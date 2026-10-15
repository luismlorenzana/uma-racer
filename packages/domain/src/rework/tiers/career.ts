// Her career in each scenario (docs/rework/03-uma-progression.md §4, D137): today's planner, unchanged, frozen when she
// arrives in a scenario. The planner reads a today's Uma, so `careerView` shows it one: her template, her race
// preferences and the lifetime level of the scenario's first level, which equals today's Uma Level at the same T.
import type { RaceTemplate, UmaTemplate } from '../../content'
import { INSPIRATION_SLOTS } from '../../inspiration'
import { lineageAptitudes } from '../../lineage'
import { SAVE_SCHEMA_VERSION, SCENARIO_GOAL_VERSION, createScenarioTraining, type ScenarioGoal, type ScenarioGoalLeg,
  type ScenarioJourney, type UmaSave } from '../../career-shapes'
import { planScenarioCareer } from '../../scenario-goals'
import type { Aptitudes } from '../../types'
import type { UmaState } from '../types'
import { firstLevel, lifetimeLevel, scenarioPlayable, tierAndScenario } from './map'

/** The private content the tier rules read, as phase 3's parsers deliver it. */
export interface TierContent {
  readonly umas: ReadonlyMap<string, UmaTemplate>
  readonly races: readonly RaceTemplate[]
}

/** What freezing a career reads of her: who she is, her race defaults and her build's lineage. */
export type CareerSubject = Pick<UmaState, 'outfitId' | 'raceDefaults' | 'build'>

/** Her template; a missing one is a caller's bug (the parsers keep it out). */
export function umaTemplate(content: TierContent, outfitId: string): UmaTemplate {
  const template = content.umas.get(outfitId)
  if (!template) throw new RangeError(`No Uma template ${outfitId}`)
  return template
}

/**
 * Today's Uma at scenario T, as the planner reads her: her template id, her race preferences and selected preset, at
 * the lifetime level of the scenario's first level, with everything else neutral.
 */
export function careerView(uma: CareerSubject, T: number): UmaSave {
  const at = tierAndScenario(T)
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    templateId: uma.outfitId,
    level: lifetimeLevel(at.tier, firstLevel(at.scenario)),
    exp: 0,
    unlockedTier: T,
    scenarios: [createScenarioTraining(T)],
    skillHistory: [],
    goalPlanVersion: SCENARIO_GOAL_VERSION,
    activePreset: uma.raceDefaults.selectedPreset,
    racePreferences: uma.raceDefaults.preferences,
  }
}

/** Her aptitudes for the career: today's lineage rule over her selected preset's filled open slots (D252, D123). */
export function careerAptitudes(uma: CareerSubject, content: TierContent): Aptitudes {
  const template = umaTemplate(content, uma.outfitId)
  const lineage = uma.build.presets[uma.raceDefaults.selectedPreset].lineage
  const open = new Set(uma.build.inspiration.slots)
  const parents = INSPIRATION_SLOTS.flatMap((slot) => {
    const id = lineage[slot]
    return open.has(slot) && id !== undefined ? [umaTemplate(content, id)] : []
  })
  return lineageAptitudes(template.aptitudes, parents)
}

/** Freeze her career for scenario T with today's planner. T must be playable: operations refuse the 15th first. */
export function freezeCareer(uma: CareerSubject, T: number, content: TierContent): ScenarioJourney {
  if (!scenarioPlayable(T)) throw new RangeError(`Scenario ${T} has no career yet`)
  return planScenarioCareer({
    uma: careerView(uma, T),
    umaTemplate: umaTemplate(content, uma.outfitId),
    aptitudes: careerAptitudes(uma, content),
    races: content.races,
  }).journey
}

/**
 * Settle a won race against her career: a single goal on that race is won, and so is an open leg of a set, which
 * completes the set with its last leg. Careers since goal plan v3 hold only `win` and `win-series` goals (D137), so a
 * legacy margin goal is left as it is.
 */
export function settleGoalWin(
  career: ScenarioJourney,
  raceId: string,
  resultId: string,
  at: number,
): { career: ScenarioJourney; completedGoalIds: string[] } {
  if (career.tracking !== 'tracked' || career.state !== 'active') return { career, completedGoalIds: [] }
  const completedGoalIds: string[] = []
  let changed = false
  const goals = career.goals.map((goal): ScenarioGoal => {
    if (goal.status !== 'active') return goal
    if (goal.kind === 'win-series' && goal.series) {
      const legIndex = goal.series.legs.findIndex((leg) => leg.status === 'active' && leg.raceId === raceId)
      if (legIndex < 0) return goal
      changed = true
      const legs = goal.series.legs.map((leg, index): ScenarioGoalLeg =>
        index === legIndex ? { ...leg, status: 'completed', completedRaceResultId: resultId, completedAt: at } : leg)
      const completed = legs.every((leg) => leg.status === 'completed')
      if (completed) completedGoalIds.push(goal.id)
      return {
        ...goal,
        series: { ...goal.series, legs },
        status: completed ? 'completed' : 'active',
        completedRaceResultId: completed ? resultId : null,
        completedAt: completed ? at : null,
      }
    }
    if (goal.kind !== 'win' || goal.raceId !== raceId) return goal
    changed = true
    completedGoalIds.push(goal.id)
    return { ...goal, status: 'completed', completedRaceResultId: resultId, completedAt: at }
  })
  return { career: changed ? { ...career, goals } : career, completedGoalIds }
}
