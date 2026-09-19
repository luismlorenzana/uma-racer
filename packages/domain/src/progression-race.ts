// Saved-Uma progression races and rewards (docs/design/racing.md).

import { CARD_EFFECTS, projectedCardEffectValue } from './cards'
import { FLAIR_SERIES_TAGS, parseFlairSeriesLegId, type FlairSeriesTag } from './badges'
import type { RaceTemplate, SupportCardTemplate, UmaTemplate } from './content'
import type { RaceCourseLayout } from './course-layout'
import { GATE_SHARD_REWARD, UMA_LEVEL_TICKET_REWARD, expToNextUmaLevel, raceExp } from './progression'
import { applyForm, yourForm } from './raceForm'
import { parseCompiledRaceSkill, type CompiledRaceSkill } from './race-skills'
import { LEVELS_PER_SCENARIO, SCENARIOS, isGateLevel, tierOfLevel } from './scenarios'
import type { CardSave, UmaSave } from './save'
import { supportDeckIssueMessage, validateEquippedSupportDeck } from './support-deck'
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
const MAX_UMA_LEVEL = SCENARIOS.length * LEVELS_PER_SCENARIO

export interface RaceCardInput {
  save: CardSave
  template: SupportCardTemplate
}

export interface UmaExperienceResult {
  uma: UmaSave
  expGained: number
  levelsGained: number[]
  ticketReward: number
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
  /** Present on engine-v3 records. */
  layout?: RaceCourseLayout
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
  engineVersion?: 2 | 3
  /** Present on engine-v2/v3 records so replay does not depend on mutable content metadata. */
  course?: RaceResultCourse
  contentVersion: string
  umaId: string
  raceId: string
  sequence: number
  seed: number
  strategy: Strategy
  startLevel: number
  startExp: number
  startStats: Stats
  raceBonus: number
  playerPlacement: number
  expGained: number
  levelsGained: number[]
  ticketReward: number
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

function parseCourseLayout(value: unknown, distance: number): RaceCourseLayout | null {
  if (!isRecord(value) || !hasExactKeys(value, ['corners', 'straights']) ||
    !Array.isArray(value.corners) || !Array.isArray(value.straights)) return null
  const parseSegments = (segments: unknown[], corner: boolean) => segments.map((segment, index) => {
    if (!isRecord(segment) || !hasExactKeys(segment, corner ? ['start', 'end', 'number'] : ['start', 'end']) ||
      !isFiniteNonNegative(segment.start) || !isFiniteNonNegative(segment.end) || segment.end <= segment.start ||
      segment.end > distance || (index > 0 && ((segments[index - 1] as Record<string, unknown>).end as number) > segment.start) ||
      (corner && (!isPositiveInt(segment.number) || segment.number > 32))) return null
    return corner
      ? { start: segment.start, end: segment.end, number: segment.number as number }
      : { start: segment.start, end: segment.end }
  })
  const corners = parseSegments(value.corners, true)
  const straights = parseSegments(value.straights, false)
  if (corners.some((segment) => segment === null) || straights.some((segment) => segment === null) ||
    (corners.length === 0 && straights.length === 0)) return null
  return { corners: corners as RaceCourseLayout['corners'], straights: straights as RaceCourseLayout['straights'] }
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
  record?: Pick<RaceResultRecord, 'raceId' | 'playerPlacement' | 'field' | 'course'>,
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

/** Generated Race Bonus from the currently equipped and usable stat-card deck. */
export function equippedRaceBonus(tier: number, cards: readonly RaceCardInput[]): number {
  const validation = validateEquippedSupportDeck(tier, cards)
  const issue = validation.issues[0]
  if (issue) throw new Error(supportDeckIssueMessage(issue))
  let total = 0
  for (const { save, template } of cards) {
    if (
      !Number.isSafeInteger(template.era) || template.era < 1 ||
      !isRecord(template.effectProfile) || !hasExactKeys(template.effectProfile, CARD_EFFECTS) ||
      CARD_EFFECTS.some((effect) => !isFiniteNonNegative(template.effectProfile[effect]))
    ) {
      throw new Error(`Card ${template.id} has invalid race effect data`)
    }
    total += projectedCardEffectValue('raceBonus', template, save)
  }
  return total
}

export const playerRaceStats = (uma: UmaSave): Stats => applyForm(uma.stats, yourForm(uma.level))

/** Apply race EXP, stopping at the next gate and banking at most one following level there. */
export function addUmaRaceExp(uma: UmaSave, expGained: number): UmaExperienceResult {
  if (!isNonNegativeInt(expGained)) throw new Error('Race EXP must be a nonnegative integer')
  let level = uma.level
  let exp = uma.exp
  const levelsGained: number[] = []
  let reachedGate: number | null = null

  if (level >= MAX_UMA_LEVEL) {
    exp = 0
  } else if (isGateLevel(level)) {
    exp = Math.min(expToNextUmaLevel(level + 1), exp + expGained)
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
    }
    if (level >= MAX_UMA_LEVEL) exp = 0
  }

  return {
    uma: { ...uma, level, exp },
    expGained,
    levelsGained,
    ticketReward: levelsGained.length * UMA_LEVEL_TICKET_REWARD,
    reachedGate,
    shardReward: reachedGate === null ? 0 : GATE_SHARD_REWARD,
  }
}

export function resolveRaceExperience(
  uma: UmaSave,
  grade: RaceGrade,
  placement: number,
  raceBonus: number,
): UmaExperienceResult {
  if (!Number.isSafeInteger(placement) || placement < 1) throw new Error('Invalid race placement')
  if (!isFiniteNonNegative(raceBonus)) throw new Error('Invalid Race Bonus')
  return addUmaRaceExp(uma, raceExp(grade, placement, raceBonus))
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

export function parseRaceResultRecord(value: unknown): RaceResultRecord | null {
  const hasEngineVersion = isRecord(value) && Object.hasOwn(value, 'engineVersion')
  const hasCompletedGoalIds = isRecord(value) && Object.hasOwn(value, 'completedGoalIds')
  const hasAccomplishmentFacts = isRecord(value) && Object.hasOwn(value, 'accomplishmentFacts')
  const hasEarnedFlairEventIds = isRecord(value) && Object.hasOwn(value, 'earnedFlairEventIds')
  const keys = [
    ...(hasEngineVersion ? ['engineVersion'] : []),
    ...(hasEngineVersion ? ['course'] : []),
    'contentVersion', 'umaId', 'raceId', 'sequence', 'seed', 'strategy', 'startLevel', 'startExp', 'startStats',
    'raceBonus', 'playerPlacement', 'expGained', 'levelsGained', 'ticketReward', 'shardReward',
    ...(hasCompletedGoalIds ? ['completedGoalIds'] : []),
    ...(hasAccomplishmentFacts ? ['accomplishmentFacts'] : []),
    ...(hasEarnedFlairEventIds ? ['earnedFlairEventIds'] : []),
    'field', 'createdAt',
  ] as const
  if (!isRecord(value) || !hasExactKeys(value, keys) || !Array.isArray(value.field)) return null
  const fieldSize = value.field.length
  const startStats = parseStats(value.startStats)
  const runners = value.field.map((runner) => parseRunner(runner, fieldSize))
  const version = hasEngineVersion && (value.engineVersion === 2 || value.engineVersion === 3) ? value.engineVersion : null
  const courseKeys = version === 3 ? ['distance', 'surface', 'season', 'layout'] : ['distance', 'surface', 'season']
  const courseLayout = version === 3 && isRecord(value.course) && isPositiveInt(value.course.distance)
    ? parseCourseLayout(value.course.layout, value.course.distance)
    : null
  const course = hasEngineVersion && isRecord(value.course) && hasExactKeys(value.course, courseKeys) &&
    isPositiveInt(value.course.distance) && SURFACES.includes(value.course.surface as Surface) && isNonNegativeInt(value.course.season) &&
    (version !== 3 || courseLayout)
    ? {
      distance: value.course.distance,
      surface: value.course.surface as Surface,
      season: value.course.season,
      ...(version === 3 ? { layout: courseLayout! } : {}),
    }
    : null
  if (
    (hasEngineVersion && !version) ||
    (hasEngineVersion && !course) ||
    !isId(value.contentVersion) || !isId(value.umaId) || !isId(value.raceId) ||
    !isNonNegativeInt(value.sequence) || !isNonNegativeInt(value.seed) || !STRATEGIES.includes(value.strategy as Strategy) ||
    !isPositiveInt(value.startLevel) || value.startLevel > MAX_UMA_LEVEL || !isNonNegativeInt(value.startExp) || !startStats ||
    !isFiniteNonNegative(value.raceBonus) || !isPositiveInt(value.playerPlacement) || value.playerPlacement > fieldSize ||
    !isNonNegativeInt(value.expGained) || !Array.isArray(value.levelsGained) ||
    value.levelsGained.some((level) => !isPositiveInt(level) || level > MAX_UMA_LEVEL) ||
    !isNonNegativeInt(value.ticketReward) || !isNonNegativeInt(value.shardReward) || value.shardReward > 1 ||
    (hasCompletedGoalIds && (!Array.isArray(value.completedGoalIds) || value.completedGoalIds.some((id) => !isId(id)) ||
      new Set(value.completedGoalIds).size !== value.completedGoalIds.length)) ||
    fieldSize < 8 || fieldSize > 18 || runners.some((runner) => runner === null) || !isNonNegativeInt(value.createdAt)
  ) return null
  const field = runners as RaceResultRunner[]
  const levels = value.levelsGained as number[]
  const player = field.find((runner) => runner.isPlayer)
  const accomplishmentFacts = hasAccomplishmentFacts
    ? parseRaceAccomplishmentFacts(value.accomplishmentFacts, {
      raceId: value.raceId as string,
      playerPlacement: value.playerPlacement as number,
      field,
      ...(course ? { course } : {}),
    })
    : null
  if (
    field.filter((runner) => runner.isPlayer).length !== 1 ||
    new Set(field.map((runner) => runner.gate)).size !== fieldSize ||
    new Set(field.map((runner) => runner.placement)).size !== fieldSize ||
    new Set(field.map((runner) => runner.umaId)).size !== fieldSize ||
    new Set(levels).size !== levels.length || levels.some((level, index) => index > 0 && level <= levels[index - 1]!) ||
    (hasEngineVersion && field.some((runner) => runner.skills === undefined)) ||
    (!hasEngineVersion && field.some((runner) => runner.skills !== undefined)) ||
    (hasAccomplishmentFacts && !accomplishmentFacts) ||
    (hasEarnedFlairEventIds && (!Array.isArray(value.earnedFlairEventIds) ||
      value.earnedFlairEventIds.some((id) => !isId(id)) || new Set(value.earnedFlairEventIds).size !== value.earnedFlairEventIds.length)) ||
    player?.umaId !== value.umaId || player?.strategy !== value.strategy ||
    player?.placement !== value.playerPlacement ||
    (value.shardReward === 1 && !isGateLevel(levels.at(-1) ?? -1)) ||
    value.ticketReward !== value.levelsGained.length * UMA_LEVEL_TICKET_REWARD
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
    startLevel: value.startLevel,
    startExp: value.startExp,
    startStats,
    raceBonus: value.raceBonus,
    playerPlacement: value.playerPlacement,
    expGained: value.expGained,
    levelsGained: [...value.levelsGained] as number[],
    ticketReward: value.ticketReward,
    shardReward: value.shardReward,
    ...(hasCompletedGoalIds ? { completedGoalIds: [...value.completedGoalIds as string[]] } : {}),
    ...(hasAccomplishmentFacts ? { accomplishmentFacts: accomplishmentFacts! } : {}),
    ...(hasEarnedFlairEventIds ? { earnedFlairEventIds: [...value.earnedFlairEventIds as string[]] } : {}),
    field,
    createdAt: value.createdAt,
  }
}
