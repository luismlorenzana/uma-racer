// A tap (T136; docs/game/02-check-ins-and-notifications.md §9): one operation, written to the outbox before the store
// publishes it; a refusal or a question writes nothing; a held busy key ignores the second tap; a reload folds to the
// same state and receipts. Badges and flair are written with their outbox key in one transaction, and the read helpers
// merge Dexie's logs with the queued taps' own.
import 'fake-indexeddb/auto'
import { fill } from '@racer/domain/check-in'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { badgeKey, flairKey, operationKey } from './db'
import { useSave } from './store'
import { device, FakeServer, flairEvent, flairId, settle, trainerBadge, turn, umaId, useClock, type Device } from './__fixtures__/server'

beforeEach(() => useClock())
afterEach(() => vi.useRealTimers())

/** A device whose network is down, so nothing it writes leaves the outbox. */
async function offlineDevice(): Promise<Device> {
  const server = new FakeServer()
  server.failAlways('offline')
  const phone = device(server)
  await settle(phone)
  return phone
}

describe('a tap', () => {
  it('writes one outbox row, and the store publishes only after Dexie commits it', async () => {
    const phone = await offlineDevice()
    const events: string[] = []
    const transaction = phone.db.transaction.bind(phone.db) as (...args: unknown[]) => Promise<unknown>
    ;(phone.db as unknown as { transaction: unknown }).transaction = (...args: unknown[]) =>
      transaction(...args).then((result) => (events.push('committed'), result))
    const stop = useSave.subscribe(() => events.push('published'))
    const answer = await phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })
    stop()
    expect(answer).toMatchObject({ kind: 'done', repeated: false })
    expect(events).toEqual(['committed', 'published'])
    const rows = await phone.db.outbox.toArray()
    expect(rows.map((row) => row.key)).toEqual(['create', operationKey(answer.id)])
    expect(rows[1]?.change).toEqual({ type: 'operation', operation: { id: answer.id, name: 'unlock-uma', input: { outfitId: umaId(1) }, at: Date.now() } })
    expect(useSave.getState().state?.umas[umaId(1)]).toBeDefined()
    expect(useSave.getState().receipts[answer.id]).toEqual({ local: answer.kind === 'done' ? answer.receipt : null })
    expect(useSave.getState().sync).toMatchObject({ pending: 2, oldestQueuedAt: Date.now() })
    phone.session.stop()
  })

  it('writes nothing for a refusal or a question, and answers the screen in plain words', async () => {
    const phone = await offlineDevice()
    const { run } = phone.session.actions
    await run('unlock-uma', { outfitId: umaId(1) })
    await run('dev-grant', { items: { carrot: 3 } })
    const before = await phone.db.outbox.count()
    const state = useSave.getState().state
    const again = await run('unlock-uma', { outfitId: umaId(1) })
    expect(again.kind).toBe('say')
    const ask = await run('start', { outfitId: umaId(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: 'chopped-carrot', count: 6 } })
    expect(ask.kind === 'ask' && fill(ask.question)).toBe('Only 3 left now. Start ×3?')
    const broken = await run('unlock-uma', { outfitId: 7 } as never)
    expect(broken.kind === 'say' && fill(broken.words)).toBe("That didn't work. Try again.")
    expect(await phone.db.outbox.count()).toBe(before)
    expect(useSave.getState().state).toBe(state)
    phone.session.stop()
  })

  it('gives a second tap on a held busy key the first one\'s answer, and runs it once', async () => {
    const phone = await offlineDevice()
    const { run } = phone.session.actions
    const first = run('unlock-uma', { outfitId: umaId(1) }, 'unlock')
    const second = run('unlock-uma', { outfitId: umaId(1) }, 'unlock')
    expect(second).toBe(first)
    const other = run('unlock-uma', { outfitId: umaId(2) }, 'other')
    await Promise.all([first, other])
    expect(await phone.db.outbox.count()).toBe(3)
    // Released once answered: the next tap with the key runs again.
    expect((await run('unlock-uma', { outfitId: umaId(1) }, 'unlock')).kind).toBe('say')
    phone.session.stop()
  })

  it('folds to the same state and receipts after a reload', async () => {
    const phone = await offlineDevice()
    const { run } = phone.session.actions
    await run('unlock-uma', { outfitId: umaId(1) })
    await run('unlock-uma', { outfitId: umaId(2) })
    await run('set-check-in-times', { times: [420, 1260] })
    const { state, receipts, pendingLogs } = useSave.getState()
    phone.session.stop()
    const reloaded = device(phone.server, { db: phone.db, storage: phone.storage })
    await reloaded.session.opened
    expect(useSave.getState().state).toEqual(state)
    expect(useSave.getState().receipts).toEqual(receipts)
    expect(useSave.getState().pendingLogs).toEqual(pendingLogs)
    reloaded.session.stop()
  })

  it("refuses a tap before the save opens", async () => {
    const server = new FakeServer()
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    const answer = server.fetch.getMockImplementation()!
    server.fetch.mockImplementation(async (input, init) => (await held, answer(input, init)))
    const phone = device(server)
    await expect(phone.session.actions.run('unlock-uma', { outfitId: umaId(1) })).rejects.toThrow('The game is still opening.')
    release()
    await settle(phone)
    phone.session.stop()
  })
})

describe('badges and flair', () => {
  it('writes a badge with its outbox key in one transaction, coalesced, and publishes it', async () => {
    const phone = await offlineDevice()
    await phone.session.actions.writeBadge('trainer', trainerBadge('Hana'))
    await phone.session.actions.writeBadge('trainer', trainerBadge('Hanako'))
    expect((await phone.db.outbox.toArray()).filter((row) => row.key === badgeKey('trainer'))).toHaveLength(1)
    expect(await phone.db.badges.get('trainer')).toMatchObject({ version: 0, savedAt: 0, data: { preferences: { displayName: 'Hanako' } } })
    expect(useSave.getState().badges.trainer).toEqual(trainerBadge('Hanako'))
    await expect(phone.session.actions.writeBadge('uma:nobody', trainerBadge())).rejects.toThrow(RangeError)
    phone.session.stop()
  })

  it('appends a flair event once: the first write wins', async () => {
    const phone = await offlineDevice()
    const event = flairEvent(1, Date.now())
    expect(await phone.session.actions.appendFlair(event)).toBe(true)
    expect(await phone.session.actions.appendFlair({ ...event, earnedAt: event.earnedAt + 5 })).toBe(false)
    expect(await phone.db.flairEvents.get(flairId(event))).toMatchObject({ at: event.earnedAt, savedAt: 0, data: event })
    expect((await phone.db.outbox.toArray()).filter((row) => row.key === flairKey(flairId(event)))).toHaveLength(1)
    phone.session.stop()
  })
})

describe('the read helpers', () => {
  it("merge Dexie's logs with the queued taps' own, by time", async () => {
    const server = new FakeServer()
    const phone = device(server)
    await settle(phone)
    vi.advanceTimersByTime(60_000)
    const { run, ledgerRows, receipt } = phone.session.actions
    const synced = await run('unlock-uma', { outfitId: umaId(1) })
    await vi.advanceTimersByTimeAsync(1_500)
    await settle(phone)
    server.failAlways('offline')
    vi.advanceTimersByTime(60_000)
    const queued = await run('unlock-uma', { outfitId: umaId(2) })
    await turn()
    const ledger = await ledgerRows()
    expect(ledger.map((row) => row.reason)).toEqual(['initial-uma-tickets', 'unlock-uma', 'unlock-uma'])
    expect(ledger.map((row) => row.at)).toEqual([...ledger.map((row) => row.at)].sort((a, b) => a - b))
    expect(await receipt(queued.id)).toEqual(queued.kind === 'done' ? queued.receipt : null)
    // The store keeps the latest receipts; an older one is read from Dexie's operations log.
    useSave.setState({ receipts: {} })
    expect(await receipt(synced.id)).toEqual(synced.kind === 'done' ? synced.receipt : null)
    expect(await phone.session.actions.raceResults(umaId(1))).toEqual([])
    phone.session.stop()
  })
})

describe("a tap's device rows (T141)", () => {
  it("writes them in the tap's own transaction, behind its outbox row, with the records they were computed from", async () => {
    const phone = await offlineDevice()
    const { run, writeDevice, allRaceResults, flairEvents } = phone.session.actions
    const event = flairEvent(2, Date.now())
    const seen: unknown[] = []
    const answer = await run('unlock-uma', { outfitId: umaId(1) }, undefined, {
      device: (applied) => {
        seen.push(applied.records)
        return { badges: { trainer: trainerBadge('Hana') }, flairEvents: [event] }
      },
    })
    expect(answer.kind).toBe('done')
    expect(seen).toEqual([{ badges: {}, raceResults: {}, flairEvents: {} }])
    const keys = (await phone.db.outbox.toArray()).map((row) => row.key)
    expect(keys).toEqual(['create', operationKey(answer.id), badgeKey('trainer'), flairKey(flairId(event))])
    expect(useSave.getState().badges.trainer).toEqual(trainerBadge('Hana'))
    expect(useSave.getState().sync.pending).toBe(4)
    expect(await flairEvents()).toEqual([event])
    expect(await allRaceResults()).toEqual([])
    await writeDevice({ flairEvents: [event, flairEvent(3, Date.now())] })
    expect((await flairEvents()).map((row) => row.awardKey)).toEqual(['achievement-2', 'achievement-3'])
    phone.session.stop()
  })

  it('writes nothing, the tap included, when the device callback throws', async () => {
    const phone = await offlineDevice()
    const before = await phone.db.outbox.count()
    const state = useSave.getState().state
    const failing = { device: () => { throw new Error('flair') } }
    await expect(phone.session.actions.run('unlock-uma', { outfitId: umaId(1) }, undefined, failing)).rejects.toThrow('flair')
    expect(await phone.db.outbox.count()).toBe(before)
    expect(useSave.getState().state).toBe(state)
    phone.session.stop()
  })
})
