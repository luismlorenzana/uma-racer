// The one sync lane (T136; docs/rework/02-check-ins-and-notifications.md §8–§9, §11): every answer reconciled in one
// transaction (applied, repeated, refused with its notice, invalid, a badge's conflict, an answer that skips a change),
// one lane in outbox order 100 at a time, its timing (the debounce, hidden, visible, online, the backoff), no retry
// after a 426, a fresh boot after a 409, and pulls that overlap by five minutes and resume from their cursor.
import 'fake-indexeddb/auto'
import { fill } from '@racer/domain/rework/check-in'
import { commitOperation, toSaveState, type EntityRow, type LogRow, type OperationEnvelope } from '@racer/domain/save-g2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { badgeKey } from './db'
import { useSave } from './store'
import { DEBOUNCE_MS, PULL_KEY, PULL_OVERLAP_MS, RETRY_EVERY_MS } from './sync'
import { refusalWords } from './words'
import {
  device, ENV, FakeServer, flairEvent, flairId, nextId, settle, trainerBadge, turn, umaId, useClock, type Device,
} from './__fixtures__/server'

beforeEach(() => useClock())
afterEach(() => vi.useRealTimers())

const store = () => useSave.getState()
const tickets = () => store().state?.profile.umaTickets
const syncs = (server: FakeServer) => server.count('/api/sync')
const pulls = (server: FakeServer) => server.count('/api/save')

async function synced(server = new FakeServer()): Promise<Device> {
  const phone = device(server)
  await settle(phone)
  return phone
}

/** The debounce runs out, and the flush it starts finishes. */
async function debounce(phone: Device): Promise<void> {
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
  await settle(phone)
}

function serverState(server: FakeServer) {
  const rows = [...server.rows.values()]
  return toSaveState(rows.filter((row): row is EntityRow => 'version' in row), rows.filter((row): row is LogRow => !('version' in row)))
}

describe('reconcile', () => {
  it("applied: the server's rows and receipt replace the local ones, and the row leaves the outbox", async () => {
    const phone = await synced()
    const answer = await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    await debounce(phone)
    expect(await phone.db.outbox.count()).toBe(0)
    expect((await phone.db.umas.get(umaId(1)))?.version).toBe(1)
    expect((await phone.db.profile.get('main'))?.version).toBe(2)
    expect(await phone.db.operations.get(answer.id)).toBeDefined()
    const receipt = store().receipts[answer.id]
    expect(receipt?.server).toEqual(receipt?.local)
    expect([tickets(), store().sync.status, store().sync.pending, store().pendingLogs]).toEqual([19, 'idle', 0, []])
    phone.session.stop()
  })

  it('repeated: a tap whose answer was lost is sent again, never paid twice, and the pull brings its rows', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    const answer = await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    server.loseNextAnswer()
    await debounce(phone)
    expect([await phone.db.outbox.count(), tickets(), store().sync.status]).toEqual([1, 19, 'offline'])
    expect(server.row<{ data: { umaTickets: number } }>('profile/main')?.data.umaTickets).toBe(19)
    phone.net.online()
    await settle(phone)
    expect(server.syncs().at(-1)?.changes).toEqual([expect.objectContaining({ type: 'operation', operation: expect.objectContaining({ id: answer.id }) })])
    expect(server.row<{ data: { umaTickets: number } }>('profile/main')?.data.umaTickets).toBe(19)
    expect([await phone.db.outbox.count(), tickets(), Object.keys(store().state!.umas)]).toEqual([0, 19, [umaId(1)]])
    expect(await phone.db.umas.get(umaId(1))).toBeDefined()
    expect(store().receipts[answer.id]?.server).toEqual(answer.kind === 'done' ? answer.receipt : null)
    phone.session.stop()
  })

  it('refused: the tap rolls back with a notice in its rule\'s words', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    const answer = await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    // The other device unlocked her first.
    const theirs: OperationEnvelope = { id: nextId(), name: 'unlock-uma', input: { outfitId: umaId(1) }, at: Date.now() }
    server.otherDevice([{ type: 'operation', operation: theirs }])
    const refused = commitOperation(serverState(server), { id: answer.id, name: 'unlock-uma', input: { outfitId: umaId(1) }, at: Date.now() }, ENV)
    if (refused.status !== 'refused') throw new Error(refused.status)
    await debounce(phone)
    expect(await phone.db.outbox.count()).toBe(0)
    expect(store().notices).toEqual([{ id: answer.id, words: refusalWords(refused.refusal), text: fill(refusalWords(refused.refusal)) }])
    expect(store().receipts[answer.id]).toBeUndefined()
    // Rolled back to what the server confirmed; the next pull brings the other device's unlock.
    expect(tickets()).toBe(20)
    phone.net.show()
    await settle(phone)
    expect([tickets(), Object.keys(store().state!.umas)]).toEqual([19, [umaId(1)]])
    phone.session.actions.dismissNotice(answer.id)
    expect(store().notices).toEqual([])
    phone.session.stop()
  })

  it("invalid: the server couldn't run it, so it says \"That didn't work. Try again.\" and leaves the outbox", async () => {
    const phone = await synced()
    const id = nextId()
    await phone.db.outbox.add({ key: `op:${id}`, change: { type: 'operation', operation: { id, name: 'unlock-uma', input: { outfitId: 7 }, at: Date.now() } }, queuedAt: Date.now() })
    phone.net.hide()
    await settle(phone)
    expect(await phone.db.outbox.count()).toBe(0)
    expect(store().notices.map((notice) => notice.text)).toEqual(["That didn't work. Try again."])
    phone.session.stop()
  })

  it("a badge conflict takes the server's copy", async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    server.otherDevice([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: trainerBadge('Ana') }])
    server.otherDevice([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 1, data: trainerBadge('Server') }])
    await phone.session.actions.writeBadge('trainer', trainerBadge('Phone'))
    await debounce(phone)
    expect(server.syncs().at(-1)?.changes).toEqual([expect.objectContaining({ type: 'upsert', id: 'trainer', baseVersion: 0 })])
    expect(await phone.db.badges.get('trainer')).toMatchObject({ version: 2, data: { preferences: { displayName: 'Server' } } })
    expect(store().badges.trainer).toEqual(trainerBadge('Server'))
    expect(await phone.db.outbox.count()).toBe(0)
    phone.session.stop()
  })

  it('a badge whose row the server lost goes again as a create', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    await phone.session.actions.writeBadge('trainer', trainerBadge('Phone'))
    await debounce(phone)
    server.rows.delete('badges/trainer')
    await phone.session.actions.writeBadge('trainer', trainerBadge('Again'))
    await debounce(phone)
    expect(server.syncs().slice(-2).map((request) => request.changes[0])).toEqual([
      expect.objectContaining({ id: 'trainer', baseVersion: 1 }), expect.objectContaining({ id: 'trainer', baseVersion: 0 }),
    ])
    expect(server.row('badges/trainer')).toMatchObject({ version: 1, data: { preferences: { displayName: 'Again' } } })
    expect(await phone.db.outbox.count()).toBe(0)
    phone.session.stop()
  })

  it('an answer that skips a change applies nothing, and the retry settles it', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    await phone.session.actions.writeBadge('trainer', trainerBadge())
    server.skipNextResult()
    await debounce(phone)
    expect([await phone.db.outbox.count(), await phone.db.umas.count(), (await phone.db.profile.get('main'))?.version]).toEqual([2, 0, 1])
    expect([store().sync.status, store().sync.words, tickets()]).toEqual(['error', "That didn't work. Try again.", 19])
    await vi.advanceTimersByTimeAsync(5_000)
    await settle(phone)
    expect([await phone.db.outbox.count(), await phone.db.umas.count(), tickets(), store().sync.status]).toEqual([0, 1, 19, 'idle'])
    expect(server.row<{ data: { umaTickets: number } }>('profile/main')?.data.umaTickets).toBe(19)
    phone.session.stop()
  })

  it('sends a badge rewritten while in flight again, with the newer data', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    await phone.session.actions.writeBadge('trainer', trainerBadge('First'))
    const release = server.hold()
    phone.net.hide()
    while (syncs(server) < 2) await turn()
    await phone.session.actions.writeBadge('trainer', trainerBadge('Second'))
    release()
    await settle(phone)
    expect((await phone.db.outbox.toArray()).map((row) => row.key)).toEqual([badgeKey('trainer')])
    expect(await phone.db.badges.get('trainer')).toMatchObject({ version: 1, data: { preferences: { displayName: 'Second' } } })
    await debounce(phone)
    expect(server.syncs().at(-1)?.changes).toEqual([expect.objectContaining({ id: 'trainer', baseVersion: 1, data: trainerBadge('Second') })])
    expect(server.row('badges/trainer')).toMatchObject({ version: 2, data: { preferences: { displayName: 'Second' } } })
    expect(await phone.db.outbox.count()).toBe(0)
    phone.session.stop()
  })
})

describe('one lane', () => {
  it('sends badges, flair and operations in outbox order, 100 at a time', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    phone.net.offline()
    const { run, writeBadge, appendFlair } = phone.session.actions
    const expected: string[] = []
    for (let n = 0; n < 150; n += 1) {
      if (n === 0) {
        await writeBadge('trainer', trainerBadge())
        expected.push('upsert:trainer')
      } else if (n % 3 === 0) {
        const event = flairEvent(n, Date.now())
        await appendFlair(event)
        expected.push(`append:${flairId(event)}`)
      } else {
        const answer = await run('set-check-in-times', { times: [n] })
        expected.push(`operation:${answer.id}`)
      }
    }
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await settle(phone)
    expect(store().sync.status).toBe('offline')
    expect(syncs(server)).toBe(1)
    phone.net.online()
    await settle(phone)
    const sent = server.syncs().slice(1)
    expect(sent.map((request) => request.changes.length)).toEqual([100, 50])
    expect(sent.flatMap((request) => request.changes).map((change) =>
      change.type === 'operation' ? `operation:${change.operation.id}` : change.type === 'create' ? 'create' : `${change.type}:${change.id}`)).toEqual(expected)
    expect(await phone.db.outbox.count()).toBe(0)
    expect(server.row<{ data: { checkIns: number[] } }>('profile/main')?.data.checkIns).toEqual([149])
    phone.session.stop()
  })
})

describe('timing', () => {
  it('flushes 1.5 s after the last write', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    const before = syncs(server)
    await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    await vi.advanceTimersByTimeAsync(1_000)
    await phone.session.actions.run('unlock-uma', { outfitId: umaId(2) })
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1)
    await settle(phone)
    expect(syncs(server)).toBe(before)
    await vi.advanceTimersByTimeAsync(1)
    await settle(phone)
    expect(syncs(server)).toBe(before + 1)
    expect(server.syncs().at(-1)?.changes).toHaveLength(2)
    phone.session.stop()
  })

  it('flushes at once when hidden, and flushes and pulls when visible or back online', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    const [s0, p0] = [syncs(server), pulls(server)]
    phone.net.hide()
    await settle(phone)
    expect([syncs(server) - s0, pulls(server) - p0]).toEqual([1, 0])
    phone.net.show()
    await settle(phone)
    expect(pulls(server) - p0).toBe(1)
    phone.net.online()
    await settle(phone)
    expect(pulls(server) - p0).toBe(2)
    phone.session.stop()
  })

  it('retries a failure after 5 s, 30 s and 2 minutes, then every 5 minutes while visible with rows waiting', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    server.failAlways(500)
    await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    await debounce(phone)
    const at = (n: number) => expect(syncs(server)).toBe(n)
    const start = syncs(server)
    expect(store().sync.status).toBe('error')
    for (const [wait, made] of [[4_999, 0], [1, 1], [29_999, 1], [1, 2], [119_999, 2], [1, 3], [RETRY_EVERY_MS, 4], [RETRY_EVERY_MS, 5]] as const) {
      await vi.advanceTimersByTimeAsync(wait)
      await settle(phone)
      at(start + made)
    }
    phone.net.hideQuietly()
    await vi.advanceTimersByTimeAsync(RETRY_EVERY_MS * 3)
    await settle(phone)
    at(start + 5)
    server.failAlways(null)
    phone.net.show()
    await settle(phone)
    expect([store().sync.status, await phone.db.outbox.count()]).toEqual(['idle', 0])
    phone.session.stop()
  })

  it('stops after a 426 and asks nothing more until the app restarts', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    server.failNext(426)
    await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    await debounce(phone)
    const made = server.fetch.mock.calls.length
    expect([store().sync.status, store().sync.words]).toEqual(['error', "That didn't work. Try again."])
    await phone.session.actions.run('unlock-uma', { outfitId: umaId(2) })
    phone.net.show()
    phone.net.online()
    phone.net.hide()
    await vi.advanceTimersByTimeAsync(60 * 60_000)
    await settle(phone)
    expect(server.fetch.mock.calls.length).toBe(made)
    expect(await phone.db.outbox.count()).toBe(2)
    expect(tickets()).toBe(18)
    phone.session.stop()
  })

  it('boots as a new device after a 409: the save and outbox are dropped and a new account is created', async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    await debounce(phone)
    expect(tickets()).toBe(19)
    server.dropSave()
    await phone.session.actions.run('unlock-uma', { outfitId: umaId(2) })
    await debounce(phone)
    await settle(phone)
    expect(server.syncs().at(-1)?.changes.map((change) => change.type)).toEqual(['create'])
    expect([store().lifecycle, tickets(), Object.keys(store().state!.umas)]).toEqual(['ready', 20, []])
    expect([await phone.db.outbox.count(), await phone.db.umas.count()]).toEqual([0, 0])
    expect(server.row<{ data: { umaTickets: number } }>('profile/main')?.data.umaTickets).toBe(20)
    phone.session.stop()
  })
})

describe('pulls', () => {
  it("start five minutes before the last pull's server time", async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    const last = server.requests.filter((request) => request.path === '/api/save').length
    const marked = JSON.parse(phone.storage.getItem(PULL_KEY)!) as { serverTime: number }
    expect(PULL_OVERLAP_MS).toBe(300_000)
    vi.advanceTimersByTime(60 * 60_000)
    phone.net.show()
    await settle(phone)
    const next = server.requests.filter((request) => request.path === '/api/save')[last]
    expect(next?.query.since).toBe(String(marked.serverTime - PULL_OVERLAP_MS))
    phone.session.stop()
  })

  it("adopt a row that committed just after the last pull's server time", async () => {
    const server = new FakeServer()
    const phone = await synced(server)
    const marked = JSON.parse(phone.storage.getItem(PULL_KEY)!) as { serverTime: number }
    // Another device's commit stamped a minute before that pull's time, but committed after it.
    const late = new FakeServer(ENV, () => marked.serverTime - 60_000)
    for (const row of server.rows.values()) late.rows.set(`${row.kind}/${row.id}`, row)
    late.otherDevice([{ type: 'operation', operation: { id: nextId(), name: 'unlock-uma', input: { outfitId: umaId(3) }, at: Date.now() } }])
    for (const [key, row] of late.rows) server.rows.set(key, row)
    vi.advanceTimersByTime(10 * 60_000)
    phone.net.show()
    await settle(phone)
    expect(Object.keys(store().state!.umas)).toEqual([umaId(3)])
    phone.session.stop()
  })

  it('resume from their cursor after a failure, and an empty database always pulls from 0', async () => {
    const server = new FakeServer()
    server.otherDevice([{ type: 'create', createdAt: Date.now() }])
    server.pageRows = 5
    const answer = server.fetch.getMockImplementation()!
    const cursors: (string | null)[] = []
    let gets = 0
    server.fetch.mockImplementation(async (input, init) => {
      if (!String(input).includes('/api/save')) return answer(input, init)
      if ((gets += 1) === 3) throw new TypeError('offline')
      const response = await answer(input, init)
      cursors.push(((await response.clone().json()) as { cursor: string | null }).cursor)
      return response
    })
    const phone = device(server)
    await settle(phone)
    // Pages 1 and 2 came, the third never answered, and the pull resumed from page 2's cursor as the save opened.
    const pulled = server.requests.filter((request) => request.path === '/api/save')
    expect(cursors[1]).toMatch(/^buildings~/)
    expect(pulled[2]?.query).toMatchObject({ since: '0', cursor: cursors[1] })
    expect(await phone.db.buildings.count()).toBe(14)
    expect(JSON.parse(phone.storage.getItem(PULL_KEY)!)).toEqual({ serverTime: expect.any(Number) })
    phone.session.stop()
    // Another device's empty database starts from 0, whatever the kept place says.
    const before = server.requests.filter((request) => request.path === '/api/save').length
    const other = device(server, { storage: phone.storage })
    await settle(other)
    expect(server.requests.filter((request) => request.path === '/api/save')[before]?.query.since).toBe('0')
    other.session.stop()
  })
})
