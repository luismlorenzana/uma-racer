// Pure Home, Race, Results, and Journey projections for T014 scenario goals.

import { SCENARIOS, scenarioJourneySummary, tierOfLevel, type RaceResultRecord, type RaceTemplate, type ScenarioGoal, type ScenarioJourney, type UmaSave } from '@racer/domain'
import type { LoadedContent } from '../content/runtime'

const SLOT_ORDER = { aptitude: 0, identity: 1, challenge: 2 } as const
const SLOT_LABEL = { aptitude: 'Aptitude', identity: 'Identity', challenge: 'Challenge' } as const

export interface GoalView {
  id: string
  slot: ScenarioGoal['slot']
  label: string
  raceId: string
  raceName: string
  race: RaceTemplate | null
  rule: string
  status: ScenarioGoal['status']
  completedRaceResultId: string | null
}

export function goalView(goal: ScenarioGoal, content: LoadedContent): GoalView {
  const race = content.races.byId.get(goal.raceId) ?? null
  return {
    id: goal.id,
    slot: goal.slot,
    label: SLOT_LABEL[goal.slot],
    raceId: goal.raceId,
    raceName: race?.name ?? goal.raceId,
    race,
    rule: goal.kind === 'win-by-margin' ? `Win by ${goal.minimumMarginLengths}+ lengths` : 'Finish 1st',
    status: goal.status,
    completedRaceResultId: goal.completedRaceResultId,
  }
}

export function activeJourney(uma: UmaSave): ScenarioJourney | null {
  const tier = tierOfLevel(uma.level)
  return uma.scenarioJourneys.find((journey) => journey.tier === tier && journey.state === 'active') ?? null
}

export type HomeGoalState =
  | { kind: 'pending'; detail: string }
  | { kind: 'legacy-untracked'; detail: string }
  | { kind: 'complete'; detail: string }
  | { kind: 'none'; detail: string }
  | { kind: 'active'; tier: number; goals: GoalView[]; completed: number; missingTargets: number }

export function buildHomeGoalState(uma: UmaSave, content: LoadedContent): HomeGoalState {
  if (!uma.scenarioStarted) return { kind: 'pending', detail: 'Goals appear after Scenario Start.' }
  const journey = activeJourney(uma)
  if (journey?.tracking === 'tracked') {
    const goals = journey.goals.map((goal) => goalView(goal, content))
    return {
      kind: 'active', tier: journey.tier, goals,
      completed: goals.filter((goal) => goal.status === 'completed').length,
      missingTargets: goals.filter((goal) => goal.race === null).length,
    }
  }
  const current = uma.scenarioJourneys.find((item) => item.tier === tierOfLevel(uma.level))
  if (current?.tracking === 'legacy-untracked') return { kind: 'legacy-untracked', detail: 'This scenario predates goal tracking.' }
  if (uma.parentSnapshot?.completedTier === tierOfLevel(uma.level)) return { kind: 'complete', detail: 'Latest scenario complete.' }
  return { kind: 'none', detail: 'No active goal plan is available.' }
}

export interface JourneyMedallionView {
  tier: number
  name: string
  tracking: ScenarioJourney['tracking'] | 'missing'
  state: ScenarioJourney['state'] | 'missing'
  goals: GoalView[]
  completed: number
  missed: number
  active: number
  honors: boolean
}

export function buildJourneyView(uma: UmaSave, content: LoadedContent): JourneyMedallionView[] {
  return Array.from({ length: tierOfLevel(uma.level) }, (_, index) => index + 1).map((tier) => {
    const journey = uma.scenarioJourneys.find((item) => item.tier === tier)
    if (!journey) return {
      tier, name: SCENARIOS[tier - 1]?.name ?? `Tier ${tier}`, tracking: 'missing' as const, state: 'missing' as const,
      goals: [], completed: 0, missed: 0, active: 0, honors: false,
    }
    const summary = scenarioJourneySummary(journey)
    return {
      tier, name: SCENARIOS[tier - 1]?.name ?? `Tier ${tier}`, tracking: journey.tracking, state: journey.state,
      goals: journey.goals.map((goal) => goalView(goal, content)), ...summary,
    }
  })
}

export interface GoalRaceView {
  race: RaceTemplate
  goals: GoalView[]
}

export function buildGoalRaceCatalog(
  races: readonly RaceTemplate[],
  uma: UmaSave,
  content: LoadedContent,
  goalsOnly = false,
): GoalRaceView[] {
  const journey = activeJourney(uma)
  const activeGoals = journey?.tracking === 'tracked' ? journey.goals.filter((goal) => goal.status === 'active') : []
  const goalsByRace = new Map<string, GoalView[]>()
  for (const goal of activeGoals) {
    const entries = goalsByRace.get(goal.raceId) ?? []
    entries.push(goalView(goal, content))
    goalsByRace.set(goal.raceId, entries)
  }
  return races
    .filter((race) => !goalsOnly || goalsByRace.has(race.id))
    .map((race) => ({ race, goals: (goalsByRace.get(race.id) ?? []).sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]) }))
    .sort((left, right) => Number(right.goals.length > 0) - Number(left.goals.length > 0))
}

export function goalsAtStake(uma: UmaSave, raceId: string, content: LoadedContent): GoalView[] {
  return (activeJourney(uma)?.goals ?? [])
    .filter((goal) => goal.status === 'active' && goal.raceId === raceId)
    .sort((left, right) => SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot])
    .map((goal) => goalView(goal, content))
}

export function buildResultGoalView(
  record: RaceResultRecord,
  uma: UmaSave,
  content: LoadedContent,
  freshCommit: boolean,
): { completions: GoalView[]; honors: boolean; animate: boolean; completed: number } {
  const ids = record.completedGoalIds ?? []
  const allGoals = uma.scenarioJourneys.flatMap((journey) => journey.goals)
  const completions = ids.map((id) => allGoals.find((goal) => goal.id === id))
    .filter((goal): goal is ScenarioGoal => goal !== undefined)
    .sort((left, right) => SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot])
    .map((goal) => goalView(goal, content))
  const journey = uma.scenarioJourneys.find((item) => item.goals.some((goal) => ids.includes(goal.id)))
  const summary = journey ? scenarioJourneySummary(journey) : { completed: 0, honors: false }
  return { completions, honors: summary.honors, completed: summary.completed, animate: freshCommit && completions.length > 0 }
}
