// The shapes the career generator writes (docs/design/scenario-goals.md, D137): a frozen journey of goals, each one
// race or one race set. Kept from generation 2's Uma save by T152 (D381); the generation-3 career record places these
// goals on its calendar (T154).

import type { FlairSeriesTag } from './race-series'
import { CAREER_STAGES, type CareerStage } from './career-stages'
import type { DistanceCategory, Strategy, Surface } from './types'

export const SAVE_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/

export type SkillOrigin = 'own-unique' | 'awakening' | 'card' | 'inherited'

export interface SkillUnlock {
  skillId: string
  origin: SkillOrigin
  sourceId: string | null
}

export { CAREER_STAGES, type CareerStage }
export type GoalSlot = CareerStage
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

export interface RacePreferences {
  strategy: Strategy
  distance: DistanceCategory
  surface: Surface
}
