// Saved-Uma progression races and rewards (docs/design/racing.md).

import { FLAIR_SERIES_TAGS, parseFlairSeriesLegId, type FlairSeriesTag } from './badges'
import type { RaceTemplate, UmaTemplate } from './content'
import type { RaceCourseLayout } from './course-layout'
import { GATE_SHARD_REWARD, expToNextUmaLevel, raceExp } from './progression'
import { parseCompiledRaceSkill, type CompiledRaceSkill } from './race-skills'
import { MAX_UMA_LEVEL, isGateLevel, tierOfLevel } from './scenarios'
import type { UmaSave } from './career-shapes'
import {
  DISTANCE_CATEGORIES,
  GRADES,
  RACE_GRADES,
  STATS,
  STRATEGIES,
  SURFACES,
  distanceCategory,
  type Grade,
  type RaceGrade,
  type Stats,
  type Strategy,
  type Surface,
} from './types'

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/

export interface UmaExperienceResult {
  uma: UmaSave
  expGained: number
  levelsGained: number[]
  reachedGate: number | null
  shardReward: number
}

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

export interface RaceAccomplishmentFactsV1 {
  version: 1
  familyId: string
  grade: RaceGrade
  venueKey: string
  venueTags: ('jra-main')[]
  courseId: string
  surface: Surface
  distance: number
  distanceCategory: (typeof DISTANCE_CATEGORIES)[number]
  series: FlairSeriesTag[]
  playerStartDelay: number
  playerFinalSpurtPlacement: number | null
  ledEverySectionCheckpoint: boolean
  inheritedUniqueActivated: boolean
}

export interface RaceResultRecord {
  /** Absent means legacy skillless engine v1. */
  engineVersion?: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  /** Present on engine-v2/v3 records so replay does not depend on mutable content metadata. */
  course?: RaceResultCourse
  contentVersion: string
  umaId: string
  raceId: string
  sequence: number
  seed: number
  strategy: Strategy
  /**
   * The scenario she raced as, written only when it is one before her current scenario (D190). Such a race pays no
   * EXP, tickets or shards and settles no goal. Absent, the scenario is the tier of her start level.
   */
  tier?: number
  startLevel: number
  startExp: number
  startStats: Stats
  raceBonus: number
  playerPlacement: number
  expGained: number
  levelsGained: number[]
  shardReward: number
  /** Snapshotted by T014; legacy records omit it. New records include an empty array when no goal completed. */
  completedGoalIds?: string[]
  /** Snapshotted by T015; legacy records omit it and remain valid. */
  accomplishmentFacts?: RaceAccomplishmentFactsV1
  /** Snapshotted by T016; legacy/T015 records may omit it. */
  earnedFlairEventIds?: string[]
  field: RaceResultRunner[]
  createdAt: number
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
export function assertProgressionRaceContent(races: readonly RaceTemplate[]): void {
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
      throw new Error(`Race ${race.id} has invalid progression-race data`)
    }
  }
}

export function parseRaceAccomplishmentFacts(
  value: unknown,
  record?: Pick<RaceResultRecord, 'playerPlacement' | 'field' | 'course'>,
): RaceAccomplishmentFactsV1 | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    'version', 'familyId', 'grade', 'venueKey', 'venueTags', 'courseId', 'surface', 'distance', 'distanceCategory',
    'series', 'playerStartDelay', 'playerFinalSpurtPlacement', 'ledEverySectionCheckpoint', 'inheritedUniqueActivated',
  ])) return null
  if (
    value.version !== 1 || !isId(value.familyId) || !RACE_GRADES.includes(value.grade as RaceGrade) || !isId(value.venueKey) ||
    !Array.isArray(value.venueTags) || value.venueTags.some((tag) => tag !== 'jra-main') ||
    new Set(value.venueTags).size !== value.venueTags.length || !isId(value.courseId) ||
    !SURFACES.includes(value.surface as Surface) || !isPositiveInt(value.distance) ||
    !DISTANCE_CATEGORIES.includes(value.distanceCategory as RaceAccomplishmentFactsV1['distanceCategory']) ||
    distanceCategory(value.distance) !== value.distanceCategory || !Array.isArray(value.series) ||
    value.series.some((tag) => !FLAIR_SERIES_TAGS.includes(tag as FlairSeriesTag)) ||
    !isSortedUniqueStrings(value.series as string[]) ||
    !isFiniteNonNegative(value.playerStartDelay) ||
    (value.playerFinalSpurtPlacement !== null && !isPositiveInt(value.playerFinalSpurtPlacement)) ||
    typeof value.ledEverySectionCheckpoint !== 'boolean' || typeof value.inheritedUniqueActivated !== 'boolean'
  ) return null
  if (record) {
    const player = record.field.find((runner) => runner.isPlayer)
    if (!player || (value.playerFinalSpurtPlacement !== null && value.playerFinalSpurtPlacement > record.field.length) ||
      (value.ledEverySectionCheckpoint && record.playerPlacement !== 1) ||
      (record.course && (value.distance !== record.course.distance || value.surface !== record.course.surface))) return null
  }
  return {
    version: 1,
    familyId: value.familyId,
    grade: value.grade as RaceGrade,
    venueKey: value.venueKey,
    venueTags: [...value.venueTags] as ('jra-main')[],
    courseId: value.courseId,
    surface: value.surface as Surface,
    distance: value.distance,
    distanceCategory: value.distanceCategory as RaceAccomplishmentFactsV1['distanceCategory'],
    series: [...value.series] as FlairSeriesTag[],
    playerStartDelay: value.playerStartDelay,
    playerFinalSpurtPlacement: value.playerFinalSpurtPlacement as number | null,
    ledEverySectionCheckpoint: value.ledEverySectionCheckpoint,
    inheritedUniqueActivated: value.inheritedUniqueActivated,
  }
}

/** Imported source entry counts below eight are padded to the documented gameplay field minimum. */
export function progressionFieldSize(race: Pick<RaceTemplate, 'fieldSize'>): number {
  if (!Number.isSafeInteger(race.fieldSize) || race.fieldSize < 1 || race.fieldSize > 18) {
    throw new Error('Invalid progression race field size')
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

/**
 * The scenario a race was run in (D122, T055). A promotion raises an Uma's level and her scenario in one step, so her
 * current scenario is always the tier of her level, and a record's start level names it. A race run as one of her
 * earlier scenarios names that one instead (D190).
 */
export const raceScenarioTier = (record: Pick<RaceResultRecord, 'startLevel' | 'tier'>): number =>
  record.tier ?? tierOfLevel(record.startLevel)

/**
 * Apply race EXP, stopping at the next gate and banking at most one following level there. A career hold
 * (`holdLevel`, from careerHoldLevel) stops it earlier and banks just short of the next level, so the race that wins
 * the stage's goal releases it (D137).
 */
export function addUmaRaceExp(uma: UmaSave, expGained: number, holdLevel: number | null = null): UmaExperienceResult {
  if (!isNonNegativeInt(expGained)) throw new Error('Race EXP must be a nonnegative integer')
  let level = uma.level
  let exp = uma.exp
  const levelsGained: number[] = []
  let reachedGate: number | null = null

  if (level >= MAX_UMA_LEVEL) {
    exp = 0
  } else if (isGateLevel(level)) {
    exp = Math.min(expToNextUmaLevel(level + 1), exp + expGained)
  } else if (holdLevel !== null && level >= holdLevel) {
    exp = Math.min(expToNextUmaLevel(level) - 1, exp + expGained)
  } else {
    exp += expGained
    while (level < MAX_UMA_LEVEL && !isGateLevel(level)) {
      const needed = expToNextUmaLevel(level)
      if (exp < needed) break
      exp -= needed
      level += 1
      levelsGained.push(level)
      if (isGateLevel(level)) {
        reachedGate = level
        exp = Math.min(expToNextUmaLevel(level + 1), exp)
        break
      }
      if (level === holdLevel) {
        exp = Math.min(expToNextUmaLevel(level) - 1, exp)
        break
      }
    }
    if (level >= MAX_UMA_LEVEL) exp = 0
  }

  return {
    uma: { ...uma, level, exp },
    expGained,
    levelsGained,
    reachedGate,
    shardReward: reachedGate === null ? 0 : GATE_SHARD_REWARD,
  }
}

export function resolveRaceExperience(
  uma: UmaSave,
  grade: RaceGrade,
  placement: number,
  raceBonus: number,
  holdLevel: number | null = null,
): UmaExperienceResult {
  if (!Number.isSafeInteger(placement) || placement < 1) throw new Error('Invalid race placement')
  if (!isFiniteNonNegative(raceBonus)) throw new Error('Invalid Race Bonus')
  return addUmaRaceExp(uma, raceExp(grade, placement, raceBonus), holdLevel)
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
type SkilledEngineVersion = NonNullable<RaceResultRecord['engineVersion']>
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

export function parseRaceResultRecord(value: unknown): RaceResultRecord | null {
  const hasEngineVersion = isRecord(value) && Object.hasOwn(value, 'engineVersion')
  const hasCompletedGoalIds = isRecord(value) && Object.hasOwn(value, 'completedGoalIds')
  const hasAccomplishmentFacts = isRecord(value) && Object.hasOwn(value, 'accomplishmentFacts')
  const hasEarnedFlairEventIds = isRecord(value) && Object.hasOwn(value, 'earnedFlairEventIds')
  const hasTier = isRecord(value) && Object.hasOwn(value, 'tier')
  const keys = [
    ...(hasEngineVersion ? ['engineVersion'] : []),
    ...(hasEngineVersion ? ['course'] : []),
    ...(hasTier ? ['tier'] : []),
    'contentVersion', 'umaId', 'raceId', 'sequence', 'seed', 'strategy', 'startLevel', 'startExp', 'startStats',
    'raceBonus', 'playerPlacement', 'expGained', 'levelsGained', 'shardReward',
    ...(hasCompletedGoalIds ? ['completedGoalIds'] : []),
    ...(hasAccomplishmentFacts ? ['accomplishmentFacts'] : []),
    ...(hasEarnedFlairEventIds ? ['earnedFlairEventIds'] : []),
    'field', 'createdAt',
  ] as const
  if (!isRecord(value) || !hasExactKeys(value, keys) || !Array.isArray(value.field)) return null
  const fieldSize = value.field.length
  const startStats = parseStats(value.startStats)
  const version = hasEngineVersion && SKILLED_ENGINE_VERSIONS.includes(value.engineVersion as SkilledEngineVersion)
    ? value.engineVersion as SkilledEngineVersion
    : null
  const course = version === null ? null : parseRaceCourse(value.course, version)
  const field = parseRaceField(value.field, hasEngineVersion)
  if (
    (hasEngineVersion && !version) ||
    (hasEngineVersion && !course) ||
    !isId(value.contentVersion) || !isId(value.umaId) || !isId(value.raceId) ||
    !isNonNegativeInt(value.sequence) || !isNonNegativeInt(value.seed) || !STRATEGIES.includes(value.strategy as Strategy) ||
    !isPositiveInt(value.startLevel) || value.startLevel > MAX_UMA_LEVEL || !isNonNegativeInt(value.startExp) || !startStats ||
    !isFiniteNonNegative(value.raceBonus) || !isPositiveInt(value.playerPlacement) || value.playerPlacement > fieldSize ||
    !isNonNegativeInt(value.expGained) || !Array.isArray(value.levelsGained) ||
    value.levelsGained.some((level) => !isPositiveInt(level) || level > MAX_UMA_LEVEL) ||
    !isNonNegativeInt(value.shardReward) || value.shardReward > 1 ||
    (hasCompletedGoalIds && (!Array.isArray(value.completedGoalIds) || value.completedGoalIds.some((id) => !isId(id)) ||
      new Set(value.completedGoalIds).size !== value.completedGoalIds.length)) ||
    !field || !isNonNegativeInt(value.createdAt) ||
    // A past scenario's race (D190) names a scenario before her current one and pays nothing.
    (hasTier && (!isPositiveInt(value.tier) || value.tier >= tierOfLevel(value.startLevel) || value.expGained !== 0 ||
      value.levelsGained.length > 0 || value.shardReward !== 0 ||
      (hasCompletedGoalIds && (value.completedGoalIds as unknown[]).length > 0)))
  ) return null
  const levels = value.levelsGained as number[]
  const player = field.find((runner) => runner.isPlayer)
  const accomplishmentFacts = hasAccomplishmentFacts
    ? parseRaceAccomplishmentFacts(value.accomplishmentFacts, {
      playerPlacement: value.playerPlacement as number,
      field,
      ...(course ? { course } : {}),
    })
    : null
  if (
    new Set(levels).size !== levels.length || levels.some((level, index) => index > 0 && level <= levels[index - 1]!) ||
    (hasAccomplishmentFacts && !accomplishmentFacts) ||
    (hasEarnedFlairEventIds && (!Array.isArray(value.earnedFlairEventIds) ||
      value.earnedFlairEventIds.some((id) => !isId(id)) || new Set(value.earnedFlairEventIds).size !== value.earnedFlairEventIds.length)) ||
    player?.umaId !== value.umaId || player?.strategy !== value.strategy ||
    player?.placement !== value.playerPlacement ||
    (value.shardReward === 1 && !isGateLevel(levels.at(-1) ?? -1))
  ) return null
  return {
    ...(hasEngineVersion ? { engineVersion: version! } : {}),
    ...(hasEngineVersion ? { course: course! } : {}),
    contentVersion: value.contentVersion,
    umaId: value.umaId,
    raceId: value.raceId,
    sequence: value.sequence,
    seed: value.seed,
    strategy: value.strategy as Strategy,
    ...(hasTier ? { tier: value.tier as number } : {}),
    startLevel: value.startLevel,
    startExp: value.startExp,
    startStats,
    raceBonus: value.raceBonus,
    playerPlacement: value.playerPlacement,
    expGained: value.expGained,
    levelsGained: [...value.levelsGained] as number[],
    shardReward: value.shardReward,
    ...(hasCompletedGoalIds ? { completedGoalIds: [...value.completedGoalIds as string[]] } : {}),
    ...(hasAccomplishmentFacts ? { accomplishmentFacts: accomplishmentFacts! } : {}),
    ...(hasEarnedFlairEventIds ? { earnedFlairEventIds: [...value.earnedFlairEventIds as string[]] } : {}),
    field,
    createdAt: value.createdAt,
  }
}

/**
 * A race as it ran, without what it paid: the generation-2 `finish-race` operation's `run` (docs/rework/09-racing-
 * rewards-and-exchange.md §9), which its `raceResults` row keeps beside the operation's receipt. The rules that pay a
 * race live in `rework/`, so the progression fields (levels, EXP, tickets, Shards, goals) stay out.
 */
export type RaceRun = Pick<RaceResultRecord, 'engineVersion' | 'course' | 'contentVersion' | 'seed' | 'strategy' | 'startStats' | 'field' | 'accomplishmentFacts'>

const RACE_RUN_KEYS = ['engineVersion', 'course', 'contentVersion', 'seed', 'strategy', 'startStats', 'field', 'accomplishmentFacts'] as const

/**
 * A generation-2 race's run, checked by `parseRaceResultRecord`'s own parts: a skilled engine's course and field, her
 * strategy on her runner, and the accomplishment facts today's race commit always writes. Her id and place are the
 * operation's input, which checks them against her runner.
 */
export function parseRaceRun(value: unknown): RaceRun | null {
  if (!isRecord(value) || !hasExactKeys(value, RACE_RUN_KEYS)) return null
  if (!SKILLED_ENGINE_VERSIONS.includes(value.engineVersion as SkilledEngineVersion)) return null
  const version = value.engineVersion as SkilledEngineVersion
  const course = parseRaceCourse(value.course, version)
  const startStats = parseStats(value.startStats)
  const field = parseRaceField(value.field, true)
  if (!course || !startStats || !field || !isId(value.contentVersion) || !isNonNegativeInt(value.seed) ||
    !STRATEGIES.includes(value.strategy as Strategy)) return null
  const player = field.find((runner) => runner.isPlayer)!
  const accomplishmentFacts = parseRaceAccomplishmentFacts(value.accomplishmentFacts, { playerPlacement: player.placement, field, course })
  if (player.strategy !== value.strategy || !accomplishmentFacts) return null
  return {
    engineVersion: version,
    course,
    contentVersion: value.contentVersion,
    seed: value.seed,
    strategy: value.strategy as Strategy,
    startStats,
    field,
    accomplishmentFacts,
  }
}
