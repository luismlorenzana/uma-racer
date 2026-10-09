// Settings sees aggregate counts only, never account rows, names or IDs (technical §7).
import { parseFarmKitchenState, parseFarmCutoverControl, farmJobRemaining } from '@racer/domain/farm/kitchen'
import { parseInventoryStackData, parseItemLedgerEntry } from '@racer/domain'
import type { RacerDb, FarmCanonicalRow } from '../../db'
import type { FarmSaveSummary } from '../diagnostics'
export async function readFarmKitchenSummary(db: RacerDb, now: number): Promise<FarmSaveSummary> {
  const control = parseFarmCutoverControl((await db.farmCutover.get('main'))?.data)
  const row = await db.table<FarmCanonicalRow, string>('farm').get('main'), farm = row?.data.schemaVersion === 3 ? parseFarmKitchenState(row.data) : null
  if (!control || row?.data.schemaVersion === 3 && !farm) throw new Error('Farm diagnostics need recovery')
  const items = (await db.items.toArray()).map(r => {
    const item = parseInventoryStackData(r.data, r.id)
    if (!item) throw new Error('Inventory diagnostics need recovery')
    return item
  })
  const ledger = await db.itemLedger.toArray()
  if (ledger.some(r => { const parsed = parseItemLedgerEntry(r.data); return !parsed || parsed.id !== r.id || parsed.createdAt !== r.createdAt }))
    throw new Error('Inventory evidence needs recovery')
  return { farmPresent: !!farm, farmLevel: null, unlockedPlots: farm ? 30 : 0, assignedPlots: farm?.stations.filter(s => s.outfitId).length ?? 0,
    growingPlots: farm?.stations.filter(s => s.job && farmJobRemaining(s.job, now) > 0).length ?? 0,
    readyPlots: farm?.stations.filter(s => s.job && farmJobRemaining(s.job, now) === 0).length ?? 0,
    itemStacks: items.filter(s => s.quantity > 0).length, totalItems: items.reduce((n, s) => n + s.quantity, 0), itemMovements: ledger.length,
    kitchen: { phase: control.phase, workers: await db.farmWorkers.count(), recipes: await db.farmRecipes.count(), maps: await db.farmExtra.count(),
      operations: await db.farmOperations.count(), pending: await db.farmPending.where('status').equals('pending').count(),
      recovery: await db.farmPending.where('status').anyOf(['rejected', 'blocked']).count() } }
}
