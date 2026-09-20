// Tier-local scenario training modifiers (docs/design/scenarios.md#scenario-modifiers).

import { STATS, type GainKey } from './types'

export const SCENARIO_MODIFIER_VERSION = 1 as const
export const TEAM_SPIRIT_CARD_THRESHOLD = 3
export const TEAM_SPIRIT_STAT_BONUS = 10
export const CLIMAX_ITEMS_PER_WIN = 1
export const CLIMAX_TRAINING_MULTIPLIER = 1.2

export interface TeamSpiritModifierState {
  version: typeof SCENARIO_MODIFIER_VERSION
  tier: 2
  kind: 'team-spirit'
  bursts: number
}

export interface ClimaxModifierState {
  version: typeof SCENARIO_MODIFIER_VERSION
  tier: 3
  kind: 'climax'
  earned: number
  stock: number
  used: number
}

export type ScenarioModifierState = TeamSpiritModifierState | ClimaxModifierState

export interface ScenarioModifierDefinition {
  tier: 2 | 3
  kind: ScenarioModifierState['kind']
  name: string
  shortRule: string
}

export type ScenarioTrainingModifierEffect =
  | {
    kind: 'team-spirit'
    triggered: boolean
    presentCardCount: number
    bonusGains: Partial<Record<GainKey, number>>
  }
  | {
    kind: 'climax'
    triggered: boolean
    multiplier: number
    itemConsumed: boolean
  }

export interface ScenarioTrainingModifierProjection {
  rawGains: Partial<Record<GainKey, number>>
  nextState: ScenarioModifierState | null
  effect: ScenarioTrainingModifierEffect | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort()
  const sorted = [...expected].sort()
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index])
}

const isCount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0

export function parseScenarioModifierState(value: unknown): ScenarioModifierState | null {
  if (!isRecord(value) || value.version !== SCENARIO_MODIFIER_VERSION) return null
  if (value.kind === 'team-spirit') {
    if (!exactKeys(value, ['version', 'tier', 'kind', 'bursts']) || value.tier !== 2 || !isCount(value.bursts)) return null
    return { version: SCENARIO_MODIFIER_VERSION, tier: 2, kind: 'team-spirit', bursts: value.bursts }
  }
  if (value.kind === 'climax') {
    if (!exactKeys(value, ['version', 'tier', 'kind', 'earned', 'stock', 'used']) || value.tier !== 3 ||
      !isCount(value.earned) || !isCount(value.stock) || !isCount(value.used) || value.stock + value.used !== value.earned) return null
    return {
      version: SCENARIO_MODIFIER_VERSION,
      tier: 3,
      kind: 'climax',
      earned: value.earned,
      stock: value.stock,
      used: value.used,
    }
  }
  return null
}

export function scenarioModifierDefinition(tier: number): ScenarioModifierDefinition | null {
  if (tier === 2) return {
    tier: 2,
    kind: 'team-spirit',
    name: 'Team Spirit',
    shortRule: `${TEAM_SPIRIT_CARD_THRESHOLD}+ cards at one facility add +${TEAM_SPIRIT_STAT_BONUS} to all five stats.`,
  }
  if (tier === 3) return {
    tier: 3,
    kind: 'climax',
    name: 'Climax',
    shortRule: `Eligible wins grant one item for a ×${CLIMAX_TRAINING_MULTIPLIER.toFixed(2)} training.`,
  }
  return null
}

export function createScenarioModifierState(tier: number): ScenarioModifierState | null {
  if (tier === 2) return { version: SCENARIO_MODIFIER_VERSION, tier: 2, kind: 'team-spirit', bursts: 0 }
  if (tier === 3) return { version: SCENARIO_MODIFIER_VERSION, tier: 3, kind: 'climax', earned: 0, stock: 0, used: 0 }
  return null
}

function assertRawGains(gains: Partial<Record<GainKey, number>>): void {
  for (const value of Object.values(gains)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Scenario modifier received invalid Training gains')
  }
}

export function projectScenarioTrainingModifier(input: {
  state: ScenarioModifierState | null
  rawGains: Partial<Record<GainKey, number>>
  presentCardCount: number
  useClimaxItem?: boolean
}): ScenarioTrainingModifierProjection {
  assertRawGains(input.rawGains)
  if (!Number.isSafeInteger(input.presentCardCount) || input.presentCardCount < 0) throw new Error('Scenario modifier received an invalid card count')
  const useClimaxItem = input.useClimaxItem ?? false
  if (!input.state) {
    if (useClimaxItem) throw new Error('No Climax item is available for this scenario')
    return { rawGains: { ...input.rawGains }, nextState: null, effect: null }
  }
  if (input.state.kind === 'team-spirit') {
    if (useClimaxItem) throw new Error('Climax items are unavailable in Unity Cup')
    const triggered = input.presentCardCount >= TEAM_SPIRIT_CARD_THRESHOLD
    const bonusGains: Partial<Record<GainKey, number>> = triggered
      ? Object.fromEntries(STATS.map((stat) => [stat, TEAM_SPIRIT_STAT_BONUS]))
      : {}
    const rawGains = { ...input.rawGains }
    if (triggered) for (const stat of STATS) rawGains[stat] = (rawGains[stat] ?? 0) + TEAM_SPIRIT_STAT_BONUS
    return {
      rawGains,
      nextState: triggered ? { ...input.state, bursts: input.state.bursts + 1 } : input.state,
      effect: { kind: 'team-spirit', triggered, presentCardCount: input.presentCardCount, bonusGains },
    }
  }
  if (!useClimaxItem) {
    return {
      rawGains: { ...input.rawGains },
      nextState: input.state,
      effect: { kind: 'climax', triggered: false, multiplier: CLIMAX_TRAINING_MULTIPLIER, itemConsumed: false },
    }
  }
  if (input.state.stock < 1) throw new Error('No Climax item is available')
  const rawGains = Object.fromEntries(
    Object.entries(input.rawGains).map(([key, value]) => [key, value! * CLIMAX_TRAINING_MULTIPLIER]),
  ) as Partial<Record<GainKey, number>>
  return {
    rawGains,
    nextState: { ...input.state, stock: input.state.stock - 1, used: input.state.used + 1 },
    effect: { kind: 'climax', triggered: true, multiplier: CLIMAX_TRAINING_MULTIPLIER, itemConsumed: true },
  }
}

export function awardClimaxItem(input: {
  state: ScenarioModifierState | null
  won: boolean
  closesTier: boolean
}): { state: ScenarioModifierState | null; awarded: number } {
  if (!input.state || input.state.kind !== 'climax' || !input.won || input.closesTier) {
    return { state: input.state, awarded: 0 }
  }
  return {
    state: {
      ...input.state,
      earned: input.state.earned + CLIMAX_ITEMS_PER_WIN,
      stock: input.state.stock + CLIMAX_ITEMS_PER_WIN,
    },
    awarded: CLIMAX_ITEMS_PER_WIN,
  }
}
