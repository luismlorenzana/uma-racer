// Scenario careers: a stage-gated race career that loops every scenario (docs/design/scenario-goals.md, D137).

import {
  flairSeriesLegId,
  FLAIR_SERIES_TAGS,
  parseFlairSeriesLegId,
  type FlairSeriesTag,
} from './badges'
import type { RaceTemplate, UmaTemplate } from './content'
import { parseRaceResultRecord, type RaceResultRecord } from './progression-race'
import {
  activeScenario,
  CAREER_STAGES,
  parseUmaSave,
  SCENARIO_GOAL_VERSION,
  SAVE_ID_PATTERN,
  type CareerStage,
  type ScenarioGoal,
  type ScenarioGoalLeg,
  type ScenarioJourney,
  type UmaSave,
} from './save'
import { LEVELS_PER_SCENARIO, isGateLevel, scenarioForTier, tierOfLevel } from './scenarios'
import {
  GRADES,
  RACE_GRADES,
  SURFACES,
  type Aptitudes,
  type DistanceCategory,
  type Grade,
  type RaceGrade,
  type Surface,
} from './types'

export const SCENARIO_SERIES_LABELS: Readonly<Record<FlairSeriesTag, string>> = {
  'triple-crown': 'Triple Crown',
  'triple-tiara': 'Triple Tiara',
  'spring-triple-crown': 'Spring Triple Crown',
  'autumn-triple-crown': 'Autumn Triple Crown',
  'grand-prix': 'Grand Prix',
  'sprint-crown': 'Sprint Crown',
  'mile-crown': 'Mile Crown',
  'dirt-crown': 'Dirt Crown',
}

/** Public race-name slugs only. Private source family ids stay in ignored content overrides. */
export const SCENARIO_SERIES_LEG_ORDER: Readonly<Record<FlairSeriesTag, readonly string[]>> = {
  'triple-crown': ['satsuki-sho', 'tokyo-yushun', 'kikuka-sho'],
  'triple-tiara': ['oka-sho', 'japanese-oaks', 'shuka-sho'],
  'spring-triple-crown': ['osaka-hai', 'tenno-sho-spring', 'takarazuka-kinen'],
  'autumn-triple-crown': ['tenno-sho-autumn', 'japan-cup', 'arima-kinen'],
  'grand-prix': ['takarazuka-kinen', 'arima-kinen'],
  'sprint-crown': ['takamatsunomiya-kinen', 'sprinters-stakes'],
  'mile-crown': ['yasuda-kinen', 'mile-championship'],
  'dirt-crown': ['february-stakes', 'champions-cup'],
}

export function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// ---- Stages ----------------------------------------------------------------------------------------------------

export const CAREER_STAGE_LABELS: Readonly<Record<CareerStage, string>> = {
  maiden: 'Maiden',
  trials: 'Trials',
  main: 'Main goals',
}

/** Levels into the scenario (1–10) each stage spans. An unfinished stage holds the Uma at its last level. */
export const CAREER_STAGE_LEVELS: Readonly<Record<CareerStage, { first: number; last: number }>> = {
  maiden: { first: 1, last: 2 },
  trials: { first: 3, last: 5 },
  main: { first: 6, last: 10 },
}

export const CAREER_STAGE_GRADES: Readonly<Record<CareerStage, RaceGrade>> = { maiden: 'g3', trials: 'g2', main: 'g1' }

/** Main goals ask for three G1 wins: a two-leg set is topped up with one more G1 from her own career. */
export const CAREER_MAIN_RACES = 3

export const isCareerStage = (slot: string): slot is CareerStage => (CAREER_STAGES as readonly string[]).includes(slot)

/** Goal plan v3 journeys. v1–v2 journeys keep their three optional slots and none of the stage rules. */
export const isCareerJourney = (journey: ScenarioJourney | null | undefined): journey is ScenarioJourney =>
  Boolean(journey && journey.goals.length > 0 && journey.goals.every((goal) => isCareerStage(goal.slot)))

/** The earliest stage with a goal still to win, or null once the career is complete (or is not a career). */
export function careerStage(journey: ScenarioJourney | null | undefined): CareerStage | null {
  if (!isCareerJourney(journey)) return null
  return CAREER_STAGES.find((stage) => journey.goals.some((goal) => goal.slot === stage && goal.status === 'active')) ?? null
}

export const careerComplete = (journey: ScenarioJourney | null | undefined): boolean =>
  isCareerJourney(journey) && journey.goals.every((goal) => goal.status === 'completed')

/**
 * The Uma Level race EXP stops at: the last level of the earliest stage that still has a goal to win. Maiden holds
 * level 2 of the scenario and Trials level 5. Main goals need no hold, because level 10 is already the gate. An Uma
 * already past a hold (a career generated mid-scenario) is never pushed back.
 */
export function careerHoldLevel(journey: ScenarioJourney | null | undefined, level: number): number | null {
  if (!isCareerJourney(journey) || journey.state !== 'active' || tierOfLevel(level) !== journey.tier) return null
  const base = (journey.tier - 1) * LEVELS_PER_SCENARIO
  for (const stage of ['maiden', 'trials'] as const) {
    const hold = base + CAREER_STAGE_LEVELS[stage].last
    const open = journey.goals.some((goal) => goal.status === 'active' &&
      CAREER_STAGES.indexOf(goal.slot as CareerStage) <= CAREER_STAGES.indexOf(stage))
    if (open && level <= hold) return hold
  }
  return null
}

/** At the gate level an unfinished career keeps racing. Everything else waits for the scenario to advance. */
export const careerOpenAtGate = (journey: ScenarioJourney | null | undefined): boolean =>
  isCareerJourney(journey) && journey.state === 'active' && !careerComplete(journey)

/** The Uma is at her gate with nothing left to race for: the next step is advancing (or, at the last tier, done). */
export const awaitingAdvance = (uma: UmaSave): boolean =>
  isGateLevel(uma.level) && !careerOpenAtGate(activeScenario(uma).journey)

/** Every race a goal names: its single race, or each leg of its set. */
export const goalRaceIds = (goal: ScenarioGoal): string[] =>
  goal.series ? goal.series.legs.map((leg) => leg.raceId) : goal.raceId ? [goal.raceId] : []

// ---- Profile ---------------------------------------------------------------------------------------------------

export type CareerBand = 'sprint-mile' | 'mile-medium' | 'medium-long'

export const CAREER_BANDS: Readonly<Record<CareerBand, readonly [DistanceCategory, DistanceCategory]>> = {
  'sprint-mile': ['sprint', 'mile'],
  'mile-medium': ['mile', 'medium'],
  'medium-long': ['medium', 'long'],
}

/** When two bands fit equally, her real career decides, and then the middle of the calendar. */
const BAND_PREFERENCE: readonly CareerBand[] = ['mile-medium', 'medium-long', 'sprint-mile']

export interface CareerProfile {
  band: CareerBand
  surface: Surface
  distances: readonly [DistanceCategory, DistanceCategory]
}

const gradeIndex = (grade: Grade): number => GRADES.indexOf(grade)
const ELIGIBLE_GRADE = gradeIndex('B')

/** B or better on both the surface and the distance. */
const fits = (aptitudes: Aptitudes, race: RaceTemplate): boolean =>
  gradeIndex(aptitudes.surface[race.surface]) <= ELIGIBLE_GRADE && gradeIndex(aptitudes.distance[race.distanceCategory]) <= ELIGIBLE_GRADE

const aptitudeScore = (aptitudes: Aptitudes, race: RaceTemplate): number =>
  gradeIndex(aptitudes.surface[race.surface]) + gradeIndex(aptitudes.distance[race.distanceCategory])

export const inCareerProfile = (profile: CareerProfile, race: RaceTemplate): boolean =>
  race.surface === profile.surface && profile.distances.includes(race.distanceCategory)

/**
 * Her best two neighbouring distances on her better surface. A pair ranks by its weaker grade, then its stronger
 * one, then by how many of her real career's races it holds.
 */
export function careerProfile(aptitudes: Aptitudes, template: UmaTemplate, races: readonly RaceTemplate[]): CareerProfile {
  const signature = new Set(template.signatureRaceFamilyIds)
  const career = races.filter((race) => signature.has(race.familyId))
  const careerFamilies = (test: (race: RaceTemplate) => boolean) => new Set(career.filter(test).map((race) => race.familyId)).size
  const surface = [...SURFACES].sort((left, right) =>
    gradeIndex(aptitudes.surface[left]) - gradeIndex(aptitudes.surface[right]) ||
    careerFamilies((race) => race.surface === right) - careerFamilies((race) => race.surface === left) ||
    SURFACES.indexOf(left) - SURFACES.indexOf(right))[0]!
  const band = BAND_PREFERENCE.map((candidate) => {
    const distances = CAREER_BANDS[candidate]
    const grades = distances.map((distance) => gradeIndex(aptitudes.distance[distance]))
    return {
      band: candidate,
      worse: Math.max(...grades),
      better: Math.min(...grades),
      career: careerFamilies((race) => distances.includes(race.distanceCategory)),
    }
  }).sort((left, right) => left.worse - right.worse || left.better - right.better || right.career - left.career ||
    BAND_PREFERENCE.indexOf(left.band) - BAND_PREFERENCE.indexOf(right.band))[0]!.band
  return { band, surface, distances: CAREER_BANDS[band] }
}

// ---- Selection -------------------------------------------------------------------------------------------------

interface CareerContext {
  template: UmaTemplate
  aptitudes: Aptitudes
  profile: CareerProfile
  tier: number
  races: readonly RaceTemplate[]
}

/** The best-fitting variant of one race family, then the lowest id. */
function bestVariant(aptitudes: Aptitudes, family: readonly RaceTemplate[]): RaceTemplate {
  return [...family].sort((left, right) => aptitudeScore(aptitudes, left) - aptitudeScore(aptitudes, right) ||
    left.id.localeCompare(right.id))[0]!
}

/**
 * Families in the order a career walks them: her real career first, in career order; then famous races (any set
 * leg); then the rest in a fixed per-Uma order. Tier *n* starts at the *n*-th family, so each scenario differs.
 */
function orderedFamilies(ctx: CareerContext, pool: readonly RaceTemplate[], salt: string): RaceTemplate[][] {
  const byFamily = new Map<string, RaceTemplate[]>()
  for (const race of pool) byFamily.set(race.familyId, [...(byFamily.get(race.familyId) ?? []), race])
  const career = ctx.template.signatureRaceFamilyIds.filter((id) => byFamily.has(id))
  const famous = (id: string) => byFamily.get(id)!.some((race) => race.series.length > 0) ? 0 : 1
  const hash = (id: string) => stableHash(`${ctx.template.id}:${salt}:${id}`)
  const rest = [...byFamily.keys()].filter((id) => !career.includes(id))
    .sort((left, right) => famous(left) - famous(right) || hash(left) - hash(right) || left.localeCompare(right))
  return [...career, ...rest].map((id) => byFamily.get(id)!)
}

/**
 * Up to `count` new races of the stage's grade, each from a different family and each as its best variant. Pools
 * relax in order until the count is met: in her profile at B or better, then in her profile, then B or better
 * anywhere, then anything of the grade. `strict` stops after the first pool.
 */
function pickStageRaces(
  ctx: CareerContext,
  stage: CareerStage,
  distances: readonly DistanceCategory[],
  taken: Set<string>,
  count: number,
  salt: string = stage,
  strict = false,
): RaceTemplate[] {
  const picked: RaceTemplate[] = []
  const graded = ctx.races.filter((race) => race.grade === CAREER_STAGE_GRADES[stage])
  const banded = graded.filter((race) => race.surface === ctx.profile.surface && distances.includes(race.distanceCategory))
  const pools = [banded.filter((race) => fits(ctx.aptitudes, race)), banded, graded.filter((race) => fits(ctx.aptitudes, race)), graded]
    .slice(0, strict ? 1 : undefined)
  for (const pool of pools) {
    if (picked.length >= count) break
    const fresh = pool.filter((race) => !taken.has(race.id) && !taken.has(`family:${race.familyId}`))
    const families = orderedFamilies(ctx, fresh, salt)
    const start = families.length === 0 ? 0 : (ctx.tier - 1) % families.length
    for (const family of [...families.slice(start), ...families.slice(0, start)].slice(0, count - picked.length)) {
      const race = bestVariant(ctx.aptitudes, family)
      picked.push(race)
      taken.add(race.id)
      taken.add(`family:${race.familyId}`)
    }
  }
  return picked
}

/** Public race-name slugs present in content for one set, in documented order. */
function orderedLegKeys(tag: FlairSeriesTag, races: readonly RaceTemplate[]): string[] {
  const covered = new Set(races.flatMap((race) => race.seriesLegs)
    .map(parseFlairSeriesLegId)
    .filter((leg): leg is { tag: FlairSeriesTag; key: string } => leg?.tag === tag)
    .map((leg) => leg.key))
  const documented = SCENARIO_SERIES_LEG_ORDER[tag].filter((key) => covered.has(key))
  return documented.length === covered.size ? documented : [...covered].sort()
}

/** The order a career's main sets rotate in. A set joins an Uma's rotation only when it fits her (below). */
export const CAREER_SET_ORDER: readonly FlairSeriesTag[] = [
  'triple-crown',
  'triple-tiara',
  'spring-triple-crown',
  'autumn-triple-crown',
  'grand-prix',
  'sprint-crown',
  'mile-crown',
  'dirt-crown',
]

/** A named set, or `signature`: three of her own G1s. Every rotation ends with `signature`. */
export type CareerMainPlan = FlairSeriesTag | 'signature'

interface SetLegs {
  tag: FlairSeriesTag
  legs: { key: string; race: RaceTemplate }[]
}

/**
 * A set fits when every leg has a G1 in her profile at B or better. The classic sets also follow the real horse's
 * sex: the Triple Crown for colts, the Triple Tiara for fillies.
 */
function fittingSet(ctx: CareerContext, tag: FlairSeriesTag): SetLegs | null {
  if (tag === 'triple-crown' && ctx.template.realHorseSex !== 'male') return null
  if (tag === 'triple-tiara' && ctx.template.realHorseSex !== 'female') return null
  const keys = orderedLegKeys(tag, ctx.races)
  if (keys.length < 2 || keys.length > 3) return null
  const legs: SetLegs['legs'] = []
  const taken = new Set<string>()
  for (const key of keys) {
    const legId = flairSeriesLegId(tag, key)
    const candidates = ctx.races.filter((race) => race.grade === 'g1' && race.seriesLegs.includes(legId) && !taken.has(race.id) &&
      inCareerProfile(ctx.profile, race) && fits(ctx.aptitudes, race))
    if (candidates.length === 0) return null
    const race = bestVariant(ctx.aptitudes, candidates)
    legs.push({ key, race })
    taken.add(race.id)
  }
  return { tag, legs }
}

/** Her main-goal rotation: every set that fits her, in set order, then her own G1s. Tier *n* takes entry *n*. */
function careerMainRotation(ctx: CareerContext): CareerMainPlan[] {
  return [...CAREER_SET_ORDER.filter((tag) => fittingSet(ctx, tag) !== null), 'signature']
}

// ---- Generation ------------------------------------------------------------------------------------------------

export function assertScenarioGoalContent(umas: readonly UmaTemplate[], races: readonly RaceTemplate[]): void {
  for (const race of races) {
    if (!SAVE_ID_PATTERN.test(race.id) || !/^\d+$/.test(race.familyId) || !RACE_GRADES.includes(race.grade) ||
      race.series.some((tag) => !FLAIR_SERIES_TAGS.includes(tag)) ||
      race.seriesLegs.some((leg) => parseFlairSeriesLegId(leg) === null)) {
      throw new Error('Scenario goal race content is malformed')
    }
  }
  for (const uma of umas) {
    if (!SAVE_ID_PATTERN.test(uma.id) || !SAVE_ID_PATTERN.test(uma.charaId) ||
      new Set(uma.signatureRaceFamilyIds).size !== uma.signatureRaceFamilyIds.length ||
      uma.signatureRaceFamilyIds.some((id) => !/^\d+$/.test(id))) {
      throw new Error('Scenario goal Uma content is malformed')
    }
  }
}

export interface GenerateScenarioJourneyInput {
  uma: UmaSave
  umaTemplate: UmaTemplate
  /** Post-lineage aptitudes from the constellation the career is being frozen against (D121). */
  aptitudes: Aptitudes
  races: readonly RaceTemplate[]
}

function winGoal(id: string, slot: CareerStage, race: RaceTemplate): ScenarioGoal {
  return {
    id,
    slot,
    raceId: race.id,
    kind: 'win',
    series: null,
    minimumMarginLengths: 0,
    status: 'active',
    completedRaceResultId: null,
    completedAt: null,
  }
}

function setGoal(id: string, selected: SetLegs): ScenarioGoal {
  return {
    id,
    slot: 'main',
    raceId: null,
    kind: 'win-series',
    series: {
      tag: selected.tag,
      legs: selected.legs.map(({ key, race }): ScenarioGoalLeg => ({
        key,
        raceId: race.id,
        status: 'active',
        completedRaceResultId: null,
        completedAt: null,
      })),
    },
    minimumMarginLengths: 0,
    status: 'active',
    completedRaceResultId: null,
    completedAt: null,
  }
}

export interface CareerPlan {
  profile: CareerProfile
  main: CareerMainPlan
  journey: ScenarioJourney
}

/**
 * Freeze this scenario's career: a G3 maiden race in her profile, a G2 trial at each of her two distances, and her
 * main goals — the scenario's G1 set in rotation, topped up to three G1 wins from her own career. Deterministic:
 * no engine RNG, clock, or input order.
 */
export function planScenarioCareer(input: GenerateScenarioJourneyInput): CareerPlan {
  if (input.uma.templateId !== input.umaTemplate.id) throw new Error('Scenario goal Uma is malformed')
  const tier = tierOfLevel(input.uma.level)
  if (!scenarioForTier(tier)) throw new Error('Scenario goal tier is unknown')
  assertScenarioGoalContent([input.umaTemplate], input.races)
  const races = [...input.races].sort((left, right) => left.id.localeCompare(right.id))
  const profile = careerProfile(input.aptitudes, input.umaTemplate, races)
  const ctx: CareerContext = { template: input.umaTemplate, aptitudes: input.aptitudes, races, tier, profile }
  const taken = new Set<string>()

  const maiden = pickStageRaces(ctx, 'maiden', profile.distances, taken, 1)
  // One trial at each of her distances; a specialist whose second distance is below B runs both at her first.
  const trials = profile.distances.flatMap((distance) => pickStageRaces(ctx, 'trials', [distance], taken, 1, `trials:${distance}`, true))
  if (trials.length < 2) trials.push(...pickStageRaces(ctx, 'trials', profile.distances, taken, 2 - trials.length))

  const rotation = careerMainRotation(ctx)
  const main = rotation[(tier - 1) % rotation.length]!
  const set = main === 'signature' ? null : fittingSet(ctx, main)
  for (const leg of set?.legs ?? []) {
    taken.add(leg.race.id)
    taken.add(`family:${leg.race.familyId}`)
  }
  const topUp = pickStageRaces(ctx, 'main', profile.distances, taken, CAREER_MAIN_RACES - (set?.legs.length ?? 0))

  if (maiden.length !== 1 || trials.length !== 2 || (!set && topUp.length === 0)) {
    const availableGrades = new Set(races.map((race) => race.grade)).size
    throw new Error(`Scenario goal content cannot supply a career (${races.length} races, ${availableGrades} grade buckets)`)
  }
  const mainGoals = [
    ...(set ? [setGoal(`goal:${tier}:main:1`, set)] : []),
    ...topUp.map((race, index) => winGoal(`goal:${tier}:main:${index + 1 + (set ? 1 : 0)}`, 'main', race)),
  ]
  const goals = [
    winGoal(`goal:${tier}:maiden`, 'maiden', maiden[0]!),
    ...trials.map((race, index) => winGoal(`goal:${tier}:trials:${index + 1}`, 'trials', race)),
    ...mainGoals,
  ]
  return { profile, main, journey: { tier, tracking: 'tracked', state: 'active', completedAt: null, goals } }
}

export const generateScenarioJourney = (input: GenerateScenarioJourneyInput): ScenarioJourney => planScenarioCareer(input).journey

const untouched = (journey: ScenarioJourney): boolean => journey.goals.every((goal) =>
  goal.status === 'active' && (goal.series?.legs.every((leg) => leg.status === 'active') ?? true))

/**
 * Upgrade an Uma to goal plan v3. Only the active scenario's journey can change, and only when nothing in it has
 * been won or missed: that one is regenerated as a career. A journey with progress keeps its frozen plan, and its
 * goals stay optional (D137). Migration invents no wins, misses, or rewards.
 */
export function upgradeGoalPlan(input: GenerateScenarioJourneyInput): UmaSave {
  const { uma } = input
  if (uma.goalPlanVersion >= SCENARIO_GOAL_VERSION) return uma
  const run = uma.scenarios.find((entry) => entry.tier === uma.unlockedTier)
  const journey = run?.journey
  const regenerate = run?.started === true && journey?.tracking === 'tracked' && journey.state === 'active' &&
    !isCareerJourney(journey) && untouched(journey) && tierOfLevel(uma.level) === run.tier
  return {
    ...uma,
    goalPlanVersion: SCENARIO_GOAL_VERSION,
    scenarios: regenerate
      ? uma.scenarios.map((entry) => entry.tier === run.tier ? { ...entry, journey: generateScenarioJourney(input) } : entry)
      : uma.scenarios,
  }
}

export interface EvaluateScenarioGoalsInput {
  journey: ScenarioJourney
  uma: UmaSave
  race: RaceTemplate
  resultId: string
  result: RaceResultRecord
  completedAt: number
}

export interface EvaluateScenarioGoalsResult {
  journey: ScenarioJourney
  newlyCompletedIds: string[]
}

export function evaluateScenarioGoals(input: EvaluateScenarioGoalsInput): EvaluateScenarioGoalsResult {
  const uma = parseUmaSave(input.uma)
  const result = parseRaceResultRecord(input.result)
  if (!uma || !result || !SAVE_ID_PATTERN.test(input.resultId) || !Number.isSafeInteger(input.completedAt) || input.completedAt < 0) {
    throw new Error('Scenario goal result input is malformed')
  }
  if (input.journey.tracking !== 'tracked' || input.journey.state !== 'active') return { journey: input.journey, newlyCompletedIds: [] }
  if (input.journey.tier !== tierOfLevel(uma.level) || result.umaId !== uma.templateId || tierOfLevel(result.startLevel) !== input.journey.tier ||
    result.raceId !== input.race.id) return { journey: input.journey, newlyCompletedIds: [] }
  const player = result.field.find((runner) => runner.isPlayer)
  if (!player || result.playerPlacement !== 1 || player.placement !== 1) return { journey: input.journey, newlyCompletedIds: [] }
  const second = result.field.find((runner) => runner.placement === 2)
  const newlyCompletedIds: string[] = []
  const goals = input.journey.goals.map((goal): ScenarioGoal => {
    if (goal.status !== 'active') return goal
    if (goal.kind === 'win-series') {
      const legIndex = goal.series!.legs.findIndex((leg) => leg.status === 'active' && leg.raceId === input.race.id)
      if (legIndex < 0) return goal
      const legs = goal.series!.legs.map((leg, index): ScenarioGoalLeg => index === legIndex ? {
        ...leg,
        status: 'completed',
        completedRaceResultId: input.resultId,
        completedAt: input.completedAt,
      } : leg)
      const completed = legs.every((leg) => leg.status === 'completed')
      if (completed) newlyCompletedIds.push(goal.id)
      return {
        ...goal,
        series: { ...goal.series!, legs },
        status: completed ? 'completed' : 'active',
        completedRaceResultId: completed ? input.resultId : null,
        completedAt: completed ? input.completedAt : null,
      }
    }
    if (goal.raceId !== input.race.id) return goal
    if (goal.kind === 'win-by-margin' && (!second || second.marginLengths < goal.minimumMarginLengths)) return goal
    newlyCompletedIds.push(goal.id)
    return { ...goal, status: 'completed', completedRaceResultId: input.resultId, completedAt: input.completedAt }
  })
  return { journey: { ...input.journey, goals }, newlyCompletedIds }
}

export function closeScenarioJourney(journey: ScenarioJourney, completedAt: number): ScenarioJourney {
  if (!Number.isSafeInteger(completedAt) || completedAt < 0) throw new Error('Scenario journey completion time is invalid')
  if (journey.state === 'completed') return journey
  return {
    ...journey,
    state: 'completed',
    completedAt,
    goals: journey.goals.map((goal): ScenarioGoal => goal.status !== 'active' ? goal : {
      ...goal,
      status: 'missed',
      series: goal.series ? {
        ...goal.series,
        legs: goal.series.legs.map((leg): ScenarioGoalLeg => leg.status === 'active' ? { ...leg, status: 'missed' } : leg),
      } : null,
    }),
  }
}

export function scenarioJourneySummary(journey: ScenarioJourney): { completed: number; missed: number; active: number; honors: boolean } {
  const completed = journey.goals.filter((goal) => goal.status === 'completed').length
  const missed = journey.goals.filter((goal) => goal.status === 'missed').length
  const active = journey.goals.filter((goal) => goal.status === 'active').length
  return { completed, missed, active, honors: journey.tracking === 'tracked' && journey.goals.length > 0 && completed === journey.goals.length }
}
