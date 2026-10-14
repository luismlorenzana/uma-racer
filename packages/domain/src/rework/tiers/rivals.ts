// Rival strength on the re-authored trees (docs/rework/04-tiers-and-promotion.md §7, docs/rework/03-uma-progression.md
// §9, D336): today's typical trained Uma and today's handicaps, unchanged, reading the new tree sizes, node values and
// the scenario's full Extra Stats. Rivals keep today's 84% card factor; it's the rivals' build, not a star.
// D191's rule holds: a scenario's field is never stronger than a later one's in the catalogue.
import { starNodePct } from '../../constellation'
import {
  GRADE_HANDICAP, NPC_PROFILE, RIVAL_REFERENCE_METERS, RIVAL_STAMINA_ROLL, RIVAL_STAMINA_SHARE_MAX, SPREAD_STATS,
  STYLE_PROFILE, TYPICAL_BASE_STAT, TYPICAL_CARD_STARS, fullSpurtStamina, rollRivalStats, rollStyleCounts,
  type RivalRng, type RivalSlot, type SpreadStat,
} from '../../opponents'
import { STATS, STRATEGIES, type DistanceCategory, type RaceGrade, type Stats, type Strategy } from '../../types'
import { fairShare, treeCardNodesAt } from '../constellation/sizes'
import { TODAY_CATALOGUE, type ScenarioCatalogue } from './map'
import { capBudgetAt, capProfileAt, extraBudgetAt, nodeValue } from './scaling'

/**
 * What each scenario's buff adds to the typical trained Uma, T = 1–14, as a share of her tree (04 §8): rivals carry it
 * (D165). Re-measured on the rework's typical build by `pnpm sim:rework-builds` (T133, D349): the ladder's four
 * distance sets at full layer, every card current-era at 100%, Extra Stats at capacity, her open Inspiration slots
 * filled and two career goals won. A value the measurement moved by more than half a point is re-pinned to it; the
 * rest keep today's (`SCENARIO_BUFFS[*].typical`). The 15th has none until it ships (04 §2).
 */
export const REWORK_BUFF_TYPICAL: readonly number[] = Object.freeze([
  0.033, 0.037, 0.037, 0, 0, 0.046, 0.039, 0.067, 0.047, 0, 0.015, 0.028, 0.009, 0.042,
])

/**
 * The typical trained Uma's average stat at scenario T: today's `trainedStat` on the new trees. Her base, plus a fifth
 * of her stat cards' nodes at 84% and the scenario's full active Extra Stats, with the buff's typical value.
 */
export function rivalTrainedStat(T: number): number {
  const typical = Number.isInteger(T) && T >= 1 ? REWORK_BUFF_TYPICAL[T - 1] : undefined
  if (typical === undefined) throw new RangeError(`Scenario ${T} has no typical buff value yet`)
  const N = treeCardNodesAt(T)
  const tree = ((N - fairShare(N)) * nodeValue(T) * starNodePct(TYPICAL_CARD_STARS)) / 100 + extraBudgetAt(T)
  return TYPICAL_BASE_STAT + (tree * (1 + typical)) / STATS.length
}

/** D191 over the catalogue: the lowest typical build from T to the catalogue's last scenario. */
export function rivalFieldStat(T: number, catalogue: ScenarioCatalogue = TODAY_CATALOGUE): number {
  if (!Number.isInteger(T) || T < 1 || T > catalogue.scenarioCount) throw new RangeError(`Scenario ${T} is not in the catalogue`)
  let value = rivalTrainedStat(T)
  for (let later = T + 1; later <= catalogue.scenarioCount; later += 1) value = Math.min(value, rivalTrainedStat(later))
  return value
}

export interface RivalPresetInput {
  readonly T: number
  readonly grade: RaceGrade
  readonly distance: DistanceCategory
  readonly strategy: Strategy
  /** The race's length; defaults to the category's reference distance. */
  readonly meters?: number
  readonly catalogue?: ScenarioCatalogue
  /** The trained stat to build on, when a caller has its own (a parity test feeds today's). Defaults to the field's. */
  readonly fieldStat?: number
}

/**
 * A rival's 100% at scenario T: today's `rivalPreset` rule, restated on T's caps. The field's trained stat less the
 * grade's handicap, Stamina first for a full spurt from a 90% roll, the rest spread by distance, style and caps.
 */
export function rivalPresetAt(input: RivalPresetInput): Stats {
  const { T, grade, distance, strategy } = input
  const meters = input.meters ?? RIVAL_REFERENCE_METERS[distance]
  const caps = capProfileAt(T)
  const average = capBudgetAt(T) / STATS.length
  const total = (input.fieldStat ?? rivalFieldStat(T, input.catalogue)) * (1 - GRADE_HANDICAP[grade]) * STATS.length
  const weight = (stat: SpreadStat) => NPC_PROFILE[distance][stat] * STYLE_PROFILE[strategy][stat] * Math.sqrt(caps[stat] / average)
  const weights = SPREAD_STATS.reduce((sum, stat) => sum + weight(stat), 0)
  const spread = (budget: number) => Object.fromEntries(SPREAD_STATS.map((stat) =>
    [stat, Math.min(caps[stat], (budget * weight(stat)) / weights)])) as Record<SpreadStat, number>
  let stamina = 0
  for (let pass = 0; pass < 4; pass += 1) {
    const rest = spread(total - stamina)
    stamina = Math.min(caps.stamina, RIVAL_STAMINA_SHARE_MAX * total,
      fullSpurtStamina(meters, strategy, rest.speed, rest.guts) / RIVAL_STAMINA_ROLL)
  }
  return { ...spread(total - stamina), stamina }
}

export interface RivalFieldInput extends Omit<RivalPresetInput, 'strategy'> {
  readonly count: number
  /** The race's seeded RNG: the only randomness the tier rules take. */
  readonly rng: RivalRng
}

/** A race's rivals in gate order at scenario T: today's `rollRivalField` rule, on `rivalPresetAt`. */
export function rollRivalFieldAt(input: RivalFieldInput): RivalSlot[] {
  const counts = rollStyleCounts(input.count, input.rng)
  const strategies = STRATEGIES.flatMap((strategy) => Array.from({ length: counts[strategy] }, () => strategy))
  for (let index = strategies.length - 1; index > 0; index -= 1) {
    const other = Math.floor(input.rng.next() * (index + 1))
    ;[strategies[index], strategies[other]] = [strategies[other]!, strategies[index]!]
  }
  return strategies.map((strategy) => ({ strategy, stats: rollRivalStats(rivalPresetAt({ ...input, strategy }), input.rng) }))
}
