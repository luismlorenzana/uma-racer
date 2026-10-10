// Device-only synthetic recovery/atomic adoption rehearsal. Never opens the owner's IndexedDB/account.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parsePlayerProfileOrThrow, type SaveSnapshot } from '@racer/domain'
import { farmCutoverFixture } from '../../../../../../packages/domain/src/farm/kitchen/cutover-fixtures'
import { farmCutoverControl, farmCutoverSource, resolveFarmCutover } from '@racer/domain/farm/kitchen'
import { RacerDb, db as singletonDb, type FarmRecoveryRow } from '../../db'
import { adoptServerSnapshot, reconcileFarmProjectionsInTransaction } from '../../persistence'
import { farmTransactionTables } from './operations'
import { farmSha256, retainFarmArchive, verifyFarmArchive, farmArchiveProof, FARM_ARCHIVE_REASON } from './backup'
import { prepareFarmCutoverOnce, adoptFarmCutoverInTransaction, readFarmCutoverRecovery, type FarmCutoverPorts } from './cutover'
import { clearLegacyProduce } from './legacy-produce'
let sequence = 0
describe('Farm archive and local cutover', () => {
  let db: RacerDb, f: ReturnType<typeof farmCutoverFixture>, ports: FarmCutoverPorts, lost: boolean
  const snapshot = (): SaveSnapshot => ({ entities: structuredClone([...f.entities.values()]) as SaveSnapshot['entities'],
    logs: structuredClone([...f.logs.values()]) as SaveSnapshot['logs'], serverTime: 100 })
  beforeEach(async () => {
    f = farmCutoverFixture(2, 14, 'absent'); db = new RacerDb(`farm-cutover-rehearsal-${++sequence}`); await db.open(); lost = false
    for (const r of f.entities.values()) await db.table(r.kind).put({ id: r.id, data: r.data, version: r.version })
    ports = { accountId: 'invented-account', build: 'invented-build', persistent: () => true, online: () => true,
      safeToPrepare: () => true, current: () => true, snapshot: vi.fn(async () => snapshot()), publish: vi.fn(async () => {}),
      prepare: vi.fn(async request => {
        const sourceDigest = !farmCutoverControl(f.entities) ? await farmSha256(farmCutoverSource(ports.accountId, f.entities, f.logs)) : undefined
        const result = resolveFarmCutover({ enabled: true, accountId: ports.accountId, now: 100, entities: f.entities, logs: f.logs, sourceDigest }, request)
        result.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => f.logs.set(`${r.kind}/${r.id}`, r))
        if (lost) { lost = false; throw new Error('Injected lost reply') }
        return result.response
      }) }
  })
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await db.delete(); await singletonDb.delete() })
  it('captures every canonical table plus device intents/journals, verifies identity/SHA-256/readback, never replaces Puzzle archive', async () => {
    await db.pendingRpgCommands.put({ id: 'invented-intent', body: { invented: true }, status: 'conflict', conflict: { invented: true }, queuedAt: 1 })
    await db.rpgFights.put({ id: 'invented-fight', actions: [], updatedAt: 1 })
    await db.puzzleArchives.put({ id: 'invented-puzzle-backup', reason: 'preserved', data: { invented: true }, createdAt: 1 })
    const before = await db.puzzleArchives.toArray(), saved = await retainFarmArchive(db, snapshot(), ports.accountId, ports.build, () => true, 100)
    expect(saved.archive.localTables.pendingRpgCommands).toHaveLength(1); expect(saved.archive.localTables.rpgFights).toHaveLength(1)
    expect(Object.keys(saved.archive.localTables).sort()).toEqual(db.tables.map(t => t.name).sort())
    expect(await verifyFarmArchive(saved.archive, ports.accountId, 1)).toEqual(saved.archive)
    expect(await verifyFarmArchive(JSON.parse(JSON.stringify(saved.archive)), ports.accountId, 1)).toEqual(saved.archive)
    expect((await farmArchiveProof(saved.archive)).archiveDigest).toHaveLength(64)
    expect(await db.puzzleArchives.toArray()).toEqual(before)
    await expect(verifyFarmArchive(saved.archive, 'different-account', 1)).rejects.toThrow(/identity/)
    await expect(verifyFarmArchive({ ...saved.archive, build: 'tampered' }, ports.accountId, 1)).rejects.toThrow(/digest/)
    await expect(verifyFarmArchive({ ...saved.archive, schemaVersion: 2 }, ports.accountId, 1)).rejects.toThrow(/schema/)
  })
  it('archives a local row holding an undefined field as its JSON export holds it (D319)', async () => {
    await db.rpgFights.put({ id: 'invented-fight', actions: [{ kind: 'attack', actorId: 'a', targetId: 'b', weapon: undefined } as never], updatedAt: 1 })
    const saved = await retainFarmArchive(db, snapshot(), ports.accountId, ports.build, () => true, 100)
    expect(saved.archive.localTables.rpgFights).toEqual([{ id: 'invented-fight', actions: [{ kind: 'attack', actorId: 'a', targetId: 'b' }], updatedAt: 1 }])
    expect(await verifyFarmArchive(JSON.parse(JSON.stringify(saved.archive)), ports.accountId, 1)).toEqual(saved.archive)
    expect(await prepareFarmCutoverOnce(db, ports, true, 101)).toBe(true)
  })
  it('blocks failed storage, readback, exportability, unknown local/server saves and oversize archives before any protected call', async () => {
    const spy = vi.spyOn(db.farmRecovery, 'add').mockRejectedValueOnce(new Error('Injected quota failure'))
    expect(await prepareFarmCutoverOnce(db, ports, true, 100)).toBe(false); expect(ports.prepare).not.toHaveBeenCalled(); spy.mockRestore()
    await expect(retainFarmArchive(db, snapshot(), ports.accountId, ports.build, () => true, 101, () => { throw new Error('Injected storage write failure') })).rejects.toThrow(/storage/)
    expect((await db.farmRecovery.toArray()).filter(r => r.reason === FARM_ARCHIVE_REASON)).toHaveLength(0)
    // Narrow Dexie's overloaded get for a string-key readback fault, without replacing its production types.
    const recovery = db.farmRecovery as unknown as { get: (key: string) => Promise<FarmRecoveryRow | undefined> }
    const get = recovery.get.bind(db.farmRecovery); let reads = 0
    const missing = vi.spyOn(recovery, 'get').mockImplementation(async key =>
      typeof key === 'string' && key.startsWith('farm-archive:') && ++reads === 2 ? undefined : get(key))
    await expect(retainFarmArchive(db, snapshot(), ports.accountId, ports.build, () => true, 101)).rejects.toThrow(/readback/)
    missing.mockRestore()
    const saved = await retainFarmArchive(db, snapshot(), ports.accountId, ports.build, () => true, 102)
    vi.stubGlobal('Blob', class { constructor() { throw new Error('Injected export failure') } })
    await expect(verifyFarmArchive(saved.archive, ports.accountId, 1)).rejects.toThrow(/export/); vi.unstubAllGlobals()
    await db.farmWorkers.put({ id: 'invented-0000', data: { schemaVersion: 99 }, version: 1, deleted: false, updatedAt: 1 })
    expect(await prepareFarmCutoverOnce(db, ports, true, 103)).toBe(false); expect(ports.prepare).not.toHaveBeenCalled()
    await db.farmWorkers.delete('invented-0000')
    const future = snapshot(); future.entities.find(r => r.kind === 'umas')!.data.schemaVersion = 999
    await expect(retainFarmArchive(db, future, ports.accountId, ports.build, () => true, 104)).rejects.toThrow(/update/)
    await expect(verifyFarmArchive({ ...saved.archive, localTables: { oversized: ['x'.repeat(64 * 1024 * 1024)] } }, ports.accountId, 1)).rejects.toThrow(/size/)
  })
  it('defers offline/nonpersistent/in-flight race or CL commits and unresolved spend without discarding intent', async () => {
    for (const guard of ['online', 'persistent', 'safeToPrepare'] as const) {
      const original = ports[guard]; ports[guard] = () => false
      expect(await prepareFarmCutoverOnce(db, ports, true, 100)).toBe(false); ports[guard] = original
    }
    await db.outbox.add({ kind: 'umas', id: 'invented-0000', op: 'upsert', queuedAt: 1 })
    expect(await prepareFarmCutoverOnce(db, ports, true, 100)).toBe(false); expect(await db.outbox.count()).toBe(1)
    expect((await readFarmCutoverRecovery(db))!.phase).toBe('needs-sync'); expect(ports.prepare).not.toHaveBeenCalled()
    await db.outbox.clear(); expect(await prepareFarmCutoverOnce(db, ports, true, 101)).toBe(true)
    expect(farmCutoverControl(f.entities)!.phase).toBe('preparing')
  })
  it('resumes lost prepare/step acknowledgements exactly and preserves a newer queued non-Farm edit', async () => {
    lost = true; expect(await prepareFarmCutoverOnce(db, ports, true, 100)).toBe(false)
    expect(farmCutoverControl(f.entities)!.nextOutfitIndex).toBe(0)
    lost = true; expect(await prepareFarmCutoverOnce(db, ports, true, 101)).toBe(false)
    expect(farmCutoverControl(f.entities)!.nextOutfitIndex).toBe(1)
    const durable = (await readFarmCutoverRecovery(db))!.request
    expect(durable).toMatchObject({ action: 'advance', index: 0 })
    expect(await prepareFarmCutoverOnce(db, ports, true, 102)).toBe(true)
    expect(farmCutoverControl(f.entities)!.nextOutfitIndex).toBe(1)
    const u = (await db.umas.get('invented-0001'))!
    u.data.exp = 77; u.data.activePreset = 'long'; await db.umas.put(u)
    // A local edit arriving while a bounded server call is in flight must be preserved at acknowledgement.
    const prepare = ports.prepare
    ports.prepare = async r => { const result = await prepare(r); await db.outbox.add({ kind: 'umas', id: u.id, op: 'upsert', queuedAt: 102 }); return result }
    expect(await prepareFarmCutoverOnce(db, ports, true, 103)).toBe(true)
    expect((await db.umas.get(u.id))!.data.exp).toBe(77); expect((await db.umas.get(u.id))!.data.activePreset).toBe('long')
    expect((await db.umas.get(u.id))!.data.scenarios.every(s => Object.values(s.extraStatsUnlocked).every(n => n === 0))).toBe(true)
    expect(await db.outbox.count()).toBe(1); ports.prepare = prepare; await db.outbox.clear()
    for (let i = 0; i < 2; i++) expect(await prepareFarmCutoverOnce(db, ports, true, 104 + i)).toBe(true)
    expect(farmCutoverControl(f.entities)!.phase).toBe('active')
    const archive = (await db.farmRecovery.toArray()).find(r => r.reason === FARM_ARCHIVE_REASON)!
    expect(archive).toBeDefined(); expect((await readFarmCutoverRecovery(db))!.phase).toBe('active')
  })
  it('rolls back every local adoption write, including the receipt and cursor', async () => {
    expect(await prepareFarmCutoverOnce(db, ports, true, 100)).toBe(true)
    const ack = await ports.prepare({ schemaVersion: 1, generation: 'farm-kitchen-v1', action: 'advance', index: 0 })
    const response = ack as Awaited<ReturnType<typeof resolveFarmCutover>>['response']
    const kinds = ['umas', 'farm', 'farmWorkers', 'farmRecipes', 'farmExtra', 'farmCutover', 'farmCutoverPages', 'farmOperations', 'farmRecovery', 'outbox']
    const read = async () => Promise.all(kinds.map(k => db.table(k).toArray())), before = await read()
    for (let at = 1; at <= response.entities.length + 1; at++) {
      let count = 0
      await expect(db.transaction('rw', kinds.map(k => db.table(k)), () => adoptFarmCutoverInTransaction(db, response,
        () => { if (++count === at) throw new Error('Injected local write failure') }))).rejects.toThrow(/write failure/)
      expect(await read()).toEqual(before)
    }
  })
  it('keeps a stale archive when server source changes, then retains a fresh one for a safe retry', async () => {
    const prepare = ports.prepare; let first = true
    ports.prepare = async r => { if (first) { first = false; f.entities.get('umas/invented-0000')!.version++ } return prepare(r) }
    expect(await prepareFarmCutoverOnce(db, ports, true, 100)).toBe(false)
    expect(f.entities.has('farmCutover/main')).toBe(false)
    expect((await readFarmCutoverRecovery(db))!.message).toMatch(/stale/)
    expect(await prepareFarmCutoverOnce(db, ports, true, 101)).toBe(true)
    expect((await db.farmRecovery.toArray()).filter(r => r.reason === FARM_ARCHIVE_REASON)).toHaveLength(2)
  })
  it('a new device adopts active state without a reset or archive; stale full pulls/evidence cannot resurrect Extra or EXP', async () => {
    for (let i = 0; i < 5; i++) expect(await prepareFarmCutoverOnce(db, ports, true, 100 + i)).toBe(true)
    const active = snapshot(), workerBefore = structuredClone(f.entities.get('farmWorkers/invented-0000'))
    await db.delete(); db = new RacerDb(`farm-new-device-${++sequence}`); await db.open()
    // Install only the correct profile; the full pull below exercises canonical device bootstrap separately.
    await db.profile.put({ id: 'main', version: 1, data: parsePlayerProfileOrThrow(active.entities.find(r => r.kind === 'profile')!.data) })
    expect(await prepareFarmCutoverOnce(db, ports, true, 200)).toBe(true)
    expect(vi.mocked(ports.prepare).mock.calls.at(-1)![0].action).toBe('status')
    expect((await db.farmRecovery.toArray()).some(r => r.reason === FARM_ARCHIVE_REASON)).toBe(false)
    expect(f.entities.get('farmWorkers/invented-0000')).toEqual(workerBefore)
    await singletonDb.open(); await adoptServerSnapshot(active)
    const old = farmCutoverFixture(2, 14, 'absent'), stale = { entities: [...old.entities.values()], logs: [], serverTime: 50 }
    await adoptServerSnapshot(stale)
    expect((await singletonDb.umas.get('invented-0000'))!.data.scenarios.every(s => Object.values(s.extraStatsUnlocked).every(v => v === 0))).toBe(true)
    const workers = await singletonDb.farmWorkers.toArray()
    await singletonDb.transaction('rw', farmTransactionTables(singletonDb), () => reconcileFarmProjectionsInTransaction(300))
    expect(await singletonDb.farmWorkers.toArray()).toEqual(workers)
  })
  it('clears old Produce stacks only once the new Farm is active (D319)', async () => {
    await db.items.put({ id: 'produce:t1:speed', version: 3, data: { itemId: 'produce:t1:speed', quantity: 4, updatedAt: 1 } })
    await db.items.put({ id: 'inspiration:t1:slot', version: 2, data: { itemId: 'inspiration:t1:slot', quantity: 6, updatedAt: 1 } })
    expect(await clearLegacyProduce(db, 50)).toEqual([])
    for (let i = 0; i < 5; i++) expect(await prepareFarmCutoverOnce(db, ports, true, 100 + i)).toBe(true)
    expect((await db.farmCutover.get('main'))!.data).toMatchObject({ phase: 'active' })
    expect(await clearLegacyProduce(db, 200)).toEqual(['produce:t1:speed'])
    expect((await db.items.get('produce:t1:speed'))).toMatchObject({ version: 3, data: { itemId: 'produce:t1:speed', quantity: 0, updatedAt: 200 } })
    expect((await db.items.get('inspiration:t1:slot'))!.data.quantity).toBe(6)
    expect((await db.outbox.toArray()).map(r => `${r.op}:${r.kind}/${r.id}`)).toEqual(['upsert:items/produce:t1:speed'])
    expect(await clearLegacyProduce(db, 201)).toEqual([])
  })
  it('normal capability-off path performs no storage or network access and leaves malformed recovery untouched', async () => {
    db.close()
    expect(await prepareFarmCutoverOnce(db, ports, false)).toBe(false); expect(ports.snapshot).not.toHaveBeenCalled(); expect(ports.prepare).not.toHaveBeenCalled()
    await db.open(); const data = { schemaVersion: 99, keep: true }
    await db.farmRecovery.put({ id: 'farm-cutover-recovery-v1', reason: 'future', data, createdAt: 1 })
    expect(await prepareFarmCutoverOnce(db, ports, true)).toBe(false)
    expect((await db.farmRecovery.get('farm-cutover-recovery-v1'))!.data).toEqual(data)
  })
})
