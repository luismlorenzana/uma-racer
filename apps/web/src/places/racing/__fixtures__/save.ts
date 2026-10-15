// Shared test fixture for building Uma saves (docs/design/uma-progression.md).

import {
  DISTANCE_CATEGORIES,
  createUmaSave,
  trainedScenario,
  withScenarioView,
  type BadgeSubject,
  type NodeAssignment,
  type ScenarioJourney,
  type UmaSave,
  type UmaTemplate,
} from '@racer/domain'

export interface RunOverrides {
  started?: boolean
  trainingLevel?: number
  trainingExp?: number
  cardSetIds?: string[]
  assignments?: Record<string, NodeAssignment>
  loadoutSkillIds?: string[]
  journey?: ScenarioJourney | null
}

/** A save whose active scenario run carries the given overrides. */
export function umaFixture(
  template: UmaTemplate,
  over: RunOverrides & { level?: number; exp?: number; unlockedTier?: number; goalPlanVersion?: number } = {},
): UmaSave {
  const base = createUmaSave(template)
  const { level, exp, unlockedTier, goalPlanVersion, ...run } = over
  const tier = unlockedTier ?? base.unlockedTier
  return withRun({
    ...base,
    level: level ?? base.level,
    exp: exp ?? base.exp,
    unlockedTier: tier,
    goalPlanVersion: goalPlanVersion ?? base.goalPlanVersion,
    scenarios: [{ ...base.scenarios[0]!, tier, started: true }],
  }, run)
}

/** Replaces the active run's fields on an existing save, in every distance preset alike (D252). */
export function withRun(uma: UmaSave, over: RunOverrides): UmaSave {
  return DISTANCE_CATEGORIES.reduce((save, preset) =>
    withScenarioView(save, { ...trainedScenario(save, save.unlockedTier, preset), ...over }), uma)
}

/** A derived badge subject for tests that do not need real content. */
export const emptySubject = (over: Partial<BadgeSubject> = {}): BadgeSubject => ({
  tier: 1,
  trainingLevel: 1,
  stats: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  library: [],
  ...over,
})
