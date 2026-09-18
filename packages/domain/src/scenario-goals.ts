// Deterministic scenario goals and Journey facts (docs/design/scenario-goals.md).

import type { RaceTemplate, UmaTemplate } from './content'
import { parseRaceResultRecord, raceAttemptId, type RaceResultRecord } from './progression-race'
import { parseUmaSave, SAVE_ID_PATTERN, type GoalSlot, type ScenarioGoal, type ScenarioJourney, type UmaSave } from './save'
import { SCENARIOS, scenarioForTier, tierOfLevel } from './scenarios'
import { GRADES, RACE_GRADES, type RaceGrade } from './types'

export const SCENARIO_GOAL_VERSION = 1 as const
export const CHALLENGE_MARGIN_LENGTHS = 5 as const
export const SCENARIO_GOAL_SLOTS: readonly GoalSlot[] = ['aptitude', 'identity', 'challenge']

const GRADE_STRENGTH: readonly RaceGrade[] = ['debut', 'maiden', 'pre-op', 'op', 'g3', 'g2', 'g1']

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
  return [
    requested,
    ...GRADE_STRENGTH.slice(0, index).reverse(),
    ...GRADE_STRENGTH.slice(index + 1),
  ]
}

export function scenarioGoalAptitudeScore(uma: UmaSave, race: RaceTemplate): number {
  return GRADES.indexOf(uma.aptitudes.surface[race.surface]) + GRADES.indexOf(uma.aptitudes.distance[race.distanceCategory])
}

function hasIdentityAptitude(uma: UmaSave, race: RaceTemplate): boolean {
  return GRADES.indexOf(uma.aptitudes.surface[race.surface]) <= GRADES.indexOf('B') &&
    GRADES.indexOf(uma.aptitudes.distance[race.distanceCategory]) <= GRADES.indexOf('B')
}

function rotatedBest(
  uma: UmaSave,
  tier: number,
  slot: GoalSlot,
  candidates: readonly RaceTemplate[],
): RaceTemplate | null {
  if (candidates.length === 0) return null
  const bestScore = Math.min(...candidates.map((race) => scenarioGoalAptitudeScore(uma, race)))
  const best = candidates
    .filter((race) => scenarioGoalAptitudeScore(uma, race) === bestScore)
    .sort((left, right) => left.id.localeCompare(right.id))
  return best[stableHash(`${uma.templateId}:${tier}:${slot}`) % best.length]!
}

function selectAptitudeCandidate(
  uma: UmaSave,
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

function selectIdentityCandidate(
  uma: UmaSave,
  template: UmaTemplate,
  tier: number,
  races: readonly RaceTemplate[],
  excluded: ReadonlySet<string>,
): RaceTemplate | null {
  const families = new Set(template.signatureRaceFamilyIds)
  for (const grade of scenarioGoalGradeFallback(scenarioGoalRequestedGrade(tier, 'identity'))) {
    const selected = rotatedBest(
      uma,
      tier,
      'identity',
      races.filter((race) => race.grade === grade && !excluded.has(race.id) && families.has(race.familyId) && hasIdentityAptitude(uma, race)),
    )
    if (selected) return selected
  }
  return selectAptitudeCandidate(uma, tier, 'identity', races, excluded)
}

export function assertScenarioGoalContent(umas: readonly UmaTemplate[], races: readonly RaceTemplate[]): void {
  const families = new Set<string>()
  for (const race of races) {
    if (!SAVE_ID_PATTERN.test(race.id) || !/^\d+$/.test(race.familyId) || !RACE_GRADES.includes(race.grade)) {
      throw new Error('Scenario goal race content is malformed')
    }
    families.add(race.familyId)
  }
  for (const uma of umas) {
    if (!SAVE_ID_PATTERN.test(uma.id) || !SAVE_ID_PATTERN.test(uma.charaId) ||
      new Set(uma.signatureRaceFamilyIds).size !== uma.signatureRaceFamilyIds.length ||
      uma.signatureRaceFamilyIds.some((id) => !/^\d+$/.test(id) || !families.has(id))) {
      throw new Error('Scenario goal Uma content is malformed')
    }
  }
}

export interface GenerateScenarioJourneyInput {
  uma: UmaSave
  umaTemplate: UmaTemplate
  races: readonly RaceTemplate[]
}

/** Freeze three distinct goal targets from post-inheritance aptitudes and private content. */
export function generateScenarioJourney(input: GenerateScenarioJourneyInput): ScenarioJourney {
  const uma = input.uma.scenarioStarted
    ? parseUmaSave({ ...input.uma, scenarioStarted: false })
    : null
  if (!uma || input.uma.templateId !== input.umaTemplate.id) {
    throw new Error('Scenario goal Uma is malformed or has not started')
  }
  const tier = tierOfLevel(uma.level)
  if (!scenarioForTier(tier)) throw new Error('Scenario goal tier is unknown')
  assertScenarioGoalContent([input.umaTemplate], input.races)
  const races = [...input.races].sort((left, right) => left.id.localeCompare(right.id))
  const excluded = new Set<string>()
  const aptitude = selectAptitudeCandidate(uma, tier, 'aptitude', races, excluded)
  if (aptitude) excluded.add(aptitude.id)
  const identity = selectIdentityCandidate(uma, input.umaTemplate, tier, races, excluded)
  if (identity) excluded.add(identity.id)
  const challenge = selectAptitudeCandidate(uma, tier, 'challenge', races, excluded)
  if (!aptitude || !identity || !challenge) {
    const availableGrades = new Set(races.map((race) => race.grade)).size
    throw new Error(`Scenario goal content cannot supply 3 distinct targets (${races.length} races, ${availableGrades} grade buckets)`)
  }
  const selected = { aptitude, identity, challenge }
  const goals = SCENARIO_GOAL_SLOTS.map((slot): ScenarioGoal => ({
    id: `goal:${tier}:${slot}`,
    slot,
    raceId: selected[slot].id,
    kind: slot === 'challenge' ? 'win-by-margin' : 'win',
    minimumMarginLengths: slot === 'challenge' ? CHALLENGE_MARGIN_LENGTHS : 0,
    status: 'active',
    completedRaceResultId: null,
    completedAt: null,
  }))
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
    result.raceId !== input.race.id) {
    return { journey: input.journey, newlyCompletedIds: [] }
  }
  const player = result.field.find((runner) => runner.isPlayer)
  if (!player || result.playerPlacement !== 1 || player.placement !== 1) return { journey: input.journey, newlyCompletedIds: [] }
  const second = result.field.find((runner) => runner.placement === 2)
  const newlyCompletedIds: string[] = []
  const goals = input.journey.goals.map((goal) => {
    if (goal.status !== 'active' || goal.raceId !== input.race.id) return goal
    if (goal.kind === 'win-by-margin' && (!second || second.marginLengths < goal.minimumMarginLengths)) return goal
    newlyCompletedIds.push(goal.id)
    return { ...goal, status: 'completed' as const, completedRaceResultId: input.resultId, completedAt: input.completedAt }
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
    goals: journey.goals.map((goal) => goal.status === 'active' ? { ...goal, status: 'missed' } : goal),
  }
}

export function scenarioJourneySummary(journey: ScenarioJourney): {
  completed: number
  missed: number
  active: number
  honors: boolean
} {
  const completed = journey.goals.filter((goal) => goal.status === 'completed').length
  const missed = journey.goals.filter((goal) => goal.status === 'missed').length
  const active = journey.goals.filter((goal) => goal.status === 'active').length
  return { completed, missed, active, honors: journey.tracking === 'tracked' && completed === SCENARIO_GOAL_SLOTS.length }
}

export interface BootstrapScenarioGoalsInput {
  uma: UmaSave
  umaTemplate: UmaTemplate
  races: readonly RaceTemplate[]
  raceHistory: readonly RaceResultRecord[]
}

/** Honest one-time v0→v1 goal-plan bootstrap. Earlier tiers stay explicitly untracked. */
export function bootstrapScenarioGoals(input: BootstrapScenarioGoalsInput): UmaSave {
  const parsed = parseUmaSave(input.uma)
  if (!parsed || parsed.templateId !== input.umaTemplate.id) throw new Error('Goal bootstrap Uma is malformed')
  if (parsed.goalPlanVersion === SCENARIO_GOAL_VERSION) return parsed
  if (parsed.goalPlanVersion !== 0) throw new Error('Goal bootstrap version is unsupported')
  if (!parsed.scenarioStarted) return { ...parsed, goalPlanVersion: SCENARIO_GOAL_VERSION, scenarioJourneys: [] }

  const currentTier = tierOfLevel(parsed.level)
  const finalComplete = currentTier === SCENARIOS.length && parsed.parentSnapshot?.completedTier === currentTier
  const completedThrough = finalComplete ? currentTier : currentTier - 1
  const byTier = new Map(parsed.scenarioJourneys.map((journey) => [journey.tier, journey]))
  for (let tier = 1; tier <= completedThrough; tier += 1) {
    if (!byTier.has(tier)) byTier.set(tier, { tier, tracking: 'legacy-untracked', state: 'completed', completedAt: null, goals: [] })
  }
  if (finalComplete) {
    return { ...parsed, goalPlanVersion: SCENARIO_GOAL_VERSION, scenarioJourneys: [...byTier.values()].sort((a, b) => a.tier - b.tier) }
  }

  const provisional: UmaSave = {
    ...parsed,
    scenarioJourneys: [...byTier.values()].filter((journey) => journey.tier !== currentTier).sort((a, b) => a.tier - b.tier),
  }
  let journey = generateScenarioJourney({ uma: provisional, umaTemplate: input.umaTemplate, races: input.races })
  const currentResults = input.raceHistory
    .filter((record) => record.umaId === parsed.templateId && tierOfLevel(record.startLevel) === currentTier)
    .sort((left, right) => left.sequence - right.sequence)
  for (const result of currentResults) {
    const race = input.races.find((candidate) => candidate.id === result.raceId)
    if (!race) continue
    journey = evaluateScenarioGoals({
      journey,
      uma: { ...provisional, scenarioJourneys: [journey] },
      race,
      resultId: raceAttemptId(result.umaId, result.sequence),
      result,
      completedAt: result.createdAt,
    }).journey
  }
  return {
    ...parsed,
    goalPlanVersion: SCENARIO_GOAL_VERSION,
    scenarioJourneys: [...provisional.scenarioJourneys, journey],
  }
}
