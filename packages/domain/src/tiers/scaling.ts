// Tier scaling (docs/game/04-tiers-and-promotion.md §7, D338): caps and SP caps by the game's scenario T, with the
// 15th continuing today's +250 and +200 ladders; Extra Stats node values per tier; and the constellation node value,
// whose 240-point term becomes the scenario's full active Extra Stats, E(t, s) (docs/game/05-training-hub.md §6).
import { CAP_PROFILES, TREE_BUDGET_SHARE, capProfile } from '../constellation'
import { SKILL_POINT_CAPS, skillPointCap } from '../scenarios'
import { STATS, type Stats } from '../types'
import { treeCardNodesAt } from '../training/trees/sizes'
import type { ScenarioOfTier, Tier } from '../state/types'
import { LAST_SCENARIO_NUMBER, tierAndScenario } from './map'

/** The 15th's caps by today's +250 rotation: Speed 2,600, Stamina 1,750, Power 1,800, Guts 1,700, Wit 1,650 (04 §2, §7). */
export const FIFTEENTH_CAPS: Stats = { speed: 2600, stamina: 1750, power: 1800, guts: 1700, wit: 1650 }
/** The 15th's SP cap, continuing the +200 ladder (04 §1–§2). */
export const FIFTEENTH_SP_CAP = 5200

function assertNumber(T: number): void {
  if (!Number.isInteger(T) || T < 1 || T > LAST_SCENARIO_NUMBER) throw new RangeError(`Scenario must be 1–15: ${T}`)
}

/** Scenario T's caps: today's profile up to T = 14 (D244), the 15th's after, so today's clamp to 14 is never hit. */
export function capProfileAt(T: number): Stats {
  assertNumber(T)
  return T <= CAP_PROFILES.length ? capProfile(T) : FIFTEENTH_CAPS
}

/** Scenario T's SP cap: today's ladder up to T = 14 (D133), 5,200 at the 15th. */
export function spCapAt(T: number): number {
  assertNumber(T)
  return T <= SKILL_POINT_CAPS.length ? skillPointCap(T) : FIFTEENTH_SP_CAP
}

/** The sum of scenario T's five caps: 6,000 at T = 1 to 9,500 at T = 15. */
export const capBudgetAt = (T: number): number => {
  const caps = capProfileAt(T)
  return STATS.reduce((sum, stat) => sum + caps[stat], 0)
}

// ---- Extra Stats (05 §6, D338) -------------------------------------------------------------------------------------

/** Tier 1's Extra Stats node values: a single +40, a Duo +20 to each of two stats, a Sun +8 to all five (D338). */
export const EXTRA_NODE_VALUES_TIER_1 = { single: 40, duo: 20, sun: 8 } as const
/** Every Extra Stats node totals 40 raw points at tier 1, whichever kind it is (05 §6). */
export const EXTRA_NODE_POINTS_TIER_1 = EXTRA_NODE_VALUES_TIER_1.single
/** Tier multipliers in whole percent: ×1, ×1.25 and ×1.5 (D338, 04 §7). */
export const TIER_MULTIPLIER_PCT = [100, 125, 150] as const

export const tierMultiplierPct = (tier: Tier): number => {
  const pct = TIER_MULTIPLIER_PCT[tier - 1]
  if (pct === undefined) throw new RangeError(`Tier must be 1–3: ${tier}`)
  return pct
}

/** A tier's Extra Stats node values: 40 / 20 / 8, 50 / 25 / 10, 60 / 30 / 12. Whole numbers in every tier (04 §7). */
export function extraNodeValues(tier: Tier): { readonly single: number; readonly duo: number; readonly sun: number } {
  const pct = tierMultiplierPct(tier)
  return {
    single: (EXTRA_NODE_VALUES_TIER_1.single * pct) / 100,
    duo: (EXTRA_NODE_VALUES_TIER_1.duo * pct) / 100,
    sun: (EXTRA_NODE_VALUES_TIER_1.sun * pct) / 100,
  }
}

/**
 * Extra Stats nodes that can pay at once in scenarios 1–5 of a tier: the capacity 7, 9, 11, 13, 15, except scenario 1,
 * whose layer offers only 5 (04 §7, 05 §6). T128's map and capacity must reproduce it.
 */
export const FULL_ACTIVE_EXTRA_NODES = [5, 9, 11, 13, 15] as const
/** 05 §6's name for the same row: min(capacity, nodes the layers so far hold). */
export const NODES_THAT_CAN_PAY = FULL_ACTIVE_EXTRA_NODES

/** E(t, s), a full build's active Extra Stats: nodes that can pay × 40 × the tier multiplier (05 §6). 200 … 900. */
export function extraBudget(tier: Tier, scenario: ScenarioOfTier): number {
  const nodes = FULL_ACTIVE_EXTRA_NODES[scenario - 1]
  if (nodes === undefined) throw new RangeError(`Scenario of a tier must be 1–5: ${scenario}`)
  return (nodes * EXTRA_NODE_POINTS_TIER_1 * tierMultiplierPct(tier)) / 100
}

/** E for the game's scenario T. */
export const extraBudgetAt = (T: number): number => {
  const { tier, scenario } = tierAndScenario(T)
  return extraBudget(tier, scenario)
}

// ---- Constellation node value (04 §7) ------------------------------------------------------------------------------

/**
 * Raw points one card node pays at scenario T: round((0.60 × capBudget(T) − E(t, s)) / N), with the re-authored tree
 * sizes N = 12 … 28. So a full build, every node on a current-era stat card plus E, stays at 60% of the cap budget.
 */
export const nodeValue = (T: number): number =>
  Math.round((TREE_BUDGET_SHARE * capBudgetAt(T) - extraBudgetAt(T)) / treeCardNodesAt(T))
