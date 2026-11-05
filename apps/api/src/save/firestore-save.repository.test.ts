// The Firestore repository on a strict fake (T152): the `g3/{uid}` layout and codec, one transaction with every read
// before the first write, the read set, atomicity and the pull's queries.
import { beforeEach, describe, expect, it } from 'vitest'
import { parseSyncRequest, type SyncRequest } from '@racer/domain/save'
import { FirestoreSaveRepository, SAVE_ROOT } from './firestore-save.repository'
import { NO_SAVE } from './resolve'
import { card, clock, ENV, FakeFirestore, op, opId, STAMP, uma } from './save.test-support'

function request(changes: readonly unknown[]): SyncRequest {
  const parsed = parseSyncRequest(JSON.parse(JSON.stringify({ ...STAMP, changes })))
  if (typeof parsed === 'string') throw new Error(parsed)
  return parsed
}

let fake: FakeFirestore
let repo: FirestoreSaveRepository
let now: number
beforeEach(() => {
  fake = new FakeFirestore()
  now = 1_800_000_000_000
  repo = new FirestoreSaveRepository(fake.asFirestore, () => (now += 1_000))
})

const sync = (changes: readonly unknown[], env = ENV) => repo.sync('u1', request(changes), async () => env)
const paths = (prefix: string) => [...fake.docs.keys()].filter((path) => path.startsWith(prefix)).sort()

async function account(): Promise<void> {
  await sync([{ type: 'create', createdAt: clock('07:00') }, op(1, 'unlock-uma', { umaId: uma(1) }, clock('07:01'))])
}

describe('the layout', () => {
  it('keeps rows at g3/{uid}/{kind}/{id} and reads them back whole', async () => {
    expect(SAVE_ROOT).toBe('g3')
    await account()
    expect([...fake.docs.keys()].sort()).toEqual(['g3/u1/account/main', `g3/u1/operations/${opId(1)}`, `g3/u1/umas/${uma(1)}`])
    // The create and the unlock in one sync write the account once.
    expect(fake.docs.get('g3/u1/account/main')).toEqual({
      kind: 'account', id: 'main', generation: 3, schema: 1, version: 1, savedAt: now, data: { createdAt: clock('07:00'), umaTickets: 19, cardTickets: 24 },
    })
    const page = await repo.snapshot('u1', 0, null)
    expect([...page.entities, ...page.logs].map((row) => fake.docs.get(`g3/u1/${row.kind}/${row.id}`))).toEqual([...page.entities, ...page.logs])
    expect(paths('saves')).toEqual([])
    expect(paths('players')).toEqual([])
  })

  it('stores a row with an array inside an array as dataJson, and reads it back through the codec', async () => {
    await account()
    // A receipt that holds a nested array (as a race's skill conditions do) is stored as text and pulled back whole.
    const receipt = { lines: [[1, 2], [3]] }
    fake.docs.set(`g3/u1/operations/${opId(9)}`, {
      kind: 'operations', id: opId(9), generation: 3, schema: 1, at: 5, savedAt: now, dataJson: JSON.stringify({ name: 'unlock-uma', at: 5, receipt }),
    })
    const page = await repo.snapshot('u1', 0, null)
    expect(page.logs.find((row) => row.id === opId(9))).toMatchObject({ data: { receipt } })
    // A retried id reads its row through the codec and answers with its receipt.
    const again = await sync([op(9, 'unlock-uma', { umaId: uma(2) }, 6)])
    expect(again).toMatchObject({ results: [{ status: 'repeated', receipt }] })
  })
})

describe('a sync', () => {
  it('reads every entity kind and the request’s operation rows, all before the first write', async () => {
    await account()
    fake.log.length = 0
    await sync([op(2, 'unlock-card', { cardId: card(1) }, clock('08:00'))])
    const reads = fake.log.filter((line) => line.startsWith('query') || line.startsWith('getAll'))
    expect(reads.sort()).toEqual([
      `getAll g3/u1/operations/${opId(2)}`, 'query g3/u1/account', 'query g3/u1/bonds', 'query g3/u1/cards', 'query g3/u1/careers', 'query g3/u1/umas',
    ])
    // Every read comes before the first write (the fake throws on a read after one).
    const firstSet = fake.log.findIndex((line) => line.startsWith('set'))
    expect(firstSet).toBeGreaterThan(0)
    expect(fake.log.slice(firstSet).every((line) => line.startsWith('set'))).toBe(true)
    expect(fake.log.slice(firstSet).sort()).toEqual(['set g3/u1/account/main', `set g3/u1/cards/${card(1)}`, `set g3/u1/operations/${opId(2)}`])
  })

  it('reads account/main alone for an empty request', async () => {
    await account()
    fake.log.length = 0
    expect(await sync([])).toMatchObject({ results: [], entities: [], logs: [] })
    expect(fake.log).toEqual(['transaction', 'getAll g3/u1/account/main'])
  })

  it('writes nothing for a repeat, a refusal or an invalid input', async () => {
    await account()
    const before = new Map(fake.docs)
    fake.log.length = 0
    const response = await sync([
      op(1, 'unlock-uma', { umaId: uma(1) }, clock('08:00')),
      op(2, 'unlock-uma', { umaId: uma(1) }, clock('08:01')),
      op(3, 'unlock-uma', { umaId: 7 }, clock('08:02')),
    ])
    expect(response).toMatchObject({ results: [{ status: 'repeated' }, { status: 'refused' }, { status: 'invalid' }] })
    expect(fake.log.some((line) => line.startsWith('set'))).toBe(false)
    expect(fake.docs).toEqual(before)
  })

  it('writes nothing when a write or the commit fails', async () => {
    await account()
    const before = new Map(fake.docs)
    fake.failAt = 1
    await expect(sync([op(2, 'unlock-uma', { umaId: uma(2) }, clock('08:00'))])).rejects.toThrow('Synthetic write failure')
    fake.failAt = 'commit'
    await expect(sync([op(2, 'unlock-uma', { umaId: uma(2) }, clock('08:00'))])).rejects.toThrow('Synthetic commit failure')
    expect(fake.docs).toEqual(before)
    fake.failAt = null
    expect(await sync([op(2, 'unlock-uma', { umaId: uma(2) }, clock('08:00'))])).toMatchObject({ results: [{ status: 'applied' }] })
  })

  it('answers NO_SAVE with nothing written when there is no save and no create', async () => {
    expect(await sync([op(1, 'unlock-uma', { umaId: uma(1) }, 5)])).toBe(NO_SAVE)
    expect(await sync([])).toBe(NO_SAVE)
    expect(fake.docs.size).toBe(0)
  })

  it('keeps each uid to its own save', async () => {
    await account()
    await repo.sync('u2', request([{ type: 'create', createdAt: 1 }]), async () => ENV)
    expect(paths('g3/u2')).toEqual(['g3/u2/account/main'])
    expect((await repo.snapshot('u2', 0, null)).entities.map((row) => row.kind)).toEqual(['account'])
  })
})

describe('the pull', () => {
  it('queries each kind from the cursor on, after since, with one row past a page', async () => {
    await account()
    fake.log.length = 0
    const page = await repo.snapshot('u1', 0, null)
    expect(fake.log).toEqual(['account', 'umas', 'cards', 'careers', 'bonds', 'operations', 'raceResults'].map((kind) => `query g3/u1/${kind}`))
    expect(page.cursor).toBeNull()
    // Resuming inside `umas` skips the kinds before it.
    fake.log.length = 0
    await repo.snapshot('u1', 0, `umas~${now}~${uma(1)}`)
    expect(fake.log[0]).toBe('query g3/u1/umas')
    expect(fake.log).toHaveLength(6)
  })
})
