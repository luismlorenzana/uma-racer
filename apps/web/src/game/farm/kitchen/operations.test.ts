// Synthetic IndexedDB transactions only. The live Farm never adopts these fixtures.
import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { farmProtocolFixture } from '../../../../../../packages/domain/src/farm/kitchen/protocol-fixtures'
import { farmCanonical, parseFarmKitchenState, FARM_KITCHEN_JOB_MS, type FarmStoredEntity } from '@racer/domain/farm/kitchen'
import { RacerDb } from '../../db'
import { FarmOperationCoordinator, farmTransactionTables } from './operations'
let seq = 0
const start = { kind: 'start' as const, stationId: 'garden-1' as const, outfitId: 'invented-0', recipeId: 'farm:raw:ura-finale:vegetable:speed', quantity: 1, choices: {} }
async function put(db: RacerDb, row: FarmStoredEntity) { await db.table(row.kind).put({ id: row.id, data: row.data, version: row.version, updatedAt: row.updatedAt, deleted: row.deleted }) }
describe('acknowledged-only Farm coordinator', () => {
  let db: RacerDb, f: ReturnType<typeof farmProtocolFixture>, schedule: ReturnType<typeof vi.fn>, coordinator: FarmOperationCoordinator
  beforeEach(async () => {
    db = new RacerDb(`farm-kitchen-test-${++seq}`); await db.open(); f = farmProtocolFixture(); schedule = vi.fn()
    for (const row of f.entities.values()) await put(db, row)
    coordinator = new FarmOperationCoordinator(db, schedule, true)
  })
  afterEach(async () => db.delete())
  it('stores intent/overlay atomically, without touching canonical stations, workers or Items', async () => {
    const before = farmCanonical(await db.farm.get('main')), op = await coordinator.enqueue(start, 'start', [], 1000)
    expect(farmCanonical(await db.farm.get('main'))).toBe(before); expect(await db.items.count()).toBe(0)
    expect((await db.farmWorkers.get('invented-0'))!.data.totalExp).toBe(0)
    expect(await db.farmPending.count()).toBe(1); expect(await db.outbox.toArray()).toMatchObject([{ op: 'farm' }])
    expect(await coordinator.enqueue(start, 'start', [], 2000)).toEqual(op); expect(await db.outbox.count()).toBe(1)
    await expect(coordinator.enqueue({ ...start, recipeId: 'farm:raw:ura-finale:vegetable:power' }, 'start')).rejects.toThrow(/reused/)
    db.close(); await db.open(); expect(await coordinator.nextBatch()).toEqual([op])
    const overlay = await db.transaction('r', farmTransactionTables(db), () => coordinator.overlayInTransaction())
    expect(overlay.entities.get('farm/main')!.data).toMatchObject({ stations: [{ job: { id: `farm-job:${f.generation}:garden-1:1` } }] })
    expect(schedule).toHaveBeenCalledTimes(2)
  })
  it('accepts exact receipts and lost replies once; pending outputs only exist in overlays', async () => {
    const op = await coordinator.enqueue(start, 'start', [], 1000), first = f.apply(op)
    await coordinator.adopt([op], first.responses, 1000)
    const claim = await coordinator.enqueue({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', jobId: `farm-job:${f.generation}:garden-1:1`, recipeId: start.recipeId }, 'claim', [], 1000 + FARM_KITCHEN_JOB_MS)
    expect(await db.items.get(start.recipeId)).toBeUndefined()
    const accepted = f.apply(claim), lostReply = f.apply(claim)
    await coordinator.adopt([claim], lostReply.responses, 1000 + FARM_KITCHEN_JOB_MS)
    expect((await db.items.get(start.recipeId))!.data.quantity).toBe(6); expect((await db.farmWorkers.get('invented-0'))!.data.totalExp).toBe(12)
    await coordinator.adopt([claim], accepted.responses, 1000 + FARM_KITCHEN_JOB_MS)
    expect((await db.items.get(start.recipeId))!.data.quantity).toBe(6); expect(await db.itemLedger.count()).toBe(1)
    expect(await db.farmPending.count()).toBe(0); expect(await db.outbox.count()).toBe(0)
  })
  it('requires pending producer dependencies and blocks descendants after a rejected ancestor', async () => {
    const first = await coordinator.enqueue(start, 'first', [], 1000)
    const claim = { kind: 'claim' as const, stationId: 'garden-1' as const, outfitId: 'invented-0', jobId: `farm-job:${f.generation}:garden-1:1`, recipeId: start.recipeId }
    await expect(coordinator.enqueue(claim, 'second', [], 1000 + FARM_KITCHEN_JOB_MS)).rejects.toThrow(/depend/)
    await coordinator.enqueue(claim, 'second', ['first'], 1000 + FARM_KITCHEN_JOB_MS)
    const owned = f.entities.get('umas/invented-0')!; owned.version++
    const rejected = f.apply(first); expect(rejected.responses[0]!.status).toBe('rejected')
    await coordinator.adopt([first], rejected.responses, 1000)
    expect((await db.farmPending.get('first'))!.status).toBe('rejected'); expect((await db.farmPending.get('second'))!.status).toBe('blocked')
    expect(await db.items.count()).toBe(0); expect(await db.outbox.count()).toBe(0); expect(await db.farmRecovery.count()).toBe(2)
  })
  it('never overwrites a newer canonical Item/worker or an unrelated Uma edit with an old acknowledgement', async () => {
    const op = await coordinator.enqueue({ kind: 'grant-energy' }, 'grant', [], 1000), response = f.apply(op).responses
    const uma = (await db.umas.get('invented-0'))!; uma.data.exp = 99; await db.umas.put(uma)
    await db.items.put({ id: 'farm:energy', version: 3, data: { itemId: 'farm:energy', quantity: 80, updatedAt: 2000 } })
    await coordinator.adopt([op], response, 1000)
    expect((await db.items.get('farm:energy'))!.data.quantity).toBe(80); expect((await db.umas.get('invented-0'))!.data.exp).toBe(99)
  })
  it.each(['order', 'pending', 'outbox'])('rolls enqueue back after %s without scheduling or orphaning intent', async failure => {
    const broken = new FarmOperationCoordinator(db, schedule, true, key => { if (key === failure) throw new Error('Synthetic failure') })
    await expect(broken.enqueue(start, 'fault', [], 1000)).rejects.toThrow(/Synthetic/)
    expect(await db.farmPending.count()).toBe(0); expect(await db.outbox.count()).toBe(0); expect(await db.farmPreferences.count()).toBe(0); expect(schedule).not.toHaveBeenCalled()
  })
  it('rolls back after every acknowledgement write, including economic evidence and pending/outbox markers', async () => {
    const startOp = await coordinator.enqueue(start, 'start', [], 1000); await coordinator.adopt([startOp], f.apply(startOp).responses, 1000)
    const op = await coordinator.enqueue({ kind: 'claim', stationId: 'garden-1', outfitId: 'invented-0', jobId: `farm-job:${f.generation}:garden-1:1`, recipeId: start.recipeId }, 'claim', [], 1000 + FARM_KITCHEN_JOB_MS)
    const responses = f.apply(op).responses, writes: string[] = []
    const observer = new FarmOperationCoordinator(db, () => undefined, true, key => writes.push(key))
    // Discover every write on a separate isolated clone, then fault the real transaction at every boundary.
    const clone = new RacerDb(`farm-fault-clone-${++seq}`); await clone.open()
    for (const t of farmTransactionTables(db)) for (const row of await t.toArray()) await clone.table(t.name).put(row)
    const cloneCoordinator = new FarmOperationCoordinator(clone, () => undefined, true, key => writes.push(key))
    await cloneCoordinator.adopt([op], responses, 1000 + FARM_KITCHEN_JOB_MS); await clone.delete()
    expect(writes.some(k => k.startsWith('itemLedger/'))).toBe(true); expect(writes).toContain('farmWorkers/invented-0')
    for (let stop = 0; stop < writes.length; stop++) {
      let step = 0
      const broken = new FarmOperationCoordinator(db, schedule, true, () => { if (step++ === stop) throw new Error('Synthetic ack failure') })
      await expect(broken.adopt([op], responses, 1000 + FARM_KITCHEN_JOB_MS)).rejects.toThrow(/Synthetic ack/)
      expect(await db.items.get(start.recipeId)).toBeUndefined(); expect((await db.farmWorkers.get('invented-0'))!.data.totalExp).toBe(0)
      expect(await db.itemLedger.count()).toBe(0); expect(await db.farmOperations.count()).toBe(1)
      expect(await db.farmPending.get('claim')).toBeDefined(); expect(await db.outbox.count()).toBe(1)
    }
    expect(observer).toBeDefined()
  })
  it('reserves monotonically across reloads and does not install a production host', async () => {
    expect(await coordinator.reserveOperationId('invented-device')).toBe('fop:invented-device:1')
    db.close(); await db.open(); expect(await coordinator.reserveOperationId('invented-device')).toBe('fop:invented-device:2')
    await expect(new FarmOperationCoordinator(db, schedule).enqueue(start, 'disabled')).rejects.toThrow(/disabled/)
  })
  it('rolls back every map-purchase acknowledgement boundary without losing the meal or creating a paid node', async () => {
    const id = 'farm:meal:b1:speed'; f.put('items', id, { itemId: id, quantity: 1, updatedAt: 1 }); await put(db, f.entities.get(`items/${id}`)!)
    const op = await coordinator.enqueue({ kind: 'buy-node', outfitId: 'invented-0', scenarioId: 'ura-finale', distance: 'sprint', nodeId: 'speed-01', autoactivate: true }, 'buy', [], 1000)
    const responses = f.apply(op).responses, writes: string[] = []
    const clone = new RacerDb(`farm-map-fault-clone-${++seq}`); await clone.open()
    for (const t of farmTransactionTables(db)) for (const row of await t.toArray()) await clone.table(t.name).put(row)
    await new FarmOperationCoordinator(clone, () => undefined, true, key => writes.push(key)).adopt([op], responses, 1000); await clone.delete()
    expect(writes).toContain('farmExtra/invented-0:b1')
    for (let stop = 0; stop < writes.length; stop++) {
      let n = 0
      await expect(new FarmOperationCoordinator(db, schedule, true, () => { if (n++ === stop) throw new Error('Synthetic map failure') }).adopt([op], responses, 1000)).rejects.toThrow(/Synthetic map/)
      expect((await db.items.get(id))!.data.quantity).toBe(1); expect(await db.farmExtra.count()).toBe(0)
      expect(await db.farmOperations.count()).toBe(0); expect(await db.itemLedger.count()).toBe(0); expect(await db.farmPending.count()).toBe(1); expect(await db.outbox.count()).toBe(1)
    }
  })
  it('accepts transitive pending dependencies beyond sixteen offline commands without widening per-command locks', async () => {
    for (let i = 0; i < 20; i++) await coordinator.enqueue({ kind: 'assign', stationId: i % 2 ? 'garden-1' : 'garden-2', outfitId: 'invented-0' }, `move-${i}`, i ? [`move-${i - 1}`] : [], 1000)
    expect((await coordinator.nextBatch()).length).toBe(16)
    expect(await db.farmPending.count()).toBe(20); expect(parseFarmKitchenState((await db.farm.get('main'))!.data)!.stations[0]!.id).toBe('garden-1')
  })
})
