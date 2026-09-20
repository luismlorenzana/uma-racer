// Pure scenario-modifier copy/progress projection (docs/design/scenarios.md#scenario-modifiers).

import { scenarioModifierDefinition, type ScenarioModifierState } from '@racer/domain'

export interface ScenarioModifierView {
  kind: ScenarioModifierState['kind']
  name: string
  rule: string
  detail: string
  legacyUnavailable: boolean
}

export function buildScenarioModifierView(
  tier: number,
  state: ScenarioModifierState | null,
  active: boolean,
): ScenarioModifierView | null {
  const definition = scenarioModifierDefinition(tier)
  if (!definition) return null
  if (!active) return {
    kind: definition.kind,
    name: definition.name,
    rule: definition.shortRule,
    detail: 'Tier-local progress expired at promotion.',
    legacyUnavailable: false,
  }
  if (!state || state.tier !== tier || state.kind !== definition.kind) return {
    kind: definition.kind,
    name: definition.name,
    rule: definition.shortRule,
    detail: 'Legacy run · modifier becomes available at the next Scenario Start.',
    legacyUnavailable: true,
  }
  return state.kind === 'team-spirit'
    ? {
      kind: state.kind,
      name: definition.name,
      rule: definition.shortRule,
      detail: `${state.bursts} Spirit Burst${state.bursts === 1 ? '' : 's'} triggered this tier.`,
      legacyUnavailable: false,
    }
    : {
      kind: state.kind,
      name: definition.name,
      rule: definition.shortRule,
      detail: `${state.stock} stocked · ${state.used} used · expires at promotion.`,
      legacyUnavailable: false,
    }
}

export const climaxRewardLabel = (amount: number): string | null =>
  amount > 0 ? `+${amount} Climax training item${amount === 1 ? '' : 's'}` : null
