// Both generation-3 repositories on one script (T152): a synthetic session of creates and operations, and its pulls,
// run on the fake Firestore and on a temporary JSON file, give the same answers.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  answersRequest, parseSaveSnapshot, parseSyncRequest, parseSyncResponse, type OperationEnv, type SaveSnapshot, type SyncResponse,
} from '@racer/domain/save'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { LocalSaveRepository } from './local-save.repository'
import { NO_SAVE } from './resolve'
import type { SaveRepository } from './save.repository'
import { card, clock, DEV, ENV, FakeFirestore, op, opId, STAMP, uma } from './save.test-support'

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
  const dir = await mkdtemp(join(tmpdir(), 'racer-g3-'))
  return { repo: new LocalSaveRepository(join(dir, 'save-g3.json'), clock), cleanup: () => rm(dir, { recursive: true, force: true }) }
}

/** One sync through the domain's parsers on both sides of the wire. */
async function sync(repo: SaveRepository, changes: readonly unknown[], env: OperationEnv = DEV): Promise<SyncResponse | typeof NO_SAVE> {
  const request = parseSyncRequest(JSON.parse(JSON.stringify({ ...STAMP, changes })))
  if (typeof request === 'string') throw new Error(request)
  let loads = 0
  const response = await repo.sync('u1', request, async () => { loads += 1; return env })
  // The env loads once, and only for a request with an operation.
  expect(loads).toBe(changes.some((change) => (change as { type: string }).type === 'operation') ? 1 : 0)
  if (response === NO_SAVE) return response
  const wire = parseSyncResponse(JSON.parse(JSON.stringify(response)))
  if (typeof wire === 'string') throw new Error(wire)
  expect(answersRequest(request, response)).toBe(true)
  return response
}

/** Every page of a pull from `since`. */
async function pull(repo: SaveRepository, since = 0): Promise<SaveSnapshot[]> {
  const pages: SaveSnapshot[] = []
  let cursor: string | null = null
  do {
    const page = await repo.snapshot('u1', since, cursor)
    const parsed = parseSaveSnapshot(JSON.parse(JSON.stringify(page)))
    if (typeof parsed === 'string') throw new Error(parsed)
    pages.push(page)
    cursor = page.cursor
  } while (cursor !== null)
  return pages
}

/** A synthetic session: what each step answered. */
async function scriptedSession(repo: SaveRepository): Promise<unknown[]> {
  const answers: unknown[] = []
  const step = async (changes: readonly unknown[], env?: OperationEnv) => { answers.push(await sync(repo, changes, env)) }
  await step([op(1, 'unlock-uma', { umaId: uma(1) }, clock('06:59'))])
  await step([{ type: 'create', createdAt: clock('07:00') }, op(1, 'unlock-uma', { umaId: uma(1) }, clock('07:01')), op(2, 'unlock-uma', { umaId: uma(2) }, clock('07:02'))])
  await step([
    op(3, 'dev-grant', { umaTickets: 2, cardTickets: 3 }, clock('07:03')),
    op(4, 'unlock-card', { cardId: card(1) }, clock('07:04')),
    op(5, 'unlock-card', { cardId: card(2) }, clock('07:05')),
  ])
  answers.push(await pull(repo))
  await step([op(4, 'unlock-card', { cardId: card(1) }, clock('07:04')), op(6, 'unlock-card', { cardId: card(1) }, clock('07:06'))])
  await step([op(7, 'settle-stage', { careerId: 'x' }, clock('07:07')), op(8, 'dev-grant', { umaTickets: 1, cardTickets: 1 }, clock('07:08'))], ENV)
  await step([op(9, 'unlock-uma', { umaId: uma(3), extra: 1 }, clock('07:09')), op(10, 'unlock-uma', { umaId: uma(3) }, clock('07:10'))])
  await step([{ type: 'create', createdAt: clock('08:00') }])
  answers.push(await pull(repo))
  answers.push(await pull(repo))
  return answers
}

describe('the scripted session', () => {
  it('answers alike on Firestore and on the local file', async () => {
    const local = await backend('local')
    const firestore = await backend('firestore')
    try {
      const [a, b] = [await scriptedSession(local.repo), await scriptedSession(firestore.repo)]
      expect(b).toEqual(a)
      // And the session did what it says: no save at first, then the account, its taps and its pulls.
      expect(a[0]).toBe(NO_SAVE)
      const statuses = (n: number) => (a[n] as SyncResponse).results.map((result) => result.status)
      expect(statuses(1)).toEqual(['created', 'applied', 'applied'])
      expect(statuses(2)).toEqual(['applied', 'applied', 'applied'])
      expect(statuses(4)).toEqual(['repeated', 'refused'])
      expect((a[4] as SyncResponse).results[0]).toEqual({ ...(a[2] as SyncResponse).results[1], status: 'repeated' })
      expect(statuses(5)).toEqual(['refused', 'refused'])
      expect((a[5] as SyncResponse).results.map((result) => (result as { refusal: { code: string } }).refusal.code)).toEqual(['not-built-yet', 'dev-only'])
      expect(statuses(6)).toEqual(['invalid', 'applied'])
      expect(statuses(7)).toEqual(['exists'])
      // `exists` answers every entity: the account, three Umas and two cards.
      expect((a[7] as SyncResponse).entities.map((row) => `${row.kind}/${row.id}`)).toEqual([
        'account/main', `umas/${uma(1)}`, `umas/${uma(2)}`, `umas/${uma(3)}`, `cards/${card(1)}`, `cards/${card(2)}`,
      ])
      const last = (a[8] as SaveSnapshot[]).flatMap((page) => page.entities)
      expect(last.find((row) => row.kind === 'account')).toMatchObject({ data: { umaTickets: 19, cardTickets: 25 } })
      expect((a[8] as SaveSnapshot[]).flatMap((page) => page.logs).map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 10].map(opId))
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
      await sync(b.repo, [{ type: 'create', createdAt: clock('07:00') }])
      const all = await pull(b.repo)
      expect(all).toHaveLength(1)
      expect(all[0]!.entities.map((row) => row.kind)).toEqual(['account'])
      const since = all[0]!.serverTime
      await sync(b.repo, [op(1, 'unlock-uma', { umaId: uma(1) }, clock('07:01'))])
      const later = await pull(b.repo, since)
      expect([...later[0]!.entities, ...later[0]!.logs].map((row) => `${row.kind}/${row.id}`)).toEqual([
        'account/main', `umas/${uma(1)}`, `operations/${opId(1)}`,
      ])
      await expect(b.repo.snapshot('u1', 0, 'umas~1')).rejects.toThrow(RangeError)
    })

    it('writes nothing when an operation’s content fails to load', async () => {
      await sync(b.repo, [{ type: 'create', createdAt: clock('07:00') }])
      const before = await pull(b.repo)
      const request = parseSyncRequest({ ...STAMP, changes: [op(1, 'unlock-uma', { umaId: uma(1) }, clock('07:01'))] })
      if (typeof request === 'string') throw new Error(request)
      await expect(b.repo.sync('u1', request, async () => { throw new Error('no content') })).rejects.toThrow('no content')
      expect(await pull(b.repo)).toEqual(before.map((page) => ({ ...page, serverTime: expect.any(Number) })))
    })
  })
}
