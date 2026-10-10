// Synthetic adapters/transactions only. No cloud credentials or private content.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalSaveRepository } from './local-save.repository'
import { FirestoreSaveRepository } from './firestore-save.repository'
import { toStored } from './firestore-codec'
import { parseEntityData, parseLogData, parseSyncRequest, type EntityRecord, type LogRecord, type SyncRequest } from './save.types'
import { createPuzzleOperation, parsePuzzleOperation, parsePuzzleEntity, parsePuzzleOperationReceipt, resolvePuzzleOperations,
  parsePuzzleOperationResponses, type PuzzleOperationV1, type PuzzlePayload, type PuzzleStoredEntity, type PuzzleStoredLog, type PuzzlePresetSaveV1 } from './puzzles'
import type { SaveRepository } from './save.repository'

interface Fixture { entities: Map<string, PuzzleStoredEntity>; logs: Map<string, PuzzleStoredLog>; party: PuzzlePresetSaveV1;
  operation: (payload: PuzzlePayload, id?: string, dependencies?: string[]) => PuzzleOperationV1; reserve: (id?: string) => PuzzleOperationV1;
  win: (op: PuzzleOperationV1) => PuzzlePayload;
  apply: (op: PuzzleOperationV1, now?: number) => ReturnType<typeof resolvePuzzleOperations> }
// Test-only dynamic bridge avoids a production/tsc CommonJS import of workspace TypeScript.
const sourcePath = resolve(process.cwd(), '../../packages/domain/src/minigames/uma-puzzles')
async function fixture(stock = 2, debt = 0): Promise<Fixture> {
  const module: { puzzleProtocolFixture: (stock: number, debt: number) => Fixture } = await import(`${sourcePath}/protocol-fixtures.ts`)
  return module.puzzleProtocolFixture(stock, debt)
}
class FakeRef {
  constructor(readonly path: string, private readonly docs: Map<string, Record<string, unknown>>) {}
  collection(name: string) { return new FakeCollection(`${this.path}/${name}`, this.docs) }
}
class FakeCollection {
  constructor(readonly path: string, private readonly docs: Map<string, Record<string, unknown>>) {}
  doc(id: string) { return new FakeRef(`${this.path}/${id}`, this.docs) }
  async get() { const prefix = `${this.path}/`; return { docs: [...this.docs].filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')).map(([, d]) => ({ data: () => structuredClone(d) })) } }
}
class StrictFirestore {
  docs = new Map<string, Record<string, unknown>>()
  private queue: Promise<unknown> = Promise.resolve()
  failCommit = false
  reads = 0
  collection(name: string) { return new FakeCollection(name, this.docs) }
  async runTransaction<T>(fn: (tx: { getAll: (...refs: FakeRef[]) => Promise<{ exists: boolean; data: () => Record<string, unknown> }[]>;
    set: (ref: FakeRef, data: Record<string, unknown>) => void }) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const writes = new Map<string, Record<string, unknown>>(); let writing = false
      const answer = await fn({ getAll: async (...refs) => {
        if (writing) throw new Error('Firestore read after write')
        this.reads += refs.length
        return refs.map(r => ({ exists: this.docs.has(r.path), data: () => structuredClone(this.docs.get(r.path)!) }))
      }, set: (ref, data) => { writing = true; writes.set(ref.path, structuredClone(data)) } })
      if (this.failCommit) throw new Error('Synthetic transaction failure')
      for (const [p, d] of writes) this.docs.set(p, d)
      return answer
    })
    this.queue = run.catch(() => undefined); return run
  }
}
const spend: PuzzlePayload = { kind: 'cl-spend', outfitId: 'invented-0', scenarioId: 'ura-finale', inputs: [{ itemId: 'constellation:ura-finale:front', quantity: 1 }] }
const req = (operations: PuzzleOperationV1[]): SyncRequest => ({ upserts: [], appends: [], puzzleProtocolVersion: 1, puzzleOperations: operations })
const asEntity = (row: PuzzleStoredEntity): EntityRecord => ({ ...row, kind: row.kind as EntityRecord['kind'] })
const asLog = (row: PuzzleStoredLog): LogRecord => ({ ...row, kind: row.kind as LogRecord['kind'] })

for (const backend of ['local', 'firestore'] as const) describe(`${backend} atomic Puzzle lane`, () => {
  let repo: SaveRepository, f: Fixture, dir: string, fake: StrictFirestore
  beforeEach(async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100)
    f = await fixture(1, 1); dir = await mkdtemp(join(tmpdir(), 'uma-puzzle-sync-')); fake = new StrictFirestore()
    const entities = Object.fromEntries([...f.entities].map(([k, r]) => [k, asEntity(r)])), logs = Object.fromEntries([...f.logs].map(([k, r]) => [k, asLog(r)]))
    if (backend === 'local') {
      const file = join(dir, 'save.json'); await writeFile(file, JSON.stringify({ owner: { entities, logs } }))
      repo = new LocalSaveRepository(file, true)
    } else {
      for (const [k, row] of Object.entries({ ...entities, ...logs })) fake.docs.set(`players/owner/${k}`, toStored(row))
      repo = new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0], true)
    }
  })
  afterEach(async () => { vi.restoreAllMocks(); await rm(dir, { recursive: true, force: true }) })
  it('accepts all economic rows together, returns the same receipt on retry, rejects reused ids', async () => {
    const op = f.operation(spend), a = await repo.sync('owner', req([op]))
    expect(a.puzzleOperations?.[0]?.status).toBe('applied')
    expect(parsePuzzleOperationResponses(a.puzzleOperations, [op])).not.toBeNull()
    const duplicate = await repo.sync('owner', req([op]))
    expect(duplicate.puzzleOperations?.[0]).toMatchObject({ status: 'duplicate', receipt: a.puzzleOperations![0]!.receipt })
    const reused = createPuzzleOperation({ ...op, payload: { ...spend, inputs: [{ itemId: 'constellation:ura-finale:front', quantity: 2 }] } })
    expect((await repo.sync('owner', req([reused]))).puzzleOperations?.[0]?.reason).toMatch(/reused/)
    const saved = await repo.load('owner')
    expect(saved.logs.filter(l => l.kind === 'puzzleOperations')).toHaveLength(1)
    expect(saved.logs.filter(l => l.kind === 'itemLedger')).toHaveLength(1)
    expect(saved.entities.find(e => e.kind === 'items')?.data.quantity).toBe(0)
  })
  it('serializes competing devices, rejects one stale spend without an orphan ledger', async () => {
    const results = await Promise.all([repo.sync('owner', req([f.operation(spend, 'device-a')])), repo.sync('owner', req([f.operation(spend, 'device-b')]))])
    expect(results.map(r => r.puzzleOperations![0]!.status)).toEqual(['applied', 'rejected'])
    expect((await repo.load('owner')).logs.filter(l => l.kind === 'itemLedger')).toHaveLength(1)
  })
  it('cannot reference another account by reusing its valid operation and target ids', async () => {
    const response = await repo.sync('not-the-owner', req([f.operation(spend)]))
    expect(response.puzzleOperations![0]!.status).toBe('rejected')
    expect((await repo.load('owner')).logs).toHaveLength(0)
    expect((await repo.load('not-the-owner')).entities).toHaveLength(0)
  })
  it('blocks dependent groups and does not roll back unrelated ordinary sync', async () => {
    const op = f.operation(spend, 'waiting', ['unknown-operation'])
    const response = await repo.sync('owner', { ...req([op]), upserts: [{ kind: 'items', id: 'produce:t1:speed', baseVersion: 0,
      data: { itemId: 'produce:t1:speed', quantity: 1, updatedAt: 1 } }] })
    expect(response.puzzleOperations![0]!.status).toBe('blocked'); expect(response.applied).toHaveLength(1)
    expect((await repo.load('owner')).logs).toHaveLength(0)
  })
  it('rejects stale old-client Training writes explicitly; new clients retain Racing/config and canonical CL', async () => {
    await repo.sync('owner', req([f.operation(spend)]))
    const before = (await repo.load('owner')).entities.find(e => e.kind === 'umas' && e.id === 'invented-0')!
    const data = { ...before.data, level: 2, activePreset: 'long', scenarios: (before.data.scenarios as Record<string, unknown>[]).map(s => ({ ...s, trainingLevel: 1 })) }
    const request: SyncRequest = { upserts: [{ kind: 'umas', id: before.id, baseVersion: before.version, data }], appends: [] }
    await expect(repo.sync('owner', request)).rejects.toThrow(/Update required/)
    const response = await repo.sync('owner', { ...request, puzzleProtocolVersion: 1 })
    expect(response.applied).toHaveLength(1)
    const after = (await repo.load('owner')).entities.find(e => e.kind === 'umas' && e.id === before.id)!
    expect(after.data).toMatchObject({ level: 2, activePreset: 'long', scenarios: [{ trainingLevel: 2, trainingExp: 0 }] })
    await expect(repo.sync('owner', { ...request, puzzleProtocolVersion: 1, upserts: [{ ...request.upserts[0]!, baseVersion: after.version,
      data: { ...after.data, scenarios: (after.data.scenarios as Record<string, unknown>[]).map(s => ({ ...s, trainingExp: 1 })) } }] })).rejects.toThrow(/retired unit Training EXP/)
  })
  it('freezes once, protects party edits, compares takeover epoch and refuses stale result claims', async () => {
    const reserve = f.reserve(); const response = await repo.sync('owner', req([reserve]))
    expect(response.puzzleOperations?.[0]?.status).toBe('applied')
    if (reserve.payload.kind !== 'reserve') throw new Error('Fixture')
    const input = reserve.payload.encounter.input
    const takeover = { schemaVersion: 1 as const, checkpointId: input.checkpointId, battleId: input.battleId, expectedEpoch: 0, deviceId: 'second-device' }
    const taken = await repo.puzzleTakeover('owner', takeover)
    expect(taken.status).toBe('taken-over')
    expect((await repo.puzzleTakeover('owner', takeover)).status).toBe('rejected')
    const state = response.puzzleOperations![0]!.authoritative
    state.forEach(a => { if (a.record) f.entities.set(`${a.kind}/${a.id}`, a.record) })
    const edit = f.operation({ kind: 'save-party', party: { ...f.party, name: 'Changed' } }, 'edit')
    expect((await repo.sync('owner', req([edit]))).puzzleOperations?.[0]?.reason).toMatch(/open battle/)
    const stale = f.operation({ kind: 'settle', checkpointId: input.checkpointId, inputHash: reserve.payload.encounter.inputHash,
      result: { engineVersion: 1, battleId: input.battleId, ownerEpoch: 0, actionCount: 1, stateHash: 'a'.repeat(16), outcome: 'abandon', reason: 'abandoned', drags: 0, hpRemaining: 1 } }, 'stale')
    expect((await repo.sync('owner', req([stale]))).puzzleOperations?.[0]?.reason).toMatch(/ownership/)
  })
  it('resolves dependencies within a batch with final canonical rows and no reads after writes', async () => {
    const first = f.operation(spend, 'first'); f.apply(first, 100)
    const second = f.operation({ kind: 'save-party', party: { ...f.party, name: 'Renamed' } }, 'second', ['first'])
    const response = await repo.sync('owner', req([first, second]))
    expect(response.puzzleOperations?.map(r => r.status)).toEqual(['applied', 'applied'])
    expect(parsePuzzleOperationResponses(response.puzzleOperations, [first, second])).not.toBeNull()
    expect(fake.reads).toBeLessThanOrEqual(200)
  })
  it('settles five replayed EXP awards and debt once, then returns the accepted result instead of taking over', async () => {
    const reserve = f.reserve(), reserved = await repo.sync('owner', req([reserve]))
    reserved.puzzleOperations![0]!.authoritative.forEach(a => { if (a.record) f.entities.set(`${a.kind}/${a.id}`, a.record) })
    const settle = f.operation(f.win(reserve), 'replayed-win', [reserve.operationId])
    const accepted = await repo.sync('owner', req([settle]))
    expect(accepted.puzzleOperations![0]!.status).toBe('applied')
    const saved = await repo.load('owner'), result = saved.logs.find(l => l.kind === 'puzzleResults')!
    expect(result.data.exp).toHaveLength(5); expect(result.data.materials).toContainEqual({ itemId: 'constellation:ura-finale:front', gross: 1, debtPaid: 1, net: 0 })
    expect((await repo.sync('owner', req([settle]))).puzzleOperations![0]!.status).toBe('duplicate')
    if (reserve.payload.kind !== 'reserve') throw new Error('Fixture')
    const input = reserve.payload.encounter.input
    expect(await repo.puzzleTakeover('owner', { schemaVersion: 1, checkpointId: input.checkpointId, battleId: input.battleId, expectedEpoch: 0, deviceId: 'late-device' }))
      .toEqual({ status: 'settled', result })
    expect((await repo.load('owner')).logs.filter(l => l.kind === 'puzzleResults')).toHaveLength(1)
  })
})

describe('standalone API packaging and parser parity', () => {
  it('checks the generated dependency closure byte-for-byte; the production build runs only API files', () => {
    // The shared save parser now includes additive Farm transport. Bound the AST subprocess without weakening parity.
    expect(execFileSync(process.execPath, ['scripts/sync-puzzle-adapter.mjs', '--check'],
      { cwd: process.cwd(), encoding: 'utf8', timeout: 20000 })).toMatch(/verified: 86/)
  }, 30000)
  it('agrees with domain on every synthetic entity/log and malformed operations', async () => {
    const pure: { parsePuzzleOperation: typeof parsePuzzleOperation; parsePuzzleEntity: typeof parsePuzzleEntity; parsePuzzleOperationReceipt: typeof parsePuzzleOperationReceipt } = await import(`${sourcePath}/operations.ts`)
    const records: { parsePuzzleEntity: typeof parsePuzzleEntity } = await import(`${sourcePath}/records.ts`)
    const f = await fixture(), op = f.operation(spend)
    for (const body of [op, { ...op, schemaVersion: 2 }, { ...op, payload: { ...spend, quantity: 99 } }, { ...op, dependencies: [op.operationId] }, Object.assign(Object.create({ hidden: true }), op)])
      expect(parsePuzzleOperation(body)).toEqual(pure.parsePuzzleOperation(body))
    for (const row of f.entities.values()) if (row.kind.startsWith('puzzle') || row.kind === 'constellationBank') {
      expect(parsePuzzleEntity(row.kind, row.data)).toEqual(records.parsePuzzleEntity(row.kind, row.data))
      expect(parseEntityData(row.kind as EntityRecord['kind'], row.data)).not.toBeNull()
    }
    const receipt = f.apply(op).responses[0]!.receipt
    expect(parsePuzzleOperationReceipt(receipt)).toEqual(pure.parsePuzzleOperationReceipt(receipt))
    expect(parseLogData('puzzleOperations', receipt)).not.toBeNull()
    expect(parseSyncRequest({ ...req([op]), upserts: [{ kind: 'puzzleOutfits', id: 'invented-0', baseVersion: 1, data: f.entities.get('puzzleOutfits/invented-0')!.data }] })).toMatch(/semantic/)
  })
  it('preflights document/group/byte bounds before making repository reads', async () => {
    const f = await fixture(), fake = new StrictFirestore(), repo = new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0], true)
    const ops = Array.from({ length: 17 }, (_, i) => f.operation(spend, `op-${i}`))
    await expect(repo.sync('owner', req(ops))).rejects.toThrow(/bounds/); expect(fake.reads).toBe(0)
    const mixed = { ...req([ops[0]!]), upserts: Array.from({ length: 200 }, (_, i) => ({ kind: 'items' as const, id: `invented-item-${i}`, baseVersion: 0,
      data: { itemId: `invented-item-${i}`, quantity: 1, updatedAt: 1 } })) }
    await expect(repo.sync('owner', mixed)).rejects.toThrow(/too many/); expect(fake.reads).toBe(0)
    const response = await repo.sync('owner', req([f.operation(spend)]))
    expect(response.puzzleOperations![0]!.reason).toMatch(/preparation/)
  })
  it('does not publish any Firestore writes when the synthetic transaction fails', async () => {
    const f = await fixture(), fake = new StrictFirestore()
    for (const [k, r] of f.entities) fake.docs.set(`players/owner/${k}`, toStored(asEntity(r)))
    fake.failCommit = true
    const repo = new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0], true), before = structuredClone([...fake.docs])
    await expect(repo.sync('owner', req([f.operation(spend)]))).rejects.toThrow(/transaction failure/)
    expect([...fake.docs]).toEqual(before)
  })
})
