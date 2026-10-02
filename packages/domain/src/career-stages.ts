// A career's stages and the Uma Level each holds (docs/design/scenario-goals.md, D137). A leaf module, so the save's
// v13 migration can re-level through a career's holds without importing the whole careers module (D241).

import type { ScenarioJourney } from './save'
import { LEVELS_PER_SCENARIO, tierOfLevel } from './scenarios'

/** Goal plan v3+: a career's stages, in order (D137). */
export const CAREER_STAGES = ['maiden', 'trials', 'main'] as const
export type CareerStage = (typeof CAREER_STAGES)[number]

/** Levels into the scenario (1–10) each stage spans. An unfinished stage holds the Uma at its last level. */
export const CAREER_STAGE_LEVELS: Readonly<Record<CareerStage, { first: number; last: number }>> = {
  maiden: { first: 1, last: 2 },
  trials: { first: 3, last: 5 },
  main: { first: 6, last: 10 },
}

export const isCareerStage = (slot: string): slot is CareerStage => (CAREER_STAGES as readonly string[]).includes(slot)

/** Goal plan v3+ journeys. v1–v2 journeys keep their three optional slots and none of the stage rules. */
export const isCareerJourney = (journey: ScenarioJourney | null | undefined): journey is ScenarioJourney =>
  Boolean(journey && journey.goals.length > 0 && journey.goals.every((goal) => isCareerStage(goal.slot)))

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
