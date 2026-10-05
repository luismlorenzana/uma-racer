// Invented account rows exercise both production-shaped persistence implementations, never owner data.
import 'fake-indexeddb/auto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createUmaSave, createScenarioTraining, parseSaveSnapshotOrThrow, parseInspirationBank, type UmaTemplate, type UmaSave } from '@racer/domain'
import { parseInspirationBank as parseApiBank } from '../../../api/src/save/inspiration-bank'
import { bankData, freezeAdvance, advanceOutfit } from '../../../api/src/save/inspiration-advance'
import { LocalSaveRepository } from '../../../api/src/save/local-save.repository'
import { FirestoreSaveRepository } from '../../../api/src/save/firestore-save.repository'
import { parseSyncRequest, type EntityRecord } from '../../../api/src/save/save.types'
import type { SaveRepository } from '../../../api/src/save/save.repository'
import { RacerDb } from './db'
import { advanceInspirationOnce, useInspirationAdvanceStatus } from './inspiration-advance'

const template = (id: string): UmaTemplate => ({ id, charaId: id, name: 'Invented worker', outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }, growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'G', mile: 'A', medium: 'A', long: 'G' }, strategy: { front: 'A', pace: 'G', late: 'G', end: 'G' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/invented.png' })
const uma = (id: string) => {
  const save = createUmaSave(template(id)); save.exp = 77
  save.scenarios[0]!.inspiration = { slots: ['parent0'], golds: ['parent0:gold0'] }
  save.scenarios[0]!.presets.mile.assignments.parent0 = { kind: 'lineage', templateId: 'invented-ancestor' }
  return save
}
const entity = (save: UmaSave): EntityRecord => ({ kind: 'umas', id: save.templateId, data: save as unknown as Record<string, unknown>, version: 1, deleted: false, updatedAt: 1 })

// Minimal serial Firestore transaction double; writes only land after successful completion.
class Ref { constructor(readonly path: string, readonly db: FirestoreDouble) {} collection(name: string) { return new Collection(`${this.path}/${name}`, this.db) } }
class Collection {
  constructor(readonly path: string, readonly db: FirestoreDouble) {}
  doc(id: string) { return new Ref(`${this.path}/${id}`, this.db) }
  async get() { return { docs: [...this.db.docs].filter(([key]) => key.startsWith(`${this.path}/`) && !key.slice(this.path.length + 1).includes('/')).map(([, data]) => ({ data: () => data })) } }
}
class FirestoreDouble {
  readonly docs = new Map<string, Record<string, unknown>>()
  private queue: Promise<unknown> = Promise.resolve()
  failOutfit: string | null = null
  collection(name: string) { return new Collection(name, this) }
  async getAll(...refs: Ref[]) { return refs.map(ref => ({ exists: this.docs.has(ref.path), data: () => this.docs.get(ref.path)! })) }
  runTransaction<T>(fn: (tx: { getAll: (...refs: Ref[]) => ReturnType<FirestoreDouble['getAll']>; get: (query: Collection) => ReturnType<Collection['get']>; set: (ref: Ref, data: Record<string, unknown>) => void }) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const writes: [string, Record<string, unknown>][] = []
      const result = await fn({ getAll: async (...refs) => {
        if (this.failOutfit && refs.some(ref => ref.path.endsWith(`/umas/${this.failOutfit}`))) throw new Error('Interrupted after a completed outfit')
        return this.getAll(...refs)
      }, get: query => query.get(), set: (ref, data) => { writes.push([ref.path, data]) } })
      writes.forEach(([key, data]) => this.docs.set(key, data)); return result
    })
    this.queue = run.catch(() => undefined); return run
  }
}
for (const backend of ['local', 'firestore'] as const) describe(`${backend} account Inspiration advance`, () => {
  let repo: SaveRepository, dir: string | undefined, fake: FirestoreDouble
  beforeEach(async () => {
    fake = new FirestoreDouble()
    if (backend === 'local') { dir = await mkdtemp(join(tmpdir(), 'racer-advance-')); repo = new LocalSaveRepository(join(dir, 'save.json')) }
    else repo = new FirestoreSaveRepository(fake as unknown as ConstructorParameters<typeof FirestoreSaveRepository>[0])
    await repo.sync('invented-owner', { upserts: [uma('invented-a'), uma('invented-b')].map(save => ({ kind: 'umas', id: save.templateId, baseVersion: 0, data: entity(save).data })), appends: [] })
  })
  afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); dir = undefined })
  it('opens all positions, includes already open nodes once, preserves presets and inventory, excludes future units', async () => {
    const stock = { itemId: 'inspiration:t1:slot', quantity: 9, updatedAt: 1 }
    await repo.sync('invented-owner', { upserts: [{ kind: 'items', id: stock.itemId, baseVersion: 0, data: stock }], appends: [] })
    const snapshot = await repo.advanceInspiration('invented-owner')
    expect(parseSaveSnapshotOrThrow(snapshot).entities).toHaveLength(3)
    const bank = bankData(snapshot.entities.find(r => r.kind === 'inspirationBank')!)
    expect(bank.balances).toEqual({ 'inspiration:t1:slot': -12, 'inspiration:t1:skill': -24 })
    expect(parseApiBank(bank)).toEqual(parseInspirationBank(bank))
    for (const r of snapshot.entities.filter(r => r.kind === 'umas')) {
      const after = r.data as unknown as UmaSave, before = uma(r.id)
      expect(after.scenarios[0]!.inspiration.slots).toHaveLength(6); expect(after.scenarios[0]!.inspiration.golds).toHaveLength(12)
      expect({ ...after, scenarios: after.scenarios.map(s => ({ ...s, inspiration: before.scenarios[0]!.inspiration })) }).toEqual(before)
    }
    const advanced = snapshot.entities.find(r => r.kind === 'umas' && r.id === 'invented-a')!
    const later = { ...advanced.data, unlockedTier: 2, level: 11, scenarios: [...(advanced.data.scenarios as object[]), createScenarioTraining(2)] }
    await repo.sync('invented-owner', { upserts: [{ kind: 'umas', id: advanced.id, baseVersion: advanced.version, data: later },
      { kind: 'umas', id: 'future-outfit', baseVersion: 0, data: entity(uma('future-outfit')).data }], appends: [] })
    const again = await repo.advanceInspiration('invented-owner')
    expect(again.entities.find(r => r.kind === 'inspirationBank')!.data).toEqual(bank)
    expect((again.entities.find(r => r.id === advanced.id)!.data.scenarios as UmaSave['scenarios'])[1]!.inspiration.slots).toEqual([])
    const save = await repo.load('invented-owner')
    expect(save.entities.find(r => r.kind === 'items')!.data).toEqual(stock)
    expect((save.entities.find(r => r.id === 'future-outfit')!.data.scenarios as UmaSave['scenarios'])[0]!.inspiration.slots).toEqual(['parent0'])
  })
  it('two callers charge once; stale/matched writes cannot close unlocks or mutate the bank', async () => {
    await Promise.all([repo.advanceInspiration('invented-owner'), repo.advanceInspiration('invented-owner')])
    const rows = (await repo.load('invented-owner')).entities, bank = rows.find(r => r.kind === 'inspirationBank')!, saved = rows.find(r => r.id === 'invented-a')!
    expect(bankData(bank).balances['inspiration:t1:slot']).toBe(-12)
    expect((await repo.advanceInspiration('another-owner')).entities).toEqual([])
    for (const baseVersion of [1, saved.version]) expect((await repo.sync('invented-owner', { upserts: [{ kind: 'umas', id: saved.id, baseVersion, data: entity(uma(saved.id)).data }], appends: [] })).applied).toEqual([])
    // Ordinary sync may repay the advance (D263) but never deepen its debt or delete it.
    expect(typeof parseSyncRequest({ upserts: [{ kind: 'inspirationBank', id: 'main', baseVersion: bank.version, data: bank.data }] })).toBe('object')
    const deeper = { ...bank.data, balances: { ...bankData(bank).balances, 'inspiration:t1:slot': -13 } }
    expect((await repo.sync('invented-owner', { upserts: [{ kind: 'inspirationBank', id: 'main', baseVersion: bank.version, data: deeper }], appends: [] })).applied).toEqual([])
    expect((await repo.sync('invented-owner', { upserts: [{ kind: 'inspirationBank', id: 'main', baseVersion: bank.version, data: bank.data, deleted: true }], appends: [] })).applied).toEqual([])
  })
  if (backend === 'firestore') it('resumes after a completed transaction without rerunning its debit', async () => {
    fake.failOutfit = 'invented-b'
    await expect(repo.advanceInspiration('invented-owner')).rejects.toThrow(/Interrupted/)
    const partial = bankData((await repo.load('invented-owner')).entities.find(r => r.kind === 'inspirationBank')!)
    expect(partial.opened).toEqual(['invented-a']); expect(partial.balances['inspiration:t1:skill']).toBe(-12)
    fake.failOutfit = null
    const result = await repo.advanceInspiration('invented-owner')
    expect(bankData(result.entities.find(r => r.kind === 'inspirationBank')!).balances['inspiration:t1:skill']).toBe(-24)
  })
})

describe('acknowledged device advance', () => {
  const database = new RacerDb('invented-advance-device')
  const response = () => {
    const row = entity(uma('invented-a')), bank = freezeAdvance([row], 1)!
    return { entities: advanceOutfit(bank, row, row.id, 2), logs: [], serverTime: 2 }
  }
  beforeEach(async () => { await database.delete(); await database.open(); useInspirationAdvanceStatus.setState({ busy: false, error: null }); await database.umas.put({ id: 'invented-a', version: 1, data: uma('invented-a') }); vi.stubGlobal('navigator', { onLine: true }) })
  afterEach(() => { database.close(); vi.unstubAllGlobals() })
  it('adopts once and preserves a new local preset edit queued while the request is in flight', async () => {
    const transport = { advanceInspiration: vi.fn(async () => {
      const row = (await database.umas.get('invented-a'))!
      row.data.exp = 88; row.data.scenarios[0]!.presets.long.assignments.parent0 = { kind: 'lineage', templateId: 'local-ancestor' }
      await database.umas.put(row); await database.outbox.add({ kind: 'umas', id: row.id, op: 'upsert', queuedAt: 2 })
      return response()
    }) }
    expect(await advanceInspirationOnce(database, transport)).toBe(true)
    const saved = (await database.umas.get('invented-a'))!
    expect(saved.version).toBe(2); expect(saved.data.exp).toBe(88)
    expect(saved.data.scenarios[0]!.presets.long.assignments.parent0).toEqual({ kind: 'lineage', templateId: 'local-ancestor' })
    expect(saved.data.scenarios[0]!.inspiration.golds).toHaveLength(12)
    expect(await advanceInspirationOnce(database, transport)).toBe(false); expect(transport.advanceInspiration).toHaveBeenCalledTimes(1)
  })
  it('waits for queued edits, remains unchanged on failure, retries and ignores a late ACK after session stop', async () => {
    const transport = { advanceInspiration: vi.fn(async () => response()) }
    await database.outbox.add({ kind: 'umas', id: 'invented-a', op: 'upsert', queuedAt: 2 })
    expect(await advanceInspirationOnce(database, transport)).toBe(false); expect(transport.advanceInspiration).not.toHaveBeenCalled()
    await database.outbox.clear()
    expect(await advanceInspirationOnce(database, { advanceInspiration: async () => { throw new Error('offline after acceptance') } })).toBe(false)
    expect(useInspirationAdvanceStatus.getState().error).toMatch(/offline/); expect(await database.inspirationBank.count()).toBe(0)
    let active = true
    expect(await advanceInspirationOnce(database, { advanceInspiration: async () => { active = false; return response() } }, () => active)).toBe(false)
    expect(await database.inspirationBank.count()).toBe(0)
    expect(await advanceInspirationOnce(database, transport)).toBe(true)
    expect(useInspirationAdvanceStatus.getState().error).toBeNull()
  })
})
