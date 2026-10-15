// Farm EXP and Farm Level (docs/game/07-farm.md §3–§4, README "Shared numbers", D327, D336): 1 EXP per listed minute
// of Farm work × her running aptitude for the family, paid at collection in quarter points; level L → L + 1 costs
// 480 + 5(L − 1), Lv 1–50 per tier, and EXP stops at Lv 50. A listed minute is a real one, base × TIME_FACTOR before
// building speed (T127's decision, 07 §14), so the EXP of an item is fixed by `workSeconds(base)` at speed 1. Aptitude
// multipliers are kept in tenths, so ×0.9 and ×1.8 stay integers until an item's EXP is rounded once.
import { SECONDS_PER_MINUTE } from '../state/time'
import type { Aptitudes, DistanceCategory, Grade, Strategy } from '../types'
import type { FamilyId } from '../items/families'

/** Farm Level runs 1–50 per tier (07 §4, D327). */
export const FARM_LEVEL_CAP = 50
/** Level L → L + 1 costs FARM_EXP_BASE + FARM_EXP_STEP × (L − 1) EXP (07 §4, D336). */
export const FARM_EXP_BASE = 480
export const FARM_EXP_STEP = 5
/** Farm EXP is kept in quarter points, so a 22.5-minute craft pays exactly 22.5 (07 §4). */
export const QUARTERS_PER_EXP = 4
/** Aptitude multipliers are written in tenths: 18 is ×1.8. */
export const TENTHS = 10

/** EXP to go from `level` to `level + 1`, for Lv 1–49 (07 §4): 480 at Lv 1, 720 at Lv 49. */
export function farmExpToNext(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level >= FARM_LEVEL_CAP) throw new RangeError(`Farm Level must be 1–${FARM_LEVEL_CAP - 1}: ${level}`)
  return FARM_EXP_BASE + FARM_EXP_STEP * (level - 1)
}

/** Total EXP an Uma holds on reaching `level` (1–50): 0 at Lv 1, 2,450 at Lv 6 … 29,400 at Lv 50 (07 §4). */
export function farmExpAtLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > FARM_LEVEL_CAP) throw new RangeError(`Farm Level must be 1–${FARM_LEVEL_CAP}: ${level}`)
  let total = 0
  for (let at = 1; at < level; at += 1) total += farmExpToNext(at)
  return total
}

/** EXP stops counting at Lv 50 (07 §4): 29,400 EXP. */
export const FARM_EXP_CAP = farmExpAtLevel(FARM_LEVEL_CAP)
/** The cap in the state's units. */
export const FARM_EXP_CAP_QUARTERS = FARM_EXP_CAP * QUARTERS_PER_EXP

/** The Farm Level for `quarters` of EXP held (the state's `umas[id].farm.exp`), 1–50. */
export function farmLevel(quarters: number): number {
  if (!Number.isInteger(quarters) || quarters < 0) throw new RangeError(`Farm EXP must be whole quarter points ≥ 0: ${quarters}`)
  let level = 1
  while (level < FARM_LEVEL_CAP && quarters >= farmExpAtLevel(level + 1) * QUARTERS_PER_EXP) level += 1
  return level
}

// --- Aptitudes ------------------------------------------------------------------------------------------------------

/** Which running aptitude speeds a family's Farm Level: one distance or one running style each (07 §3, D336). */
export type FarmAptitude =
  | { readonly kind: 'distance'; readonly key: DistanceCategory }
  | { readonly kind: 'strategy'; readonly key: Strategy }

const distance = (key: DistanceCategory): FarmAptitude => Object.freeze({ kind: 'distance', key })
const style = (key: Strategy): FarmAptitude => Object.freeze({ kind: 'strategy', key })

/** 07 §3's pairs: the four distances and the four running styles, one per family. */
export const FAMILY_APTITUDE: Readonly<Record<FamilyId, FarmAptitude>> = Object.freeze({
  sweets: distance('sprint'),
  fish: distance('mile'),
  'herbs-spices': distance('medium'),
  fruits: distance('long'),
  'nuts-seeds': style('end'),
  grains: style('pace'),
  vegetables: style('front'),
  mushrooms: style('late'),
})

/** Farm EXP × her aptitude letter, in tenths (07 §3): S 1.8, A 1.6, B 1.2, C 1.0, D 0.9, E–G 0.8. */
export const FARM_EXP_TENTHS: Readonly<Record<Grade, number>> = Object.freeze({ S: 18, A: 16, B: 12, C: 10, D: 9, E: 8, F: 8, G: 8 })

/** The Farm EXP multiplier for an aptitude letter, **in tenths** (18 is ×1.8), so EXP stays exact until it rounds. */
export const farmExpMultiplier = (grade: Grade): number => FARM_EXP_TENTHS[grade]

/** Her letter for the aptitude that suits `family`. */
export function familyAptitude(aptitudes: Pick<Aptitudes, 'distance' | 'strategy'>, family: FamilyId): Grade {
  const pair = FAMILY_APTITUDE[family]
  return pair.kind === 'distance' ? aptitudes.distance[pair.key] : aptitudes.strategy[pair.key]
}

/** Seconds of work per quarter point at ×1.0: 60 s a minute × 10 tenths ÷ 4 quarters = 150. */
export const SECONDS_PER_QUARTER_TENTH = (SECONDS_PER_MINUTE * TENTHS) / QUARTERS_PER_EXP

/**
 * One item's Farm EXP in quarter points: round(`listedSeconds` × tenths ÷ 150), where `listedSeconds` is the step's
 * `workSeconds(base)` at speed 1. Rounded once per item; a collect multiplies it by the items it pays (07 §14).
 */
export function farmExpPerItem(listedSeconds: number, tenths: number): number {
  if (!Number.isInteger(listedSeconds) || listedSeconds < 0) throw new RangeError(`Listed seconds must be whole and ≥ 0: ${listedSeconds}`)
  if (!Number.isInteger(tenths) || tenths < 0) throw new RangeError(`An aptitude in tenths must be whole and ≥ 0: ${tenths}`)
  return Math.round((listedSeconds * tenths) / SECONDS_PER_QUARTER_TENTH)
}

/** She gains `quarters` of Farm EXP, stopping at Lv 50; her level follows (07 §4). */
export function addFarmExp(farm: { readonly level: number; readonly exp: number }, quarters: number): { readonly level: number; readonly exp: number } {
  if (!Number.isInteger(quarters) || quarters < 0) throw new RangeError(`Farm EXP must be whole quarter points ≥ 0: ${quarters}`)
  const exp = Math.max(farm.exp, Math.min(FARM_EXP_CAP_QUARTERS, farm.exp + quarters))
  return { level: farmLevel(exp), exp }
}
