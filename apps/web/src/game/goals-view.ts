// Pure Home, Race, Results, and Journey projections for T014 scenario goals.

import { activeScenario, SCENARIOS, SCENARIO_SERIES_LABELS, scenarioJourneySummary, type RaceResultRecord, type RaceTemplate, type ScenarioGoal, type ScenarioJourney, type UmaSave } from '@racer/domain'
import type { LoadedContent } from '../content/runtime'

/** Every journey an Uma has, in tier order. Journeys live on their scenario run now (D122). */
const journeysOf = (uma: UmaSave): ScenarioJourney[] =>
  uma.scenarios
    .map((run) => run.journey)
    .filter((journey): journey is ScenarioJourney => journey !== null)
    .sort((left, right) => left.tier - right.tier)

const SLOT_ORDER = { aptitude: 0, identity: 1, challenge: 2 } as const
const SLOT_LABEL = { aptitude: 'Aptitude', identity: 'Identity', challenge: 'Challenge' } as const

export interface GoalView {
  id: string
  slot: ScenarioGoal['slot']
  label: string
  raceId: string | null
  raceName: string
  race: RaceTemplate | null
  rule: string
  status: ScenarioGoal['status']
  completedRaceResultId: string | null
  pips: { key: string; status: ScenarioGoal['status']; raceId: string; raceName: string; missing: boolean }[]
  seriesName: string | null
}

export function goalView(goal: ScenarioGoal, content: LoadedContent, targetRaceId?: string): GoalView {
  const pips = goal.series?.legs.map((leg) => {
    const target = content.races.byId.get(leg.raceId)
    return { key: leg.key, status: leg.status, raceId: leg.raceId, raceName: target?.name ?? leg.raceId, missing: target === undefined }
  }) ?? []
  const selectedRaceId = targetRaceId ?? goal.raceId ?? goal.series?.legs.find((leg) => leg.status === 'active')?.raceId ?? goal.series?.legs[0]?.raceId ?? null
  const race = selectedRaceId ? content.races.byId.get(selectedRaceId) ?? null : null
  const seriesName = goal.series ? SCENARIO_SERIES_LABELS[goal.series.tag] : null
  const completedLegs = pips.filter((pip) => pip.status === 'completed').length
  return {
    id: goal.id,
    slot: goal.slot,
    label: SLOT_LABEL[goal.slot],
    raceId: selectedRaceId,
    raceName: seriesName ?? race?.name ?? selectedRaceId ?? 'Missing target',
    race,
    rule: goal.kind === 'win-by-margin' ? `Win by ${goal.minimumMarginLengths}+ lengths`
      : goal.series ? `${race?.name ?? 'Series leg'} · ${completedLegs} / ${pips.length} legs won` : 'Finish 1st',
    status: goal.status,
    completedRaceResultId: goal.completedRaceResultId,
    pips,
    seriesName,
  }
}

export function activeJourney(uma: UmaSave): ScenarioJourney | null {
  const journey = activeScenario(uma).journey
  return journey?.state === 'active' ? journey : null
}

export type HomeGoalState =
  | { kind: 'pending'; detail: string }
  | { kind: 'legacy-untracked'; detail: string }
  | { kind: 'complete'; detail: string }
  | { kind: 'none'; detail: string }
  | { kind: 'active'; tier: number; goals: GoalView[]; completed: number; missingTargets: number }

export function buildHomeGoalState(uma: UmaSave, content: LoadedContent): HomeGoalState {
  if (!activeScenario(uma).started) return { kind: 'pending', detail: 'Goals appear once this scenario starts.' }
  const journey = activeJourney(uma)
  if (journey?.tracking === 'tracked') {
    const goals = journey.goals.map((goal) => goalView(goal, content))
    return {
      kind: 'active', tier: journey.tier, goals,
      completed: goals.filter((goal) => goal.status === 'completed').length,
      missingTargets: goals.reduce((sum, goal) => sum + (goal.pips.length > 0 ? goal.pips.filter((pip) => pip.missing).length : Number(goal.race === null)), 0),
    }
  }
  const current = activeScenario(uma).journey
  if (current?.tracking === 'legacy-untracked') return { kind: 'legacy-untracked', detail: 'This scenario predates goal tracking.' }
  if (current?.state === 'completed') return { kind: 'complete', detail: 'Latest scenario complete.' }
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
  const byTier = new Map(journeysOf(uma).map((journey) => [journey.tier, journey]))
  return Array.from({ length: uma.unlockedTier }, (_, index) => index + 1).map((tier) => {
    const name = SCENARIOS[tier - 1]?.name ?? `Tier ${tier}`
    const journey = byTier.get(tier)
    if (!journey) return {
      tier, name, tracking: 'missing' as const, state: 'missing' as const,
      goals: [], completed: 0, missed: 0, active: 0, honors: false,
    }
    return {
      tier, name, tracking: journey.tracking, state: journey.state,
      goals: journey.goals.map((goal) => goalView(goal, content)), ...scenarioJourneySummary(journey),
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
    const targets = goal.series?.legs.filter((leg) => leg.status === 'active').map((leg) => leg.raceId) ?? (goal.raceId ? [goal.raceId] : [])
    for (const raceId of targets) {
      const entries = goalsByRace.get(raceId) ?? []
      if (!entries.some((entry) => entry.id === goal.id)) entries.push(goalView(goal, content, raceId))
      goalsByRace.set(raceId, entries)
    }
  }
  return races
    .filter((race) => !goalsOnly || goalsByRace.has(race.id))
    .map((race) => ({ race, goals: (goalsByRace.get(race.id) ?? []).sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]) }))
    .sort((left, right) => Number(right.goals.length > 0) - Number(left.goals.length > 0))
}

export function goalsAtStake(uma: UmaSave, raceId: string, content: LoadedContent): GoalView[] {
  return (activeJourney(uma)?.goals ?? [])
    .filter((goal) => goal.status === 'active' && (goal.raceId === raceId || goal.series?.legs.some((leg) => leg.status === 'active' && leg.raceId === raceId)))
    .sort((left, right) => SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot])
    .map((goal) => goalView(goal, content, raceId))
}

export function buildResultGoalView(
  record: RaceResultRecord,
  uma: UmaSave,
  content: LoadedContent,
  freshCommit: boolean,
): { completions: GoalView[]; honors: boolean; animate: boolean; completed: number } {
  const ids = record.completedGoalIds ?? []
  const allGoals = journeysOf(uma).flatMap((journey) => journey.goals)
  const completions = ids.map((id) => allGoals.find((goal) => goal.id === id))
    .filter((goal): goal is ScenarioGoal => goal !== undefined)
    .sort((left, right) => SLOT_ORDER[left.slot] - SLOT_ORDER[right.slot])
    .map((goal) => goalView(goal, content))
  const journey = journeysOf(uma).find((item) => item.goals.some((goal) => ids.includes(goal.id)))
  const summary = journey ? scenarioJourneySummary(journey) : { completed: 0, honors: false }
  return { completions, honors: summary.honors, completed: summary.completed, animate: freshCommit && completions.length > 0 }
}
