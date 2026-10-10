// Read-only canonical/pending joins. No enrollment, inventory grants or racing-stat joins (technical §7).
import { parseUmaSave, SCENARIOS } from '@racer/domain'
import { createFarmKitchenWorker, emptyFarmRecipes, farmWorkerProgress, farmStation, farmJobRemaining, farmLegacyPageId,
  farmExtraRowId, farmIngredientBlock, createFarmExtraBlock, parseFarmKitchenState, parseFarmKitchenWorker, parseFarmBlockRecipes,
  parseFarmExtraBlock, parseFarmCutoverControl, parseFarmCutoverPage, farmTargetGuardId, farmCanonical, farmHash,
  FARM_STATION_IDS, FARM_KITCHEN_CATALOGUE, FARM_CUTOVER_GENERATION, parseFarmOperationReceipt, type FarmKitchenWorker, type FarmBlockRecipes,
  type FarmExtraBlock, type FarmStoredEntity, type FarmLegacyStationV1, type FarmOperationReceiptV1 } from '@racer/domain/farm/kitchen'
import type { FarmPendingRow, FarmCanonicalRow, RacerDb } from '../../db'
import { FarmOperationCoordinator, readFarmCanonical, readFarmPending, farmTransactionTables } from './operations'

export type FarmKitchenMode = 'active' | 'legacy' | 'upgrade' | 'maintenance' | 'unavailable'
export interface FarmViewRevision { generation: string | null; versions: Record<string, number>; pending: string }
export interface FarmStockView { canonical: number; reserved: number; incoming: number; projected: number }
export interface FarmKitchenReadInput { outfitId?: string; scenarioId?: string; operationIds?: string[] }
export interface FarmKitchenView {
  mode: FarmKitchenMode; message: string | null; now: number; revision: FarmViewRevision
  control: ReturnType<typeof parseFarmCutoverControl>
  stations: Array<ReturnType<typeof farmStation> & { status: 'empty' | 'idle' | 'busy' | 'ready'; pending: boolean;
    remainingMs: number; legacy: FarmLegacyStationV1 | null }>
  workers: Record<string, { canonical: FarmKitchenWorker; projected: FarmKitchenWorker; progress: ReturnType<typeof farmWorkerProgress>; pending: boolean }>
  recipes: Record<string, { canonical: FarmBlockRecipes; projected: FarmBlockRecipes; pending: boolean }>
  items: Record<string, FarmStockView>
  extra: { canonical: FarmExtraBlock; projected: FarmExtraBlock; pending: boolean } | null
  pending: FarmPendingRow[]; receipts: Record<string, FarmOperationReceiptV1>
}
export function farmPendingRevision(rows: readonly FarmPendingRow[]): string {
  return farmHash(rows.map(r => [r.id, r.operation.payloadDigest, r.status]))
}
/** Rows an operation reads only as a server-side guard, never shown on a Farm screen: the Puzzles bank (D320). */
const FARM_GUARD_ONLY_KEYS: ReadonlySet<string> = new Set(['constellationBank/main'])
/** Authority does not depend on a clock tick; readiness is derived, not a new save revision. */
export function assertFarmViewRevision(expected: FarmViewRevision, generation: string, entities: ReadonlyMap<string, FarmStoredEntity>,
  rows: readonly FarmPendingRow[], keys: readonly string[]): void {
  if (!expected || expected.generation !== generation || expected.pending !== farmPendingRevision(rows) ||
    keys.some(key => !FARM_GUARD_ONLY_KEYS.has(key) && (expected.versions[key] ?? 0) !== (entities.get(key)?.version ?? 0)))
    throw new Error('Farm changed; reload and review the current choices before confirming')
}
export async function readFarmKitchenView(db: RacerDb, coordinator: FarmOperationCoordinator, enabled: boolean, now: number,
  input: FarmKitchenReadInput = {}): Promise<FarmKitchenView> {
  return db.transaction('r', farmTransactionTables(db), async () => {
    const controlRow = await db.farmCutover.get('main'), control = controlRow && parseFarmCutoverControl(controlRow.data)
    if (controlRow && (!control || controlRow.deleted)) throw new Error('Farm control needs recovery; never reopen the legacy writer')
    const farmRow = await db.table<FarmCanonicalRow, string>('farm').get('main'), newFarm = farmRow?.data.schemaVersion === 3
    const generation = control?.generation ?? null
    const mode: FarmKitchenMode = !control ? newFarm ? 'maintenance' : 'legacy' : !enabled || control.generation !== FARM_CUTOVER_GENERATION
      ? 'maintenance' : control.phase !== 'active' ? 'upgrade' : 'active'
    const message = mode === 'maintenance' ? 'This Farm generation requires a compatible app. Keep the save and export recovery.'
      : mode === 'upgrade' ? 'Farm preparation is unfinished. Retry the protected upgrade or export recovery.'
        : mode === 'legacy' ? enabled ? 'Archive and prepare the one-time Farm/Extra upgrade before using Stable Kitchen.' : 'The existing Farm remains active until the kitchen release.' : null
    const owned = await db.umas.toArray()
    if (owned.some(r => !parseUmaSave(r.data))) throw new Error('Owned Farm worker data needs recovery')
    const workerKeys = owned.map(r => `farmWorkers/${r.id}`), itemRows = await db.items.toArray()
    const mapBlock = input.scenarioId && SCENARIOS.find(s => s.id === input.scenarioId)?.tier
    if (input.scenarioId && !mapBlock || input.outfitId && !owned.some(r => r.id === input.outfitId)) throw new Error('Farm target is unavailable')
    const mapKey = input.outfitId && mapBlock ? `farmExtra/${farmExtraRowId(input.outfitId, farmIngredientBlock(mapBlock))}` : null
    const keys = ['farmCutover/main', 'farm/main', ...owned.map(r => `umas/${r.id}`), ...workerKeys,
      ...itemRows.map(r => `items/${r.id}`), ...FARM_KITCHEN_CATALOGUE.blocks.map(b => `farmRecipes/b${b}`), ...(mapKey ? [mapKey] : []),
      ...(generation ? [`farmCutoverPages/${farmLegacyPageId(generation)}`] : [])]
    const logs = generation ? FARM_STATION_IDS.map(s => `farmOperations/${farmTargetGuardId(generation, 'terminal', `station:${s}`)}`) : []
    const refs = { entities: keys, logs }, canonical = await readFarmCanonical(db, refs), pending = await readFarmPending(db)
    // Disabled/incompatible generations are read-only, including their retained pending intents.
    const projected = mode === 'active' ? await coordinator.overlayInTransaction(refs) : canonical
    const data = (state: typeof canonical, key: string) => state.entities.get(key)?.data
    const farm = newFarm && parseFarmKitchenState(data(projected, 'farm/main'))
    if (control?.phase === 'active' && (!farm || farm.generation !== generation)) throw new Error('Active Farm projection is missing or corrupt; export recovery')
    const legacyRaw = generation && data(canonical, `farmCutoverPages/${farmLegacyPageId(generation)}`)
    const legacy = legacyRaw ? parseFarmCutoverPage(legacyRaw) : null
    if (legacyRaw && !legacy || control?.phase === 'active' && (!legacy || legacy.type !== 'legacy')) throw new Error('Frozen Farm jobs need recovery')
    const affected = (key: string) => pending.some(r => r.status === 'pending' && r.prediction.changes.some(c => `${c.kind}/${c.id}` === key))
    const stations = farm ? FARM_STATION_IDS.map(id => {
      const station = farmStation(farm, id), old = legacy?.type === 'legacy' ? legacy.stations.find(s => s.stationId === id && s.cycle &&
        !projected.logs.has(`farmOperations/${farmTargetGuardId(generation!, 'terminal', `station:${id}`)}`)) ?? null : null
      const remainingMs = old?.cycle ? Math.max(0, old.cycle.readyAt - now) : station.job ? farmJobRemaining(station.job, now) : 0
      return { ...station, legacy: old, remainingMs, pending: pending.some(r => r.status === 'pending' && 'stationId' in r.operation.payload && r.operation.payload.stationId === id),
        status: (station.job || old?.cycle ? remainingMs ? 'busy' : 'ready' : station.outfitId ? 'idle' : 'empty') as 'empty' | 'idle' | 'busy' | 'ready' }
    }) : []
    const workers: FarmKitchenView['workers'] = {}, recipes: FarmKitchenView['recipes'] = {}, items: FarmKitchenView['items'] = {}
    if (generation) for (const row of owned) {
      const key = `farmWorkers/${row.id}`, base = data(canonical, key), overlay = data(projected, key)
      const c: FarmKitchenWorker | null = base ? parseFarmKitchenWorker(base) : createFarmKitchenWorker(generation, row.id)
      const p: FarmKitchenWorker | null = overlay ? parseFarmKitchenWorker(overlay) : c
      if (!c || !p || c.generation !== generation || p.generation !== generation) throw new Error('Farm worker needs recovery')
      workers[row.id] = { canonical: c, projected: p, progress: farmWorkerProgress(p.totalExp), pending: affected(key) }
    }
    if (generation) for (const b of FARM_KITCHEN_CATALOGUE.blocks) {
      const key = `farmRecipes/b${b}`, base = data(canonical, key), overlay = data(projected, key)
      const c: FarmBlockRecipes | null = base ? parseFarmBlockRecipes(base) : emptyFarmRecipes(generation, b)
      const p: FarmBlockRecipes | null = overlay ? parseFarmBlockRecipes(overlay) : c
      if (!c || !p || c.generation !== generation || p.generation !== generation) throw new Error('Farm recipes need recovery')
      recipes[`b${b}`] = { canonical: c, projected: p, pending: affected(key) }
    }
    const stockKeys = new Set([...canonical.entities.keys(), ...projected.entities.keys()].filter(k => k.startsWith('items/')))
    for (const key of stockKeys) {
      const c = Number(data(canonical, key)?.quantity ?? 0), p = Number(data(projected, key)?.quantity ?? 0)
      const changes = pending.filter(r => r.status === 'pending').flatMap(r => r.prediction.logs).filter(l => l.kind === 'itemLedger' && l.data.itemId === key.slice(6))
      items[key.slice(6)] = { canonical: c, projected: p, reserved: changes.reduce((n, l) => n + Math.max(0, -Number(l.data.delta)), 0),
        incoming: changes.reduce((n, l) => n + Math.max(0, Number(l.data.delta)), 0) }
    }
    let extra: FarmKitchenView['extra'] = null
    if (mapKey && generation && input.outfitId && mapBlock) {
      const base = data(canonical, mapKey), overlay = data(projected, mapKey)
      const c = base ? parseFarmExtraBlock(base) : createFarmExtraBlock(generation, input.outfitId, farmIngredientBlock(mapBlock)), p = overlay ? parseFarmExtraBlock(overlay) : c
      if (!c || !p || c.generation !== generation || p.generation !== generation) throw new Error('Farm map needs recovery')
      extra = { canonical: c, projected: p, pending: affected(mapKey) }
    }
    const receiptIds = input.operationIds ?? [], receipts: Record<string, FarmOperationReceiptV1> = {}
    if (receiptIds.length > 30) throw new Error('Too many Farm receipt targets')
    for (const id of receiptIds) {
      const row = await db.farmOperations.get(id)
      if (row) {
        const receipt = parseFarmOperationReceipt(row.data)
        if (!receipt || receipt.operation.operationId !== id) throw new Error('Farm receipt needs recovery')
        receipts[id] = receipt
      }
    }
    return { mode, message, now, control: control || null, revision: { generation, versions: Object.fromEntries([...canonical.entities].map(([k, r]) => [k, r.version])),
      pending: farmPendingRevision(pending) }, stations, workers, recipes, items, extra, pending, receipts }
  })
}
export function sameFarmSlice(a: unknown, b: unknown): boolean { return farmCanonical(a) === farmCanonical(b) }
