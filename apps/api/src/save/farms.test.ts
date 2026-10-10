// Private/cloud-free adapter parity and atomicity: invented fixtures, tmp files and strict fake Firestore.
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { AuthGuard } from '../auth/auth.guard'
import { LocalSaveRepository } from './local-save.repository'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { toStored } from './firestore-codec'
import { parseEntityData, parseLogData, parseSyncRequest, type EntityRecord, type SyncRequest } from './save.types'
import { farmCanonical, farmBytes, FARM_SYNC_LIMITS, farmOperationReferences, parseFarmOperation, resolveFarmOperations, parseFarmOperationResponses,
  type FarmOperationV1, type FarmPayloadV1, type FarmStoredEntity, type FarmStoredLog } from './farms'
import { puzzleSyncReadSet, resolveSyncWithPuzzles } from './puzzle-sync'
import { SaveController } from './save.controller'
interface Fixture { generation: string; entities: Map<string, FarmStoredEntity>; logs: Map<string, FarmStoredLog>;
  operation(payload: FarmPayloadV1, id?: string, now?: number, dependencies?: string[]): FarmOperationV1;
  apply(op: FarmOperationV1, now?: number): ReturnType<typeof resolveFarmOperations> }
const source = resolve(process.cwd(), '../../packages/domain/src/farm/kitchen')
async function fixture(): Promise<Fixture> { const module: { farmProtocolFixture(): Fixture } = await import(`${source}/protocol-fixtures.ts`); return module.farmProtocolFixture() }
class Ref { constructor(readonly path: string, private readonly db: FakeFirestore) {} collection(name: string) { return new Collection(`${this.path}/${name}`, this.db) } }
class Collection {
  constructor(readonly path: string, private readonly db: FakeFirestore) {}
  doc(id: string) { return new Ref(`${this.path}/${id}`, this.db) }
  async get() { return { docs: [...this.db.docs].filter(([p]) => p.startsWith(`${this.path}/`) && !p.slice(this.path.length + 1).includes('/')).map(([, data]) => ({ data: () => structuredClone(data) })) } }
}
class FakeFirestore {
  docs = new Map<string, Record<string, unknown>>(); failAt = -1; reads = 0
  private queue: Promise<unknown> = Promise.resolve()
  collection(name: string) { return new Collection(name, this) }
  async runTransaction<T>(fn: (tx: { getAll(...refs: Ref[]): Promise<{ exists: boolean; data(): Record<string, unknown> }[]>; set(ref: Ref, data: Record<string, unknown>): void }) => Promise<T>) {
    const run = this.queue.then(async () => {
      const writes = new Map<string, Record<string, unknown>>(); let writing = false, n = 0
      const result = await fn({ getAll: async (...refs) => {
        if (writing) throw new Error('Read after write'); this.reads += refs.length
        return refs.map(ref => ({ exists: this.docs.has(ref.path), data: () => structuredClone(this.docs.get(ref.path)!) }))
      }, set: (ref, data) => { writing = true; if (n++ === this.failAt) throw new Error('Synthetic commit failure'); writes.set(ref.path, structuredClone(data)) } })
      for (const [key, value] of writes) this.docs.set(key, value); return result
    })
    this.queue = run.catch(() => undefined); return run
  }
}
const req = (ops: FarmOperationV1[]): SyncRequest => ({ upserts: [], appends: [], farmProtocolVersion: 1, farmOperations: ops })
const start: FarmPayloadV1 = { kind: 'start', stationId: 'garden-1', outfitId: 'invented-0', recipeId: 'farm:raw:ura-finale:vegetable:speed', quantity: 1, choices: {} }
for (const backend of ['local', 'firestore'] as const) describe(`${backend} Farm semantic lane`, () => {
  let f: Fixture, dir: string, file: string, fake: FakeFirestore, repo: LocalSaveRepository | FirestoreSaveRepository
  beforeEach(async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000); f = await fixture(); dir = await mkdtemp(join(tmpdir(), 'racer-farm-sync-')); file = join(dir, 'save.json'); fake = new FakeFirestore()
    const data = { entities: Object.fromEntries(f.entities), logs: Object.fromEntries(f.logs) }
    await writeFile(file, JSON.stringify({ owner: data }))
    for (const [k, row] of [...f.entities, ...f.logs]) fake.docs.set(`players/owner/${k}`, toStored(row))
    repo = backend === 'local' ? new LocalSaveRepository(file, false, undefined, true) : new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0], false, undefined, true)
  })
  afterEach(async () => { vi.restoreAllMocks(); await rm(dir, { recursive: true, force: true }) })
  it('matches the pure resolver including receipts, logs and authoritative data, with reads before writes', async () => {
    const operation = f.operation(start), expected = f.apply(operation), response = await repo.sync('owner', req([operation]))
    expect(response.farmOperations).toEqual(expected.responses); expect(parseFarmOperationResponses(response.farmOperations, [operation])).not.toBeNull()
    const snapshot = await repo.load('owner')
    expect(snapshot.entities.map(r => `${r.kind}/${r.id}`).sort()).toEqual([...expected.entities.keys()].sort())
    expect(snapshot.logs).toEqual(expected.appends)
    const repeat = await repo.sync('owner', req([operation])); expect(repeat.farmOperations![0]).toMatchObject({ status: 'duplicate', receipt: response.farmOperations![0]!.receipt })
    expect(fake.reads).toBeLessThan(200)
  })
  it('serializes two devices and never allows an outfit/account to be borrowed', async () => {
    const results = await Promise.all(['a', 'b'].map(id => repo.sync('owner', req([f.operation(start, id)]))))
    expect(results.map(r => r.farmOperations![0]!.status)).toEqual(['applied', 'rejected'])
    expect((await repo.load('owner')).logs.filter(l => l.kind === 'farmOperations')).toHaveLength(1)
    expect((await repo.sync('another-account', req([f.operation(start, 'foreign')]))).farmOperations![0]!.status).toBe('rejected')
  })
  it('allows unrelated stock/card/race-build writes and visibly guards retired Extra and old clients', async () => {
    const uma = f.entities.get('umas/invented-0')! as EntityRecord
    const request: SyncRequest = { upserts: [{ kind: 'umas', id: uma.id, baseVersion: 1, data: { ...uma.data, activePreset: 'long' } }], appends: [] }
    await expect(repo.sync('owner', request)).rejects.toThrow(/refresh/)
    expect((await repo.sync('owner', { ...request, farmProtocolVersion: 1 })).applied).toHaveLength(1)
    const retired = structuredClone(request.upserts[0]!), scenarios = retired.data.scenarios as { extraStatsUnlocked: { speed: number } }[]
    scenarios[0]!.extraStatsUnlocked.speed = 1; retired.baseVersion = 2
    await expect(repo.sync('owner', { ...request, farmProtocolVersion: 1, upserts: [retired] })).rejects.toThrow(/retired Extra/)
    const item = { kind: 'items' as const, id: 'invented:other-mode', baseVersion: 0, data: { itemId: 'invented:other-mode', quantity: 7, updatedAt: 1000 } }
    const blocked = f.operation({ kind: 'grant-energy' }, 'blocked', 1000, ['missing'])
    expect(await repo.sync('owner', { ...req([blocked]), upserts: [item] })).toMatchObject({ applied: [{ kind: 'items', id: item.id }], farmOperations: [{ status: 'blocked' }] })
    for (const row of [{ ...item, id: 'farm:energy', data: { itemId: 'farm:energy', quantity: 500, updatedAt: 1000 } },
      { kind: 'farm' as const, id: 'main', baseVersion: 1, data: { schemaVersion: 2, plots: [], workers: {} } }]) await expect(repo.sync('owner', { upserts: [row], appends: [] })).rejects.toThrow(/semantic|schema 3/)
  })
  it('rolls all economic state back after an adapter failure, preserving retry identity', async () => {
    const op = f.operation({ kind: 'grant-energy' }), before = await repo.load('owner')
    if (backend === 'firestore') {
      for (let i = 0; i < 3; i++) { fake.failAt = i; await expect(repo.sync('owner', req([op]))).rejects.toThrow(/Synthetic/); expect(await repo.load('owner')).toEqual(before) }
      fake.failAt = -1
    } else {
      const target = repo as LocalSaveRepository, original = Reflect.get(target, 'write') as (data: unknown) => Promise<void>
      const fail = vi.spyOn(target as unknown as { write(data: unknown): Promise<void> }, 'write').mockRejectedValueOnce(new Error('Synthetic replacement failure'))
      await expect(repo.sync('owner', req([op]))).rejects.toThrow(/Synthetic/); expect(JSON.parse(await readFile(file, 'utf8')).owner.logs).toEqual({})
      fail.mockRestore(); expect(original).toBeDefined()
    }
    expect((await repo.sync('owner', req([op]))).farmOperations![0]!.status).toBe('applied')
  })
})
describe('Farm wire and standalone mirror', () => {
  it('enforces exact combined-reference and complete-request byte boundaries at the authenticated API parser', async () => {
    const f = await fixture(), op = f.operation({ kind: 'grant-energy' }), refs = farmOperationReferences(op)
    const count = new Set([...refs.entities, ...refs.logs]).size
    const upserts = Array.from({ length: 200 - count }, (_, i) => ({ kind: 'items' as const, id: `invented:${i}`, baseVersion: 0, data: { itemId: `invented:${i}`, quantity: 1, updatedAt: 1 } }))
    const body = { ...req([op]), upserts, padding: '' }
    expect(typeof parseSyncRequest(body)).toBe('object')
    expect(puzzleSyncReadSet(body).entities.length + puzzleSyncReadSet(body).logs.length).toBe(200)
    expect(parseSyncRequest({ ...body, upserts: [...upserts, { ...upserts[0]!, id: 'invented:extra', data: { itemId: 'invented:extra', quantity: 1, updatedAt: 1 } }] })).toMatch(/bounds/)
    body.padding = 'x'.repeat(FARM_SYNC_LIMITS.bytes - farmBytes(body)); expect(farmBytes(body)).toBe(FARM_SYNC_LIMITS.bytes)
    expect(typeof parseSyncRequest(body)).toBe('object'); expect(parseSyncRequest({ ...body, padding: body.padding + 'x' })).toMatch(/bounds/)
    expect(typeof parseSyncRequest({ upserts: [], appends: [], farmOperations: [] })).toBe('string')
  })
  it('checks all pure source modules and the retained legacy Puzzle dependency separately', () => {
    expect(execFileSync(process.execPath, ['scripts/sync-farm-adapter.mjs', '--check'], { encoding: 'utf8' })).toMatch(/verified: 18/)
  })
  it('agrees on every synthetic record, receipt and malformed request; uses the authenticated sync route', async () => {
    const f = await fixture(), op = f.operation(start), result = f.apply(op)
    for (const r of f.entities.values()) expect(parseEntityData(r.kind as EntityRecord['kind'], r.data)).not.toBeNull()
    for (const r of f.logs.values()) expect(parseLogData(r.kind as 'farmOperations', r.data)).not.toBeNull()
    expect(parseFarmOperation(op)).toEqual(op); expect(parseFarmOperation({ ...op, extra: 1 })).toBeNull()
    expect(parseSyncRequest(req([op]))).toEqual(req([op])); expect(typeof parseSyncRequest({ ...req([op]), farmProtocolVersion: 2 })).toBe('string')
    expect(puzzleSyncReadSet({ upserts: [], appends: [] }).entities).toContain('farmCutover/main')
    const mock = { sync: vi.fn().mockResolvedValue(result.responses) }, controller = new SaveController(mock as unknown as ConstructorParameters<typeof SaveController>[0])
    expect(Reflect.getMetadata(GUARDS_METADATA, SaveController)).toContain(AuthGuard)
    await controller.sync('invented-authenticated-id', req([op])); expect(mock.sync).toHaveBeenCalledWith('invented-authenticated-id', req([op]))
    const domain: { resolveFarmOperations: typeof resolveFarmOperations } = await import(`${source}/resolver.ts`)
    const g = await fixture(), context = { enabled: true, now: 1000, entities: g.entities, logs: g.logs }
    expect(farmCanonical(resolveFarmOperations(context, [op]))).toBe(farmCanonical(domain.resolveFarmOperations(context, [op])))
    expect(resolveSyncWithPuzzles('owner', req([op]), g.entities as Map<string, EntityRecord>, new Map(), 1000, false, false).response.farmOperations![0]!.status).toBe('rejected')
  })
  it('lets an active Farm clear an old Produce stack to zero, and nothing more (D319)', async () => {
    const f = await fixture()
    expect(f.entities.get('farmCutover/main')!.data.phase).toBe('active')
    const item: EntityRecord = { kind: 'items', id: 'produce:t2:wit', version: 4, updatedAt: 1, deleted: false, data: { itemId: 'produce:t2:wit', quantity: 5, updatedAt: 1 } }
    f.entities.set(`items/${item.id}`, item)
    const upsert = (data: Record<string, unknown>) => ({ upserts: [{ kind: 'items' as const, id: item.id, baseVersion: 4, data }], appends: [] })
    const cleared = resolveSyncWithPuzzles('owner', upsert({ ...item.data, quantity: 0, updatedAt: 9 }), f.entities as Map<string, EntityRecord>, new Map(), 1000, false)
    expect(cleared.writes).toMatchObject([{ kind: 'items', id: item.id, version: 5, data: { quantity: 0 } }])
    for (const data of [{ ...item.data, quantity: 6 }, { ...item.data, quantity: 1 }, { itemId: 'produce:t3:wit', quantity: 0, updatedAt: 9 }])
      expect(() => resolveSyncWithPuzzles('owner', upsert(data), f.entities as Map<string, EntityRecord>, new Map(), 1000, false)).toThrow(/retired|identity|match/)
  })
  it.each(['preparing', 'resetting'] as const)('protects %s even without client opt-in; historic projections keep their original versions', async phase => {
    const f = await fixture(), legacy: { createInitialFarmState(): object } = await import(`${source}/../rules.ts`)
    const control = f.entities.get('farmCutover/main')!, old = f.entities.get('farm/main')!
    f.entities.set('farmCutover/main', { ...control, data: { ...control.data, phase, nextOutfitIndex: 0, activatedAt: null } })
    f.entities.set('farm/main', { ...old, data: legacy.createInitialFarmState() as Record<string, unknown> })
    const item: EntityRecord = { kind: 'items', id: 'produce:t1:speed', version: 7, updatedAt: 1, deleted: false, data: { itemId: 'produce:t1:speed', quantity: 3, updatedAt: 1 } }
    f.entities.set(`items/${item.id}`, item)
    const request: SyncRequest = { upserts: [{ kind: 'items', id: item.id, baseVersion: 0, data: item.data }], appends: [] }
    const result = resolveSyncWithPuzzles('owner', request, f.entities as Map<string, EntityRecord>, new Map(), 1000, false)
    expect(result.writes).toEqual([]); expect(result.response.applied).toEqual([{ kind: 'items', id: item.id, version: 7 }])
    expect(() => resolveSyncWithPuzzles('owner', { ...request, upserts: [{ ...request.upserts[0]!, data: { ...item.data, quantity: 4 } }] }, f.entities as Map<string, EntityRecord>, new Map(), 1000, false)).toThrow(/retired/)
    // Clearing old Produce waits for the active Farm (D319).
    expect(() => resolveSyncWithPuzzles('owner', { ...request, upserts: [{ ...request.upserts[0]!, baseVersion: 7, data: { ...item.data, quantity: 0 } }] },
      f.entities as Map<string, EntityRecord>, new Map(), 1000, false)).toThrow(/retired/)
    const uma = f.entities.get('umas/invented-0')!, changed = structuredClone(uma.data)
    ;(changed.scenarios as { extraStatsUnlocked: { speed: number } }[])[0]!.extraStatsUnlocked.speed = 1
    expect(() => resolveSyncWithPuzzles('owner', { upserts: [{ kind: 'umas', id: uma.id, baseVersion: 1, data: changed }], appends: [], farmProtocolVersion: 1 }, f.entities as Map<string, EntityRecord>, new Map(), 1000, false)).toThrow(/Extra Stats/)
  })
})
