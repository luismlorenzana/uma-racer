// Local-file / strict fake Firestore rehearsal. Only invented JSON, explicit clocks, no credentials/network.
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalSaveRepository } from './local-save.repository'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { toStored, fromStored } from './firestore-codec'
import { farmCanonical, farmCutoverSource, farmCutoverControl, farmHash, farmCutoverReceiptId, type FarmCutoverRequest } from './farms'
import type { SaveRepository } from './save.repository'
import type { EntityRecord, LogRecord } from './save.types'
class Collection {
  constructor(readonly path: string, readonly docs: Map<string, Record<string, unknown>>, readonly cap = Infinity, readonly live = false) {}
  doc(id: string) { return new Ref(`${this.path}/${id}`, this.docs) }
  limit(n: number) { return new Collection(this.path, this.docs, n, this.live) }
  where(field: string, op: string, value: unknown) { if (field !== 'deleted' || op !== '==' || value !== false) throw new Error('Unexpected query'); return new Collection(this.path, this.docs, this.cap, true) }
  async get() { return { docs: [...this.docs].filter(([p, row]) => p.startsWith(`${this.path}/`) && !p.slice(this.path.length + 1).includes('/') &&
    (!this.live || row.deleted === false)).slice(0, this.cap).map(([, row]) => ({ exists: true, data: () => structuredClone(row) })) } }
}
class Ref {
  constructor(readonly path: string, readonly docs: Map<string, Record<string, unknown>>) {}
  collection(name: string) { return new Collection(`${this.path}/${name}`, this.docs) }
}
class StrictDb {
  docs = new Map<string, Record<string, unknown>>(); fail = false; readCount = 0; queries = 0; maxBoundedReads = 0
  private queue: Promise<unknown> = Promise.resolve()
  collection(name: string) { return new Collection(name, this.docs) }
  runTransaction<T>(fn: (tx: { getAll: (...refs: Ref[]) => Promise<{ exists: boolean; data: () => Record<string, unknown> }[]>;
    get: (q: Collection) => ReturnType<Collection['get']>; set: (ref: Ref, data: Record<string, unknown>) => void }) => Promise<T>) {
    const run = this.queue.then(async () => {
      let writing = false, reads = 0; const writes = new Map<string, Record<string, unknown>>()
      const result = await fn({ getAll: async (...refs) => { if (writing) throw new Error('Read after write'); reads += refs.length; this.readCount += refs.length
        return refs.map(r => ({ exists: this.docs.has(r.path), data: () => structuredClone(this.docs.get(r.path)!) })) },
      get: async q => { if (writing) throw new Error('Read after write'); this.queries++; return q.get() },
      set: (r, data) => { writing = true; writes.set(r.path, structuredClone(data)) } })
      this.maxBoundedReads = Math.max(this.maxBoundedReads, reads)
      if (this.fail) throw new Error('Injected atomic commit failure')
      for (const [key, row] of writes) this.docs.set(key, row)
      return result
    }); this.queue = run.catch(() => undefined); return run
  }
}
// Each case replays a whole 35-outfit/two-page account, with dozens of real local-file commits.
// This is a durability rehearsal, not a five-second performance contract on a shared CI runner.
const REHEARSAL_TIMEOUT = 30_000
for (const backend of ['local', 'firestore'] as const) describe(`${backend} Farm cutover`, () => {
  let repo: SaveRepository, folder: string, file: string, fake: StrictDb
  const generation = 'invented-cutover'
  beforeEach(async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100)
    const module: { farmCutoverFixture: (n: number) => { entities: Map<string, EntityRecord>; logs: Map<string, LogRecord> } } =
      await import(resolve(process.cwd(), '../../packages/domain/src/farm/kitchen/cutover-fixtures.ts'))
    const f = module.farmCutoverFixture(35)
    folder = await mkdtemp(join(tmpdir(), 'farm-cutover-')); file = join(folder, 'save.json'); fake = new StrictDb()
    await writeFile(file, JSON.stringify({ invented: { entities: Object.fromEntries(f.entities), logs: Object.fromEntries(f.logs) } }))
    for (const [key, row] of [...f.entities, ...f.logs]) fake.docs.set(`players/invented/${key}`, toStored(row))
    repo = backend === 'local' ? new LocalSaveRepository(file, true, undefined, true)
      : new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0], true, undefined, true)
  })
  afterEach(async () => { vi.restoreAllMocks(); await rm(folder, { recursive: true, force: true }) })
  const snapshot = async () => backend === 'local' ? (() => { throw new Error('Use async file read') })() : {
    entities: [...fake.docs.values()].map(v => fromStored<EntityRecord | LogRecord>(v)).filter((v): v is EntityRecord => 'version' in v),
    logs: [...fake.docs.values()].map(v => fromStored<EntityRecord | LogRecord>(v)).filter((v): v is LogRecord => 'createdAt' in v) }
  const rows = async () => {
    if (backend === 'firestore') return snapshot()
    const user = (JSON.parse(await readFile(file, 'utf8')) as Record<string, { entities: Record<string, EntityRecord>; logs: Record<string, LogRecord> }>).invented!
    return { entities: Object.values(user.entities), logs: Object.values(user.logs) }
  }
  const prepare = async (): Promise<FarmCutoverRequest> => {
    const s = await rows(), source = farmCutoverSource('invented', new Map(s.entities.map(r => [`${r.kind}/${r.id}`, r])), new Map(s.logs.map(r => [`${r.kind}/${r.id}`, r])))
    return { schemaVersion: 1, generation, action: 'prepare', archive: { accountId: 'invented', profileCreatedAt: 1,
      archiveDigest: 'b'.repeat(64), sourceDigest: createHash('sha256').update(farmCanonical(source)).digest('hex') } }
  }
  const request = (action: 'advance' | 'verify', index: number): FarmCutoverRequest => ({ schemaVersion: 1, generation, action, index })
  const finish = async () => {
    const c = farmCutoverControl(new Map((await rows()).entities.map(r => [`${r.kind}/${r.id}`, r])))!
    for (let i = c.nextOutfitIndex; i < c.outfitCount; i++) expect((await repo.prepareFarm('invented', request('advance', i))).status).toBe('resetting')
    for (let i = 0; i < c.pageCount; i++) expect((await repo.prepareFarm('invented', request('verify', i))).status).toBe('resetting')
    expect((await repo.prepareFarm('invented', { schemaVersion: 1, generation, action: 'finalize' })).status).toBe('active')
  }
  it('freezes once, survives lost replies, keeps valid non-Farm edits and finalizes once', async () => {
    const before = await rows(), req = await prepare()
    expect((await repo.prepareFarm('invented', req)).status).toBe('preparing')
    const afterFreeze = await rows()
    for (const row of before.entities) expect(afterFreeze.entities.find(r => r.kind === row.kind && r.id === row.id)).toEqual(row)
    const u = afterFreeze.entities.find(r => r.kind === 'umas')!
    expect((await repo.sync('invented', { farmProtocolVersion: 1, puzzleProtocolVersion: 1, upserts: [{ kind: 'umas', id: u.id,
      baseVersion: u.version, data: { ...u.data, activePreset: 'long' } }], appends: [] })).applied).toHaveLength(1)
    const first = await repo.prepareFarm('invented', request('advance', 0))
    expect((await repo.prepareFarm('invented', request('advance', 0))).receipt).toEqual(first.receipt)
    await finish(); const after = await rows()
    expect(after.entities.find(r => r.kind === 'umas' && r.id === u.id)!.data.activePreset).toBe('long')
    expect((await repo.prepareFarm('invented', { schemaVersion: 1, generation, action: 'finalize' })).status).toBe('active')
    expect(await rows()).toEqual(after)
    if (backend === 'firestore') { expect(fake.queries).toBe(1); expect(fake.maxBoundedReads).toBeLessThanOrEqual(200) }
    console.info('Farm adapter witness', JSON.stringify({ backend, outfits: 35, pages: 2, digest: farmHash(after), maxBoundedReads: fake.maxBoundedReads }))
  }, REHEARSAL_TIMEOUT)
  it('rolls back a failure at every outfit and finalization, then resumes the original frozen cohort', async () => {
    await repo.prepareFarm('invented', await prepare())
    const failCall = async (req: FarmCutoverRequest) => {
      const before = await rows()
      const spy = backend === 'local' ? vi.spyOn(repo as unknown as { write: () => Promise<void> }, 'write').mockRejectedValueOnce(new Error('Injected atomic commit failure')) : null
      fake.fail = true
      expect((await repo.prepareFarm('invented', req)).status).toBe('recoverable-error'); expect(await rows()).toEqual(before)
      spy?.mockRestore(); fake.fail = false
      expect((await repo.prepareFarm('invented', req)).status).not.toBe('recoverable-error')
    }
    for (let i = 0; i < 35; i++) await failCall(request('advance', i))
    await failCall(request('verify', 0)); await failCall(request('verify', 1))
    await failCall({ schemaVersion: 1, generation, action: 'finalize' })
    expect((await rows()).logs.filter(l => l.kind === 'farmOperations' && l.data.action === 'advance')).toHaveLength(35)
  }, REHEARSAL_TIMEOUT)
  it('rejects stale/archive-account proof before freeze and old v2 writers after prepare/active', async () => {
    const req = await prepare(), before = await rows()
    const bad = structuredClone(req); if (bad.action === 'prepare') bad.archive.accountId = 'another-account'
    expect((await repo.prepareFarm('invented', bad)).message).toMatch(/account/); expect(await rows()).toEqual(before)
    const old = before.entities.find(r => r.kind === 'umas')!
    await repo.sync('invented', { upserts: [{ kind: 'umas', id: old.id, baseVersion: old.version, data: { ...old.data, exp: 1 } }], appends: [] })
    expect((await repo.prepareFarm('invented', req)).message).toMatch(/stale/)
    await repo.prepareFarm('invented', await prepare())
    await expect(repo.sync('invented', { upserts: [{ kind: 'umas', id: old.id, baseVersion: old.version, data: old.data }], appends: [] })).rejects.toThrow(/Update\/recovery/)
    await finish()
    const current = (await rows()).entities.find(r => r.kind === 'umas' && r.id === old.id)!
    const oldFarm = before.entities.find(r => r.kind === 'farm')!
    await expect(repo.sync('invented', { upserts: [{ kind: 'farm', id: 'main', baseVersion: oldFarm.version, data: oldFarm.data }], appends: [] })).rejects.toThrow(/legacy Farm/)
    await expect(repo.sync('invented', { farmProtocolVersion: 1, upserts: [{ kind: 'umas', id: old.id, baseVersion: current.version, data: old.data }], appends: [] })).rejects.toThrow(/retired Extra/)
    expect((await rows()).entities.find(r => r.kind === 'umas' && r.id === old.id)!.data.exp).toBe(1)
  }, REHEARSAL_TIMEOUT)
  it('allows a zero-default new acquisition after freeze without adding it to the cohort', async () => {
    await repo.prepareFarm('invented', await prepare())
    const u = (await rows()).entities.find(r => r.kind === 'umas')!, data = structuredClone(u.data)
    data.templateId = 'invented-new'
    for (const unit of data.scenarios as { extraStatsUnlocked: Record<string, number>; presets: Record<string, { activeExtraStats: string[] }> }[]) {
      for (const key of Object.keys(unit.extraStatsUnlocked)) unit.extraStatsUnlocked[key] = 0
      Object.values(unit.presets).forEach(p => p.activeExtraStats = [])
    }
    expect((await repo.sync('invented', { farmProtocolVersion: 1, upserts: [{ kind: 'umas', id: 'invented-new', baseVersion: 0, data }], appends: [] })).applied).toHaveLength(1)
    await finish()
    expect((await rows()).entities.find(r => r.kind === 'umas' && r.id === 'invented-new')!.data).toEqual(data)
    expect((await rows()).entities.some(r => r.kind === 'farmWorkers' && r.id === 'invented-new')).toBe(false)
    expect((await rows()).logs.some(l => l.id === farmCutoverReceiptId(generation, 'advance', 35))).toBe(false)
  }, REHEARSAL_TIMEOUT)
})
it('the normal disabled endpoint returns before any local file or Firestore access', async () => {
  const req: FarmCutoverRequest = { schemaVersion: 1, generation: 'invented', action: 'status' }, fake = new StrictDb()
  const repo = new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0], false, undefined, false)
  expect((await repo.prepareFarm('invented', req)).status).toBe('disabled'); expect(fake.readCount).toBe(0); expect(fake.queries).toBe(0)
  expect((await new LocalSaveRepository('/nonexistent/do-not-open.json', false, undefined, false).prepareFarm('invented', req)).status).toBe('disabled')
})
