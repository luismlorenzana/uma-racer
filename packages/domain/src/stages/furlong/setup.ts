// Furlong Hand's race setup (docs/game/09-furlong-hand.md §1, D385): the facts a play reads beyond the deck, built from
// the career and the content on the device and the API alike, so the rules never look further. The race whose course
// it runs and its legs (the real layout cut into Sprint 3, Mile 4, Medium 5 or Long 6 legs and the spurt, each leg's
// terrain its longest kind of ground), her racing build as the rules read it (each stat as a percentage of the season's
// typical trained Uma, her distance and style aptitudes, her style), her skills, and the rival field: real Umas cast by
// `rollRivalFieldAt` and `castRivals` from the race's grade and season, seeded by the stage's seed. Plain JSON data,
// whole numbers only. Pure.
import type { CourseTemplate, RaceTemplate, SkillTemplate, UmaTemplate } from '../../content'
import { compileRaceCourseLayout, compileRaceCourseSlopes } from '../../course-layout'
import { castRivals, type RivalRng } from '../../opponents'
import { skillChainBelow } from '../../race-skills'
import { rivalFieldStat, rivalSeasonShare, rollRivalFieldAt } from '../../tiers/rivals'
import { GRADES, STATS, type DistanceCategory, type Grade, type RaceGrade, type Stats, type Strategy, type Surface } from '../../types'
import { stageRng } from '../rng'

/** A leg's ground: Speed is favoured on a straight, Power on a corner and a climb. */
export const TERRAINS = ['straight', 'corner', 'climb'] as const
export type FurlongTerrain = (typeof TERRAINS)[number]

/** Legs before the spurt, by the race's distance (M036). */
export const LEGS_BY_DISTANCE: Readonly<Record<DistanceCategory, number>> = Object.freeze({ sprint: 3, mile: 4, medium: 5, long: 6 })

/** Rival tokens on the ladder: with her, nine places. */
export const FURLONG_RIVALS = 8

/** When a skill card fires: on a leg of its terrain, in the spurt, or anywhere. */
export type SkillTrigger = FurlongTerrain | 'spurt' | 'any'

export interface FurlongSkill {
  readonly id: string
  /** Its colour (0 Speed … 4 Wit), from its first effect. */
  readonly colour: number
  readonly trigger: SkillTrigger
  /** A gold or her unique: it fires stronger. */
  readonly gold: boolean
}

export interface FurlongRival {
  readonly umaId: string
  readonly strategy: Strategy
  /** Her mean stat as a percentage of the season's typical trained Uma. */
  readonly strength: number
}

export interface FurlongHer {
  readonly strategy: Strategy
  /** Each stat (Speed … Wit) as a percentage of the season's typical trained Uma. */
  readonly stats: readonly number[]
  readonly distance: Grade
  readonly style: Grade
}

export interface FurlongSetup {
  readonly race: {
    readonly id: string
    readonly name: string
    readonly meters: number
    readonly distance: DistanceCategory
    readonly surface: Surface
    readonly grade: RaceGrade
  }
  /** The legs before the spurt, in order. */
  readonly legs: readonly FurlongTerrain[]
  /** The home stretch's ground. */
  readonly spurt: FurlongTerrain
  readonly her: FurlongHer
  /** Her skills in the order Wit deals them: her unique, then golds, then whites. */
  readonly skills: readonly FurlongSkill[]
  readonly rivals: readonly FurlongRival[]
}

// --- The legs -------------------------------------------------------------------------------------------------------

const overlap = (a: number, b: number, segments: readonly { start: number; end: number }[]): number =>
  segments.reduce((sum, seg) => sum + Math.max(0, Math.min(b, seg.end) - Math.max(a, seg.start)), 0)

/** A stretch's terrain: a climb when a quarter of it runs uphill, else a corner where corners outrun straights. */
export function terrainOf(start: number, end: number, layout: {
  readonly corners: readonly { start: number; end: number }[]
  readonly straights: readonly { start: number; end: number }[]
  readonly slopes?: readonly { start: number; end: number; slope: number }[]
}): FurlongTerrain {
  const length = end - start
  const uphill = overlap(start, end, (layout.slopes ?? []).filter((slope) => slope.slope > 0))
  if (uphill * 4 >= length) return 'climb'
  return overlap(start, end, layout.corners) > overlap(start, end, layout.straights) ? 'corner' : 'straight'
}

/** The race cut into its legs and the spurt, equal lengths, each with its terrain. */
export function raceLegs(race: Pick<RaceTemplate, 'distance' | 'distanceCategory' | 'direction' | 'courseId'>, course: CourseTemplate): { legs: FurlongTerrain[]; spurt: FurlongTerrain } {
  const layout = { ...compileRaceCourseLayout(course, race.distance, race.direction), slopes: compileRaceCourseSlopes(course, race.distance) }
  const count = LEGS_BY_DISTANCE[race.distanceCategory]
  const cut = (i: number) => Math.floor((race.distance * i) / (count + 1))
  const legs = Array.from({ length: count }, (_, i) => terrainOf(cut(i), cut(i + 1), layout))
  return { legs, spurt: terrainOf(cut(count), race.distance, layout) }
}

// --- Her ------------------------------------------------------------------------------------------------------------

/** The season's typical trained Uma's mean stat: what her stats and the rivals' are read against. */
export const typicalStat = (T: number, season: number): number => rivalFieldStat(T) * rivalSeasonShare(season)

/** Her racing build as the rules read it: each stat as a whole percentage of the typical stat. */
export function furlongHer(stats: Stats, aptitudes: UmaTemplate['aptitudes'], distance: DistanceCategory, strategy: Strategy, typical: number): FurlongHer {
  return {
    strategy,
    stats: STATS.map((stat) => Math.max(0, Math.round((100 * stats[stat]) / typical))),
    distance: aptitudes.distance[distance],
    style: aptitudes.strategy[strategy],
  }
}

/** A skill's colour by its first effect: speed-ups Speed, recovery Stamina, acceleration Power, Guts, else Wit. */
export function skillColour(skill: Pick<SkillTemplate, 'conditions'>): number {
  const type = skill.conditions[0]?.effects[0]?.type ?? 0
  if ([1, 21, 22, 27, 37, 42].includes(type)) return 0
  if ([2, 9].includes(type)) return 1
  if ([3, 31, 48].includes(type)) return 2
  if (type === 4) return 3
  return 4
}

/** When a skill fires, read from its condition: corners, straights, uphill, the late race, else anywhere. */
export function skillTrigger(skill: Pick<SkillTemplate, 'conditions'>): SkillTrigger {
  const text = skill.conditions.map((condition) => `${condition.precondition ?? ''}&${condition.condition ?? ''}`).join('|')
  if (/slope==1|up_slope/.test(text)) return 'climb'
  if (/corner/.test(text) && !/is_finalcorner/.test(text)) return 'corner'
  if (/straight/.test(text)) return 'straight'
  if (/phase>=2|phase==2|phase==3|is_finalcorner|is_lastspurt|remain_distance|last_straight/.test(text)) return 'spurt'
  return 'any'
}

/** Her skills as cards: her unique first, then the golds she bought, then the whites (a gold stands for its white). */
export function furlongSkills(uniqueSkillId: string | null, bought: readonly string[], skills: ReadonlyMap<string, SkillTemplate>): FurlongSkill[] {
  const below = new Set(bought.flatMap((id) => {
    const skill = skills.get(id)
    return skill === undefined ? [] : skillChainBelow(skill, skills).map((lower) => lower.id)
  }))
  const own = uniqueSkillId === null ? [] : [skills.get(uniqueSkillId)].filter((skill) => skill !== undefined)
  const rest = bought.filter((id) => id !== uniqueSkillId && !below.has(id)).flatMap((id) => {
    const skill = skills.get(id)
    return skill === undefined ? [] : [skill]
  }).sort((a, b) => Number(b.kind === 'gold') - Number(a.kind === 'gold') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return [...own, ...rest].map((skill) => ({
    id: skill.id, colour: skillColour(skill), trigger: skillTrigger(skill), gold: skill.kind !== 'white',
  }))
}

// --- The field ------------------------------------------------------------------------------------------------------

/** Floats in [0, 1) from the stage's integer dice, for the rival field's roll (as `raceRng` reads them). */
const rivalRng = (seed: number): RivalRng => {
  const rng = stageRng(seed)
  return { next: () => rng.nextInt() / 4294967296 }
}

export interface FieldInput {
  readonly seed: number
  readonly T: number
  /** The career's season the field is as strong as: 0–11, or 12 for the Finale. */
  readonly season: number
  readonly grade: RaceGrade
  readonly handicap?: number
  readonly race: Pick<RaceTemplate, 'distance' | 'distanceCategory'>
  /** Her, so she never meets herself (one Uma a character). */
  readonly uma: Pick<UmaTemplate, 'id' | 'charaId'>
  readonly umas: ReadonlyMap<string, UmaTemplate>
}

/**
 * The rival field: up to eight real Umas (one a character, never hers), shuffled by the seed, each cast to a style
 * slot of `rollRivalFieldAt` at the race's grade and season, with her mean stat over the typical one.
 */
export function furlongField(input: FieldInput): FurlongRival[] {
  const pool = new Map<string, UmaTemplate>()
  for (const uma of [...input.umas.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (uma.charaId !== input.uma.charaId && uma.id !== input.uma.id && !pool.has(uma.charaId)) pool.set(uma.charaId, uma)
  }
  const shuffled = [...pool.values()]
  const dice = stageRng((input.seed ^ 0x2c1b3c6d) >>> 0)
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = dice.below(i + 1)
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  const count = Math.min(FURLONG_RIVALS, shuffled.length)
  if (count === 0) return []
  const slots = rollRivalFieldAt({
    T: input.T, grade: input.grade, distance: input.race.distanceCategory, meters: input.race.distance, count,
    rng: rivalRng((input.seed ^ 0x297a2d39) >>> 0), season: input.season, ...(input.handicap === undefined ? {} : { handicap: input.handicap }),
  })
  const cast = castRivals(shuffled, slots)
  const typical = typicalStat(input.T, input.season)
  return slots.map((slot, i) => ({
    umaId: cast[i]!.id,
    strategy: slot.strategy,
    strength: Math.max(1, Math.round((100 * STATS.reduce((sum, stat) => sum + slot.stats[stat], 0)) / (STATS.length * typical))),
  }))
}

// --- Everything -----------------------------------------------------------------------------------------------------

export interface SetupInput {
  readonly seed: number
  readonly T: number
  readonly season: number
  readonly grade: RaceGrade
  readonly handicap?: number
  readonly race: RaceTemplate
  readonly course: CourseTemplate
  readonly uma: UmaTemplate
  /** Her racing stats: the career's capped stats, or her base outside one. */
  readonly stats: Stats
  readonly strategy: Strategy
  /** Her bought skills. */
  readonly bought: readonly string[]
  readonly skills: ReadonlyMap<string, SkillTemplate>
  readonly umas: ReadonlyMap<string, UmaTemplate>
}

export function furlongSetup(input: SetupInput): FurlongSetup {
  const { race } = input
  const { legs, spurt } = raceLegs(race, input.course)
  return {
    race: { id: race.id, name: race.name, meters: race.distance, distance: race.distanceCategory, surface: race.surface, grade: input.grade },
    legs,
    spurt,
    her: furlongHer(input.stats, input.uma.aptitudes, race.distanceCategory, input.strategy, typicalStat(input.T, input.season)),
    skills: furlongSkills(input.uma.uniqueSkillId, input.bought, input.skills),
    rivals: furlongField({ ...input, race }),
  }
}

/** A grade's rank: S 0 … G 7. */
export const gradeRank = (grade: Grade): number => GRADES.indexOf(grade)
