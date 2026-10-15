import { describe, expect, it } from 'vitest'
import { SCENARIO_BUFFS, lineageSlotTakesAnyUma, scenarioBuff } from './scenario-buffs'
import { MAX_SCENARIO_TIER } from './scenarios'

describe('scenario buffs (D165)', () => {
  it('names one buff per scenario', () => {
    expect(SCENARIO_BUFFS).toHaveLength(MAX_SCENARIO_TIER)
    expect(new Set(SCENARIO_BUFFS.map((buff) => buff.id)).size).toBe(MAX_SCENARIO_TIER)
    expect(scenarioBuff(1).name).toBe('Foundation')
    expect(scenarioBuff(14).name).toBe('Orders')
  })

  it('Legends (10): the first parent slot takes any Uma', () => {
    expect(lineageSlotTakesAnyUma(10, 'parent0')).toBe(true)
    expect(lineageSlotTakesAnyUma(10, 'parent1')).toBe(false)
    expect(lineageSlotTakesAnyUma(9, 'parent0')).toBe(false)
  })
})
