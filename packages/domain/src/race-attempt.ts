// A race attempt as it ran: the seed, the field size, the strategy default and the replayable run (course and field),
// kept from the retired progression races by T152 (D381). What a race pays is the career's (T154), not this file's.

import { FLAIR_SERIES_TAGS, parseFlairSeriesLegId } from './race-series'
import type { RaceTemplate, UmaTemplate } from './content'
import type { RaceCourseLayout } from './course-layout'
import { parseCompiledRaceSkill, type CompiledRaceSkill } from './race-skills'
import {
  DISTANCE_CATEGORIES,
  GRADES,
  RACE_GRADES,
  STATS,
  STRATEGIES,
  SURFACES,
  distanceCategory,
  type Grade,
  type Stats,
  type Strategy,
  type Surface,
} from './types'

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/

export interface RaceResultAptitude {
  distance: Grade
  surface: Grade
  strategy: Grade
}

export interface RaceResultRunner {
  umaId: string
  isPlayer: boolean
  strategy: Strategy
  gate: number
  stats: Stats
  aptitude: RaceResultAptitude
  placement: number
  finishTime: number
  marginLengths: number
  /** Present on engine-v2/v3 records; absent on legacy T005 results. */
  skills?: CompiledRaceSkill[]
}

export interface RaceResultCourse {
  distance: number
  surface: Surface
  season: number
  /** Present on engine-v3 records; v5 layouts also carry slopes. */
  layout?: RaceCourseLayout
  /** Engine v5: the imported track id and the original's rotation code, for course-fact skill conditions. */
  trackId?: number
  rotation?: number
  /** Engine v8: the original's grade code (G1 100, G2 200, G3 300, OP 400 …) for the `grade` condition. */
  grade?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const expected = [...keys].sort()
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

const isId = (value: unknown): value is string => typeof value === 'string' && ID_PATTERN.test(value)
const isNonNegativeInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const isPositiveInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0
const isFiniteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const isSortedUniqueStrings = (value: readonly string[]): boolean =>
  value.every((entry, index) => index === 0 || value[index - 1]!.localeCompare(entry) < 0)

function parseStats(value: unknown): Stats | null {
  if (!isRecord(value) || !hasExactKeys(value, STATS) || STATS.some((key) => !isFiniteNonNegative(value[key]))) return null
  return Object.fromEntries(STATS.map((key) => [key, value[key] as number])) as Stats
}

function parseAptitude(value: unknown): RaceResultAptitude | null {
  if (!isRecord(value) || !hasExactKeys(value, ['distance', 'surface', 'strategy'])) return null
  if (![value.distance, value.surface, value.strategy].every((item) => GRADES.includes(item as Grade))) return null
  return value as unknown as RaceResultAptitude
}

function parseCourseLayout(value: unknown, distance: number, withSlopes = false, withFrontTypes = false): RaceCourseLayout | null {
  if (!isRecord(value) || !hasExactKeys(value, withSlopes ? ['corners', 'straights', 'slopes'] : ['corners', 'straights']) ||
    !Array.isArray(value.corners) || !Array.isArray(value.straights) || (withSlopes && !Array.isArray(value.slopes))) return null
  const parseSegments = (segments: unknown[], corner: boolean) => segments.map((segment, index) => {
    // Engine v8 straights may name their front type (1 home, 2 back) for `straight_front_type`.
    const frontType = !corner && withFrontTypes && isRecord(segment) && Object.hasOwn(segment, 'frontType')
    if (!isRecord(segment) || !hasExactKeys(segment, corner ? ['start', 'end', 'number'] : frontType ? ['start', 'end', 'frontType'] : ['start', 'end']) ||
      !isFiniteNonNegative(segment.start) || !isFiniteNonNegative(segment.end) || segment.end <= segment.start ||
      segment.end > distance || (index > 0 && ((segments[index - 1] as Record<string, unknown>).end as number) > segment.start) ||
      (corner && (!isPositiveInt(segment.number) || segment.number > 32)) ||
      (frontType && segment.frontType !== 1 && segment.frontType !== 2)) return null
    return corner
      ? { start: segment.start, end: segment.end, number: segment.number as number }
      : { start: segment.start, end: segment.end, ...(frontType ? { frontType: segment.frontType as 1 | 2 } : {}) }
  })
  const corners = parseSegments(value.corners, true)
  const straights = parseSegments(value.straights, false)
  if (corners.some((segment) => segment === null) || straights.some((segment) => segment === null) ||
    (corners.length === 0 && straights.length === 0)) return null
  const layout = { corners: corners as RaceCourseLayout['corners'], straights: straights as RaceCourseLayout['straights'] }
  if (!withSlopes) return layout
  const slopes = (value.slopes as unknown[]).map((slope, index, all) =>
    isRecord(slope) && hasExactKeys(slope, ['start', 'end', 'slope']) && isFiniteNonNegative(slope.start) &&
    isFiniteNonNegative(slope.end) && slope.end > slope.start && slope.end <= distance &&
    typeof slope.slope === 'number' && Number.isFinite(slope.slope) && slope.slope !== 0 && Math.abs(slope.slope) <= 100_000 &&
    (index === 0 || ((all[index - 1] as Record<string, unknown>).end as number) <= slope.start)
      ? { start: slope.start, end: slope.end, slope: slope.slope }
      : null)
  return slopes.some((slope) => slope === null) ? null : { ...layout, slopes: slopes as NonNullable<RaceCourseLayout['slopes']> }
}

/** Validate every private race field consumed by T005 before it reaches setup or simulation. */
export function assertRaceContent(races: readonly RaceTemplate[]): void {
  const ids = new Set<string>()
  for (const race of races) {
    if (!isId(race.id) || ids.has(race.id)) throw new Error(`Race ${String(race.id)} has an invalid or duplicate id`)
    ids.add(race.id)
    if (
      typeof race.name !== 'string' || race.name.length === 0 ||
      !/^\d+$/.test(race.familyId) ||
      typeof race.venue !== 'string' || race.venue.length === 0 ||
      !isId(race.venueKey) || !Array.isArray(race.venueTags) ||
      race.venueTags.some((tag) => tag !== 'jra-main') || new Set(race.venueTags).size !== race.venueTags.length ||
      !Array.isArray(race.series) || race.series.some((tag) => !FLAIR_SERIES_TAGS.includes(tag)) ||
      !isSortedUniqueStrings(race.series) ||
      !Array.isArray(race.seriesLegs) || !isSortedUniqueStrings(race.seriesLegs) ||
      race.seriesLegs.some((leg) => {
        const parsed = parseFlairSeriesLegId(leg)
        return parsed === null || !race.series.includes(parsed.tag)
      }) ||
      race.series.some((tag) => !race.seriesLegs.some((leg) => parseFlairSeriesLegId(leg)?.tag === tag)) ||
      !isId(race.courseId) ||
      !RACE_GRADES.includes(race.grade) ||
      !SURFACES.includes(race.surface) ||
      !DISTANCE_CATEGORIES.includes(race.distanceCategory) ||
      !isPositiveInt(race.distance) ||
      distanceCategory(race.distance) !== race.distanceCategory ||
      !['right', 'left', 'straight'].includes(race.direction) ||
      !isNonNegativeInt(race.season) ||
      !Number.isSafeInteger(race.fieldSize) || race.fieldSize < 1 || race.fieldSize > 18
    ) {
      throw new Error(`Race ${race.id} has invalid race data`)
    }
  }
}


/** Imported source entry counts below eight are padded to the documented gameplay field minimum. */
export function raceFieldSize(race: Pick<RaceTemplate, 'fieldSize'>): number {
  if (!Number.isSafeInteger(race.fieldSize) || race.fieldSize < 1 || race.fieldSize > 18) {
    throw new Error('Invalid race field size')
  }
  return Math.max(8, race.fieldSize)
}

/** Stable FNV-1a attempt seed; zero is remapped because it is easy to mistake for a missing query value. */
export function raceAttemptSeed(
  createdAt: number,
  contentVersion: string,
  umaId: string,
  raceId: string,
  strategy: Strategy,
  sequence: number,
): number {
  if (!isNonNegativeInt(createdAt) || !isId(contentVersion) || !isId(umaId) || !isId(raceId)) {
    throw new Error('Invalid race seed identity')
  }
  if (!STRATEGIES.includes(strategy) || !isNonNegativeInt(sequence)) throw new Error('Invalid race seed options')
  const text = `${createdAt}:${contentVersion}:${umaId}:${raceId}:${strategy}:${sequence}`
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  const seed = hash >>> 0
  return seed === 0 ? 1 : seed
}

export function raceAttemptId(umaId: string, sequence: number): string {
  if (!isId(umaId) || !isNonNegativeInt(sequence)) throw new Error('Invalid race attempt identity')
  const id = `race:${umaId}:${sequence}`
  if (!ID_PATTERN.test(id)) throw new Error('Race attempt id is too long')
  return id
}

/** Highest strategy aptitude, with the documented strategy order as a stable tie break. */
export function bestStrategy(template: UmaTemplate): Strategy {
  const rank = (grade: Grade) => GRADES.indexOf(grade)
  return STRATEGIES.reduce((best, strategy) =>
    rank(template.aptitudes.strategy[strategy]) < rank(template.aptitudes.strategy[best]) ? strategy : best,
  STRATEGIES[0])
}

function parseRunner(value: unknown, fieldSize: number): RaceResultRunner | null {
  if (!isRecord(value)) return null
  const hasSkills = Object.hasOwn(value, 'skills')
  if (!hasExactKeys(value, [
    'umaId', 'isPlayer', 'strategy', 'gate', 'stats', 'aptitude', 'placement', 'finishTime', 'marginLengths',
    ...(hasSkills ? ['skills'] : []),
  ])) return null
  const stats = parseStats(value.stats)
  const aptitude = parseAptitude(value.aptitude)
  const skills = hasSkills && Array.isArray(value.skills) ? value.skills.map(parseCompiledRaceSkill) : []
  if (
    !isId(value.umaId) || typeof value.isPlayer !== 'boolean' || !STRATEGIES.includes(value.strategy as Strategy) ||
    !isNonNegativeInt(value.gate) || value.gate >= fieldSize || !stats || !aptitude ||
    !isPositiveInt(value.placement) || value.placement > fieldSize ||
    !isFiniteNonNegative(value.finishTime) || !isFiniteNonNegative(value.marginLengths) ||
    (hasSkills && (!Array.isArray(value.skills) || skills.some((skill) => skill === null) ||
      new Set(skills.map((skill) => skill!.id)).size !== skills.length))
  ) return null
  return {
    umaId: value.umaId,
    isPlayer: value.isPlayer,
    strategy: value.strategy as Strategy,
    gate: value.gate,
    stats,
    aptitude,
    placement: value.placement,
    finishTime: value.finishTime,
    marginLengths: value.marginLengths,
    ...(hasSkills ? { skills: skills as CompiledRaceSkill[] } : {}),
  }
}

/** The engine versions that record skills and a course (v1, the skillless engine, records neither). */
export type SkilledEngineVersion = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
const SKILLED_ENGINE_VERSIONS: readonly SkilledEngineVersion[] = [2, 3, 4, 5, 6, 7, 8, 9]

/**
 * The course a skilled engine recorded. Engine v4 (the stamina contest, D135) records the same course shape as v3; v5
 * adds slopes, track and rotation; v6 (turns, D154) and v7 (D158) record the same course as v5; v8 adds the race's grade
 * and each straight's front type, and v9 (D240) records v8's course.
 */
function parseRaceCourse(value: unknown, version: SkilledEngineVersion): RaceResultCourse | null {
  const hasLayout = version >= 3
  const v5 = version >= 5
  const v8 = version >= 8
  const courseKeys = v8
    ? ['distance', 'surface', 'season', 'layout', 'trackId', 'rotation', 'grade']
    : v5
      ? ['distance', 'surface', 'season', 'layout', 'trackId', 'rotation']
      : hasLayout ? ['distance', 'surface', 'season', 'layout'] : ['distance', 'surface', 'season']
  if (!isRecord(value) || !hasExactKeys(value, courseKeys) || !isPositiveInt(value.distance) ||
    !SURFACES.includes(value.surface as Surface) || !isNonNegativeInt(value.season)) return null
  const layout = hasLayout ? parseCourseLayout(value.layout, value.distance, v5, v8) : null
  if ((hasLayout && !layout) || (v5 && (!isNonNegativeInt(value.trackId) || !isNonNegativeInt(value.rotation))) ||
    (v8 && !isNonNegativeInt(value.grade))) return null
  return {
    distance: value.distance,
    surface: value.surface as Surface,
    season: value.season,
    ...(hasLayout ? { layout: layout! } : {}),
    ...(v5 ? { trackId: value.trackId as number, rotation: value.rotation as number } : {}),
    ...(v8 ? { grade: value.grade as number } : {}),
  }
}

/**
 * A race's field: 8–18 runners, each gate, place and Uma once, exactly one of them hers. A skilled engine's runners
 * carry their skills; a v1 record's never do.
 */
function parseRaceField(value: unknown, skilled: boolean): RaceResultRunner[] | null {
  if (!Array.isArray(value)) return null
  const fieldSize = value.length
  if (fieldSize < 8 || fieldSize > 18) return null
  const runners = value.map((runner) => parseRunner(runner, fieldSize))
  if (runners.some((runner) => runner === null)) return null
  const field = runners as RaceResultRunner[]
  if (
    field.filter((runner) => runner.isPlayer).length !== 1 ||
    new Set(field.map((runner) => runner.gate)).size !== fieldSize ||
    new Set(field.map((runner) => runner.placement)).size !== fieldSize ||
    new Set(field.map((runner) => runner.umaId)).size !== fieldSize ||
    field.some((runner) => (runner.skills !== undefined) !== skilled)
  ) return null
  return field
}

/** A race as it ran: what replays it exactly (engine version, course, seed, field with stats, aptitudes and skills). */
export interface RaceRun {
  engineVersion: SkilledEngineVersion
  course: RaceResultCourse
  contentVersion: string
  seed: number
  strategy: Strategy
  field: RaceResultRunner[]
}

const RACE_RUN_KEYS = ['engineVersion', 'course', 'contentVersion', 'seed', 'strategy', 'field'] as const

// --- The engine, as the rules call it (T154, D383) ----------------------------------------------------------------
// The domain never imports `@racer/race` (the engine imports the domain). A career race is prepared here, run by the
// engine the caller hands the operation (`OperationEnv.race`: the device's and the API's own `simulateRace`), and
// settled here from its result. These shapes are the engine's input and result, restated: `RaceSetup` is assignable to
// `@racer/race`'s `RaceInput`, and its `RaceTimeline` to `RaceFinish`.

/** One runner as the engine takes it. */
export interface RaceSetupRunner {
  readonly id: string
  readonly label: string
  readonly stats: Stats
  readonly strategy: Strategy
  readonly aptitude: RaceResultAptitude
  /** 0-based gate. */
  readonly gate: number
  readonly skills: readonly CompiledRaceSkill[]
}

/** The engine's input: the course, the field by gate and the seed. */
export interface RaceSetup {
  readonly course: Required<RaceResultCourse>
  readonly runners: readonly RaceSetupRunner[]
  readonly seed: number
}

/** One runner's finish, as the engine's results give it. */
export interface RaceFinishLine {
  /** Index into `RaceSetup.runners`. */
  readonly runner: number
  readonly placement: number
  readonly finishTime: number
  readonly marginLengths: number
}

/** What the rules read of a run: the results, in finishing order. */
export interface RaceFinish {
  readonly results: readonly RaceFinishLine[]
}

/** The race engine a caller hands the rules: its version, which the run records, and its simulation. */
export interface RaceEngine {
  readonly version: SkilledEngineVersion
  readonly simulate: (setup: RaceSetup) => RaceFinish
}

/**
 * The race's seeded RNG (mulberry32), step for step `@racer/race`'s `createRng`, so a field the rules roll is the field
 * the engine's own draw would roll. Never `Math.random`.
 */
export function raceRng(seed: number): { next(): number } {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

/**
 * The run as it ran, for the result row: the setup's course, seed and field, each runner with her finish, in finishing
 * order. `umaIds[i]` names runner i. Throws when the results don't place every runner once.
 */
export function raceRunOf(setup: RaceSetup, umaIds: readonly string[], playerIndex: number, strategy: Strategy, contentVersion: string,
  engineVersion: SkilledEngineVersion, finish: RaceFinish): RaceRun {
  const runners = setup.runners.length
  const placed = new Set(finish.results.map((line) => line.runner))
  if (finish.results.length !== runners || placed.size !== runners ||
    finish.results.some((line) => !Number.isInteger(line.runner) || line.runner < 0 || line.runner >= runners)) {
    throw new RangeError('The engine\'s results don\'t place every runner once')
  }
  const field: RaceResultRunner[] = [...finish.results].sort((a, b) => a.placement - b.placement).map((line) => {
    const runner = setup.runners[line.runner]!
    return {
      umaId: umaIds[line.runner]!, isPlayer: line.runner === playerIndex, strategy: runner.strategy, gate: runner.gate,
      stats: { ...runner.stats }, aptitude: { ...runner.aptitude }, placement: line.placement, finishTime: line.finishTime,
      marginLengths: line.marginLengths, skills: [...runner.skills],
    }
  })
  const course = setup.course
  return {
    engineVersion,
    course: { distance: course.distance, surface: course.surface, season: course.season, layout: course.layout, trackId: course.trackId,
      rotation: course.rotation, grade: course.grade },
    contentVersion, seed: setup.seed, strategy, field,
  }
}

export function parseRaceRun(value: unknown): RaceRun | null {
  if (!isRecord(value) || !hasExactKeys(value, RACE_RUN_KEYS)) return null
  if (!SKILLED_ENGINE_VERSIONS.includes(value.engineVersion as SkilledEngineVersion)) return null
  const version = value.engineVersion as SkilledEngineVersion
  const course = parseRaceCourse(value.course, version)
  const field = parseRaceField(value.field, true)
  if (!course || !field || !isId(value.contentVersion) || !isNonNegativeInt(value.seed) ||
    !STRATEGIES.includes(value.strategy as Strategy)) return null
  const player = field.find((runner) => runner.isPlayer)!
  if (player.strategy !== value.strategy) return null
  return { engineVersion: version, course, contentVersion: value.contentVersion, seed: value.seed, strategy: value.strategy as Strategy, field }
}
