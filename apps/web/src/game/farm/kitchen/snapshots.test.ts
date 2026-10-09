// Additive storage/bootstrap proofs with fabricated save rows only; never the owner database.
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPlayerProfile, parseSaveSnapshotOrThrow, type EntityRecord } from '@racer/domain'
import { farmProtocolFixture } from '../../../../../../packages/domain/src/farm/kitchen/protocol-fixtures'
import { puzzleProtocolFixture } from '../../../../../../packages/domain/src/minigames/uma-puzzles/protocol-fixtures'
import { db, RacerDb } from '../../db'
import { adoptServerSnapshot, readLocalSnapshot, isDatabaseSemanticallyEmpty, reconcileFarmProjectionsInTransaction } from '../../persistence'
import { FarmOperationCoordinator, farmTransactionTables } from './operations'
const newKinds = ['farmWorkers', 'farmRecipes', 'farmExtra', 'farmCutover', 'farmCutoverPages', 'farmOperations', 'farmPending', 'farmRecovery', 'farmPreferences']
let sequence = 0
const profile = { kind: 'profile' as const, id: 'main', version: 1, deleted: false, updatedAt: 1, data: createPlayerProfile('2026-01-01', 1) as unknown as Record<string, unknown> }
describe('additive v32 and canonical Farm snapshots', () => {
  beforeEach(async () => { await db.delete(); await db.open() })
  afterEach(async () => { await db.delete() })
  it('adds empty stores without modifying any v31 row, history, journal or outbox', async () => {
    const name = `farm-upgrade-proof-${++sequence}`, current = new RacerDb(name), old = new Dexie(name)
    const stores = Object.fromEntries(current.tables.filter(t => !newKinds.includes(t.name)).map(t => [t.name, t.schema.primKey.src +
      (t.schema.indexes.length ? `,${t.schema.indexes.map(i => i.src).join(',')}` : '')]))
    current.close(); old.version(31).stores(stores); await old.open()
    for (const kind of Object.keys(stores)) await old.table(kind).put(kind === 'outbox' ? { kind: 'farm', id: 'main', op: 'upsert', queuedAt: 1 } : { id: 'invented-sentinel', value: kind })
    const before = new Map(await Promise.all(Object.keys(stores).map(async kind => [kind, await old.table(kind).toArray()] as const)))
    old.close(); await current.open()
    for (const [kind, rows] of before) expect(await current.table(kind).toArray(), kind).toEqual(rows)
    for (const kind of newKinds) expect(await current.table(kind).count()).toBe(0)
    await current.delete()
  })
  it('round-trips GET save/JSON/bootstrap without translating v3 through retired EXP evidence', async () => {
    const f = farmProtocolFixture(), op = f.operation({ kind: 'grant-energy' }); f.apply(op)
    const snapshot = JSON.parse(JSON.stringify({ entities: [profile, ...f.entities.values()], logs: [...f.logs.values()], serverTime: 1000 }))
    expect(parseSaveSnapshotOrThrow(snapshot)).toEqual(snapshot)
    expect(await adoptServerSnapshot(snapshot)).toBe('adopted')
    const local = await readLocalSnapshot()
    expect(local!.farm).toBeNull(); expect(local!.farmEntities.filter(r => r.kind === 'farmWorkers')).toHaveLength(2)
    expect(local!.farmLogs).toHaveLength(1); expect(local!.items.find(r => r.id === 'farm:energy')!.data.quantity).toBe(50)
    const before = await db.farmWorkers.toArray()
    await db.transaction('rw', farmTransactionTables(db), () => reconcileFarmProjectionsInTransaction(2000))
    expect(await db.farmWorkers.toArray()).toEqual(before); expect(await db.outbox.count()).toBe(0)
    expect(await isDatabaseSemanticallyEmpty()).toBe(false)
  })
  it('preserves a newer local ordinary Uma edit and Farm stock during a delayed full pull', async () => {
    const f = farmProtocolFixture(), bank = puzzleProtocolFixture().entities.get('constellationBank/main')!
    const snapshot = { entities: [profile, ...f.entities.values(), bank] as EntityRecord[], logs: [], serverTime: 1000 }
    await adoptServerSnapshot(snapshot)
    const uma = (await db.umas.get('invented-0'))!; uma.data.exp = 77; uma.version++
    await db.umas.put(uma); await db.outbox.add({ kind: 'umas', id: uma.id, op: 'upsert', queuedAt: 1200 })
    await db.items.put({ id: 'farm:energy', version: 2, data: { itemId: 'farm:energy', quantity: 80, updatedAt: 1200 } })
    snapshot.entities.push({ kind: 'items', id: 'farm:energy', version: 1, deleted: false, updatedAt: 1000, data: { itemId: 'farm:energy', quantity: 50, updatedAt: 1000 } })
    await adoptServerSnapshot(snapshot)
    expect((await db.umas.get(uma.id))!.data.exp).toBe(77); expect((await db.umas.get(uma.id))!.version).toBe(uma.version)
    expect((await db.items.get('farm:energy'))!.data.quantity).toBe(80)
    expect(await db.outbox.count()).toBe(1)
  })
  it('retains an unacknowledged command through dormant bootstrap and clears it when its receipt is pulled', async () => {
    const f = farmProtocolFixture(), snapshot = { entities: [profile, ...f.entities.values()] as EntityRecord[], logs: [], serverTime: 1000 }
    await adoptServerSnapshot(snapshot)
    const coordinator = new FarmOperationCoordinator(db, () => undefined, true), op = await coordinator.enqueue({ kind: 'grant-energy' }, 'invented-pending', [], 1000)
    await adoptServerSnapshot(snapshot); expect(await db.farmPending.get(op.operationId)).toBeDefined(); expect(await db.items.count()).toBe(0)
    f.apply(op); await adoptServerSnapshot({ entities: [profile, ...f.entities.values()], logs: [...f.logs.values()], serverTime: 1000 })
    expect(await db.farmPending.count()).toBe(0); expect(await db.outbox.count()).toBe(0); expect((await db.items.get('farm:energy'))!.data.quantity).toBe(50)
  })
  it('reports unknown future local/server rows without erasing either recovery evidence or valid saves', async () => {
    await db.profile.put({ id: 'main', data: createPlayerProfile('2026-01-01', 1), version: 1 })
    await db.farmRecovery.put({ id: 'invented-recovery', reason: 'offline', data: {}, createdAt: 1 })
    await db.farmWorkers.put({ id: 'invented-0', version: 1, updatedAt: 1, deleted: false, data: { schemaVersion: 999 } })
    await expect(readLocalSnapshot()).rejects.toThrow(/future local Farm/)
    const f = farmProtocolFixture(), bad = [...f.entities.values()].map(r => r.kind === 'farm' ? { ...r, data: { ...r.data, schemaVersion: 99 } } : r)
    await expect(adoptServerSnapshot({ entities: [profile, ...bad], logs: [], serverTime: 1000 })).rejects.toThrow(/App update required/)
    expect(await db.profile.count()).toBe(1); expect(await db.farmRecovery.count()).toBe(1)
  })
})
