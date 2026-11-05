// Rival strength (docs/game/racing.md, D152, D191, D383). A field is built on the typical trained Uma's average stat
// in its scenario, less its grade's handicap. URA Finale's (T = 1) is measured on generation 3's build by `sim:careers`
// (D383), and a career's field is as strong as the typical career at the race's season; the later scenarios keep
// generation 2's frozen values (D381) until their careers open. D191's rule holds: a scenario's field is never stronger
// than a later one's in the catalogue.
import {
  GRADE_HANDICAP, NPC_PROFILE, RIVAL_REFERENCE_METERS, RIVAL_STAMINA_ROLL, RIVAL_STAMINA_SHARE_MAX, SPREAD_STATS,
  STYLE_PROFILE, fullSpurtStamina, rollRivalStats, rollStyleCounts,
  type RivalRng, type RivalSlot, type SpreadStat,
} from '../opponents'
import { STATS, STRATEGIES, type DistanceCategory, type RaceGrade, type Stats, type Strategy } from '../types'
import { TODAY_CATALOGUE, type ScenarioCatalogue } from './map'
import { capBudgetAt, capProfileAt } from './scaling'

/**
 * The typical trained Uma's average stat at scenario T. T = 1 is generation 3's typical URA Finale career at its Finale
 * (a median bonded deck, every stage played once at grade A; `sim:careers`, D383). T = 2–15 are frozen from generation 2
 * (`rivalTrainedStat` on c592ccd, its typical buffs included); the 15th repeats the 14th's.
 */
export const RIVAL_TRAINED_STAT: readonly number[] = Object.freeze([
  559, 664.8033, 683.4859, 707.92, 728.456, 763.2898, 777.6115, 815.3297, 854.7102, 839.6, 852.98, 881.0987,
  885.9775, 969.2749, 969.2749,
])

/** The typical trained Uma's average stat at scenario T (the frozen table). */
export function rivalTrainedStat(T: number): number {
  const value = Number.isInteger(T) && T >= 1 ? RIVAL_TRAINED_STAT[T - 1] : undefined
  if (value === undefined) throw new RangeError(`Scenario ${T} has no rival strength`)
  return value
}

/**
 * How strong a career's fields are at each point of its calendar, as a share of the scenario's trained stat (D383):
 * seasons 0–11, then the Finale at 12. Measured by `sim:careers` as the typical career's average stat when it races in
 * that season, over its average at the Finale. Junior Spring is set lower than measured (0.294): she races there before
 * any Training Yard, on her base stats, and the fields' stamina-first presets outlast her. A field outside a career
 * (no season) is a finished career's: 1.
 */
export const RIVAL_SEASON_SHARE: readonly number[] = Object.freeze([
  0.15, 0.357, 0.44, 0.496, 0.536, 0.621, 0.678, 0.743, 0.758, 0.86, 0.899, 0.981, 1,
])

/** The share of the trained stat a field races at in this season of a career; 1 outside one. */
export function rivalSeasonShare(season: number | undefined): number {
  if (season === undefined) return 1
  const share = Number.isInteger(season) ? RIVAL_SEASON_SHARE[season] : undefined
  if (share === undefined) throw new RangeError(`No season ${season}`)
  return share
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
  /** The career's season the race falls in (0–11, or 12 for the Finale): the field is as strong as that point. */
  readonly season?: number
  /** The rivals' handicap, when the race sets its own (the URA Finals' final). Defaults to the grade's. */
  readonly handicap?: number
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
  const fieldStat = input.fieldStat ?? rivalFieldStat(T, input.catalogue) * rivalSeasonShare(input.season)
  const total = fieldStat * (1 - (input.handicap ?? GRADE_HANDICAP[grade])) * STATS.length
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
