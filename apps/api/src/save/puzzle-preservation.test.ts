// Synthetic file/strict Firestore transaction parity, no network or credentials.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalSaveRepository } from './local-save.repository'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { fromStored, toStored } from './firestore-codec'
import { parseEntityData, type EntityRecord, type LogRecord, type SyncRequest } from './save.types'
import { parseConstellationBankSave, type LegacySparkProof, type LegacySparkRequest, type PuzzlePreservationRequest, type VerifiedPuzzlePreservationContent } from './puzzles'
import type { SaveRepository } from './save.repository'
class Collection {
  constructor(readonly path: string, readonly docs: Map<string, Record<string, unknown>>) {}
  doc(id: string): Ref { return new Ref(`${this.path}/${id}`, this.docs) }
  async get() { return { docs: [...this.docs].filter(([p]) => p.startsWith(`${this.path}/`) && !p.slice(this.path.length + 1).includes('/')).map(([, d]) => ({ exists: true, data: () => structuredClone(d) })) } }
}
class Ref {
  constructor(readonly path: string, readonly docs: Map<string, Record<string, unknown>>) {}
  collection(name: string) { return new Collection(`${this.path}/${name}`, this.docs) }
  async get() { return { exists: this.docs.has(this.path), data: () => structuredClone(this.docs.get(this.path)!) } }
}
class StrictDb {
  docs = new Map<string, Record<string, unknown>>(); fail = false; reads = 0
  private queue: Promise<unknown> = Promise.resolve()
  collection(name: string) { return new Collection(name, this.docs) }
  runTransaction<T>(fn: (tx: { getAll: (...refs: Ref[]) => Promise<{ exists: boolean; data: () => Record<string, unknown> }[]>;
    get: (query: Collection) => ReturnType<Collection['get']>; set: (ref: Ref, row: Record<string, unknown>) => void }) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const writes = new Map<string, Record<string, unknown>>(); let writing = false
      const answer = await fn({ getAll: async (...refs) => { if (writing) throw new Error('Read after write'); this.reads += refs.length;
        return refs.map(r => ({ exists: this.docs.has(r.path), data: () => structuredClone(this.docs.get(r.path)!) })) },
      get: async query => { if (writing) throw new Error('Read after write'); return query.get() },
      set: (ref, row) => { writing = true; writes.set(ref.path, structuredClone(row)) } })
      if (this.fail) throw new Error('Synthetic commit failed')
      for (const [key, value] of writes) this.docs.set(key, value)
      return answer
    }); this.queue = run.catch(() => undefined); return run
  }
}
async function fixture(count = 40) {
  const module: { preservationFixture: (n: number) => { entities: Map<string, EntityRecord>; logs: Map<string, LogRecord>; content: VerifiedPuzzlePreservationContent } } =
    await import(resolve(process.cwd(), '../../packages/domain/src/minigames/uma-puzzles/preservation.synthetic.ts'))
  return module.preservationFixture(count)
}
for (const backend of ['local', 'firestore'] as const) describe(`${backend} protected preservation`, () => {
  let repo: SaveRepository, folder: string, file: string, fake: StrictDb, content: VerifiedPuzzlePreservationContent, verify: ReturnType<typeof vi.fn>
  beforeEach(async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100)
    const f = await fixture(); content = f.content; verify = vi.fn(async () => content)
    folder = await mkdtemp(join(tmpdir(), 'uma-preservation-')); file = join(folder, 'save.json'); fake = new StrictDb()
    await writeFile(file, JSON.stringify({ owner: { entities: Object.fromEntries(f.entities), logs: Object.fromEntries(f.logs) } }))
    for (const [key, row] of [...f.entities, ...f.logs]) fake.docs.set(`players/owner/${key}`, toStored(row))
    repo = backend === 'local' ? new LocalSaveRepository(file, true, verify) : new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0], true, verify)
  })
  afterEach(async () => { vi.restoreAllMocks(); await rm(folder, { recursive: true, force: true }) })
  const request = async (action: PuzzlePreservationRequest['action'] = 'advance'): Promise<PuzzlePreservationRequest> => {
    const bank = (await repo.load('owner')).entities.find(e => e.kind === 'constellationBank')
    return { schemaVersion: 2, cutoverId: 'invented-cutover', expectedBankRevision: parseConstellationBankSave(bank?.data)?.revision ?? 0, action }
  }
  it('previews, freezes, resumes bounded steps after a lost response, finalizes once and retains every four-preset build', async () => {
    const before = await repo.load('owner'), preview = await repo.preparePuzzles('owner', await request('preview'))
    expect(preview.status).toBe('preview'); expect(await repo.load('owner')).toEqual(before)
    expect((await repo.preparePuzzles('owner', await request())).status).toBe('preparing')
    const first = await request(); await repo.preparePuzzles('owner', first)
    expect((await repo.preparePuzzles('owner', first)).summary?.completed).toBe(16)
    for (let i = 0; i < 3; i++) await repo.preparePuzzles('owner', await request())
    const after = await repo.load('owner'), bank = after.entities.find(e => e.kind === 'constellationBank')!
    expect(bank.data.phase).toBe('active'); expect(after.entities.filter(e => e.kind === 'puzzleCohort')).toHaveLength(40)
    for (const old of before.entities.filter(e => e.kind === 'umas')) {
      const next = after.entities.find(e => e.kind === 'umas' && e.id === old.id)!
      expect(next.data).toEqual({ ...old.data, schemaVersion: 16 }); expect(parseEntityData('umas', next.data)).not.toBeNull()
    }
    const retry = await repo.preparePuzzles('owner', await request())
    expect(retry.status).toBe('active'); expect(await repo.load('owner')).toEqual(after)
    expect(after.logs.filter(l => l.kind === 'itemLedger')).toHaveLength(1)
  })
  it('freezes economic fields but allows unrelated Racing/config writes while preparing', async () => {
    await repo.preparePuzzles('owner', await request())
    const u = (await repo.load('owner')).entities.find(e => e.kind === 'umas')!
    const req: SyncRequest = { upserts: [{ kind: 'umas', id: u.id, baseVersion: u.version, data: { ...u.data, activePreset: 'long' } }], appends: [], puzzleProtocolVersion: 1 }
    expect((await repo.sync('owner', req)).applied).toHaveLength(1)
    const current = (await repo.load('owner')).entities.find(e => e.id === u.id)!
    await expect(repo.sync('owner', { ...req, upserts: [{ ...req.upserts[0]!, baseVersion: current.version,
      data: { ...current.data, scenarios: (current.data.scenarios as Record<string, unknown>[]).map(s => ({ ...s, trainingExp: 1 })) } }] })).rejects.toThrow(/preparation/)
    for (let i = 0; i < 4; i++) await repo.preparePuzzles('owner', await request())
    expect((await repo.load('owner')).entities.find(e => e.id === u.id)!.data.activePreset).toBe('long')
  })
  it('refuses old-client reconnect with explicit update, while new Racing retains canonical CL', async () => {
    for (let i = 0; i < 5; i++) await repo.preparePuzzles('owner', await request())
    const u = (await repo.load('owner')).entities.find(e => e.kind === 'umas')!
    const req: SyncRequest = { upserts: [{ kind: 'umas', id: u.id, baseVersion: u.version, data: { ...u.data, schemaVersion: 15 } }], appends: [], puzzleProtocolVersion: 1 }
    await expect(repo.sync('owner', req)).rejects.toThrow(/Update required/)
    expect((await repo.sync('owner', { ...req, upserts: [{ ...req.upserts[0]!, data: { ...u.data, activePreset: 'sprint' } }] })).applied).toHaveLength(1)
  })
  it('has no writes if required content is unavailable, and keeps frozen rows if source changes on retry', async () => {
    verify.mockRejectedValueOnce(new Error('Missing compatible content')); const before = await repo.load('owner')
    expect((await repo.preparePuzzles('owner', await request())).status).toBe('recoverable-error'); expect(await repo.load('owner')).toEqual(before)
    await repo.preparePuzzles('owner', await request()); content = { ...content, sources: new Map() }
    expect((await repo.preparePuzzles('owner', await request())).summary?.completed).toBe(16)
    expect(verify).toHaveBeenLastCalledWith(content.contentHash)
    content = { ...content, contentHash: 'b'.repeat(64) }
    expect((await repo.preparePuzzles('owner', await request())).status).toBe('recoverable-error')
  })
  it('keeps the authoritative snapshot on commit failure; a later retry resumes the original cohort', async () => {
    if (backend !== 'firestore') return
    fake.fail = true; const before = structuredClone(fake.docs)
    expect((await repo.preparePuzzles('owner', await request())).status).toBe('recoverable-error'); expect(fake.docs).toEqual(before)
    fake.fail = false; expect((await repo.preparePuzzles('owner', await request())).status).toBe('preparing')
    fake.fail = true; const frozen = structuredClone(fake.docs)
    expect((await repo.preparePuzzles('owner', await request())).status).toBe('recoverable-error'); expect(fake.docs).toEqual(frozen)
    fake.fail = false; expect((await repo.preparePuzzles('owner', await request())).summary?.completed).toBe(16)
  })
  it('can restore a synthetic pre-freeze backup, and a post-finalization backup cannot grant again', async () => {
    const backup = backend === 'local' ? await readFile(file, 'utf8') : structuredClone(fake.docs)
    for (let i = 0; i < 5; i++) await repo.preparePuzzles('owner', await request())
    const finished = backend === 'local' ? await readFile(file, 'utf8') : structuredClone(fake.docs)
    if (backend === 'local') await writeFile(file, backup as string); else fake.docs = backup as Map<string, Record<string, unknown>>
    expect((await repo.preparePuzzles('owner', await request('preview'))).summary?.completed).toBe(0)
    if (backend === 'local') await writeFile(file, finished as string); else fake.docs = finished as Map<string, Record<string, unknown>>
    const size = (await repo.load('owner')).logs.length; await repo.preparePuzzles('owner', await request())
    expect((await repo.load('owner')).logs).toHaveLength(size)
    if (backend === 'firestore') expect([...fake.docs.values()].map(d => fromStored<EntityRecord | LogRecord>(d))).not.toHaveLength(0)
  })
  it('refunds original paid Spark once across retries/devices, and rolls back a failed refund transaction', async () => {
    const module: { preservationSparkProof: (terminal: boolean) => LegacySparkProof } = await import(resolve(process.cwd(), '../../packages/domain/src/minigames/uma-puzzles/preservation.synthetic.ts'))
    const run = module.preservationSparkProof(false), paid: LogRecord = { kind: 'ledger', id: run.id, createdAt: 1,
      data: { resource: 'tickets', delta: -5, reason: 'training', localDay: '2000-01-01', createdAt: 1 } }
    const snapshot = await repo.load('owner'), profile = snapshot.entities.find(r => r.kind === 'profile')!; profile.data.tickets = 60
    if (backend === 'local') {
      const data = JSON.parse(await readFile(file, 'utf8')) as Record<string, { entities: Record<string, EntityRecord>; logs: Record<string, LogRecord> }>
      data.owner!.entities['profile/main'] = profile; data.owner!.logs[`ledger/${run.id}`] = paid; await writeFile(file, JSON.stringify(data))
    } else { fake.docs.set('players/owner/profile/main', toStored(profile)); fake.docs.set(`players/owner/ledger/${run.id}`, toStored(paid)) }
    const req: LegacySparkRequest = { schemaVersion: 1, disposition: 'unfinished', localDay: '2000-01-01', run }
    verify.mockRejectedValueOnce(new Error('Missing replacement')); const before = await repo.load('owner')
    expect((await repo.retireSpark('owner', req)).status).toBe('recoverable-error'); expect(await repo.load('owner')).toEqual(before)
    if (backend === 'firestore') { fake.fail = true; expect((await repo.retireSpark('owner', req)).status).toBe('recoverable-error'); expect(await repo.load('owner')).toEqual(before); fake.fail = false }
    expect((await repo.retireSpark('owner', req)).status).toBe('refunded')
    const after = await repo.load('owner'); expect(after.entities.find(r => r.kind === 'profile')!.data.tickets).toBe(65)
    expect((await repo.retireSpark('owner', { ...req, localDay: '2000-01-02' })).status).toBe('refunded'); expect(await repo.load('owner')).toEqual(after)
    expect(after.logs.filter(r => r.id === `${run.id}:refund`)).toHaveLength(1)
    expect((await repo.retireSpark('owner', { ...req, disposition: 'committed', run: module.preservationSparkProof(true) })).status).toBe('recoverable-error')
  })
})
it('off capability never verifies content or opens Firestore', async () => {
  const verify = vi.fn(), fake = new StrictDb(), repo = new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0], false, verify)
  expect((await repo.preparePuzzles('owner', { schemaVersion: 2, cutoverId: 'invented', expectedBankRevision: 0, action: 'advance' })).status).toBe('disabled')
  expect(verify).not.toHaveBeenCalled(); expect(fake.reads).toBe(0); expect(fake.docs.size).toBe(0)
})
