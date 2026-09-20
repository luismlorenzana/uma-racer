import { describe, expect, it } from 'vitest'
import {
  CLIMAX_TRAINING_MULTIPLIER,
  SCENARIO_MODIFIER_VERSION,
  TEAM_SPIRIT_CARD_THRESHOLD,
  TEAM_SPIRIT_STAT_BONUS,
  awardClimaxItem,
  createScenarioModifierState,
  parseScenarioModifierState,
  projectScenarioTrainingModifier,
  scenarioModifierDefinition,
} from './scenario-modifiers'

describe('scenario modifiers', () => {
  it('initializes only implemented tiers and exposes stable definitions', () => {
    expect(createScenarioModifierState(1)).toBeNull()
    expect(createScenarioModifierState(2)).toEqual({ version: 1, tier: 2, kind: 'team-spirit', bursts: 0 })
    expect(createScenarioModifierState(3)).toEqual({ version: 1, tier: 3, kind: 'climax', earned: 0, stock: 0, used: 0 })
    expect(createScenarioModifierState(4)).toBeNull()
    expect(scenarioModifierDefinition(2)).toMatchObject({ kind: 'team-spirit', name: 'Team Spirit' })
    expect(scenarioModifierDefinition(3)).toMatchObject({ kind: 'climax', name: 'Climax' })
  })

  it('strictly parses versioned state and Climax accounting', () => {
    const spirit = { version: SCENARIO_MODIFIER_VERSION, tier: 2, kind: 'team-spirit', bursts: 7 }
    const climax = { version: SCENARIO_MODIFIER_VERSION, tier: 3, kind: 'climax', earned: 5, stock: 2, used: 3 }
    expect(parseScenarioModifierState(spirit)).toEqual(spirit)
    expect(parseScenarioModifierState(climax)).toEqual(climax)
    expect(parseScenarioModifierState({ ...spirit, version: 2 })).toBeNull()
    expect(parseScenarioModifierState({ ...spirit, extra: 1 })).toBeNull()
    expect(parseScenarioModifierState({ ...climax, stock: 3 })).toBeNull()
    expect(parseScenarioModifierState({ ...climax, tier: 2 })).toBeNull()
  })

  it('adds Team Spirit to all stats at the threshold without touching SP', () => {
    const state = createScenarioModifierState(2)!
    const ordinary = { speed: 100, power: 40, sp: 12 }
    const idle = projectScenarioTrainingModifier({ state, rawGains: ordinary, presentCardCount: TEAM_SPIRIT_CARD_THRESHOLD - 1 })
    expect(idle.rawGains).toEqual(ordinary)
    expect(idle.nextState).toEqual(state)
    expect(idle.effect).toMatchObject({ kind: 'team-spirit', triggered: false })

    const burst = projectScenarioTrainingModifier({ state, rawGains: ordinary, presentCardCount: TEAM_SPIRIT_CARD_THRESHOLD })
    expect(burst.rawGains).toEqual({
      speed: 100 + TEAM_SPIRIT_STAT_BONUS,
      stamina: TEAM_SPIRIT_STAT_BONUS,
      power: 40 + TEAM_SPIRIT_STAT_BONUS,
      guts: TEAM_SPIRIT_STAT_BONUS,
      wit: TEAM_SPIRIT_STAT_BONUS,
      sp: 12,
    })
    expect(burst.nextState).toMatchObject({ kind: 'team-spirit', bursts: 1 })
  })

  it('awards and consumes Climax items only on eligible actions', () => {
    const initial = createScenarioModifierState(3)!
    expect(awardClimaxItem({ state: initial, won: false, closesTier: false })).toEqual({ state: initial, awarded: 0 })
    expect(awardClimaxItem({ state: initial, won: true, closesTier: true })).toEqual({ state: initial, awarded: 0 })
    const award = awardClimaxItem({ state: initial, won: true, closesTier: false })
    expect(award).toEqual({
      awarded: 1,
      state: { version: 1, tier: 3, kind: 'climax', earned: 1, stock: 1, used: 0 },
    })
    const saved = projectScenarioTrainingModifier({ state: award.state, rawGains: { speed: 101, sp: 11 }, presentCardCount: 0 })
    expect(saved.rawGains).toEqual({ speed: 101, sp: 11 })
    expect(saved.nextState).toEqual(award.state)
    const used = projectScenarioTrainingModifier({ state: award.state, rawGains: { speed: 101, sp: 11 }, presentCardCount: 0, useClimaxItem: true })
    expect(used.rawGains).toEqual({ speed: 101 * CLIMAX_TRAINING_MULTIPLIER, sp: 11 * CLIMAX_TRAINING_MULTIPLIER })
    expect(used.nextState).toEqual({ version: 1, tier: 3, kind: 'climax', earned: 1, stock: 0, used: 1 })
    expect(() => projectScenarioTrainingModifier({ state: used.nextState, rawGains: {}, presentCardCount: 0, useClimaxItem: true })).toThrow(/No Climax item/)
  })
})
