// The Firestore repository on a strict fake (T135): the layout and codec, one transaction with every read before the
// first write, the read set, atomicity and the pull's queries.
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTrainerBadgeState } from '@racer/domain'
import { rawItem } from '@racer/domain/items'
import { parseSyncRequestV2, type SyncRequestV2 } from '@racer/domain/save'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { NO_SAVE } from './resolve'
import { FakeFirestore, saveFixtures, type SaveFixtures } from './save.test-support'

let F: SaveFixtures
beforeAll(async () => { F = await saveFixtures() })

const STAMP = { protocol: 2, generation: 2 } as const
const VEG = rawItem('vegetables', 1).id

function request(changes: readonly unknown[]): SyncRequestV2 {
  const parsed = parseSyncRequestV2(JSON.parse(JSON.stringify({ ...STAMP, changes })))
  if (typeof parsed === 'string') throw new Error(parsed)
  return parsed
}
const op = (n: number, name: string, input: unknown, at: number) => ({ type: 'operation', operation: { id: F.opId(n), name, input, at } })

let fake: FakeFirestore
let repo: FirestoreSaveRepository
let now: number
beforeEach(() => {
  fake = new FakeFirestore()
  now = 1_800_000_000_000
  repo = new FirestoreSaveRepository(fake.asFirestore, () => (now += 1_000))
})

const sync = (changes: readonly unknown[], env = F.ENV) => repo.sync('u1', request(changes), async () => env)
const paths = (prefix: string) => [...fake.docs.keys()].filter((path) => path.startsWith(prefix)).sort()

async function account(): Promise<void> {
  await sync([{ type: 'create', createdAt: F.clock('07:00') }, op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('07:01'))])
}

describe('the layout', () => {
  it('keeps rows at saves/{uid}/{kind}/{id}, a work row with nested arrays as dataJson, and reads it back whole', async () => {
    await account()
    await sync([op(2, 'start', { outfitId: F.uma(1), slot: { building: 'vegetable-garden', slot: 0 }, request: { kind: 'gather', item: VEG, count: 2 } }, F.clock('07:02'))])
    expect(paths('saves/u1/profile')).toEqual(['saves/u1/profile/main'])
    expect(paths('saves/u1/buildings')).toHaveLength(14)
    const stored = fake.docs.get(`saves/u1/work/${F.uma(1)}`)!
    expect(stored).toMatchObject({ kind: 'work', id: F.uma(1), generation: 2, schema: 1, version: 1, dataJson: expect.any(String) })
    expect(stored).not.toHaveProperty('data')
    const page = await repo.snapshot('u1', 0, null)
    const work = page.entities.find((row) => row.kind === 'work')!
    expect(work.data).toEqual(JSON.parse(stored.dataJson as string))
    expect(work.kind === 'work' && work.data.entries[0]!.inputs).toEqual([[], []])
    // A collect re-reads the row through the codec and runs on it.
    const collected = await sync([op(3, 'collect', { outfitId: F.uma(1) }, F.clock('20:00'))])
    expect(collected).not.toBe(NO_SAVE)
    expect(fake.docs.get(`saves/u1/items/${VEG}`)).toMatchObject({ data: { count: 2 } })
    expect(paths('players')).toEqual([])
  })
})

describe('a sync', () => {
  it('reads only its read set: a badge reads its document and profile/main', async () => {
    await account()
    fake.log.length = 0
    await sync([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: createTrainerBadgeState(1) }])
    expect(fake.log).toEqual(['transaction', 'getAll saves/u1/profile/main saves/u1/badges/trainer', 'set saves/u1/badges/trainer'])
  })

  it('reads the operation set for an operation, and never a log it does not need', async () => {
    await account()
    fake.log.length = 0
    await sync([op(2, 'collect-all', {}, F.clock('08:00'))])
    const reads = fake.log.filter((line) => line.startsWith('query') || line.startsWith('getAll'))
    expect(reads.sort()).toEqual([
      `getAll saves/u1/operations/${F.opId(2)}`, 'query saves/u1/buildings', 'query saves/u1/items', 'query saves/u1/ledger', 'query saves/u1/profile',
      'query saves/u1/umas', 'query saves/u1/work',
    ])
    // Every read comes before the first write (the fake throws on a read after one).
    const firstSet = fake.log.findIndex((line) => line.startsWith('set'))
    expect(fake.log.slice(firstSet).every((line) => line.startsWith('set'))).toBe(true)
  })

  it('writes nothing when a write or the commit fails', async () => {
    await account()
    const before = new Map(fake.docs)
    fake.failAt = 1
    await expect(sync([op(2, 'unlock-uma', { outfitId: F.uma(2) }, F.clock('08:00'))])).rejects.toThrow('Synthetic write failure')
    fake.failAt = 'commit'
    await expect(sync([op(2, 'unlock-uma', { outfitId: F.uma(2) }, F.clock('08:00'))])).rejects.toThrow('Synthetic commit failure')
    expect(fake.docs).toEqual(before)
    fake.failAt = null
    expect(await sync([op(2, 'unlock-uma', { outfitId: F.uma(2) }, F.clock('08:00'))])).toMatchObject({ results: [{ status: 'applied' }] })
  })

  it('answers NO_SAVE with nothing written when there is no save and no create', async () => {
    expect(await sync([op(1, 'unlock-uma', { outfitId: F.uma(1) }, 5)])).toBe(NO_SAVE)
    expect(fake.docs.size).toBe(0)
  })
})

describe('the pull', () => {
  it('queries each kind from the cursor on, after since, with one row past a page', async () => {
    await account()
    fake.log.length = 0
    const page = await repo.snapshot('u1', 0, null)
    expect(fake.log).toHaveLength(11)
    expect(page.cursor).toBeNull()
    // Resuming inside `umas` skips the kinds before it.
    fake.log.length = 0
    await repo.snapshot('u1', 0, `umas~${now}~${F.uma(1)}`)
    expect(fake.log[0]).toBe('query saves/u1/umas')
    expect(fake.log).toHaveLength(9)
    // `meta` is not a kind, so the purge's marker never comes back.
    const audit = { generation: 2, at: now, collections: 3, documents: 5 }
    fake.docs.set('saves/u1/meta/purge', audit)
    const after = await repo.snapshot('u1', 0, null)
    expect([...after.entities, ...after.logs].some((row) => (row.kind as string) === 'meta')).toBe(false)
    await sync([op(8, 'set-repeat-sizing', { sizing: 'fit' }, now)])
    expect(fake.docs.get('saves/u1/meta/purge')).toEqual(audit)
    expect(fake.log.some((line) => line.includes('/meta/'))).toBe(false)
  })
})
