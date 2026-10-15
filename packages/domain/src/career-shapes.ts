// Today's Uma and career shapes that the kept rules still read (D137, D190, D252): the career a scenario freezes, her
// race preferences and skills, and the `UmaSave` view the rework's `careerView` shows today's planner, race views and
// badge rules. Generation 2 stores none of it as today did; `@racer/domain/save` holds what it stores.

import { FLAIR_SERIES_LEG_KEY_PATTERN, FLAIR_SERIES_TAGS, type FlairSeriesTag } from './badges'
import type { UmaTemplate } from './content'
import { CAREER_STAGES, type CareerStage } from './career-stages'
import type { NodeAssignment } from './constellation'
import { SCENARIOS } from './scenarios'
import { DISTANCE_CATEGORIES, GRADES, STATS, type Aptitudes, type DistanceCategory, type Grade, type Stats, type Strategy, type Surface } from './types'

export const SAVE_SCHEMA_VERSION = 15 as const
export const SAVE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/

export type SkillOrigin = 'own-unique' | 'awakening' | 'card' | 'inherited'

export interface SkillUnlock {
  skillId: string
  origin: SkillOrigin
  sourceId: string | null
}

export interface SkillHistoryEntry extends SkillUnlock {
  tier: number
}

/** The three optional targets of goal plans v1 and v2, kept only on journeys frozen before careers. */
export type LegacyGoalSlot = 'aptitude' | 'identity' | 'challenge'
export { CAREER_STAGES, type CareerStage } from './career-stages'
export type GoalSlot = LegacyGoalSlot | CareerStage
/** Goal plan v4 repairs untouched careers whose targets left the regular race catalog (D194). */
export const SCENARIO_GOAL_VERSION = 4 as const
export type GoalStatus = 'active' | 'completed' | 'missed'

export interface ScenarioGoalLeg {
  key: string
  raceId: string
  status: GoalStatus
  completedRaceResultId: string | null
  completedAt: number | null
}

export interface ScenarioGoalSeries {
  tag: FlairSeriesTag
  legs: ScenarioGoalLeg[]
}

export interface ScenarioGoal {
  id: string
  slot: GoalSlot
  raceId: string | null
  kind: 'win' | 'win-by-margin' | 'win-series'
  series: ScenarioGoalSeries | null
  minimumMarginLengths: number
  status: GoalStatus
  completedRaceResultId: string | null
  completedAt: number | null
}

export interface ScenarioJourney {
  tier: number
  tracking: 'tracked' | 'legacy-untracked'
  state: 'active' | 'completed'
  completedAt: number | null
  goals: ScenarioGoal[]
}

/** One scenario's build for one distance (D252): its card set, the nodes they fill, and the equipped skills. */
export interface TrainingPreset {
  cardSetIds: string[]
  assignments: Record<string, NodeAssignment>
  loadoutSkillIds: string[]
}

/** A scenario as today's views read it (D252): its four distance presets and its career. */
export interface ScenarioUnit {
  tier: number
  presets: Record<DistanceCategory, TrainingPreset>
  journey: ScenarioJourney | null
  /** False until the player confirms this scenario's start. */
  started: boolean
}

/** One scenario seen through one distance preset: the unit's shared state and the preset's build (D252). */
export interface ScenarioTraining {
  tier: number
  cardSetIds: string[]
  assignments: Record<string, NodeAssignment>
  loadoutSkillIds: string[]
  journey: ScenarioJourney | null
  started: boolean
  preset: DistanceCategory
}

export interface RacePreferences {
  strategy: Strategy
  distance: DistanceCategory
  surface: Surface
}

export interface UmaSave {
  schemaVersion: typeof SAVE_SCHEMA_VERSION
  templateId: string
  /** Permanent, earned by racing only. Unlocks scenarios; does not feed stats. */
  level: number
  exp: number
  /** Highest unlocked scenario, and always the active one. */
  unlockedTier: number
  scenarios: ScenarioUnit[]
  skillHistory: SkillHistoryEntry[]
  goalPlanVersion: number
  /** The distance preset her profile shows and edits, and that every race-free use reads (D252). */
  activePreset: DistanceCategory
  /** Null means the deterministic template recommendation until the owner sets a preference. */
  racePreferences: RacePreferences | null
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isId = (value: unknown): value is string => typeof value === 'string' && SAVE_ID_PATTERN.test(value)
const isNonNegativeInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
const isPositiveInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0
const isTimestamp = (value: unknown): value is number => isNonNegativeInt(value)

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function parseStats(value: unknown): Stats | null {
  if (!isObject(value) || !exactKeys(value, STATS)) return null
  if (STATS.some((key) => !isNonNegativeInt(value[key]))) return null
  return Object.fromEntries(STATS.map((key) => [key, value[key] as number])) as Stats
}

function parseGrade(value: unknown): Grade | null {
  return typeof value === 'string' && GRADES.includes(value as Grade) ? (value as Grade) : null
}

function parseAptitudes(value: unknown): Aptitudes | null {
  if (!isObject(value) || !isObject(value.surface) || !isObject(value.distance) || !isObject(value.strategy)) return null
  const surface = value.surface
  const distance = value.distance
  const strategy = value.strategy
  const surfaceKeys = ['turf', 'dirt'] as const
  const distanceKeys = ['sprint', 'mile', 'medium', 'long'] as const
  const strategyKeys = ['front', 'pace', 'late', 'end'] as const
  if (!exactKeys(surface, surfaceKeys) || !exactKeys(distance, distanceKeys) || !exactKeys(strategy, strategyKeys)) return null
  if (
    surfaceKeys.some((key) => !parseGrade(surface[key])) ||
    distanceKeys.some((key) => !parseGrade(distance[key])) ||
    strategyKeys.some((key) => !parseGrade(strategy[key]))
  ) return null
  return {
    surface: Object.fromEntries(surfaceKeys.map((key) => [key, surface[key]])) as Aptitudes['surface'],
    distance: Object.fromEntries(distanceKeys.map((key) => [key, distance[key]])) as Aptitudes['distance'],
    strategy: Object.fromEntries(strategyKeys.map((key) => [key, strategy[key]])) as Aptitudes['strategy'],
  }
}

function parseUniqueIds(value: unknown, max = Number.POSITIVE_INFINITY): string[] | null {
  if (!Array.isArray(value) || value.length > max || value.some((item) => !isId(item))) return null
  const ids = value as string[]
  return new Set(ids).size === ids.length ? [...ids] : null
}

function assertSaveUmaTemplate(template: UmaTemplate): void {
  if (!isId(template.id) || !isId(template.charaId)) throw new Error('Uma content has an invalid reference id')
  if (typeof template.name !== 'string' || template.name.length === 0) throw new Error(`Uma ${template.id} has no name`)
  if (template.outfit !== null && typeof template.outfit !== 'string') throw new Error(`Uma ${template.id} has an invalid outfit`)
  if (typeof template.starter !== 'boolean' || !parseStats(template.baseStats) || !parseAptitudes(template.aptitudes)) {
    throw new Error(`Uma ${template.id} has invalid save initialization data`)
  }
  if (template.uniqueSkillId !== null && !isId(template.uniqueSkillId)) {
    throw new Error(`Uma ${template.id} has an invalid unique skill reference`)
  }
  if (!parseUniqueIds(template.awakeningSkillIds)) {
    throw new Error(`Uma ${template.id} has invalid awakening skill references`)
  }
  // Her innate and story-event skills (D186) are optional: a pack published before them has neither.
  for (const list of [template.innateSkillIds, template.eventSkillIds]) {
    if (list !== undefined && !parseUniqueIds(list)) throw new Error(`Uma ${template.id} has invalid own skill references`)
  }
}

const LEGACY_GOAL_SLOTS: readonly LegacyGoalSlot[] = ['aptitude', 'identity', 'challenge']
const GOAL_SLOTS: readonly GoalSlot[] = [...LEGACY_GOAL_SLOTS, ...CAREER_STAGES]
const isCareerStage = (slot: GoalSlot): slot is CareerStage => (CAREER_STAGES as readonly string[]).includes(slot)
/** Each career stage's goal count: one maiden race, two trials, and one to four main goals. */
const CAREER_STAGE_COUNTS: Readonly<Record<CareerStage, { min: number; max: number }>> = {
  maiden: { min: 1, max: 1 },
  trials: { min: 2, max: 2 },
  main: { min: 1, max: 4 },
}

function hasValidGoalEvidence(value: Record<string, unknown>): boolean {
  const completed = value.status === 'completed'
  return completed
    ? isId(value.completedRaceResultId) && isTimestamp(value.completedAt)
    : value.completedRaceResultId === null && value.completedAt === null
}

function parseScenarioGoalLeg(value: unknown): ScenarioGoalLeg | null {
  if (!isObject(value) || !exactKeys(value, ['key', 'raceId', 'status', 'completedRaceResultId', 'completedAt'])) return null
  if (typeof value.key !== 'string' || value.key.length > 40 || !FLAIR_SERIES_LEG_KEY_PATTERN.test(value.key) || !isId(value.raceId)) return null
  if (!['active', 'completed', 'missed'].includes(String(value.status)) || !hasValidGoalEvidence(value)) return null
  return {
    key: value.key,
    raceId: value.raceId,
    status: value.status as GoalStatus,
    completedRaceResultId: value.completedRaceResultId as string | null,
    completedAt: value.completedAt as number | null,
  }
}

function parseScenarioGoalSeries(value: unknown): ScenarioGoalSeries | null {
  if (!isObject(value) || !exactKeys(value, ['tag', 'legs']) || !FLAIR_SERIES_TAGS.includes(value.tag as FlairSeriesTag)) return null
  if (!Array.isArray(value.legs) || value.legs.length < 2 || value.legs.length > 3) return null
  const legs = value.legs.map(parseScenarioGoalLeg)
  if (legs.some((leg) => leg === null)) return null
  const valid = legs as ScenarioGoalLeg[]
  if (new Set(valid.map((leg) => leg.key)).size !== valid.length || new Set(valid.map((leg) => leg.raceId)).size !== valid.length) return null
  return { tag: value.tag as FlairSeriesTag, legs: valid }
}

function parseScenarioGoal(value: unknown, tier: number): ScenarioGoal | null {
  if (!isObject(value) || !exactKeys(value, [
    'id', 'slot', 'raceId', 'kind', 'series', 'minimumMarginLengths', 'status', 'completedRaceResultId', 'completedAt',
  ])) return null
  if (!GOAL_SLOTS.includes(value.slot as GoalSlot) || !['win', 'win-by-margin', 'win-series'].includes(String(value.kind))) return null
  if (typeof value.minimumMarginLengths !== 'number' || !Number.isFinite(value.minimumMarginLengths) || value.minimumMarginLengths < 0) return null
  if (value.slot === 'challenge' ? value.kind !== 'win-by-margin' || value.minimumMarginLengths !== 5 : value.minimumMarginLengths !== 0) return null
  if (value.kind === 'win-series' && value.slot !== 'identity' && value.slot !== 'main') return null
  if (!['active', 'completed', 'missed'].includes(String(value.status))) return null
  // A career goal's id carries its place in the stage, so the journey checks it.
  if (!isCareerStage(value.slot as GoalSlot) && value.id !== `goal:${tier}:${String(value.slot)}`) return null
  if (typeof value.id !== 'string' || !value.id.startsWith(`goal:${tier}:`)) return null
  if (!hasValidGoalEvidence(value)) return null
  const series = value.kind === 'win-series' ? parseScenarioGoalSeries(value.series) : null
  if (value.kind === 'win-series') {
    if (value.raceId !== null || !series) return null
    const active = series.legs.filter((leg) => leg.status === 'active').length
    const missed = series.legs.filter((leg) => leg.status === 'missed').length
    if (value.status === 'active' && (active === 0 || missed > 0)) return null
    if (value.status === 'completed' && (active > 0 || missed > 0 || !series.legs.some((leg) =>
      leg.completedRaceResultId === value.completedRaceResultId && leg.completedAt === value.completedAt))) return null
    if (value.status === 'missed' && (active > 0 || missed === 0)) return null
  } else {
    if (!isId(value.raceId) || value.series !== null) return null
    if (value.slot === 'challenge' ? value.kind !== 'win-by-margin' : value.kind !== 'win') return null
  }
  return {
    id: value.id,
    slot: value.slot as GoalSlot,
    raceId: value.raceId as string | null,
    kind: value.kind as ScenarioGoal['kind'],
    series,
    minimumMarginLengths: value.minimumMarginLengths,
    status: value.status as GoalStatus,
    completedRaceResultId: value.completedRaceResultId as string | null,
    completedAt: value.completedAt as number | null,
  }
}

/** Goal plans v1–v2: exactly the three legacy slots, each once. */
function isLegacyGoalPlan(goals: readonly ScenarioGoal[]): boolean {
  return goals.length === LEGACY_GOAL_SLOTS.length && goals.every((goal) => !isCareerStage(goal.slot)) &&
    new Set(goals.map((goal) => goal.slot)).size === LEGACY_GOAL_SLOTS.length
}

/**
 * Goal plan v3+: stages in order, each with its documented count, ids numbered within the stage
 * (`goal:3:maiden`, `goal:3:trials:1`, `goal:3:main:2`), and at most one series goal, among the main goals.
 */
function isCareerGoalPlan(goals: readonly ScenarioGoal[], tier: number): boolean {
  let index = 0
  for (const stage of CAREER_STAGES) {
    const stageGoals: ScenarioGoal[] = []
    while (goals[index]?.slot === stage) stageGoals.push(goals[index++]!)
    const { min, max } = CAREER_STAGE_COUNTS[stage]
    if (stageGoals.length < min || stageGoals.length > max) return false
    if (stageGoals.some((goal, position) => goal.id !== (max === 1 ? `goal:${tier}:${stage}` : `goal:${tier}:${stage}:${position + 1}`))) return false
  }
  return index === goals.length && goals.filter((goal) => goal.kind === 'win-series').length <= 1 &&
    goals.every((goal) => goal.kind !== 'win-by-margin')
}

export function parseScenarioJourney(value: unknown): ScenarioJourney | null {
  if (!isObject(value) || !exactKeys(value, ['tier', 'tracking', 'state', 'completedAt', 'goals'])) return null
  if (!isPositiveInt(value.tier) || value.tier > SCENARIOS.length) return null
  if (!['tracked', 'legacy-untracked'].includes(String(value.tracking)) || !['active', 'completed'].includes(String(value.state))) return null
  if (value.state === 'active' && value.completedAt !== null) return null
  if (value.state === 'completed' && value.tracking === 'tracked' && !isTimestamp(value.completedAt)) return null
  if (value.state === 'completed' && value.tracking === 'legacy-untracked' && value.completedAt !== null && !isTimestamp(value.completedAt)) return null
  if (!Array.isArray(value.goals)) return null
  const goals = value.goals.map((goal) => parseScenarioGoal(goal, value.tier as number))
  if (goals.some((goal) => goal === null)) return null
  const validGoals = goals as ScenarioGoal[]
  if (value.tracking === 'legacy-untracked' && validGoals.length !== 0) return null
  if (value.tracking === 'legacy-untracked' && value.state !== 'completed') return null
  if (value.tracking === 'tracked') {
    if (!validGoals.every((goal) => isCareerStage(goal.slot)) ? !isLegacyGoalPlan(validGoals) : !isCareerGoalPlan(validGoals, value.tier)) return null
    const raceIds = validGoals.flatMap((goal) => goal.series?.legs.map((leg) => leg.raceId) ?? (goal.raceId ? [goal.raceId] : []))
    if (new Set(raceIds).size !== raceIds.length) return null
  }
  if (value.state === 'active' && validGoals.some((goal) => goal.status === 'missed')) return null
  if (value.state === 'completed' && validGoals.some((goal) => goal.status === 'active')) return null
  return {
    tier: value.tier,
    tracking: value.tracking as ScenarioJourney['tracking'],
    state: value.state as ScenarioJourney['state'],
    completedAt: value.completedAt as number | null,
    goals: validGoals,
  }
}

/** A unit seen through one preset: what every view-reading rule and screen works on (D252). */
export function scenarioView(unit: ScenarioUnit, preset: DistanceCategory): ScenarioTraining {
  const build = unit.presets[preset]
  return { tier: unit.tier, cardSetIds: build.cardSetIds, assignments: build.assignments, loadoutSkillIds: build.loadoutSkillIds,
    journey: unit.journey, started: unit.started, preset }
}

/** A changed view written back: the shared fields into its unit, the build into its preset alone (D252). */
export function unitWithView(unit: ScenarioUnit, view: ScenarioTraining): ScenarioUnit {
  if (unit.tier !== view.tier) throw new Error(`A tier ${view.tier} view cannot change tier ${unit.tier}`)
  return {
    tier: unit.tier,
    presets: { ...unit.presets, [view.preset]: { cardSetIds: [...view.cardSetIds], assignments: { ...view.assignments },
      loadoutSkillIds: [...view.loadoutSkillIds] } },
    journey: view.journey, started: view.started,
  }
}

/** Writes a changed view back into her save (D252); the view's tier must already be one of her units. */
export function withScenarioView(uma: UmaSave, view: ScenarioTraining): UmaSave {
  if (!uma.scenarios.some((unit) => unit.tier === view.tier)) throw new Error(`Uma ${uma.templateId} has no scenario at tier ${view.tier}`)
  return { ...uma, scenarios: uma.scenarios.map((unit) => unit.tier === view.tier ? unitWithView(unit, view) : unit) }
}

/** The active scenario (always the highest unlocked, D121) through a preset: hers unless one is named (D252). */
export function activeScenario(uma: UmaSave, preset: DistanceCategory = uma.activePreset): ScenarioTraining {
  const run = uma.scenarios.find((entry) => entry.tier === uma.unlockedTier)
  if (!run) throw new Error(`Uma ${uma.templateId} has no scenario at tier ${uma.unlockedTier}`)
  return scenarioView(run, preset)
}

export function scenarioAt(uma: UmaSave, tier: number, preset: DistanceCategory = uma.activePreset): ScenarioTraining | null {
  const run = uma.scenarios.find((entry) => entry.tier === tier)
  return run ? scenarioView(run, preset) : null
}

/**
 * One of her units (D190): the scenario at `tier`, or the active one when no tier is named, through a distance preset
 * (D252). Every unlocked scenario keeps its own presets, and races in its own context.
 */
export function trainedScenario(uma: UmaSave, tier?: number, preset: DistanceCategory = uma.activePreset): ScenarioTraining {
  if (tier === undefined) return activeScenario(uma, preset)
  const run = scenarioAt(uma, tier, preset)
  if (!run) throw new Error(`Uma ${uma.templateId} has no scenario at tier ${tier}`)
  return run
}

/** A scenario before her current one (D190): it races and trains, but levels and careers belong to the current one. */
export const isPastScenario = (uma: Pick<UmaSave, 'unlockedTier'>, tier: number): boolean => tier < uma.unlockedTier

/** A new scenario unit: four empty presets (D252). */
export function createScenarioTraining(tier: number): ScenarioUnit {
  const preset = (): TrainingPreset => ({ cardSetIds: [], assignments: {}, loadoutSkillIds: [] })
  return {
    tier,
    presets: { sprint: preset(), mile: preset(), medium: preset(), long: preset() },
    journey: null,
    started: false,
  }
}

/** Her best base distance, Medium on a tie with it, then the shorter: where a new Uma's preset starts (D252). */
export function bestBaseDistance(template: Pick<UmaTemplate, 'aptitudes'>): DistanceCategory {
  const rank = (distance: DistanceCategory) => GRADES.indexOf(template.aptitudes.distance[distance])
  return [...DISTANCE_CATEGORIES].sort((left, right) =>
    rank(left) - rank(right) || Number(right === 'medium') - Number(left === 'medium') ||
    DISTANCE_CATEGORIES.indexOf(left) - DISTANCE_CATEGORIES.indexOf(right))[0]!
}

export function createUmaSave(template: UmaTemplate): UmaSave {
  assertSaveUmaTemplate(template)
  const skillHistory: SkillHistoryEntry[] = template.uniqueSkillId
    ? [{ skillId: template.uniqueSkillId, origin: 'own-unique', sourceId: template.id, tier: 1 }]
    : []
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    templateId: template.id,
    level: 1,
    exp: 0,
    unlockedTier: 1,
    scenarios: [createScenarioTraining(1)],
    skillHistory,
    goalPlanVersion: SCENARIO_GOAL_VERSION,
    racePreferences: null,
    activePreset: bestBaseDistance(template),
  }
}
