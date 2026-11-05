// Rival Umas, generated fresh for every race (docs/design/racing.md#opponents-generated-rivals, D152–D153): a mix of
// running styles rolled per race, each rival on her style's preset for the scenario and distance, every stat rolled.
import type { UmaTemplate } from './content'
import { raceSkillFitsRunner, type CompiledRaceSkill, type RaceSkillCourseFacts } from './race-skills'
import { GRADES, STATS, STRATEGIES, mapStats, type DistanceCategory, type RaceGrade, type StatKey, type Stats, type Strategy } from './types'

/** Uniform in [0, 1). The race's seeded RNG; the domain never uses Math.random. */
export interface RivalRng {
  next(): number
}

/** Median base stat of the imported roster. */
export const TYPICAL_BASE_STAT = 110

/**
 * How much weaker than the typical trained Uma a grade's rivals race (D152, D155; re-tuned by `sim:careers` against
 * generation 3's career in D383, where the trained Uma is the typical career at the race's season). A share rather than
 * a fixed amount, so a grade is equally soft at every tier and in every stat of a build. G1 is the real test; each
 * grade below is softer. A career races G3s, G2s and G1s; the lower grades only keep the ladder.
 */
export const GRADE_HANDICAP: Record<RaceGrade, number> = {
  debut: 0.45,
  maiden: 0.45,
  'pre-op': 0.4,
  op: 0.4,
  g3: 0.38,
  g2: 0.22,
  g1: 0.17,
}

/** The four stats a rival spreads by weight; Stamina is set first, by what the distance needs (D159). */
export type SpreadStat = Exclude<StatKey, 'stamina'>
export const SPREAD_STATS: readonly SpreadStat[] = ['speed', 'power', 'guts', 'wit']

/**
 * How a rival spreads what is left after Stamina, by distance, the way a trained Uma does (D155, D159): Speed first,
 * as every real build stacks it, Power for the acceleration that decides sprints, and more Guts and Wit the longer the
 * race. Each row averages 1: it shapes the build rather than shrinking it.
 */
export const NPC_PROFILE: Record<DistanceCategory, Record<SpreadStat, number>> = {
  sprint: { speed: 1.5, power: 1.2, guts: 0.65, wit: 0.65 },
  mile: { speed: 1.5, power: 1.1, guts: 0.65, wit: 0.75 },
  medium: { speed: 1.45, power: 1.0, guts: 0.7, wit: 0.85 },
  long: { speed: 1.4, power: 0.9, guts: 0.8, wit: 0.9 },
}

/**
 * How each running style spreads those four (D153, D159), after the original's needs: a front runner holds her lead on
 * Wit and fights for it on Guts, and closers win on the Power that accelerates the last spurt. Each row averages 1.
 * Each style's Stamina follows from its HP coefficient instead.
 */
export const STYLE_PROFILE: Record<Strategy, Record<SpreadStat, number>> = {
  front: { speed: 1.0, power: 0.9, guts: 1.0, wit: 1.1 },
  pace: { speed: 1.0, power: 1.0, guts: 1.0, wit: 1.0 },
  late: { speed: 1.0, power: 1.1, guts: 0.95, wit: 0.95 },
  end: { speed: 1.0, power: 1.15, guts: 0.95, wit: 0.9 },
}

/** Each category's distance, when the caller has no race to name one: the rival builds for the category's longest. */
export const RIVAL_REFERENCE_METERS: Record<DistanceCategory, number> = { sprint: 1400, mile: 1800, medium: 2400, long: 3200 }

// The original's race numbers the Stamina estimate reads (mirrored from @racer/race, which checks this against its
// engine): each style's HP coefficient, its speed coefficient by leg, and the last 60 m the spurt plan leaves out.
const HP_COEF: Record<Strategy, number> = { front: 0.95, pace: 0.89, late: 1.0, end: 0.995 }
const SPEED_COEF: Record<Strategy, readonly [number, number, number]> = {
  front: [1.0, 0.98, 0.962],
  pace: [0.978, 0.991, 0.975],
  late: [0.938, 0.998, 0.994],
  end: [0.931, 1.0, 1.0],
}
const SPURT_BUFFER_METERS = 60
/**
 * What position keeping and the competitions before the spurt add to the opening and middle legs' HP at 2,000 m
 * (engine v7, measured by the sims): front runners fight for the lead, so theirs is the largest. It grows 4 points a
 * kilometre, as the pushes add up over a longer race.
 */
export const EARLY_HP_MARGIN: Record<Strategy, number> = { front: 1.06, pace: 1.0, late: 1.0, end: 1.0 }

const effective = (value: number): number => (value <= 1200 ? value : 1200 + (value - 1200) / 2)

/**
 * The Stamina a runner needs to hold her maximum last spurt from the final leg to the line (engine v7's HP model): the
 * opening and middle legs at her style's pace, then the final third at full spurt, which Guts makes cheaper and Speed
 * dearer, with a margin for the field's pushes. The last 60 m are the spurt plan's buffer.
 */
export function fullSpurtStamina(distance: number, strategy: Strategy, speed: number, guts: number): number {
  const base = 20 - (distance - 2000) / 1000
  const drain = (v: number) => (20 * (v - base + 12) ** 2) / 144
  const [opening, middle, final] = SPEED_COEF[strategy]
  const early = (((distance / 6) * drain(base * opening)) / (base * opening) + ((distance / 2) * drain(base * middle)) / (base * middle)) *
    (EARLY_HP_MARGIN[strategy] + (0.04 * (distance - 2000)) / 1000)
  const term = Math.sqrt(500 * effective(speed)) * 0.002
  const legPace = base * final + term
  const max = (legPace + 0.01 * base) * 1.05 + term + (450 * effective(guts)) ** 0.597 * 0.0001
  const gutsMod = 1 + 200 / Math.sqrt(600 * Math.max(1, effective(guts)))
  const late = (((distance / 3 - SPURT_BUFFER_METERS) * drain(max)) / max) * gutsMod
  return Math.max(0, (early + late - distance) / (0.8 * HP_COEF[strategy]))
}

/** A rival's Stamina covers a full spurt from this share of her roll up: half the field can hold one, half cannot. */
export const RIVAL_STAMINA_ROLL = 0.9
/** However long the race, no rival puts more than this share of her build into Stamina. */
export const RIVAL_STAMINA_SHARE_MAX = 0.4

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

/**
 * How many whites a rival carries beside her own unique (D163): rolled per rival, so one brings three and another
 * seven. A random draw is weaker than the curated four every rival carried before (it includes passives and
 * corner-only skills), so five on average matches that kit's strength (`pnpm sim:turns`): a field is as strong as it
 * was, only less alike.
 */
export const RIVAL_SKILL_RANGE = { min: 3, max: 7 }

/**
 * A rival's whites for this race: a seeded draw, without repeats, from the pool (`selectRivalSkillPool`) of skills that
 * can fire for her running style on this course. Deterministic from the race seed, and stored on the race record.
 */
export function rollRivalSkills(
  pool: readonly CompiledRaceSkill[],
  input: { strategy: Strategy; course: RaceSkillCourseFacts; rng: RivalRng },
): CompiledRaceSkill[] {
  const fits = pool.filter((skill) => raceSkillFitsRunner(skill, input.course, input.strategy))
  const count = Math.min(fits.length,
    RIVAL_SKILL_RANGE.min + Math.floor(input.rng.next() * (RIVAL_SKILL_RANGE.max - RIVAL_SKILL_RANGE.min + 1)))
  const picked = [...fits]
  for (let index = 0; index < count; index += 1) {
    const other = index + Math.floor(input.rng.next() * (picked.length - index))
    ;[picked[index], picked[other]] = [picked[other]!, picked[index]!]
  }
  return picked.slice(0, count)
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
