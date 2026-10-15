// Badge facts and independently versioned save state (docs/design/badges.md).

import { MAX_TRAINING_LEVEL } from './constellation'
import { raceScenarioTier, type RaceAccomplishmentFactsV1, type RaceResultRecord } from './progression-race'
import { SCENARIOS, tierOfLevel } from './scenarios'
import type { ScenarioJourney, UmaSave } from './save'
import {
  DISTANCE_CATEGORIES,
  RACE_GRADES,
  STATS,
  STRATEGIES,
  SURFACES,
  type DistanceCategory,
  type RaceGrade,
  type StatKey,
  type Stats,
  type Strategy,
  type Surface,
} from './types'

export const BADGE_STATE_VERSION = 1 as const
export const BADGE_CATALOG_VERSION = 1 as const
export const BADGE_STATE_ID_PREFIX = 'uma:' as const
const BADGE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/

export const BADGE_TIERS = ['bronze', 'silver', 'gold', 'platinum', 'rainbow'] as const
export type BadgeTier = (typeof BADGE_TIERS)[number]

export const BADGE_FILTER_CATEGORIES = [
  'victories', 'surface', 'distance', 'strategy', 'venue', 'race-feat', 'stats', 'scenario', 'training', 'skills',
  'goals', 'lineage', 'title', 'trophy', 'collection', 'stable', 'journey',
] as const

export const BADGE_TIER_POINTS = [1, 2, 4, 8, 16] as const
export const BADGE_ONE_OFF_POINTS = 4
/** Generation 2's Hall of Fame badge, a one-off worth four ordinary one-offs (docs/rework/04-tiers-and-promotion.md §9). */
export const HALL_OF_FAME_POINTS = 16
export const GOAL_RIBBON_POINTS = 1
export const HONORS_POINTS = 4
export const TITLE_POINTS = 10
export const PRESTIGE_FRAME_THRESHOLDS = [0, 5, 15, 40, 80, 160, 300] as const

export const BADGE_THRESHOLDS = {
  mastery: [1, 10, 25, 50, 100],
  gradeChampion: [1, 5, 10, 20, 40],
  g1Champion: [1, 3, 7, 15, 30],
  starts: [10, 50, 100, 250, 500],
  unbeaten: [3, 5, 8, 12, 20],
  specialist: [1, 5, 10, 20, 40],
  breadth: [1, 3, 5, 10, 20],
  venue: [1, 3, 7, 15, 30],
  backField: [1, 5, 15, 30, 60],
  statPeak: [600, 900, 1_200, 1_600, 2_000],
  // Stats start at an Uma's base, about 110 (D152): a fully trained, even set of new cards reaches the first tier, and
  // the last needs an even, fully bonded tree in a late scenario.
  balanced: [400, 600, 800, 1_000, 1_200],
  level: [10, 25, 50, 75, 100],
  // Spark Match runs (D164, D214): about six take a scenario to TL10 (D211), so the last stage is all fourteen trained.
  diligent: [6, 15, 30, 60, 84],
  lifetimeSkills: [5, 15, 30, 60, 100],
  scenarioSkills: [5, 10, 15, 20, 25],
  destiny: [3, 10, 25, 50, 100],
  legacy: [1, 5, 10, 25, 50],
  dynasty: [1, 3, 5, 10, 20],
} as const

export const FLAIR_SERIES_TAGS = [
  'triple-crown',
  'triple-tiara',
  'spring-triple-crown',
  'autumn-triple-crown',
  'grand-prix',
  'sprint-crown',
  'mile-crown',
  'dirt-crown',
] as const
export type FlairSeriesTag = (typeof FLAIR_SERIES_TAGS)[number]

export const FLAIR_SERIES_REQUIRED_LEGS: Readonly<Record<FlairSeriesTag, number>> = {
  'triple-crown': 3,
  'triple-tiara': 3,
  'spring-triple-crown': 3,
  'autumn-triple-crown': 3,
  'grand-prix': 2,
  'sprint-crown': 2,
  'mile-crown': 2,
  'dirt-crown': 2,
}

export const FLAIR_SERIES_LEG_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function flairSeriesLegId(tag: FlairSeriesTag, key: string): string {
  if (!FLAIR_SERIES_TAGS.includes(tag) || key.length < 1 || key.length > 40 || !FLAIR_SERIES_LEG_KEY_PATTERN.test(key)) {
    throw new Error('Invalid flair series leg')
  }
  return `${tag}:${key}`
}

export function parseFlairSeriesLegId(value: string): { tag: FlairSeriesTag; key: string } | null {
  const separator = value.indexOf(':')
  if (separator <= 0 || separator !== value.lastIndexOf(':')) return null
  const tag = value.slice(0, separator)
  const key = value.slice(separator + 1)
  if (!FLAIR_SERIES_TAGS.includes(tag as FlairSeriesTag) || key.length < 1 || key.length > 40 ||
    !FLAIR_SERIES_LEG_KEY_PATTERN.test(key)) return null
  return { tag: tag as FlairSeriesTag, key }
}

export type HistoryGrade = 'exact' | 'since-tracking' | 'untracked'
export type HistoryFamily = 'race' | 'training' | 'scenario-completion' | 'lineage'

export interface BadgeHistoryAvailability {
  race: HistoryGrade
  training: HistoryGrade
  'scenario-completion': HistoryGrade
  lineage: HistoryGrade
  diagnostics: string[]
}

export interface CountFact {
  key: string
  count: number
}

export interface FamilyWinFact extends CountFact {
  grade: RaceGrade
  series: FlairSeriesTag[]
}

export interface CourseBestFact {
  courseId: string
  finishTime: number
  resultId: string
  achievedAt: number
}

export interface RaceFeatFacts {
  wireToWireWins: number
  greatComebackWins: number
  backFieldWins: number
  dominantWins: number
  bigMarginWins: number
  photoFinishWins: number
  lightningStartWins: number
  slowStartWins: number
  inheritedUniqueWins: number
  impossibleGroundWins: number
  unorthodoxWins: number
  ironHorseWins: number
  blinkOfAnEyeWins: number
}

export interface GoalFact {
  goalId: string
  resultId: string
  tier: number
  completedAt: number
}

export interface ScenarioCompletionFact {
  tier: number
  completedAt: number
  trainingLevel: number
  stats: Stats
  deckCardIds: string[]
  deckEras: number[]
  trainingTurns: number
  friendshipTrainings: number
  raceStarts: number
  completedGoalIds: string[]
  honors: boolean
  parentUmaIds: string[]
  grandparentUmaIds: string[]
}

export interface TrainingTierFact {
  tier: number
  turns: number
  friendshipTrainings: number
  fullHouseCount: number
  reachedTl10: boolean
}

export interface LineageEvidence {
  key: string
  relatedUmaId: string
  tier: number
  createdAt: number
}

export interface UmaBadgeFacts {
  starts: number
  wins: number
  seconds: number
  thirds: number
  currentWinStreak: number
  longestWinStreak: number
  gradeWins: CountFact[]
  surfaceWins: CountFact[]
  distanceWins: CountFact[]
  strategyWins: CountFact[]
  venueWins: CountFact[]
  familyWins: FamilyWinFact[]
  lowAptitudeSurfaceWins: CountFact[]
  lowAptitudeDistanceWins: CountFact[]
  courseBests: CourseBestFact[]
  raceFeats: RaceFeatFacts
  statPeaks: Stats
  balancedPeak: number
  levelPeak: number
  distinctSkillIds: string[]
  lifetimeTrainingTurns: number
  friendshipTrainings: number
  fullHouseCount: number
  trainingByTier: TrainingTierFact[]
  fullyTrainedTiers: number[]
  maxSkillsByTier: CountFact[]
  goals: GoalFact[]
  honorsTiers: number[]
  completedScenarioTiers: number[]
  raceStartsByTier: CountFact[]
  completions: ScenarioCompletionFact[]
  parentedScenarioStarts: LineageEvidence[]
  legacyEvidence: LineageEvidence[]
  dynastyEvidence: LineageEvidence[]
}

export type FlairSourceKind = 'race' | 'training' | 'scenario' | 'goal' | 'migration' | 'collection'
export interface FlairSource {
  kind: FlairSourceKind
  id: string | null
  tier: number | null
}

export interface EarnedBadgeStage {
  awardKey: string
  stage: BadgeTier | 'one-off'
  earnedAt: number
  history: HistoryGrade
  source: FlairSource
  frozenKeys: string[]
}

export interface EarnedTitle {
  awardKey: string
  earnedAt: number
  history: HistoryGrade
  source: FlairSource
  frozenKeys: string[]
}

export interface EarnedTrophy {
  familyId: string
  count: number
  firstEarnedAt: number
  lastEarnedAt: number
  firstResultId: string
  lastResultId: string
}

export interface ShowcaseGroup {
  id: string
  name: string | null
  awardRefs: string[]
}

export type BadgeSort = 'recent' | 'tier' | 'closest' | 'rarest' | 'alphabetical' | 'category'
export interface SavedBadgeView {
  id: string
  name: string
  filters: CountFact[]
  sort: BadgeSort
}

export const TRAINER_SAVED_VIEW_ID_PREFIX = 'trainer-view-'

export function isTrainerSavedBadgeViewId(id: string): boolean {
  return id.startsWith(TRAINER_SAVED_VIEW_ID_PREFIX)
}

export function isTrainerSavedBadgeView(view: Pick<SavedBadgeView, 'id'>): boolean {
  return isTrainerSavedBadgeViewId(view.id)
}

export interface BadgePreferences {
  activeTitleId: string | null
  showcaseGroups: ShowcaseGroup[]
  savedViews: SavedBadgeView[]
}

export interface UmaBadgeStateV1 {
  version: typeof BADGE_STATE_VERSION
  scope: 'uma'
  umaId: string
  catalogVersion: number
  evaluatorVersion: number
  trackingStartedAt: number
  sourceWatermarks: { raceSequence: number; trainingTurns: number; scenarioCompletions: number; lineageEvidence: number }
  history: BadgeHistoryAvailability
  facts: UmaBadgeFacts
  awards: { badges: EarnedBadgeStage[]; titles: EarnedTitle[]; trophies: EarnedTrophy[] }
  preferences: BadgePreferences
}

export const TRAINER_RECORD_KINDS = [
  'highest-stat', 'most-wins', 'most-g1-wins', 'most-badge-stages', 'biggest-winning-margin', 'longest-win-streak',
] as const
export type TrainerRecordKind = (typeof TRAINER_RECORD_KINDS)[number]

export interface TrainerRecord {
  kind: TrainerRecordKind
  value: number
  umaId: string
  sourceId: string | null
  achievedAt: number
  stat: StatKey | null
}

export interface TrainerBadgeStateV1 {
  version: typeof BADGE_STATE_VERSION
  scope: 'trainer'
  catalogVersion: number
  evaluatorVersion: number
  trackingStartedAt: number
  sourceWatermarks: { contributors: number; ledgerEntries: number; contentVersion: string | null }
  aggregates: CountFact[]
  records: TrainerRecord[]
  awards: { achievements: EarnedBadgeStage[] }
  preferences: BadgePreferences & { displayName: string; pinnedUmaIds: string[] }
}

export type BadgeStateV1 = UmaBadgeStateV1 | TrainerBadgeStateV1

export const FLAIR_EVENT_VERSION = 1 as const
export const FLAIR_EVENT_KINDS = [
  'badge-tier', 'one-off', 'goal-ribbon', 'honors', 'title', 'trophy-earned', 'trainer-achievement',
] as const
export type FlairEventKind = (typeof FLAIR_EVENT_KINDS)[number]

export interface FlairEventV1 {
  version: typeof FLAIR_EVENT_VERSION
  scope: 'uma' | 'trainer'
  umaId: string | null
  kind: FlairEventKind
  awardKey: string
  stage: BadgeTier | 'one-off'
  earnedAt: number
  source: FlairSource
  retroactive: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isId = (value: unknown): value is string => typeof value === 'string' && BADGE_ID_PATTERN.test(value)
const isNonNegativeInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const isPositiveInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0
const isFiniteNonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function parseIds(value: unknown, max = 10_000): string[] | null {
  if (!Array.isArray(value) || value.length > max || value.some((item) => !isId(item))) return null
  const result = value as string[]
  return new Set(result).size === result.length ? [...result] : null
}

function parseSortedIds(value: unknown, max = 10_000): string[] | null {
  const ids = parseIds(value, max)
  return ids && ids.every((id, index) => index === 0 || ids[index - 1]!.localeCompare(id) < 0) ? ids : null
}

function parseTierList(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length > SCENARIOS.length || value.some((tier) => !isPositiveInt(tier) || tier > SCENARIOS.length)) return null
  const tiers = value as number[]
  return new Set(tiers).size === tiers.length && tiers.every((tier, index) => index === 0 || tiers[index - 1]! < tier) ? [...tiers] : null
}

function parseStats(value: unknown): Stats | null {
  if (!isRecord(value) || !exactKeys(value, STATS) || STATS.some((key) => !isNonNegativeInt(value[key]))) return null
  return Object.fromEntries(STATS.map((key) => [key, value[key] as number])) as Stats
}

function parseCounts(value: unknown, max = 10_000): CountFact[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  const parsed = value.map((entry) => {
    if (!isRecord(entry) || !exactKeys(entry, ['key', 'count']) || !isId(entry.key) || !isNonNegativeInt(entry.count)) return null
    return { key: entry.key, count: entry.count }
  })
  if (parsed.some((entry) => entry === null)) return null
  const rows = parsed as CountFact[]
  return rows.every((entry, index) => index === 0 || rows[index - 1]!.key.localeCompare(entry.key) < 0) ? rows : null
}

function incrementCount(rows: readonly CountFact[], key: string, amount = 1): CountFact[] {
  if (!isId(key) || !isNonNegativeInt(amount)) throw new Error('Invalid badge counter')
  const map = new Map(rows.map((row) => [row.key, row.count]))
  map.set(key, (map.get(key) ?? 0) + amount)
  return [...map].map(([entryKey, count]) => ({ key: entryKey, count })).sort((a, b) => a.key.localeCompare(b.key))
}

function gradeAtMost(grade: string, limit: string): boolean {
  const grades = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
  return grades.indexOf(grade) >= grades.indexOf(limit)
}

function emptyRaceFeats(): RaceFeatFacts {
  return {
    wireToWireWins: 0,
    greatComebackWins: 0,
    backFieldWins: 0,
    dominantWins: 0,
    bigMarginWins: 0,
    photoFinishWins: 0,
    lightningStartWins: 0,
    slowStartWins: 0,
    inheritedUniqueWins: 0,
    impossibleGroundWins: 0,
    unorthodoxWins: 0,
    ironHorseWins: 0,
    blinkOfAnEyeWins: 0,
  }
}

const emptyPreferences = (): BadgePreferences => ({
  activeTitleId: null,
  showcaseGroups: [{ id: 'default', name: null, awardRefs: [] }],
  savedViews: [],
})

/**
 * The derived facts badges need. Declared structurally rather than imported, because `save` already imports
 * this module and `derived` imports `save`.
 */
export interface BadgeSubject {
  tier: number
  trainingLevel: number
  stats: Stats
  library: readonly { skillId: string }[]
}

export function createUmaBadgeState(uma: UmaSave, subject: BadgeSubject, now: number): UmaBadgeStateV1 {
  if (!isNonNegativeInt(now)) throw new Error('Invalid badge tracking time')
  const journeys = uma.scenarios.map((run) => run.journey).filter((j): j is ScenarioJourney => j !== null)
  const distinctSkillIds = [...new Set([...uma.skillHistory.map((entry) => entry.skillId),
    ...subject.library.map((entry) => entry.skillId)])].sort()
  const completedJourneys = journeys.filter((journey) => journey.state === 'completed' && journey.tracking === 'tracked')
  const hasLegacyJourneys = journeys.some((journey) => journey.state === 'completed' && journey.tracking === 'legacy-untracked')
  const goals: GoalFact[] = completedJourneys.flatMap((journey) => journey.goals
    .filter((goal) => goal.status === 'completed' && goal.completedRaceResultId && goal.completedAt !== null)
    .map((goal) => ({
      goalId: goal.id,
      resultId: goal.completedRaceResultId!,
      tier: journey.tier,
      completedAt: goal.completedAt!,
    }))).sort((left, right) => left.goalId.localeCompare(right.goalId))
  const honorsTiers = completedJourneys
    .filter((journey) => journey.goals.length > 0 && journey.goals.every((goal) => goal.status === 'completed'))
    .map((journey) => journey.tier).sort((a, b) => a - b)
  const maxSkillsByTier = new Map<number, number>()
  for (const entry of uma.skillHistory) maxSkillsByTier.set(entry.tier, (maxSkillsByTier.get(entry.tier) ?? 0) + 1)
  const activeTier = tierOfLevel(uma.level)
  maxSkillsByTier.set(activeTier, Math.max(maxSkillsByTier.get(activeTier) ?? 0, subject.library.length))
  const balancedPeak = Math.min(...STATS.map((key) => subject.stats[key]))
  return {
    version: BADGE_STATE_VERSION,
    scope: 'uma',
    umaId: uma.templateId,
    catalogVersion: BADGE_CATALOG_VERSION,
    evaluatorVersion: 0,
    trackingStartedAt: now,
    sourceWatermarks: {
      raceSequence: -1,
      trainingTurns: 0,
      scenarioCompletions: completedJourneys.length,
      lineageEvidence: 0,
    },
    history: {
      race: 'exact',
      // Spark Match runs are in the synced ledger from the first one, so training history is complete (T056).
      training: 'exact',
      'scenario-completion': hasLegacyJourneys ? 'untracked' : completedJourneys.length > 0 ? 'exact' : 'since-tracking',
      lineage: 'since-tracking',
      diagnostics: hasLegacyJourneys ? ['scenario-history-unavailable'] : [],
    },
    facts: {
      starts: 0,
      wins: 0,
      seconds: 0,
      thirds: 0,
      currentWinStreak: 0,
      longestWinStreak: 0,
      gradeWins: [],
      surfaceWins: [],
      distanceWins: [],
      strategyWins: [],
      venueWins: [],
      familyWins: [],
      lowAptitudeSurfaceWins: [],
      lowAptitudeDistanceWins: [],
      courseBests: [],
      raceFeats: emptyRaceFeats(),
      statPeaks: { ...subject.stats },
      balancedPeak,
      levelPeak: uma.level,
      distinctSkillIds,
      lifetimeTrainingTurns: 0,
      friendshipTrainings: 0,
      fullHouseCount: 0,
      trainingByTier: [{
        tier: activeTier,
        turns: 0,
        friendshipTrainings: 0,
        fullHouseCount: 0,
        reachedTl10: subject.trainingLevel === MAX_TRAINING_LEVEL,
      }],
      fullyTrainedTiers: subject.trainingLevel === MAX_TRAINING_LEVEL ? [activeTier] : [],
      maxSkillsByTier: [...maxSkillsByTier].map(([key, count]) => ({ key: String(key), count })).sort((a, b) => a.key.localeCompare(b.key)),
      goals,
      honorsTiers,
      completedScenarioTiers: completedJourneys.map((journey) => journey.tier).sort((a, b) => a - b),
      raceStartsByTier: [],
      completions: [],
      parentedScenarioStarts: [],
      legacyEvidence: [],
      dynastyEvidence: [],
    },
    awards: { badges: [], titles: [], trophies: [] },
    preferences: emptyPreferences(),
  }
}

export function createTrainerBadgeState(now: number): TrainerBadgeStateV1 {
  if (!isNonNegativeInt(now)) throw new Error('Invalid badge tracking time')
  return {
    version: BADGE_STATE_VERSION,
    scope: 'trainer',
    catalogVersion: BADGE_CATALOG_VERSION,
    evaluatorVersion: 0,
    trackingStartedAt: now,
    sourceWatermarks: { contributors: 0, ledgerEntries: 0, contentVersion: null },
    aggregates: [],
    records: [],
    awards: { achievements: [] },
    preferences: { ...emptyPreferences(), displayName: 'Trainer', pinnedUmaIds: [] },
  }
}

function playerRunner(record: RaceResultRecord) {
  return record.field.find((runner) => runner.isPlayer)
}

function runnerUpMargin(record: RaceResultRecord): number | null {
  const runner = record.field.find((entry) => entry.placement === 2)
  return runner?.marginLengths ?? null
}

function withFactDiagnostic(state: UmaBadgeStateV1, code: string): UmaBadgeStateV1 {
  const diagnostics = [...new Set([...state.history.diagnostics, code])].sort()
  return { ...state, history: { ...state.history, diagnostics } }
}

export function applyRaceBadgeFacts(
  state: UmaBadgeStateV1,
  resultId: string,
  record: RaceResultRecord,
  facts: RaceAccomplishmentFactsV1 | null,
): UmaBadgeStateV1 {
  if (state.umaId !== record.umaId || !isId(resultId)) throw new Error('Race badge facts do not match the Uma')
  if (record.sequence <= state.sourceWatermarks.raceSequence) return state
  if (record.sequence !== state.sourceWatermarks.raceSequence + 1) throw new Error('Race badge sequence is incomplete')
  const player = playerRunner(record)
  if (!player) throw new Error('Race badge facts are missing the player')
  const win = record.playerPlacement === 1
  let next: UmaBadgeStateV1 = {
    ...state,
    sourceWatermarks: { ...state.sourceWatermarks, raceSequence: record.sequence },
    facts: {
      ...state.facts,
      starts: state.facts.starts + 1,
      wins: state.facts.wins + (win ? 1 : 0),
      seconds: state.facts.seconds + (record.playerPlacement === 2 ? 1 : 0),
      thirds: state.facts.thirds + (record.playerPlacement === 3 ? 1 : 0),
      currentWinStreak: win ? state.facts.currentWinStreak + 1 : 0,
      longestWinStreak: win ? Math.max(state.facts.longestWinStreak, state.facts.currentWinStreak + 1) : state.facts.longestWinStreak,
      statPeaks: Object.fromEntries(STATS.map((key) => [key, Math.max(state.facts.statPeaks[key], record.startStats[key])])) as Stats,
      balancedPeak: Math.max(state.facts.balancedPeak, Math.min(...STATS.map((key) => record.startStats[key]))),
      levelPeak: Math.max(state.facts.levelPeak, record.startLevel, ...record.levelsGained),
      goals: [...state.facts.goals, ...(record.completedGoalIds ?? [])
        .filter((goalId) => !state.facts.goals.some((goal) => goal.goalId === goalId))
        .map((goalId) => ({
          goalId,
          resultId,
          tier: raceScenarioTier(record),
          completedAt: record.createdAt,
        }))].sort((left, right) => left.goalId.localeCompare(right.goalId)),
      raceStartsByTier: incrementCount(state.facts.raceStartsByTier, String(raceScenarioTier(record))),
    },
  }
  if (!facts) return withFactDiagnostic(next, `race-facts-unavailable:${resultId}`)
  const courseBest = next.facts.courseBests.find((entry) => entry.courseId === facts.courseId)
  const isRecord = !courseBest || player.finishTime < courseBest.finishTime
  const courseBests = isRecord
    ? [...next.facts.courseBests.filter((entry) => entry.courseId !== facts.courseId), {
      courseId: facts.courseId,
      finishTime: player.finishTime,
      resultId,
      achievedAt: record.createdAt,
    }].sort((left, right) => left.courseId.localeCompare(right.courseId))
    : next.facts.courseBests
  let gradeWins = next.facts.gradeWins
  let surfaceWins = next.facts.surfaceWins
  let distanceWins = next.facts.distanceWins
  let strategyWins = next.facts.strategyWins
  let venueWins = next.facts.venueWins
  let familyWins = next.facts.familyWins
  let lowAptitudeSurfaceWins = next.facts.lowAptitudeSurfaceWins
  let lowAptitudeDistanceWins = next.facts.lowAptitudeDistanceWins
  const raceFeats = { ...next.facts.raceFeats }
  if (win) {
    gradeWins = incrementCount(gradeWins, facts.grade)
    surfaceWins = incrementCount(surfaceWins, facts.surface)
    distanceWins = incrementCount(distanceWins, facts.distanceCategory)
    strategyWins = incrementCount(strategyWins, record.strategy)
    venueWins = incrementCount(venueWins, facts.venueKey)
    const family = familyWins.find((entry) => entry.key === facts.familyId)
    familyWins = [...familyWins.filter((entry) => entry.key !== facts.familyId), {
      key: facts.familyId,
      count: (family?.count ?? 0) + 1,
      grade: facts.grade,
      series: [...new Set([...(family?.series ?? []), ...facts.series])].sort() as FlairSeriesTag[],
    }].sort((left, right) => left.key.localeCompare(right.key))
    if (gradeAtMost(player.aptitude.surface, 'B')) lowAptitudeSurfaceWins = incrementCount(lowAptitudeSurfaceWins, facts.surface)
    if (gradeAtMost(player.aptitude.distance, 'B')) lowAptitudeDistanceWins = incrementCount(lowAptitudeDistanceWins, facts.distanceCategory)
    if (gradeAtMost(player.aptitude.surface, 'E')) raceFeats.impossibleGroundWins += 1
    if (gradeAtMost(player.aptitude.strategy, 'C')) raceFeats.unorthodoxWins += 1
    if (facts.distance >= 3_000) raceFeats.ironHorseWins += 1
    if (facts.distance <= 1_200) raceFeats.blinkOfAnEyeWins += 1
    if (facts.ledEverySectionCheckpoint) raceFeats.wireToWireWins += 1
    if (facts.playerFinalSpurtPlacement === record.field.length) raceFeats.greatComebackWins += 1
    if (facts.playerFinalSpurtPlacement !== null && facts.playerFinalSpurtPlacement >= 10) raceFeats.backFieldWins += 1
    const second = runnerUpMargin(record)
    if (second !== null && second >= 5) raceFeats.dominantWins += 1
    if (second !== null && second >= 10) raceFeats.bigMarginWins += 1
    if (second !== null && second > 0 && second < 0.15) raceFeats.photoFinishWins += 1
    if (facts.playerStartDelay < 0.01) raceFeats.lightningStartWins += 1
    if (facts.playerStartDelay >= 0.08) raceFeats.slowStartWins += 1
    if (facts.inheritedUniqueActivated) raceFeats.inheritedUniqueWins += 1
  }
  next = {
    ...next,
    facts: {
      ...next.facts,
      gradeWins,
      surfaceWins,
      distanceWins,
      strategyWins,
      venueWins,
      familyWins,
      lowAptitudeSurfaceWins,
      lowAptitudeDistanceWins,
      courseBests,
      raceFeats,
    },
  }
  return next
}

export function applyParentedStartFact(state: UmaBadgeStateV1, tier: number, parentIds: readonly string[], now: number): UmaBadgeStateV1 {
  if (parentIds.length === 0) return state
  const evidence = { key: `start:${state.umaId}:${tier}`, relatedUmaId: state.umaId, tier, createdAt: now }
  if (state.facts.parentedScenarioStarts.some((row) => row.key === evidence.key)) return state
  return {
    ...state,
    sourceWatermarks: { ...state.sourceWatermarks, lineageEvidence: state.sourceWatermarks.lineageEvidence + 1 },
    facts: { ...state.facts, parentedScenarioStarts: [...state.facts.parentedScenarioStarts, evidence].sort((left, right) => left.key.localeCompare(right.key)) },
  }
}

export function applyLegacyFact(state: UmaBadgeStateV1, childUmaId: string, tier: number, now: number): UmaBadgeStateV1 {
  const evidence = { key: `legacy:${childUmaId}:${tier}`, relatedUmaId: childUmaId, tier, createdAt: now }
  if (state.facts.legacyEvidence.some((row) => row.key === evidence.key)) return state
  return {
    ...state,
    sourceWatermarks: { ...state.sourceWatermarks, lineageEvidence: state.sourceWatermarks.lineageEvidence + 1 },
    facts: { ...state.facts, legacyEvidence: [...state.facts.legacyEvidence, evidence].sort((left, right) => left.key.localeCompare(right.key)) },
  }
}

export function applyDynastyFact(state: UmaBadgeStateV1, descendantUmaId: string, tier: number, now: number): UmaBadgeStateV1 {
  const evidence = { key: `dynasty:${descendantUmaId}:${tier}`, relatedUmaId: descendantUmaId, tier, createdAt: now }
  if (state.facts.dynastyEvidence.some((row) => row.key === evidence.key)) return state
  return {
    ...state,
    sourceWatermarks: { ...state.sourceWatermarks, lineageEvidence: state.sourceWatermarks.lineageEvidence + 1 },
    facts: { ...state.facts, dynastyEvidence: [...state.facts.dynastyEvidence, evidence].sort((left, right) => left.key.localeCompare(right.key)) },
  }
}

/** What the minigame era can say about an Uma's training (T056): each scenario's runs, TL10s and full trees. */
export interface TrainingBadgeSnapshot {
  /** Spark Match runs per scenario tier, from the synced ledger. */
  runsByTier: ReadonlyMap<number, number>
  /** Scenario tiers she has taken to Training Level 10. */
  fullyTrainedTiers: readonly number[]
  /** Scenario tiers whose constellation has every card and stat node filled. */
  fullTreeTiers: readonly number[]
}

/**
 * The training facts of the minigame era (T056, D164). Spark Match runs stand where training turns stood, counted from
 * the ledger, so the history is exact; Training Level 10 comes from the save; Full House is a scenario whose every card
 * and stat node is filled. Friendship trainings stay as they were: the card minigame belongs to a card, not an Uma.
 * Nothing already counted is taken back, and an unchanged state is returned as it came.
 */
export function applyTrainingBadgeFacts(state: UmaBadgeStateV1, snapshot: TrainingBadgeSnapshot): UmaBadgeStateV1 {
  const tiers = [...new Set([
    ...state.facts.trainingByTier.map((entry) => entry.tier),
    ...snapshot.runsByTier.keys(),
    ...snapshot.fullyTrainedTiers,
    ...snapshot.fullTreeTiers,
  ])].filter((tier) => tier >= 1 && tier <= SCENARIOS.length).sort((a, b) => a - b)
  const trainingByTier = tiers.map((tier) => {
    const before = state.facts.trainingByTier.find((entry) => entry.tier === tier)
    const turns = Math.max(before?.turns ?? 0, snapshot.runsByTier.get(tier) ?? 0)
    return {
      tier,
      turns,
      friendshipTrainings: Math.min(turns, before?.friendshipTrainings ?? 0),
      fullHouseCount: Math.min(turns, Math.max(before?.fullHouseCount ?? 0, snapshot.fullTreeTiers.includes(tier) ? 1 : 0)),
      reachedTl10: (before?.reachedTl10 ?? false) || snapshot.fullyTrainedTiers.includes(tier),
    }
  })
  const lifetimeTrainingTurns = Math.max(state.facts.lifetimeTrainingTurns, trainingByTier.reduce((sum, entry) => sum + entry.turns, 0))
  const next: UmaBadgeStateV1 = {
    ...state,
    sourceWatermarks: { ...state.sourceWatermarks, trainingTurns: lifetimeTrainingTurns },
    history: { ...state.history, training: 'exact' },
    facts: {
      ...state.facts,
      lifetimeTrainingTurns,
      friendshipTrainings: Math.min(lifetimeTrainingTurns, state.facts.friendshipTrainings),
      fullHouseCount: Math.min(lifetimeTrainingTurns, Math.max(state.facts.fullHouseCount,
        trainingByTier.reduce((sum, entry) => sum + entry.fullHouseCount, 0))),
      trainingByTier,
      fullyTrainedTiers: [...new Set([...state.facts.fullyTrainedTiers, ...snapshot.fullyTrainedTiers])].sort((a, b) => a - b),
    },
  }
  return JSON.stringify(next) === JSON.stringify(state) ? state : next
}

/**
 * The most goals one scenario completion can record: a career is one maiden race, two trials and up to three main
 * races (`CAREER_MAIN_RACES`, D137). The old three-goal scenarios fit too. The API mirrors this bound.
 */
export const MAX_COMPLETION_GOALS = 6

export function applyScenarioCompletionFact(state: UmaBadgeStateV1, fact: ScenarioCompletionFact): UmaBadgeStateV1 {
  if (state.facts.completedScenarioTiers.includes(fact.tier)) return state
  return {
    ...state,
    sourceWatermarks: { ...state.sourceWatermarks, scenarioCompletions: state.sourceWatermarks.scenarioCompletions + 1 },
    facts: {
      ...state.facts,
      completions: [...state.facts.completions, fact].sort((left, right) => left.tier - right.tier),
      completedScenarioTiers: [...new Set([...state.facts.completedScenarioTiers, fact.tier])].sort((a, b) => a - b),
      honorsTiers: fact.honors ? [...new Set([...state.facts.honorsTiers, fact.tier])].sort((a, b) => a - b) : state.facts.honorsTiers,
    },
  }
}

// The parser below intentionally round-trips only the strict v1 shape. Award-specific checks are shared with T016.
export function parseBadgeState(value: unknown): BadgeStateV1 | null {
  if (!isRecord(value) || value.version !== BADGE_STATE_VERSION) return null
  try {
    const cloned = structuredClone(value) as unknown as BadgeStateV1
    if (cloned.scope === 'uma') return validateUmaBadgeState(cloned) ? cloned : null
    if (cloned.scope === 'trainer') return validateTrainerBadgeState(cloned) ? cloned : null
    return null
  } catch {
    return null
  }
}

function validHistory(value: unknown): value is BadgeHistoryAvailability {
  if (!isRecord(value) || !exactKeys(value, ['race', 'training', 'scenario-completion', 'lineage', 'diagnostics'])) return false
  const grades: HistoryGrade[] = ['exact', 'since-tracking', 'untracked']
  return grades.includes(value.race as HistoryGrade) && grades.includes(value.training as HistoryGrade) &&
    grades.includes(value['scenario-completion'] as HistoryGrade) && grades.includes(value.lineage as HistoryGrade) &&
    parseSortedIds(value.diagnostics, 200) !== null
}

function validSource(value: unknown): value is FlairSource {
  return isRecord(value) && exactKeys(value, ['kind', 'id', 'tier']) &&
    ['race', 'training', 'scenario', 'goal', 'migration', 'collection'].includes(value.kind as string) &&
    (value.id === null || isId(value.id)) && (value.tier === null || (isPositiveInt(value.tier) && value.tier <= SCENARIOS.length))
}

function validStage(value: unknown): value is EarnedBadgeStage {
  return isRecord(value) && exactKeys(value, ['awardKey', 'stage', 'earnedAt', 'history', 'source', 'frozenKeys']) &&
    isId(value.awardKey) && [...BADGE_TIERS, 'one-off'].includes(value.stage as BadgeTier | 'one-off') &&
    isNonNegativeInt(value.earnedAt) && ['exact', 'since-tracking', 'untracked'].includes(value.history as string) &&
    value.history !== 'untracked' && validSource(value.source) && parseSortedIds(value.frozenKeys, 500) !== null
}

function validTitle(value: unknown): value is EarnedTitle {
  return isRecord(value) && exactKeys(value, ['awardKey', 'earnedAt', 'history', 'source', 'frozenKeys']) &&
    isId(value.awardKey) && isNonNegativeInt(value.earnedAt) && ['exact', 'since-tracking'].includes(value.history as string) &&
    validSource(value.source) && parseSortedIds(value.frozenKeys, 500) !== null
}

function validPreferences(value: unknown, trainer = false): boolean {
  const keys = trainer
    ? ['activeTitleId', 'showcaseGroups', 'savedViews', 'displayName', 'pinnedUmaIds']
    : ['activeTitleId', 'showcaseGroups', 'savedViews']
  if (!isRecord(value) || !exactKeys(value, keys) || (value.activeTitleId !== null && !isId(value.activeTitleId)) ||
    !Array.isArray(value.showcaseGroups) || value.showcaseGroups.length < 1 || value.showcaseGroups.length > 21 ||
    !Array.isArray(value.savedViews) || value.savedViews.length > (trainer ? 40 : 20)) return false
  const awardRefs = new Set<string>()
  const groupIds = new Set<string>()
  const groupNames = new Set<string>()
  for (const [index, group] of value.showcaseGroups.entries()) {
    if (!isRecord(group) || !exactKeys(group, ['id', 'name', 'awardRefs']) || !isId(group.id) || groupIds.has(group.id)) return false
    if (index === 0 ? group.id !== 'default' || group.name !== null : typeof group.name !== 'string' || group.name.trim().length < 1 || group.name.trim().length > 40) return false
    const refs = parseIds(group.awardRefs)
    if (!refs || refs.some((ref) => awardRefs.has(ref))) return false
    if (index > 0) {
      const name = (group.name as string).trim().toLocaleLowerCase()
      if (groupNames.has(name)) return false
      groupNames.add(name)
    }
    refs.forEach((ref) => awardRefs.add(ref))
    groupIds.add(group.id)
  }
  const normalizedNames = new Set<string>()
  const viewIds = new Set<string>()
  let stableViewCount = 0
  let trainerViewCount = 0
  for (const view of value.savedViews) {
    if (!isRecord(view) || !exactKeys(view, ['id', 'name', 'filters', 'sort']) || !isId(view.id) || viewIds.has(view.id) ||
      typeof view.name !== 'string' || view.name.trim().length < 1 || view.name.trim().length > 40 ||
      !['recent', 'tier', 'closest', 'rarest', 'alphabetical', 'category'].includes(view.sort as string) || !validSavedViewFilters(view.filters)) return false
    const name = view.name.trim().toLocaleLowerCase()
    const viewScope = trainer && isTrainerSavedBadgeViewId(view.id as string) ? 'trainer' : 'stable'
    const scopedName = `${viewScope}:${name}`
    if (normalizedNames.has(scopedName)) return false
    normalizedNames.add(scopedName)
    viewIds.add(view.id)
    if (viewScope === 'trainer') trainerViewCount += 1
    else stableViewCount += 1
  }
  if (stableViewCount > 20 || trainerViewCount > 20) return false
  if (trainer) {
    if (typeof value.displayName !== 'string' || value.displayName.trim().length < 1 || [...value.displayName.trim()].length > 32) return false
    if (!parseIds(value.pinnedUmaIds)) return false
  }
  return true
}

function validSavedViewFilters(value: unknown): boolean {
  const rows = parseCounts(value, 30)
  if (!rows) return false
  const kinds = new Set<string>()
  const enums: Record<string, readonly string[]> = {
    category: BADGE_FILTER_CATEGORIES,
    type: [...BADGE_TIERS, 'one-off', 'title', 'trophy', 'goal-ribbon', 'honors'],
    surface: SURFACES,
    distance: DISTANCE_CATEGORIES,
    strategy: STRATEGIES,
    aptitude: ['challenge', 'impossible', 'unorthodox'],
    grade: RACE_GRADES,
    status: ['earned', 'locked', 'progress', 'complete', 'untracked'],
    pinned: ['yes', 'no'],
    rarity: ['common', 'uncommon', 'rare', 'elite'],
  }
  for (const row of rows) {
    if (row.key === 'earned-after') {
      if (kinds.has('earned-after')) return false
      kinds.add('earned-after')
      continue
    }
    if (row.count !== 1) return false
    const separator = row.key.indexOf(':')
    if (separator <= 0) return false
    const kind = row.key.slice(0, separator)
    const filterValue = row.key.slice(separator + 1)
    if (kinds.has(kind)) return false
    kinds.add(kind)
    if (kind === 'scenario') {
      const tier = Number(filterValue)
      if (!isPositiveInt(tier) || tier > SCENARIOS.length || String(tier) !== filterValue) return false
    } else if (kind === 'venue' || kind === 'uma') {
      if (!isId(filterValue)) return false
    } else if (!enums[kind]?.includes(filterValue)) return false
  }
  return true
}

function validRaceFeats(value: unknown): value is RaceFeatFacts {
  const keys = Object.keys(emptyRaceFeats())
  return isRecord(value) && exactKeys(value, keys) && keys.every((key) => isNonNegativeInt(value[key]))
}

function validateUmaBadgeState(value: UmaBadgeStateV1): boolean {
  if (!exactKeys(value as unknown as Record<string, unknown>, [
    'version', 'scope', 'umaId', 'catalogVersion', 'evaluatorVersion', 'trackingStartedAt', 'sourceWatermarks',
    'history', 'facts', 'awards', 'preferences',
  ]) || !isId(value.umaId) || !isPositiveInt(value.catalogVersion) || !isNonNegativeInt(value.evaluatorVersion) ||
    !isNonNegativeInt(value.trackingStartedAt) || !validHistory(value.history) || !validPreferences(value.preferences)) return false
  const watermarks = value.sourceWatermarks
  if (!isRecord(watermarks) || !exactKeys(watermarks, ['raceSequence', 'trainingTurns', 'scenarioCompletions', 'lineageEvidence']) ||
    !Number.isSafeInteger(watermarks.raceSequence) || watermarks.raceSequence < -1 ||
    !isNonNegativeInt(watermarks.trainingTurns) || !isNonNegativeInt(watermarks.scenarioCompletions) || !isNonNegativeInt(watermarks.lineageEvidence)) return false
  const facts = value.facts
  if (!isRecord(facts) || !exactKeys(facts, [
    'starts', 'wins', 'seconds', 'thirds', 'currentWinStreak', 'longestWinStreak', 'gradeWins', 'surfaceWins',
    'distanceWins', 'strategyWins', 'venueWins', 'familyWins', 'lowAptitudeSurfaceWins', 'lowAptitudeDistanceWins',
    'courseBests', 'raceFeats', 'statPeaks', 'balancedPeak', 'levelPeak', 'distinctSkillIds', 'lifetimeTrainingTurns',
    'friendshipTrainings', 'fullHouseCount', 'trainingByTier', 'fullyTrainedTiers', 'maxSkillsByTier', 'goals', 'honorsTiers',
    'completedScenarioTiers', 'raceStartsByTier', 'completions',
    'parentedScenarioStarts', 'legacyEvidence', 'dynastyEvidence',
  ])) return false
  if (![facts.starts, facts.wins, facts.seconds, facts.thirds, facts.currentWinStreak, facts.longestWinStreak,
    facts.balancedPeak, facts.levelPeak, facts.lifetimeTrainingTurns, facts.friendshipTrainings, facts.fullHouseCount].every(isNonNegativeInt) ||
    facts.wins > facts.starts || facts.seconds + facts.thirds > facts.starts || facts.currentWinStreak > facts.longestWinStreak ||
    // Full House is not bounded by the lifetime training turns: generation 2 retires that fact and keeps Full House
    // (docs/rework/06-cards-and-bonds.md §7), so it can be earned with no turns counted. Each tier's row stays bounded.
    facts.friendshipTrainings > facts.lifetimeTrainingTurns ||
    !parseStats(facts.statPeaks) || !parseSortedIds(facts.distinctSkillIds) || !parseTierList(facts.fullyTrainedTiers) ||
    !parseTierList(facts.honorsTiers) || !parseTierList(facts.completedScenarioTiers) || !validRaceFeats(facts.raceFeats)) return false
  if (!Array.isArray(facts.trainingByTier) || facts.trainingByTier.length > SCENARIOS.length || facts.trainingByTier.some((entry) =>
    !isRecord(entry) || !exactKeys(entry, ['tier', 'turns', 'friendshipTrainings', 'fullHouseCount', 'reachedTl10']) ||
    !isPositiveInt(entry.tier) || entry.tier > SCENARIOS.length || !isNonNegativeInt(entry.turns) ||
    !isNonNegativeInt(entry.friendshipTrainings) || entry.friendshipTrainings > entry.turns ||
    !isNonNegativeInt(entry.fullHouseCount) || entry.fullHouseCount > entry.turns || typeof entry.reachedTl10 !== 'boolean') ||
    facts.trainingByTier.some((entry, index) => index > 0 && facts.trainingByTier[index - 1]!.tier >= entry.tier)) return false
  const keyedCounts = [facts.gradeWins, facts.surfaceWins, facts.distanceWins, facts.strategyWins, facts.venueWins,
    facts.lowAptitudeSurfaceWins, facts.lowAptitudeDistanceWins, facts.maxSkillsByTier, facts.raceStartsByTier]
  if (keyedCounts.some((rows) => !parseCounts(rows))) return false
  if (facts.gradeWins.some((entry) => !RACE_GRADES.includes(entry.key as RaceGrade)) ||
    facts.surfaceWins.some((entry) => !SURFACES.includes(entry.key as Surface)) ||
    facts.distanceWins.some((entry) => !DISTANCE_CATEGORIES.includes(entry.key as DistanceCategory)) ||
    facts.strategyWins.some((entry) => !STRATEGIES.includes(entry.key as Strategy))) return false
  if ([facts.maxSkillsByTier, facts.raceStartsByTier].some((rows) => rows.some((entry) =>
    !isPositiveInt(Number(entry.key)) || Number(entry.key) > SCENARIOS.length || String(Number(entry.key)) !== entry.key))) return false
  if (!Array.isArray(facts.familyWins) || facts.familyWins.some((entry) => !isRecord(entry) ||
    !exactKeys(entry, ['key', 'count', 'grade', 'series']) || !isId(entry.key) || !isNonNegativeInt(entry.count) ||
    !RACE_GRADES.includes(entry.grade as RaceGrade) || !Array.isArray(entry.series) ||
    entry.series.some((tag) => !FLAIR_SERIES_TAGS.includes(tag as FlairSeriesTag)) ||
    entry.series.some((tag, index) => index > 0 && entry.series[index - 1]!.localeCompare(tag) >= 0)) ||
    facts.familyWins.some((entry, index) => index > 0 && facts.familyWins[index - 1]!.key.localeCompare(entry.key) >= 0)) return false
  if (!Array.isArray(facts.courseBests) || facts.courseBests.some((entry) => !isRecord(entry) ||
    !exactKeys(entry, ['courseId', 'finishTime', 'resultId', 'achievedAt']) || !isId(entry.courseId) || !isId(entry.resultId) ||
    !isFiniteNonNegative(entry.finishTime) || !isNonNegativeInt(entry.achievedAt)) ||
    facts.courseBests.some((entry, index) => index > 0 && facts.courseBests[index - 1]!.courseId.localeCompare(entry.courseId) >= 0)) return false
  const evidenceLists = [facts.parentedScenarioStarts, facts.legacyEvidence, facts.dynastyEvidence]
  if (evidenceLists.some((rows) => !Array.isArray(rows) || rows.length > 10_000 || rows.some((entry) => !isRecord(entry) ||
    !exactKeys(entry, ['key', 'relatedUmaId', 'tier', 'createdAt']) || !isId(entry.key) || !isId(entry.relatedUmaId) ||
    !isPositiveInt(entry.tier) || entry.tier > SCENARIOS.length || !isNonNegativeInt(entry.createdAt)) ||
    rows.some((entry, index) => index > 0 && rows[index - 1]!.key.localeCompare(entry.key) >= 0))) return false
  if (!Array.isArray(facts.goals) || facts.goals.some((entry) => !isRecord(entry) ||
    !exactKeys(entry, ['goalId', 'resultId', 'tier', 'completedAt']) || !isId(entry.goalId) || !isId(entry.resultId) ||
    !isPositiveInt(entry.tier) || entry.tier > SCENARIOS.length || !isNonNegativeInt(entry.completedAt)) ||
    facts.goals.some((entry, index) => index > 0 && facts.goals[index - 1]!.goalId.localeCompare(entry.goalId) >= 0)) return false
  if (!Array.isArray(facts.completions) || facts.completions.length > SCENARIOS.length || facts.completions.some((entry) => !isRecord(entry) ||
    !exactKeys(entry, ['tier', 'completedAt', 'trainingLevel', 'stats', 'deckCardIds', 'deckEras', 'trainingTurns', 'friendshipTrainings',
      'raceStarts', 'completedGoalIds', 'honors', 'parentUmaIds', 'grandparentUmaIds']) || !isPositiveInt(entry.tier) ||
    entry.tier > SCENARIOS.length || !isNonNegativeInt(entry.completedAt) || !isPositiveInt(entry.trainingLevel) || entry.trainingLevel > 10 ||
    !parseStats(entry.stats) || !parseIds(entry.deckCardIds, 6) || !Array.isArray(entry.deckEras) ||
    entry.deckEras.length !== entry.deckCardIds.length || entry.deckEras.some((era) => !isPositiveInt(era)) ||
    !isNonNegativeInt(entry.trainingTurns) || !isNonNegativeInt(entry.friendshipTrainings) || !isNonNegativeInt(entry.raceStarts) ||
    !parseIds(entry.completedGoalIds, MAX_COMPLETION_GOALS) || typeof entry.honors !== 'boolean' || !parseIds(entry.parentUmaIds, 2) || !parseIds(entry.grandparentUmaIds, 4)) ||
    facts.completions.some((entry, index) => index > 0 && facts.completions[index - 1]!.tier >= entry.tier)) return false
  if (watermarks.raceSequence + 1 !== facts.starts || watermarks.trainingTurns !== facts.lifetimeTrainingTurns ||
    watermarks.scenarioCompletions !== facts.completedScenarioTiers.length ||
    watermarks.lineageEvidence !== evidenceLists.reduce((sum, rows) => sum + rows.length, 0)) return false
  const awards = value.awards
  if (!isRecord(awards) || !exactKeys(awards, ['badges', 'titles', 'trophies']) || !Array.isArray(awards.badges) ||
    !Array.isArray(awards.titles) || !Array.isArray(awards.trophies) || awards.badges.some((entry) => !validStage(entry)) ||
    awards.titles.some((entry) => !validTitle(entry)) || awards.trophies.some((entry) => !isRecord(entry) ||
      !exactKeys(entry, ['familyId', 'count', 'firstEarnedAt', 'lastEarnedAt', 'firstResultId', 'lastResultId']) || !isId(entry.familyId) ||
      !isPositiveInt(entry.count) || !isNonNegativeInt(entry.firstEarnedAt) || !isNonNegativeInt(entry.lastEarnedAt) ||
      entry.lastEarnedAt < entry.firstEarnedAt || !isId(entry.firstResultId) || !isId(entry.lastResultId))) return false
  const stageOrder = (stage: BadgeTier | 'one-off') => stage === 'one-off' ? BADGE_TIERS.length : BADGE_TIERS.indexOf(stage)
  if (awards.badges.some((entry, index) => index > 0 && (
    awards.badges[index - 1]!.awardKey.localeCompare(entry.awardKey) > 0 ||
    (awards.badges[index - 1]!.awardKey === entry.awardKey && stageOrder(awards.badges[index - 1]!.stage) >= stageOrder(entry.stage))
  )) || awards.titles.some((entry, index) => index > 0 && awards.titles[index - 1]!.awardKey.localeCompare(entry.awardKey) >= 0) ||
    awards.trophies.some((entry, index) => index > 0 && awards.trophies[index - 1]!.familyId.localeCompare(entry.familyId) >= 0) ||
    (value.preferences.activeTitleId !== null && !awards.titles.some((entry) => entry.awardKey === value.preferences.activeTitleId))) return false
  return true
}

function validateTrainerBadgeState(value: TrainerBadgeStateV1): boolean {
  if (!exactKeys(value as unknown as Record<string, unknown>, [
    'version', 'scope', 'catalogVersion', 'evaluatorVersion', 'trackingStartedAt', 'sourceWatermarks', 'aggregates',
    'records', 'awards', 'preferences',
  ]) || !isPositiveInt(value.catalogVersion) || !isNonNegativeInt(value.evaluatorVersion) || !isNonNegativeInt(value.trackingStartedAt) ||
    !parseCounts(value.aggregates) || !validTrainerRecords(value.records) || !validPreferences(value.preferences, true)) return false
  if (!isRecord(value.sourceWatermarks) || !exactKeys(value.sourceWatermarks, ['contributors', 'ledgerEntries', 'contentVersion']) ||
    !isNonNegativeInt(value.sourceWatermarks.contributors) || !isNonNegativeInt(value.sourceWatermarks.ledgerEntries) ||
    (value.sourceWatermarks.contentVersion !== null && !isId(value.sourceWatermarks.contentVersion))) return false
  if (!isRecord(value.awards) || !exactKeys(value.awards, ['achievements']) || !Array.isArray(value.awards.achievements) ||
    !value.awards.achievements.every((entry) => validStage(entry))) return false
  const stageOrder = (stage: BadgeTier | 'one-off') => stage === 'one-off' ? BADGE_TIERS.length : BADGE_TIERS.indexOf(stage)
  return value.awards.achievements.every((entry, index, rows) => index === 0 ||
    rows[index - 1]!.awardKey.localeCompare(entry.awardKey) < 0 ||
    (rows[index - 1]!.awardKey === entry.awardKey && stageOrder(rows[index - 1]!.stage) < stageOrder(entry.stage)))
}

function validTrainerRecords(value: unknown): value is TrainerRecord[] {
  if (!Array.isArray(value) || value.length > TRAINER_RECORD_KINDS.length) return false
  return value.every((entry, index) => isRecord(entry) && exactKeys(entry, ['kind', 'value', 'umaId', 'sourceId', 'achievedAt', 'stat']) &&
    TRAINER_RECORD_KINDS.includes(entry.kind as TrainerRecordKind) && isFiniteNonNegative(entry.value) && isId(entry.umaId) &&
    (entry.sourceId === null || isId(entry.sourceId)) && isNonNegativeInt(entry.achievedAt) &&
    (entry.kind === 'highest-stat' ? STATS.includes(entry.stat as StatKey) : entry.stat === null) &&
    (index === 0 || (value[index - 1] as TrainerRecord).kind.localeCompare(entry.kind as string) < 0))
}

export function parseFlairEvent(value: unknown): FlairEventV1 | null {
  if (!isRecord(value) || !exactKeys(value, [
    'version', 'scope', 'umaId', 'kind', 'awardKey', 'stage', 'earnedAt', 'source', 'retroactive',
  ]) || value.version !== FLAIR_EVENT_VERSION || !['uma', 'trainer'].includes(value.scope as string) ||
    (value.scope === 'uma' ? !isId(value.umaId) : value.umaId !== null) || !FLAIR_EVENT_KINDS.includes(value.kind as FlairEventKind) ||
    (value.scope === 'trainer' ? value.kind !== 'trainer-achievement' : value.kind === 'trainer-achievement') ||
    !isId(value.awardKey) || ![...BADGE_TIERS, 'one-off'].includes(value.stage as BadgeTier | 'one-off') ||
    !isNonNegativeInt(value.earnedAt) || !validSource(value.source) || typeof value.retroactive !== 'boolean') return null
  return structuredClone(value) as unknown as FlairEventV1
}

export function badgeStateId(umaId: string): string {
  if (!isId(umaId)) throw new Error('Invalid Uma badge identity')
  const id = `${BADGE_STATE_ID_PREFIX}${umaId}`
  if (!BADGE_ID_PATTERN.test(id)) throw new Error('Uma badge identity is too long')
  return id
}

export function countFact(rows: readonly CountFact[], key: string): number {
  return rows.find((row) => row.key === key)?.count ?? 0
}

export function statPeakKey(stat: StatKey): string {
  return `stat-${stat}`
}
