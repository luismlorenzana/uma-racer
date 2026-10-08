// Isolated IndexedDB stores and invented pure engine inputs; no real account or cloud request.
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlayerProfile, createInitialFarmState, parseSaveSnapshot, type PuzzleOperationV1, type PuzzlePayload, type PuzzleStoredEntity,
  resolvePuzzleOperations, createPuzzleBattle, applyPuzzleBattleAction, puzzleBattleResult, puzzleBotAction, puzzleData } from '@racer/domain'
import { puzzleProtocolFixture } from '../../../../../packages/domain/src/minigames/uma-puzzles/protocol-fixtures'
import { RacerDb, db as appDb } from '../db'
import { PuzzleOperationCoordinator, canonicalPuzzleUmaForSync, puzzleTransactionTables, adoptPuzzleUmaVersion } from './operations'
import { usePuzzleSync } from './store'
import { adoptServerSnapshot, readLocalSnapshot, reconcileFarmProjectionsInTransaction } from '../persistence'

let sequence = 0
const spend: PuzzlePayload = { kind: 'cl-spend', outfitId: 'invented-0', scenarioId: 'ura-finale', inputs: [{ itemId: 'constellation:ura-finale:front', quantity: 1 }] }
const put = async (database: RacerDb, row: PuzzleStoredEntity) => database.table(row.kind).put({ id: row.id, data: row.data, version: row.version })
const server = (f: ReturnType<typeof puzzleProtocolFixture>, ops: PuzzleOperationV1[], now = 100) => {
  const result = resolvePuzzleOperations({ accountSeed: 'invented-cutover', enabled: true, now, entities: f.entities, logs: f.logs }, ops)
  result.writes.forEach(r => f.entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => f.logs.set(`${r.kind}/${r.id}`, r)); return result.responses
}
async function winResult(op: PuzzleOperationV1) {
  if (op.payload.kind !== 'reserve') throw new Error('Fixture')
  let state = createPuzzleBattle(op.payload.encounter.input)
  for (let i = 0; i < 181 && state.outcome === 'active'; i++) state = applyPuzzleBattleAction(state, puzzleBotAction(state, 'competent')).state
  expect(state.outcome).toBe('win')
  return { kind: 'settle' as const, checkpointId: state.input.checkpointId, inputHash: op.payload.encounter.inputHash, result: puzzleBattleResult(state) }
}
describe('durable Puzzle prediction/reconciliation', () => {
  let database: RacerDb, f: ReturnType<typeof puzzleProtocolFixture>, coordinator: PuzzleOperationCoordinator, schedule: ReturnType<typeof vi.fn>
  beforeEach(async () => {
    database = new RacerDb(`puzzle-test-${++sequence}`); await database.open(); f = puzzleProtocolFixture(1, 1)
    for (const row of f.entities.values()) await put(database, row)
    schedule = vi.fn(); coordinator = new PuzzleOperationCoordinator(database, 'invented-cutover', schedule, true)
    usePuzzleSync.setState({ pending: 0, message: null, recoveryIds: [] })
  })
  afterEach(async () => { await database.delete() })
  it('atomically predicts and queues once, schedules after commit and prevents two offline spends on one stack', async () => {
    const op = await coordinator.enqueue(spend, 'local-spend', [], 10)
    expect(await database.outbox.count()).toBe(1); expect(await database.pendingPuzzleOperations.count()).toBe(1)
    expect(schedule).toHaveBeenCalledOnce(); expect(usePuzzleSync.getState().pending).toBe(1)
    expect((await database.items.get('constellation:ura-finale:front'))!.data.quantity).toBe(0)
    expect((await database.umas.get('invented-0'))!.data.scenarios[0]!.trainingLevel).toBe(2)
    await expect(coordinator.enqueue(spend, 'second-spend')).rejects.toThrow(/enough/)
    expect(await database.pendingPuzzleOperations.count()).toBe(1)
    expect(await coordinator.enqueue(spend, 'local-spend', [], 11)).toEqual(op)
    expect(await database.outbox.count()).toBe(1)
  })
  it('restores canonical CL after conflict, blocks a dependent and preserves racing/Farm/RPG/build edits', async () => {
    const op = await coordinator.enqueue(spend, 'local-spend', [], 10)
    const name = { ...f.party, name: 'Saved draft' }
    await coordinator.enqueue({ kind: 'save-party', party: name }, 'dependent', ['local-spend'], 11)
    const row = (await database.umas.get('invented-0'))!
    row.data.level = 2; row.data.exp = 22; row.data.activePreset = 'long'; row.data.scenarios[0]!.presets.long.cardSetIds = ['invented-card']
    await database.umas.put(row)
    await database.items.put({ id: 'produce:t1:speed', version: 3, data: { itemId: 'produce:t1:speed', quantity: 19, updatedAt: 30 } })
    await database.farm.put({ id: 'main', version: 5, revision: 9, data: createInitialFarmState() })
    await database.rpgFights.put({ id: 'invented-rpg', actions: [], updatedAt: 31 })
    server(f, [f.operation(spend, 'other-device')])
    await coordinator.adopt([op], server(f, [op]), 40)
    expect((await database.umas.get(row.id))!.data).toMatchObject({ level: 2, exp: 22, activePreset: 'long', scenarios: [{ trainingLevel: 2, presets: { long: { cardSetIds: ['invented-card'] } } }] })
    // Other device bought CL on this same outfit: canonical level 2, not our local optimistic level +1.
    expect((await database.pendingPuzzleOperations.get('local-spend'))!.status).toBe('rejected')
    expect((await database.pendingPuzzleOperations.get('dependent'))!.status).toBe('blocked')
    expect((await database.puzzlePresets.get(f.party.partyId))!.data.name).toBe(f.party.name)
    expect((await database.items.get('produce:t1:speed'))!.data.quantity).toBe(19)
    expect((await database.farm.get('main'))!.revision).toBe(9); expect(await database.rpgFights.get('invented-rpg')).toBeDefined()
    expect(await database.puzzleArchives.count()).toBe(2); expect(await database.outbox.count()).toBe(0)
  })
  it('does not leave locked-node CL after a rejected spend on another outfit', async () => {
    const op = await coordinator.enqueue(spend, 'local-spend')
    server(f, [f.operation({ ...spend, outfitId: 'invented-1' }, 'competing')])
    await coordinator.adopt([op], server(f, [op]))
    expect((await database.umas.get('invented-0'))!.data.scenarios[0]!.trainingLevel).toBe(1)
    expect(usePuzzleSync.getState().message).toMatch(/saved for recovery/)
  })
  it('keeps ordinary Uma sync on canonical CL, never pending economic state', async () => {
    await coordinator.enqueue(spend, 'pending')
    const row = (await database.umas.get('invented-0'))!
    expect(row.version).toBe(1)
    const outgoing = await canonicalPuzzleUmaForSync(database, row.id, puzzleData({ ...row.data, level: 2 }))
    expect(outgoing).toMatchObject({ level: 2, scenarios: [{ trainingLevel: 1, trainingExp: 0 }] })
  })
  it('replays pending CL after an ordinary Racing acknowledgement without losing either mutation', async () => {
    const op = await coordinator.enqueue(spend, 'pending-cl')
    await database.transaction('rw', puzzleTransactionTables(database), async () => { await coordinator.reconcileOrdinaryInTransaction(async () => {
      const row = (await database.umas.get('invented-0'))!
      expect(row.data.scenarios[0]!.trainingLevel).toBe(1)
      row.version++; row.data.level = 2; row.data.exp = 50; row.data.activePreset = 'long'
      await database.umas.put(row)
    }, 99) })
    expect((await database.umas.get('invented-0'))!.data).toMatchObject({ level: 2, exp: 50, activePreset: 'long', scenarios: [{ trainingLevel: 2 }] })
    expect((await database.pendingPuzzleOperations.get(op.operationId))!.status).toBe('pending')
    const serverUma = f.entities.get('umas/invented-0')!; serverUma.version++; serverUma.data.level = 2; serverUma.data.exp = 50
    await coordinator.adopt([op], server(f, [op]))
    expect((await database.umas.get('invented-0'))!.data).toMatchObject({ level: 2, exp: 50, activePreset: 'long', scenarios: [{ trainingLevel: 2 }] })
  })
  it('adopts canonical CL while preserving a newer queued Racing payload on stale ordinary sync', async () => {
    const row = (await database.umas.get('invented-0'))!
    row.data.level = 2; row.data.exp = 91; row.data.activePreset = 'long'
    await database.umas.put(row)
    const canonical = structuredClone(f.entities.get('umas/invented-0')!)
    const units = canonical.data.scenarios as { trainingLevel: number }[]
    units[0]!.trainingLevel = 3; canonical.version = 2
    await database.transaction('rw', puzzleTransactionTables(database), async () => { await adoptPuzzleUmaVersion(database, canonical) })
    expect((await database.umas.get(row.id))!).toMatchObject({ version: 2, data: { level: 2, exp: 91, activePreset: 'long', scenarios: [{ trainingLevel: 3 }] } })
  })
  it('retains local result/ledger predictions for offline summaries without appending cloud evidence', async () => {
    const reserve = await coordinator.enqueue(f.reserve().payload, 'reserve-offline')
    const settle = await coordinator.enqueue(await winResult(reserve), 'settle-offline', ['reserve-offline'])
    const row = (await database.pendingPuzzleOperations.get(settle.operationId))!
    expect(row.prediction.logs.find(l => l.kind === 'puzzleResults')!.data.exp).toHaveLength(5)
    expect(await database.puzzleResults.count()).toBe(0); expect(await database.itemLedger.count()).toBe(0)
    database.close(); await database.open()
    expect((await database.pendingPuzzleOperations.get(settle.operationId))!.prediction).toEqual(row.prediction)
  })
  it('reloads the identical ordered queue, installs duplicate receipts once and never syncs a journal', async () => {
    const op = await coordinator.enqueue(spend, 'offline-op')
    await database.puzzleJournals.put({ id: 'invented-battle', schemaVersion: 1, ownerEpoch: 0, inputHash: 'a'.repeat(16), stateHash: 'b'.repeat(16), actions: [], updatedAt: 1 })
    database.close(); await database.open()
    coordinator = new PuzzleOperationCoordinator(database, 'invented-cutover', schedule, true)
    expect(await coordinator.nextBatch()).toEqual([op])
    const accepted = server(f, [op]), retry = server(f, [op])
    expect(accepted[0]!.status).toBe('applied'); expect(retry[0]!.status).toBe('duplicate')
    await coordinator.adopt([op], retry)
    expect(await database.puzzleOperations.count()).toBe(1); expect(await database.itemLedger.count()).toBe(1)
    expect(await database.pendingPuzzleOperations.count()).toBe(0); expect(await database.puzzleJournals.count()).toBe(1)
    expect(await database.outbox.count()).toBe(0)
  })
  it('reconciles changed debt and net inventory together without changing gross/EXP', async () => {
    const reserve = await coordinator.enqueue(f.reserve().payload, 'reserve')
    const reservationResponse = server(f, [reserve]); await coordinator.adopt([reserve], reservationResponse)
    const resultPayload = await winResult(reserve), settle = await coordinator.enqueue(resultPayload, 'settle', ['reserve'])
    expect((await database.items.get('constellation:ura-finale:front'))!.data.quantity).toBe(1)
    // A competing accepted battle repaid this debt after this device's optimistic result.
    const bank = f.entities.get('constellationBank/main')!
    bank.data.balances = { 'constellation:ura-finale:front': 0 }; bank.version++; bank.data.revision = 2
    const response = server(f, [settle]), receipt = response[0]!.receipt!
    await coordinator.adopt([settle], response)
    expect((await database.constellationBank.get('main'))!.data.balances['constellation:ura-finale:front']).toBe(0)
    expect((await database.items.get('constellation:ura-finale:front'))!.data.quantity).toBe(2)
    expect(receipt.logs.find(l => l.kind === 'puzzleResults')!.data.materials).toContainEqual({ itemId: 'constellation:ura-finale:front', gross: 1, debtPaid: 0, net: 1 })
    expect(usePuzzleSync.getState().message).toMatch(/Gross rewards and EXP are unchanged/)
  })
  it('rebases a valid unacknowledged reward after an accepted win, preserving two additive awards', async () => {
    const virtual = puzzleProtocolFixture(1, 1), operations: PuzzleOperationV1[] = []
    for (let n = 1; n <= 2; n++) {
      const reserve = await coordinator.enqueue(virtual.reserve().payload, `reserve-${n}`, n === 1 ? [] : [`settle-${n - 1}`]); operations.push(reserve); virtual.apply(reserve)
      const settle = await coordinator.enqueue(await winResult(reserve), `settle-${n}`, [`reserve-${n}`]); operations.push(settle); virtual.apply(settle)
    }
    await coordinator.adopt(operations.slice(0, 2), server(f, operations.slice(0, 2)))
    expect(await database.pendingPuzzleOperations.where('status').equals('pending').count()).toBe(2)
    await coordinator.adopt(operations.slice(2), server(f, operations.slice(2)))
    expect(await database.puzzleResults.count()).toBe(2)
    const local = (await database.puzzleOutfits.get('invented-0'))!.data.enrollment, canonical = f.entities.get('puzzleOutfits/invented-0')!.data.enrollment
    expect(local).toEqual(canonical)
    expect(local.level).toBeGreaterThanOrEqual(1); expect(local.exp + local.level).toBeGreaterThan(1)
  }, 15000)
  it('rejects response mismatches before mutating any local table', async () => {
    const op = await coordinator.enqueue(spend, 'pending'), before = await database.umas.toArray()
    await expect(coordinator.adopt([op], [])).rejects.toThrow(/acknowledgements/)
    expect(await database.umas.toArray()).toEqual(before); expect(await database.pendingPuzzleOperations.count()).toBe(1)
  })
  it('refuses an injected write failure without publishing Zustand or scheduling', async () => {
    const spy = vi.spyOn(database.outbox, 'add').mockRejectedValueOnce(new Error('Synthetic disk failure'))
    await expect(coordinator.enqueue(spend, 'disk-failed')).rejects.toThrow(/disk failure/)
    expect(await database.pendingPuzzleOperations.count()).toBe(0); expect(await database.puzzleBases.count()).toBe(0)
    expect((await database.umas.get('invented-0'))!.data.scenarios[0]!.trainingLevel).toBe(1)
    expect(usePuzzleSync.getState().pending).toBe(0); expect(schedule).not.toHaveBeenCalled(); spy.mockRestore()
  })
  it('never enrolls/writes a live account through the off production capability', async () => {
    const off = new PuzzleOperationCoordinator(database, 'invented-cutover', schedule, false)
    await expect(off.enqueue(spend, 'disabled')).rejects.toThrow(/disabled/)
    expect(await database.pendingPuzzleOperations.count()).toBe(0); expect(schedule).not.toHaveBeenCalled()
  })
})

describe('additive Puzzle storage and snapshots', () => {
  afterEach(async () => { await appDb.delete() })
  it('upgrades every pre-existing Dexie v27 row/outbox without performing a training migration', async () => {
    const name = `puzzle-upgrade-${++sequence}`, current = new RacerDb(name)
    const old = new Dexie(name)
    // Create exactly the old table/index set; it is all preserved by additive v28.
    const schema: Record<string, string> = {}
    for (const t of current.tables) if (!t.name.startsWith('puzzle') && t.name !== 'constellationBank' && t.name !== 'pendingPuzzleOperations')
      schema[t.name] = t.name === 'outbox' ? '++seq, [kind+id]' : 'id'
    current.close(); old.version(27).stores(schema); await old.open()
    for (const kind of Object.keys(schema)) await old.table(kind).add(kind === 'outbox' ? { kind: 'umas', id: 'invented-0', op: 'upsert', queuedAt: 1 } : { id: 'sentinel', value: kind })
    const before = Object.fromEntries(await Promise.all(Object.keys(schema).map(async k => [k, await old.table(k).toArray()] as const)))
    old.close(); await current.open()
    for (const [kind, rows] of Object.entries(before)) expect(await current.table(kind).toArray(), kind).toEqual(rows)
    for (const kind of ['puzzleOutfits', 'constellationBank', 'puzzleJournals', 'pendingPuzzleOperations']) expect(await current.table(kind).count()).toBe(0)
    await current.delete()
  })
  it('adopts and reads every new synced kind; local journals/queues/preferences never enter serialization', async () => {
    await appDb.open(); const f = puzzleProtocolFixture(0, 1), reserve = f.reserve(); f.apply(reserve)
    f.apply(f.operation(await winResult(reserve), 'settle', ['invented-reserve']))
    const { puzzleCohortId } = await import('@racer/domain')
    f.put('puzzleCohort', puzzleCohortId('invented-0', 'ura-finale'), { schemaVersion: 1, cutoverId: 'invented-cutover', outfitId: 'invented-0', scenarioId: 'ura-finale',
      legacyLevel: 2, preferredStyle: 'front', source: f.sources[0]!, debtStyle: 'front', debit: 1, completed: true })
    const entities = [...f.entities.values(), { kind: 'profile', id: 'main', version: 1, data: puzzleData(createPlayerProfile('invented-v1', 1)), deleted: false, updatedAt: 1 }]
    const snapshot = { entities, logs: [...f.logs.values()], serverTime: 100 }
    expect(parseSaveSnapshot(snapshot)).not.toBeNull()
    await appDb.puzzlePreferences.put({ id: 'invented-pref', value: 'plain-orbs' })
    await appDb.puzzleJournals.put({ id: 'invented-journal', schemaVersion: 1, ownerEpoch: 0, inputHash: 'a'.repeat(16), stateHash: 'b'.repeat(16), actions: [], updatedAt: 1 })
    await adoptServerSnapshot(snapshot)
    const local = await readLocalSnapshot()
    expect(local?.puzzleEntities.some(e => e.kind === 'constellationBank')).toBe(true)
    expect(local?.puzzleLogs.some(l => l.kind === 'puzzleOperations')).toBe(true)
    expect(await appDb.pendingPuzzleOperations.count()).toBe(0); expect(await appDb.puzzleJournals.count()).toBe(1)
    expect((await appDb.puzzlePreferences.get('invented-pref'))!.value).toBe('plain-orbs')
    expect(new Set(local?.puzzleEntities.map(e => e.kind))).toEqual(new Set(['puzzleOutfits', 'puzzlePresets', 'puzzleCheckpoints', 'constellationBank', 'puzzleCohort']))
    expect(new Set(local?.puzzleLogs.map(l => l.kind))).toEqual(new Set(['puzzleResults', 'puzzleOperations']))
  })
  it('Farm reconciliation never queues or overwrites a receipt-owned material preview', async () => {
    await appDb.open(); const f = puzzleProtocolFixture(0), reserve = f.reserve(); f.apply(reserve)
    f.apply(f.operation(await winResult(reserve), 'accepted-win'))
    for (const row of f.entities.values()) await put(appDb, row)
    for (const row of f.logs.values()) await appDb.table(row.kind).put({ id: row.id, data: row.data, createdAt: row.createdAt })
    await appDb.farm.put({ id: 'main', data: createInitialFarmState(), version: 1, revision: 1 })
    const coordinator = new PuzzleOperationCoordinator(appDb, 'invented-cutover', () => undefined, true)
    await coordinator.enqueue(spend, 'pending-spend')
    expect((await appDb.items.get('constellation:ura-finale:front'))!.data.quantity).toBe(0)
    await appDb.transaction('rw', [appDb.farm, appDb.items, appDb.itemLedger, appDb.outbox], async () => { await reconcileFarmProjectionsInTransaction(100) })
    expect((await appDb.items.get('constellation:ura-finale:front'))!.data.quantity).toBe(0)
    expect((await appDb.outbox.toArray()).every(r => r.op === 'puzzle')).toBe(true)
  })
})
