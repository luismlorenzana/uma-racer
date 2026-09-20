import { describe, expect, it } from 'vitest'
import {
  CLIMAX_TRAINING_MULTIPLIER,
  EXPEDITION_STAMP_THRESHOLD,
  GODDESS_BURST_MULTIPLIER,
  GODDESS_FRAGMENT_THRESHOLD,
  PERFORMANCE_STAT_BONUS,
  SCENARIO_MODIFIER_VERSION,
  TEAM_SPIRIT_CARD_THRESHOLD,
  TEAM_SPIRIT_STAT_BONUS,
  awardClimaxItem,
  completeExpedition,
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
    expect(createScenarioModifierState(4)).toEqual({ version: 1, tier: 4, kind: 'performances', notes: [], performances: 0 })
    expect(createScenarioModifierState(5)).toEqual({ version: 1, tier: 5, kind: 'goddess-fragments', fragments: 0, bursts: 0 })
    expect(createScenarioModifierState(6)).toEqual({ version: 1, tier: 6, kind: 'expedition', stamps: 0, completed: 0, upgraded: 0 })
    expect(createScenarioModifierState(7)).toBeNull()
    expect(scenarioModifierDefinition(2)).toMatchObject({ kind: 'team-spirit', name: 'Team Spirit' })
    expect(scenarioModifierDefinition(3)).toMatchObject({ kind: 'climax', name: 'Climax' })
    expect(scenarioModifierDefinition(4)).toMatchObject({ kind: 'performances', name: 'Performances' })
    expect(scenarioModifierDefinition(5)).toMatchObject({ kind: 'goddess-fragments', name: 'Goddess Fragments' })
    expect(scenarioModifierDefinition(6)).toMatchObject({ kind: 'expedition', name: 'Expedition' })
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
    expect(parseScenarioModifierState({ version: 1, tier: 4, kind: 'performances', notes: ['speed', 'power'], performances: 2 })).toEqual({
      version: 1, tier: 4, kind: 'performances', notes: ['speed', 'power'], performances: 2,
    })
    expect(parseScenarioModifierState({ version: 1, tier: 4, kind: 'performances', notes: ['power', 'speed'], performances: 2 })).toBeNull()
    expect(parseScenarioModifierState({ version: 1, tier: 4, kind: 'performances', notes: ['speed', 'stamina', 'power', 'guts', 'wit'], performances: 2 })).toBeNull()
    expect(parseScenarioModifierState({ version: 1, tier: 5, kind: 'goddess-fragments', fragments: 8, bursts: 1 })).toBeNull()
    expect(parseScenarioModifierState({ version: 1, tier: 6, kind: 'expedition', stamps: 5, completed: 1, upgraded: 2 })).toBeNull()
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

  it('collects distinct Concert notes and pays the completing all-stat bonus once', () => {
    let state = createScenarioModifierState(4)!
    for (const facility of ['speed', 'stamina', 'power', 'guts'] as const) {
      const result = projectScenarioTrainingModifier({ state, rawGains: { [facility]: 40 }, presentCardCount: 0, facility })
      expect(result.effect).toMatchObject({ kind: 'performances', note: facility, collected: true, completed: false })
      state = result.nextState!
    }
    const repeated = projectScenarioTrainingModifier({ state, rawGains: { speed: 40 }, presentCardCount: 0, facility: 'speed' })
    expect(repeated.nextState).toEqual(state)
    expect(repeated.effect).toMatchObject({ collected: false, completed: false })
    const completed = projectScenarioTrainingModifier({ state, rawGains: { wit: 50, sp: 10 }, presentCardCount: 0, facility: 'wit' })
    expect(completed.rawGains).toEqual({
      speed: PERFORMANCE_STAT_BONUS,
      stamina: PERFORMANCE_STAT_BONUS,
      power: PERFORMANCE_STAT_BONUS,
      guts: PERFORMANCE_STAT_BONUS,
      wit: 50 + PERFORMANCE_STAT_BONUS,
      sp: 10,
    })
    expect(completed.nextState).toEqual({ version: 1, tier: 4, kind: 'performances', notes: [], performances: 1 })
  })

  it('grants one fragment per turn and bursts on the eighth', () => {
    const state = { ...createScenarioModifierState(5)!, fragments: GODDESS_FRAGMENT_THRESHOLD - 1 }
    const result = projectScenarioTrainingModifier({ state, rawGains: { speed: 100, sp: 12 }, presentCardCount: 0, facility: 'speed' })
    expect(result.rawGains).toEqual({ speed: 100 * GODDESS_BURST_MULTIPLIER, sp: 12 * GODDESS_BURST_MULTIPLIER })
    expect(result.nextState).toEqual({ version: 1, tier: 5, kind: 'goddess-fragments', fragments: 0, bursts: 1 })
    expect(result.effect).toMatchObject({ kind: 'goddess-fragments', fragmentGranted: true, fragmentCount: 0, burst: true })
  })

  it('fills L Arc stamps, upgrades a chosen aptitude to at most A, and handles all-capped completion', () => {
    let state = createScenarioModifierState(6)!
    for (let stamp = 1; stamp <= EXPEDITION_STAMP_THRESHOLD; stamp += 1) {
      const result = projectScenarioTrainingModifier({ state, rawGains: { speed: 10 }, presentCardCount: 0, facility: 'speed' })
      expect(result.effect).toMatchObject({ kind: 'expedition', stampCount: stamp, ready: stamp === EXPEDITION_STAMP_THRESHOLD })
      state = result.nextState!
    }
    const aptitudes = {
      surface: { turf: 'A' as const, dirt: 'G' as const },
      distance: { sprint: 'B' as const, mile: 'A' as const, medium: 'A' as const, long: 'A' as const },
      strategy: { front: 'A' as const, pace: 'A' as const, late: 'A' as const, end: 'A' as const },
    }
    const first = completeExpedition({ state, aptitudes, category: 'distance:sprint' })
    expect(first).toMatchObject({ category: 'distance:sprint', before: 'B', after: 'A', state: { stamps: 0, completed: 1, upgraded: 1 } })
    expect(first.aptitudes.distance.sprint).toBe('A')
    expect(aptitudes.distance.sprint).toBe('B')
    expect(() => completeExpedition({ state, aptitudes, category: 'surface:turf' })).toThrow(/eligible/)

    const allCapped = {
      surface: { turf: 'S' as const, dirt: 'A' as const },
      distance: { sprint: 'A' as const, mile: 'A' as const, medium: 'A' as const, long: 'S' as const },
      strategy: { front: 'A' as const, pace: 'A' as const, late: 'S' as const, end: 'A' as const },
    }
    const retired = completeExpedition({ state, aptitudes: allCapped, category: null })
    expect(retired).toMatchObject({ category: null, before: null, after: null, state: { stamps: 0, completed: 1, upgraded: 0 } })
  })
})
