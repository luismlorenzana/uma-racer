// Both generation-2 repositories on one script (T135): a synthetic day of creates, device rows and operations, its
// pulls, run on the fake Firestore and on a temporary JSON file, give the same answers.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTrainerBadgeState, flairEventId } from '@racer/domain'
import { buyPrice, sellPrice } from '@racer/domain/economy'
import { craftedItem, rawItem } from '@racer/domain/items'
import {
  answersRequest, parseSaveSnapshotV2, parseSyncRequestV2, parseSyncResponseV2, type OperationEnv, type SaveSnapshotV2, type SyncResponseV2,
} from '@racer/domain/save'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { NO_SAVE } from './resolve'
import type { SaveRepository } from './save.repository'
import { FakeFirestore, saveFixtures, type SaveFixtures } from './save.test-support'

let F: SaveFixtures
beforeAll(async () => { F = await saveFixtures() })

const STAMP = { protocol: 2, generation: 2 } as const
const VEG = rawItem('vegetables', 1).id
const CHOPPED = craftedItem('vegetables', 1).id
const FLAIR_ID = flairEventId('trainer', null, 'synthetic-award', 'bronze')

/** A clock that moves a second a call, the same on both backends. */
function ticking(start = 1_800_000_000_000): () => number {
  let now = start
  return () => (now += 1_000)
}

interface Backend {
  readonly repo: SaveRepository
  readonly cleanup: () => Promise<void>
}

async function backend(kind: 'local' | 'firestore', clock = ticking()): Promise<Backend & { fake?: FakeFirestore }> {
  if (kind === 'firestore') {
    const fake = new FakeFirestore()
    return { repo: new FirestoreSaveRepository(fake.asFirestore, clock), fake, cleanup: async () => undefined }
  }
  const dir = await mkdtemp(join(tmpdir(), 'racer-g2-'))
  return { repo: new LocalSaveRepository(join(dir, 'save-g2.json'), clock), cleanup: () => rm(dir, { recursive: true, force: true }) }
}

const op = (n: number, name: string, input: unknown, at: number) => ({ type: 'operation', operation: { id: F.opId(n), name, input, at } })

/** One sync through T134's parsers on both sides of the wire. */
async function sync(repo: SaveRepository, changes: readonly unknown[], env: OperationEnv = F.DEV): Promise<SyncResponseV2 | typeof NO_SAVE> {
  const request = parseSyncRequestV2(JSON.parse(JSON.stringify({ ...STAMP, changes })))
  if (typeof request === 'string') throw new Error(request)
  let loads = 0
  const response = await repo.sync('u1', request, async () => { loads += 1; return env })
  // The env loads once, and only for a request with an operation.
  expect(loads).toBe(changes.some((change) => (change as { type: string }).type === 'operation') ? 1 : 0)
  if (response === NO_SAVE) return response
  const wire = parseSyncResponseV2(JSON.parse(JSON.stringify(response)))
  if (typeof wire === 'string') throw new Error(wire)
  expect(answersRequest(request, response)).toBe(true)
  return response
}

/** Every page of a pull from `since`. */
async function pull(repo: SaveRepository, since = 0): Promise<SaveSnapshotV2[]> {
  const pages: SaveSnapshotV2[] = []
  let cursor: string | null = null
  do {
    const page = await repo.snapshot('u1', since, cursor)
    const parsed = parseSaveSnapshotV2(JSON.parse(JSON.stringify(page)))
    if (typeof parsed === 'string') throw new Error(parsed)
    pages.push(page)
    cursor = page.cursor
  } while (cursor !== null)
  return pages
}

/** A synthetic day: what each step answered. */
async function scriptedDay(repo: SaveRepository): Promise<unknown[]> {
  const answers: unknown[] = []
  const step = async (changes: readonly unknown[], env?: OperationEnv) => { answers.push(await sync(repo, changes, env)) }
  await step([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: createTrainerBadgeState(1) }])
  await step([
    { type: 'create', createdAt: F.clock('07:00') },
    { type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 0, data: createTrainerBadgeState(F.clock('07:00')) },
    { type: 'append', kind: 'flairEvents', id: FLAIR_ID, at: F.clock('07:00'), data: {
      version: 1, scope: 'trainer', umaId: null, kind: 'trainer-achievement', awardKey: 'synthetic-award', stage: 'bronze', earnedAt: F.clock('07:00'),
      source: { kind: 'race', id: 'race:synthetic:0', tier: 1 }, retroactive: false,
    } },
  ])
  await step([op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('07:01')), op(2, 'unlock-uma', { outfitId: F.uma(2) }, F.clock('07:02'))])
  await step([
    op(3, 'dev-grant', { prizeMoney: 3_000 }, F.clock('07:03')),
    op(4, 'buy', { sku: VEG, qty: 6, unitPrice: buyPrice(VEG) }, F.clock('07:04')),
    op(5, 'start', { outfitId: F.uma(2), slot: { building: 'vegetable-garden', slot: 0 }, request: { kind: 'gather', item: VEG, count: 2 } }, F.clock('07:05')),
    op(6, 'start', { outfitId: F.uma(1), slot: { building: 'pantry', slot: 0 }, request: { kind: 'craft', item: CHOPPED, count: 2 } }, F.clock('07:06')),
  ])
  answers.push(await pull(repo))
  await step([op(7, 'collect-all', {}, F.clock('14:00'))])
  await step([op(7, 'collect-all', {}, F.clock('14:00')), op(8, 'repeat', {}, F.clock('14:05'))])
  await step([op(9, 'sell', { itemId: CHOPPED, qty: 1, unitPrice: sellPrice(CHOPPED) }, F.clock('14:06')), op(10, 'dev-grant', { prizeMoney: 1 }, F.clock('14:07'))], F.ENV)
  await step([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 1, data: createTrainerBadgeState(F.clock('14:10')) }])
  await step([{ type: 'upsert', kind: 'badges', id: 'trainer', baseVersion: 1, data: createTrainerBadgeState(F.clock('14:11')) }])
  answers.push(await pull(repo))
  answers.push(await pull(repo))
  return answers
}

describe('the scripted day', () => {
  it('answers alike on Firestore and on the local file', async () => {
    const local = await backend('local')
    const firestore = await backend('firestore')
    try {
      const [a, b] = [await scriptedDay(local.repo), await scriptedDay(firestore.repo)]
      expect(b).toEqual(a)
      // And the day did what it says: no save at first, then the account, its taps and its pulls.
      expect(a[0]).toBe(NO_SAVE)
      const statuses = (n: number) => (a[n] as SyncResponseV2).results.map((result) => result.status)
      expect(statuses(1)).toEqual(['created', 'applied', 'appended'])
      expect(statuses(3)).toEqual(['applied', 'applied', 'applied', 'applied'])
      expect(statuses(5)).toEqual(['applied'])
      expect(statuses(6)).toEqual(['repeated', 'applied'])
      expect((a[6] as SyncResponseV2).results[0]).toEqual({ ...(a[5] as SyncResponseV2).results[0], status: 'repeated' })
      expect(statuses(7)).toEqual(['applied', 'refused'])
      expect(statuses(8)).toEqual(['applied'])
      expect(statuses(9)).toEqual(['conflict'])
      expect(a[11]).toEqual(expect.any(Array))
    } finally {
      await local.cleanup()
      await firestore.cleanup()
    }
  })
})

for (const kind of ['local', 'firestore'] as const) {
  describe(`the ${kind} repository`, () => {
    let b: Backend & { fake?: FakeFirestore }
    beforeEach(async () => { b = await backend(kind) })
    afterEach(async () => b.cleanup())

    it('pulls a save page by page, resumes at the cursor, and filters by since', async () => {
      await sync(b.repo, [{ type: 'create', createdAt: F.clock('07:00') }])
      const all = await pull(b.repo)
      expect(all).toHaveLength(1)
      expect(all[0]!.entities.map((row) => row.kind)).toEqual(['profile', ...Array(14).fill('buildings')])
      const since = all[0]!.serverTime
      await sync(b.repo, [op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('07:01'))])
      const later = await pull(b.repo, since)
      expect([...later[0]!.entities, ...later[0]!.logs].map((row) => `${row.kind}/${row.id}`)).toEqual([
        'profile/main', `umas/${F.uma(1)}`, `ledger/unlock-uma:${F.uma(1)}`, `operations/${F.opId(1)}`,
      ])
      await expect(b.repo.snapshot('u1', 0, 'umas~1')).rejects.toThrow(RangeError)
    })

    it('writes nothing when an operation’s content fails to load', async () => {
      await sync(b.repo, [{ type: 'create', createdAt: F.clock('07:00') }])
      const before = await pull(b.repo)
      const request = parseSyncRequestV2({ ...STAMP, changes: [op(1, 'unlock-uma', { outfitId: F.uma(1) }, F.clock('07:01'))] })
      if (typeof request === 'string') throw new Error(request)
      await expect(b.repo.sync('u1', request, async () => { throw new Error('no content') })).rejects.toThrow('no content')
      expect(await pull(b.repo)).toEqual(before.map((page) => ({ ...page, serverTime: expect.any(Number) })))
    })
  })
}
