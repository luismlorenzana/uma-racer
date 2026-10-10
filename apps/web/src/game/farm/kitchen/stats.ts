// Canonical-only Farm join and reactive adoption. Pending economics are exclusively screen previews (§8).
import { liveQuery } from 'dexie'
import { DISTANCE_CATEGORIES, SCENARIOS, type Stats } from '@racer/domain'
import { FARM_CUTOVER_GENERATION, farmExtraRowId, farmIngredientBlock, projectFarmExtraStats, parseFarmCutoverControl, parseFarmExtraBlock,
  parseFarmKitchenState } from '@racer/domain/farm/kitchen'
import type { RacerDb } from '../../db'
import { farmStatKey, LEGACY_FARM_STATS, type FarmStatState } from '../../farm-stats'

export const farmStatTables = (db: RacerDb) => [db.farmCutover, db.farmExtra, db.farm]

export async function readFarmStatState(db: RacerDb, enabled: boolean, target?: { outfitId: string; tier: number }): Promise<FarmStatState> {
  try {
    const controlRow = await db.farmCutover.get('main'), farmRow = await db.farm.get('main')
    if (!controlRow) {
      if (Number(farmRow?.data.schemaVersion) >= 3) throw new Error('Farm control is missing')
      return LEGACY_FARM_STATS
    }
    const control = parseFarmCutoverControl(controlRow.data), farm = farmRow && parseFarmKitchenState(farmRow.data)
    if (controlRow.deleted || !control || control.generation !== FARM_CUTOVER_GENERATION || !enabled || control.phase !== 'active' ||
      !farm || farm.generation !== control.generation) throw new Error('Farm generation is not ready in this app')
    const vectors: Record<string, Stats> = {}
    const targeted = target && await db.farmExtra.get(farmExtraRowId(target.outfitId, farmIngredientBlock(target.tier)))
    for (const row of target ? targeted ? [targeted] : [] : await db.farmExtra.toArray()) {
      const map = parseFarmExtraBlock(row.data)
      if (row.deleted || !map || map.generation !== control.generation || row.id !== farmExtraRowId(map.outfitId, map.block))
        throw new Error('Farm map identity or template is incompatible')
      for (const scenarioId of Object.keys(map.activeByScenario)) {
        const tier = SCENARIOS.find(s => s.id === scenarioId)!.tier
        for (const distance of DISTANCE_CATEGORIES) {
          const vector = projectFarmExtraStats({ map, generation: control.generation, outfitId: map.outfitId, scenarioId, distance })
          if (!vector.ok) throw new Error(vector.error.detail)
          vectors[farmStatKey(map.outfitId, tier, distance)] = vector.value
        }
      }
    }
    return { mode: 'active', generation: control.generation, vectors }
  } catch (error) {
    return { mode: 'recovery', error: `Farm stats need recovery. ${error instanceof Error ? error.message : String(error)}. Keep the save; export Farm recovery.` }
  }
}

export function observeFarmStats(db: RacerDb, enabled: boolean, publish: (state: FarmStatState) => void): () => void {
  const sub = liveQuery(() => db.transaction('r', farmStatTables(db), () => readFarmStatState(db, enabled))).subscribe({
    next: publish, error: error => publish({ mode: 'recovery', error: `Farm stats could not be read: ${String(error)}` }),
  })
  return () => sub.unsubscribe()
}
