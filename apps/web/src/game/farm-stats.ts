// Small stat-join contract; kitchen catalogue/parsers stay lazy (technical/farm-kitchen-implementation §8).
import type { DistanceCategory, Stats } from '@racer/domain'

// This bridge is used by startup's store. No runtime domain-barrel import (its catalogues must stay lazy).
const EMPTY_FARM_STATS: Stats = { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }

export type FarmStatState =
  | { mode: 'legacy' }
  | { mode: 'recovery'; error: string }
  | { mode: 'active'; generation: string; vectors: Readonly<Record<string, Stats>> }
export const LEGACY_FARM_STATS: FarmStatState = { mode: 'legacy' }
export const farmStatKey = (outfitId: string, tier: number, distance: DistanceCategory) => `${outfitId}:${tier}:${distance}`
const raceLocks = new Map<string, number>()
export function lockFarmRace(outfitId: string, tier: number): () => void {
  const key = `${outfitId}:${tier}`
  raceLocks.set(key, (raceLocks.get(key) ?? 0) + 1)
  let released = false
  return () => { if (!released) { released = true; const n = (raceLocks.get(key) ?? 1) - 1; if (n) raceLocks.set(key, n); else raceLocks.delete(key) } }
}
export const farmRaceLocked = (outfitId: string, tier: number) => raceLocks.has(`${outfitId}:${tier}`)

/** Never reads pending rows. A missing map/unit/preset starts empty; incompatible data never becomes legacy. */
export function farmStatsFor(state: FarmStatState, outfitId: string, tier: number, distance: DistanceCategory): Stats | undefined {
  if (state.mode === 'recovery') throw new Error(state.error)
  return state.mode === 'active' ? { ...(state.vectors[farmStatKey(outfitId, tier, distance)] ?? EMPTY_FARM_STATS) } : undefined
}
