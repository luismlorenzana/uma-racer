// Tier scaling (docs/game/04-tiers-and-scenarios.md): each scenario's per-stat caps and SP cap, by the game's scenario
// number T. The caps outlive generation 2's trees (D380, D381): the restart's tree spends toward them.
import { SKILL_POINT_CAPS, skillPointCap } from '../scenarios'
import { STATS, type Stats } from '../types'
import { LAST_SCENARIO_NUMBER } from './map'

/**
 * Per-stat caps. URA Finale caps every stat at 1200 (6000); each later scenario adds 250: 100 to Speed, 100 to a main
 * stat and 50 to a sub stat, round-robin through Stamina, Power, Guts and Wit. Each row sums to that scenario's cap
 * budget (D244).
 */
export const CAP_PROFILES: readonly Stats[] = [
  { speed: 1200, stamina: 1200, power: 1200, guts: 1200, wit: 1200 }, // 1  URA Finale
  { speed: 1300, stamina: 1300, power: 1250, guts: 1200, wit: 1200 }, // 2  Unity Cup
  { speed: 1400, stamina: 1300, power: 1350, guts: 1250, wit: 1200 }, // 3  Trackblazer
  { speed: 1500, stamina: 1300, power: 1350, guts: 1350, wit: 1250 }, // 4  Our Grand Concert
  { speed: 1600, stamina: 1350, power: 1350, guts: 1350, wit: 1350 }, // 5  Grand Masters
  { speed: 1700, stamina: 1450, power: 1400, guts: 1350, wit: 1350 }, // 6  Project L'Arc
  { speed: 1800, stamina: 1450, power: 1500, guts: 1400, wit: 1350 }, // 7  U.A.F. Ready GO!
  { speed: 1900, stamina: 1450, power: 1500, guts: 1500, wit: 1400 }, // 8  Great Food Festival
  { speed: 2000, stamina: 1500, power: 1500, guts: 1500, wit: 1500 }, // 9  Run! Mecha Umamusume
  { speed: 2100, stamina: 1600, power: 1550, guts: 1500, wit: 1500 }, // 10 The Twinkle Legends
  { speed: 2200, stamina: 1600, power: 1650, guts: 1550, wit: 1500 }, // 11 Design Your Island
  { speed: 2300, stamina: 1600, power: 1650, guts: 1650, wit: 1550 }, // 12 Yukoma Hot Springs
  { speed: 2400, stamina: 1650, power: 1650, guts: 1650, wit: 1650 }, // 13 Beyond Dreams
  { speed: 2500, stamina: 1750, power: 1700, guts: 1650, wit: 1650 }, // 14 Tracen Diner
]

/** The 15th's caps by the same +250 rotation: Speed 2,600, Stamina 1,750, Power 1,800, Guts 1,700, Wit 1,650. */
export const FIFTEENTH_CAPS: Stats = { speed: 2600, stamina: 1750, power: 1800, guts: 1700, wit: 1650 }
/** The 15th's SP cap, continuing the +200 ladder. */
export const FIFTEENTH_SP_CAP = 5200

function assertNumber(T: number): void {
  if (!Number.isInteger(T) || T < 1 || T > LAST_SCENARIO_NUMBER) throw new RangeError(`Scenario must be 1–15: ${T}`)
}

/** Scenario T's caps. */
export function capProfileAt(T: number): Stats {
  assertNumber(T)
  return T <= CAP_PROFILES.length ? CAP_PROFILES[T - 1]! : FIFTEENTH_CAPS
}

/** Scenario T's SP cap: the ladder up to T = 14 (D133), 5,200 at the 15th. */
export function spCapAt(T: number): number {
  assertNumber(T)
  return T <= SKILL_POINT_CAPS.length ? skillPointCap(T) : FIFTEENTH_SP_CAP
}

/** The sum of scenario T's five caps: 6,000 at T = 1 to 9,500 at T = 15. */
export const capBudgetAt = (T: number): number => {
  const caps = capProfileAt(T)
  return STATS.reduce((sum, stat) => sum + caps[stat], 0)
}
