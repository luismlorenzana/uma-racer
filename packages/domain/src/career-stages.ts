// A career's stages (docs/design/scenario-goals.md, D137): Maiden, Trials and Main. A leaf module, so the career
// shapes can name the stages without importing the generator (D241).

import type { ScenarioJourney } from './career-shapes'

/** A career's stages, in order (D137). */
export const CAREER_STAGES = ['maiden', 'trials', 'main'] as const
export type CareerStage = (typeof CAREER_STAGES)[number]

export const isCareerStage = (slot: string): slot is CareerStage => (CAREER_STAGES as readonly string[]).includes(slot)

/** A journey whose goals are all career stages. */
export const isCareerJourney = (journey: ScenarioJourney | null | undefined): journey is ScenarioJourney =>
  Boolean(journey && journey.goals.length > 0 && journey.goals.every((goal) => isCareerStage(goal.slot)))
