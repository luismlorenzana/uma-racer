// Deterministic scenario goals and Journey facts (docs/design/scenario-goals.md).

import {
  FLAIR_SERIES_TAGS,
  flairSeriesLegId,
  parseFlairSeriesLegId,
  type FlairSeriesTag,
} from './badges'
import type { RaceTemplate, UmaTemplate } from './content'
import { parseRaceResultRecord, raceAttemptId, type RaceResultRecord } from './progression-race'
import {
  parseUmaSave,
  SAVE_ID_PATTERN,
  type GoalSlot,
  type ScenarioGoal,
  type ScenarioGoalLeg,
  type ScenarioJourney,
  type UmaSave,
} from './save'
import { isGateLevel, scenarioForTier, tierOfLevel } from './scenarios'
import { GRADES, RACE_GRADES, type RaceGrade, type Aptitudes } from './types'

export const SCENARIO_GOAL_VERSION = 2 as const
export const CHALLENGE_MARGIN_LENGTHS = 5 as const
export const SCENARIO_GOAL_SLOTS: readonly GoalSlot[] = ['aptitude', 'identity', 'challenge']

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

const GRADE_STRENGTH: readonly RaceGrade[] = ['debut', 'maiden', 'pre-op', 'op', 'g3', 'g2', 'g1']
const LATE_SERIES_ROTATION: readonly FlairSeriesTag[] = [
  'spring-triple-crown',
  'autumn-triple-crown',
  'grand-prix',
  'sprint-crown',
  'mile-crown',
  'dirt-crown',
]

export function scenarioGoalSeriesRotation(realHorseSex: UmaTemplate['realHorseSex']): FlairSeriesTag[] {
  const classic = realHorseSex === 'male' ? 'triple-crown' : realHorseSex === 'female' ? 'triple-tiara' : null
  return classic ? [classic, ...LATE_SERIES_ROTATION] : [...LATE_SERIES_ROTATION]
}

export function stableHash(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function scenarioGoalRequestedGrade(tier: number, slot: GoalSlot): RaceGrade {
  if (!scenarioForTier(tier)) throw new Error('Scenario goal tier is unknown')
  if (tier === 1) return slot === 'aptitude' ? 'pre-op' : 'op'
  if (tier === 2) return 'g3'
  if (tier === 3) return 'g2'
  return 'g1'
}

/** Requested grade, then nearest weaker grades, then nearest stronger grades. */
export function scenarioGoalGradeFallback(requested: RaceGrade): RaceGrade[] {
  const index = GRADE_STRENGTH.indexOf(requested)
  if (index < 0) throw new Error('Scenario goal requested grade is invalid')
  return [requested, ...GRADE_STRENGTH.slice(0, index).reverse(), ...GRADE_STRENGTH.slice(index + 1)]
}

/** What goal selection reads. Aptitudes come from the constellation, so they are passed in (D121). */
export interface GoalSubject {
  templateId: string
  level: number
  aptitudes: Aptitudes
  /** Journeys of every scenario this Uma has reached. */
  journeys: readonly ScenarioJourney[]
}

export const goalSubject = (uma: UmaSave, aptitudes: Aptitudes): GoalSubject => ({
  templateId: uma.templateId,
  level: uma.level,
  aptitudes,
  journeys: uma.scenarios.map((run) => run.journey).filter((j): j is ScenarioJourney => j !== null),
})

export function scenarioGoalAptitudeScore(uma: GoalSubject, race: RaceTemplate): number {
  return GRADES.indexOf(uma.aptitudes.surface[race.surface]) + GRADES.indexOf(uma.aptitudes.distance[race.distanceCategory])
}

function hasIdentityAptitude(uma: GoalSubject, race: RaceTemplate): boolean {
  return GRADES.indexOf(uma.aptitudes.surface[race.surface]) <= GRADES.indexOf('B') &&
    GRADES.indexOf(uma.aptitudes.distance[race.distanceCategory]) <= GRADES.indexOf('B')
}

function rotatedBest(uma: GoalSubject, tier: number, slot: GoalSlot, candidates: readonly RaceTemplate[]): RaceTemplate | null {
  if (candidates.length === 0) return null
  const bestScore = Math.min(...candidates.map((race) => scenarioGoalAptitudeScore(uma, race)))
  const best = candidates.filter((race) => scenarioGoalAptitudeScore(uma, race) === bestScore)
  const famous = best.filter((race) => race.series.length > 0)
  const pool = (famous.length > 0 ? famous : best).sort((left, right) => left.id.localeCompare(right.id))
  return pool[stableHash(`${uma.templateId}:${tier}:${slot}`) % pool.length]!
}

function selectAptitudeCandidate(
  uma: GoalSubject,
  tier: number,
  slot: GoalSlot,
  races: readonly RaceTemplate[],
  excluded: ReadonlySet<string>,
): RaceTemplate | null {
  for (const grade of scenarioGoalGradeFallback(scenarioGoalRequestedGrade(tier, slot))) {
    const selected = rotatedBest(uma, tier, slot, races.filter((race) => race.grade === grade && !excluded.has(race.id)))
    if (selected) return selected
  }
  return null
}

function earlierIdentityFacts(uma: GoalSubject, tier: number, races: readonly RaceTemplate[]): {
  families: ReadonlySet<string>
  legs: ReadonlySet<string>
} {
  const racesById = new Map(races.map((race) => [race.id, race]))
  const selected = uma.journeys
    .filter((journey) => journey.tracking === 'tracked' && journey.tier < tier)
    .flatMap((journey) => journey.goals.filter((goal) => goal.slot === 'identity'))
    .flatMap((goal) => goal.series?.legs.map((leg) => leg.raceId) ?? (goal.raceId ? [goal.raceId] : []))
    .map((raceId) => racesById.get(raceId))
    .filter((race): race is RaceTemplate => race !== undefined)
  return {
    families: new Set(selected.map((race) => race.familyId)),
    legs: new Set(selected.flatMap((race) => race.seriesLegs)),
  }
}

function orderedLegKeys(tag: FlairSeriesTag, races: readonly RaceTemplate[]): string[] {
  const covered = new Set(races.flatMap((race) => race.seriesLegs)
    .map(parseFlairSeriesLegId)
    .filter((leg): leg is { tag: FlairSeriesTag; key: string } => leg?.tag === tag)
    .map((leg) => leg.key))
  const documented = SCENARIO_SERIES_LEG_ORDER[tag].filter((key) => covered.has(key))
  return documented.length === covered.size ? documented : [...covered].sort()
}

function selectCareerOrClassic(
  uma: GoalSubject,
  template: UmaTemplate,
  tier: number,
  races: readonly RaceTemplate[],
  excluded: ReadonlySet<string>,
): RaceTemplate | null {
  const used = earlierIdentityFacts(uma, tier, races)
  for (const familyId of template.signatureRaceFamilyIds) {
    if (used.families.has(familyId)) continue
    const selected = rotatedBest(uma, tier, 'identity', races.filter((race) =>
      race.familyId === familyId && !excluded.has(race.id) && hasIdentityAptitude(uma, race)))
    if (selected) return selected
  }

  const classic = template.realHorseSex === 'male' ? 'triple-crown' : template.realHorseSex === 'female' ? 'triple-tiara' : null
  if (classic) {
    for (const key of orderedLegKeys(classic, races)) {
      const legId = flairSeriesLegId(classic, key)
      if (used.legs.has(legId)) continue
      const selected = rotatedBest(uma, tier, 'identity', races.filter((race) =>
        race.seriesLegs.includes(legId) && !excluded.has(race.id) && hasIdentityAptitude(uma, race)))
      if (selected) return selected
    }
  }
  return selectAptitudeCandidate(uma, tier, 'identity', races, excluded)
}

interface SeriesCandidate {
  tag: FlairSeriesTag
  legs: { key: string; race: RaceTemplate }[]
  eligible: boolean
  score: number
}

function seriesCandidate(
  tag: FlairSeriesTag,
  uma: GoalSubject,
  tier: number,
  races: readonly RaceTemplate[],
  excluded: ReadonlySet<string>,
): SeriesCandidate | null {
  const keys = orderedLegKeys(tag, races)
  if (keys.length < 2 || keys.length > 3) return null
  const legs: SeriesCandidate['legs'] = []
  const taken = new Set(excluded)
  for (const key of keys) {
    const legId = flairSeriesLegId(tag, key)
    const race = rotatedBest(uma, tier, 'identity', races.filter((candidate) =>
      candidate.seriesLegs.includes(legId) && !taken.has(candidate.id)))
    if (!race) return null
    legs.push({ key, race })
    taken.add(race.id)
  }
  return {
    tag,
    legs,
    eligible: legs.every((leg) => hasIdentityAptitude(uma, leg.race)),
    score: legs.reduce((sum, leg) => sum + scenarioGoalAptitudeScore(uma, leg.race), 0),
  }
}

function selectSeriesCandidate(
  uma: GoalSubject,
  template: UmaTemplate,
  tier: number,
  races: readonly RaceTemplate[],
  excluded: ReadonlySet<string>,
): SeriesCandidate | null {
  const rotation = scenarioGoalSeriesRotation(template.realHorseSex)
  if (rotation.length === 0) return null
  const offset = (tier - 7) % rotation.length
  const ordered = [...rotation.slice(offset), ...rotation.slice(0, offset)]
  const candidates = ordered.map((tag) => seriesCandidate(tag, uma, tier, races, excluded))
    .filter((candidate): candidate is SeriesCandidate => candidate !== null)
  return candidates.find((candidate) => candidate.eligible) ??
    [...candidates].sort((left, right) => left.score - right.score || ordered.indexOf(left.tag) - ordered.indexOf(right.tag))[0] ?? null
}

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
  /** Post-lineage aptitudes from the constellation the goals are being frozen against. */
  aptitudes: Aptitudes
  races: readonly RaceTemplate[]
}

function singleGoal(tier: number, slot: GoalSlot, race: RaceTemplate): ScenarioGoal {
  return {
    id: `goal:${tier}:${slot}`,
    slot,
    raceId: race.id,
    kind: slot === 'challenge' ? 'win-by-margin' : 'win',
    series: null,
    minimumMarginLengths: slot === 'challenge' ? CHALLENGE_MARGIN_LENGTHS : 0,
    status: 'active',
    completedRaceResultId: null,
    completedAt: null,
  }
}

function seriesGoal(tier: number, selected: SeriesCandidate): ScenarioGoal {
  return {
    id: `goal:${tier}:identity`,
    slot: 'identity',
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

/** Freeze three distinct goal targets from post-inheritance aptitudes and private content. */
export function generateScenarioJourney(input: GenerateScenarioJourneyInput): ScenarioJourney {
  if (input.uma.templateId !== input.umaTemplate.id) throw new Error('Scenario goal Uma is malformed')
  const uma = goalSubject(input.uma, input.aptitudes)
  const tier = tierOfLevel(uma.level)
  if (!scenarioForTier(tier)) throw new Error('Scenario goal tier is unknown')
  assertScenarioGoalContent([input.umaTemplate], input.races)
  const races = [...input.races].sort((left, right) => left.id.localeCompare(right.id))
  const excluded = new Set<string>()
  const aptitude = selectAptitudeCandidate(uma, tier, 'aptitude', races, excluded)
  if (aptitude) excluded.add(aptitude.id)

  const selectedSeries = tier >= 7 ? selectSeriesCandidate(uma, input.umaTemplate, tier, races, excluded) : null
  const identity = selectedSeries ? null : selectCareerOrClassic(uma, input.umaTemplate, tier, races, excluded)
  if (selectedSeries) for (const leg of selectedSeries.legs) excluded.add(leg.race.id)
  if (identity) excluded.add(identity.id)
  const challenge = selectAptitudeCandidate(uma, tier, 'challenge', races, excluded)
  if (!aptitude || (!selectedSeries && !identity) || !challenge) {
    const availableGrades = new Set(races.map((race) => race.grade)).size
    throw new Error(`Scenario goal content cannot supply 3 distinct targets (${races.length} races, ${availableGrades} grade buckets)`)
  }
  const goals = [
    singleGoal(tier, 'aptitude', aptitude),
    selectedSeries ? seriesGoal(tier, selectedSeries) : singleGoal(tier, 'identity', identity!),
    singleGoal(tier, 'challenge', challenge),
  ]
  return { tier, tracking: 'tracked', state: 'active', completedAt: null, goals }
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
  return { completed, missed, active, honors: journey.tracking === 'tracked' && completed === SCENARIO_GOAL_SLOTS.length }
}
