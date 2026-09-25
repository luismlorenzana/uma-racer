// Rival Umas, generated fresh for every race (docs/design/racing.md#opponents-generated-rivals, D152–D153): a mix of
// running styles rolled per race, each rival on her style's preset for the scenario and distance, every stat rolled.
import { averageCap, capProfile, treeBudget } from './constellation'
import type { UmaTemplate } from './content'
import { GRADES, STATS, STRATEGIES, mapStats, type DistanceCategory, type RaceGrade, type Stats, type Strategy } from './types'

/** Uniform in [0, 1). The race's seeded RNG; the domain never uses Math.random. */
export interface RivalRng {
  next(): number
}

/** Median base stat of the imported roster. */
export const TYPICAL_BASE_STAT = 110

/**
 * A typical fully trained Uma's average stat at a tier (D152): her base plus a fifth of a full tree of 5★ current-era
 * cards. Rivals are built on it, so they grow with the tier exactly as a trained Uma does.
 */
export const trainedStat = (tier: number): number => TYPICAL_BASE_STAT + treeBudget(tier) / STATS.length

/**
 * How much weaker than a fully trained Uma a grade's rivals race (D152, retuned for engine v6 in D155). A share rather
 * than a fixed amount, so a grade is equally soft at every tier and in every stat of a build. G1 is the real test;
 * each grade below is softer.
 */
export const GRADE_HANDICAP: Record<RaceGrade, number> = {
  debut: 0.35,
  maiden: 0.35,
  'pre-op': 0.3,
  op: 0.3,
  g3: 0.25,
  g2: 0.15,
  g1: 0.05,
}

/**
 * How a rival spreads her stats for a distance, the way a trained Uma does (D155): Speed first, as every real build
 * stacks it, and the Stamina the distance needs, so a good roll holds a full spurt and a poor one falls short. Each
 * row averages 1: it shapes the build rather than shrinking it.
 */
export const NPC_PROFILE: Record<DistanceCategory, Stats> = {
  sprint: { speed: 1.5, stamina: 0.65, power: 1.1, guts: 0.8, wit: 0.95 },
  mile: { speed: 1.45, stamina: 0.8, power: 1.05, guts: 0.75, wit: 0.95 },
  medium: { speed: 1.4, stamina: 1.0, power: 1.0, guts: 0.7, wit: 0.9 },
  long: { speed: 1.3, stamina: 1.25, power: 0.9, guts: 0.75, wit: 0.8 },
}

/**
 * How each running style spreads its stats (D153), after the original's needs: a front runner holds her lead on Wit
 * and burns more HP per point of Stamina, closers win on the Power that accelerates the last spurt, and an end closer
 * gets the most HP from her Stamina. Each row averages 1.
 */
export const STYLE_PROFILE: Record<Strategy, Stats> = {
  front: { speed: 1.05, stamina: 1.0, power: 0.9, guts: 1.0, wit: 1.05 },
  pace: { speed: 1.05, stamina: 1.0, power: 1.0, guts: 0.95, wit: 1.0 },
  late: { speed: 1.05, stamina: 0.95, power: 1.1, guts: 0.95, wit: 0.95 },
  end: { speed: 1.05, stamina: 0.9, power: 1.15, guts: 1.0, wit: 0.9 },
}

/**
 * A rival's target stats, her 100% (D153): a trained Uma of the tier, handicapped by grade, shaped by the distance,
 * her running style and the scenario's caps. A scenario that caps Stamina high breeds rivals who lean on Stamina, at
 * the square root of its lean so no stat runs away. Never above the scenario's cap.
 */
export function rivalPreset(tier: number, grade: RaceGrade, distance: DistanceCategory, strategy: Strategy): Stats {
  const caps = capProfile(tier)
  const average = averageCap(tier)
  const shape = mapStats(NPC_PROFILE[distance], (weight, stat) =>
    weight * STYLE_PROFILE[strategy][stat] * Math.sqrt(caps[stat] / average))
  const mean = STATS.reduce((sum, stat) => sum + shape[stat], 0) / STATS.length
  const base = trainedStat(tier) * (1 - GRADE_HANDICAP[grade])
  return mapStats(shape, (weight, stat) => Math.min(caps[stat], (base * weight) / mean))
}

/** Each stat is rolled between 80% and 100% of the preset (D153): a lucky rival nears it, an unlucky one may run dry. */
export const RIVAL_STAT_FLOOR = 0.8

export const rollRivalStats = (preset: Stats, rng: RivalRng): Stats =>
  mapStats(preset, (value) => Math.round(value * (RIVAL_STAT_FLOOR + (1 - RIVAL_STAT_FLOOR) * rng.next())))

/** Rivals per running style, before the field's size limits it (D153). */
export const STYLE_COUNT_RANGE = { min: 2, max: 5 } as const

/**
 * How many rivals run each style: every split of the field with each style inside the range is equally likely. A
 * field too small for two of each lowers the floor to what fits, so an 8-runner race's 7 rivals still show every style.
 */
export function rollStyleCounts(rivals: number, rng: RivalRng): Record<Strategy, number> {
  const min = Math.min(STYLE_COUNT_RANGE.min, Math.floor(rivals / STRATEGIES.length))
  const max = Math.max(STYLE_COUNT_RANGE.max, Math.ceil(rivals / STRATEGIES.length))
  const splits: number[][] = []
  const build = (prefix: number[], left: number) => {
    if (prefix.length === STRATEGIES.length - 1) {
      if (left >= min && left <= max) splits.push([...prefix, left])
      return
    }
    for (let count = min; count <= Math.min(max, left); count += 1) build([...prefix, count], left - count)
  }
  build([], rivals)
  const split = splits[Math.floor(rng.next() * splits.length)]!
  return Object.fromEntries(STRATEGIES.map((strategy, index) => [strategy, split[index]!])) as Record<Strategy, number>
}

export interface RivalSlot {
  strategy: Strategy
  stats: Stats
}

/** A race's rivals in gate order: styles rolled, then each rival's stats rolled from her style's preset. */
export function rollRivalField(input: {
  tier: number
  grade: RaceGrade
  distance: DistanceCategory
  count: number
  rng: RivalRng
}): RivalSlot[] {
  const counts = rollStyleCounts(input.count, input.rng)
  const strategies = STRATEGIES.flatMap((strategy) => Array.from({ length: counts[strategy] }, () => strategy))
  for (let index = strategies.length - 1; index > 0; index -= 1) {
    const other = Math.floor(input.rng.next() * (index + 1))
    ;[strategies[index], strategies[other]] = [strategies[other]!, strategies[index]!]
  }
  return strategies.map((strategy) => ({
    strategy,
    stats: rollRivalStats(rivalPreset(input.tier, input.grade, input.distance, strategy), input.rng),
  }))
}

/**
 * Who runs each slot: for every slot, the first Uma in the (already shuffled) pool with the best aptitude for its
 * style, so front runners are drawn from the Umas who front-run. Rarer styles are cast first. Aligned with `slots`.
 */
export function castRivals(pool: readonly UmaTemplate[], slots: readonly Pick<RivalSlot, 'strategy'>[]): UmaTemplate[] {
  if (pool.length < slots.length) throw new Error(`Need ${slots.length} distinct rivals, have ${pool.length}`)
  const rank = (uma: UmaTemplate, strategy: Strategy) => GRADES.indexOf(uma.aptitudes.strategy[strategy])
  const suited = (strategy: Strategy) => pool.filter((uma) => rank(uma, strategy) <= GRADES.indexOf('A')).length
  const order = slots.map((slot, index) => ({ slot, index })).sort((left, right) =>
    suited(left.slot.strategy) - suited(right.slot.strategy) || left.index - right.index)
  const used = new Set<string>()
  const cast: UmaTemplate[] = new Array(slots.length)
  for (const { slot, index } of order) {
    let best: UmaTemplate | undefined
    for (const uma of pool) {
      if (!used.has(uma.id) && (!best || rank(uma, slot.strategy) < rank(best, slot.strategy))) best = uma
    }
    used.add(best!.id)
    cast[index] = best!
  }
  return cast
}
