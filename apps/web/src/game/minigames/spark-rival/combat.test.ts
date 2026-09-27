import { GRADES, STRATEGIES } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import {
  bestSparkStrategy,
  sparkAptitudeMultiplier,
  sparkMatchup,
  sparkOutcome,
  sparkTurnTotals,
} from './combat'
import type { SparkCascade, SparkMatchGroup, SparkOrb } from './types'

const cascade = (groups: readonly SparkMatchGroup[]): SparkCascade => ({
  index: 0,
  before: [],
  groups,
  cleared: groups.flatMap((group) => group.indices),
  after: [],
})
const group = (orb: SparkOrb, count: number, offset = 0): SparkMatchGroup => ({
  orb,
  indices: Array.from({ length: count }, (_, index) => offset + index),
})
const aptitudes = { front: 'A', pace: 'A', late: 'A', end: 'A' } as const

describe('Spark Rival combat', () => {
  it('pins every advantage, resistance, and opposite-neutral relation', () => {
    expect(STRATEGIES.map((attacker) => STRATEGIES.map((defender) => sparkMatchup(attacker, defender)))).toEqual([
      ['neutral', 'resisted', 'neutral', 'advantaged'],
      ['advantaged', 'neutral', 'resisted', 'neutral'],
      ['neutral', 'advantaged', 'neutral', 'resisted'],
      ['resisted', 'neutral', 'advantaged', 'neutral'],
    ])
  })

  it('pins all aptitude grades and the deterministic best-strategy tie break', () => {
    expect(GRADES.map(sparkAptitudeMultiplier)).toEqual([1.1, 1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7])
    expect(bestSparkStrategy({ front: 'B', pace: 'B', late: 'B', end: 'B' })).toBe('front')
    expect(bestSparkStrategy({ front: 'C', pace: 'A', late: 'A', end: 'B' })).toBe('pace')
  })

  it('uses one whole-turn combo multiplier for style, Spark, Recovery, and charge', () => {
    const totals = sparkTurnTotals([cascade([
      group('pace', 3),
      group('pace', 4, 3),
      group('spark', 3, 7),
      group('recovery', 4, 10),
    ])], aptitudes, 'front', null)
    expect(totals.combos).toBe(4)
    expect(totals.attacks.find((attack) => attack.orb === 'pace')).toMatchObject({ rawAmount: 216, appliedAmount: 216, matchup: 'advantaged' })
    expect(totals.attacks.find((attack) => attack.orb === 'spark')).toMatchObject({ rawAmount: 48, matchup: 'neutral' })
    expect(totals.recovery).toBe(38)
    expect(totals.charge).toBe(3)
  })

  it('applies Guard only when the combo threshold is missed', () => {
    const low = sparkTurnTotals([cascade([group('pace', 3)])], aptitudes, 'front', { reduction: 0.5, comboThreshold: 4 })
    expect(low.attacks.find((attack) => attack.orb === 'pace')).toMatchObject({ rawAmount: 60, appliedAmount: 30 })
    const high = sparkTurnTotals([cascade([
      group('pace', 3), group('spark', 3, 3), group('recovery', 3, 6), group('front', 3, 9),
    ])], aptitudes, 'front', { reduction: 0.5, comboThreshold: 4 })
    expect(high.attacks.find((attack) => attack.orb === 'pace')?.appliedAmount)
      .toBe(high.attacks.find((attack) => attack.orb === 'pace')?.rawAmount)
  })

  it('caps loss progress and grants only a clear the bounded bonuses', () => {
    const loss = sparkOutcome('loss', 'turn-limit', [500, 650, 899], [500, 650, 900], 40, 20, 100, 100)
    expect(loss).toEqual({
      kind: 'loss', reason: 'turn-limit', trainingExp: 877, waveExp: [500, 650, 799],
      clearBonus: 0, comboBonus: 0, driveBonus: 0,
    })
    const zero = sparkOutcome('loss', 'drive-depleted', [0, 0, 0], [500, 650, 900], 0, 1, 0, 100)
    expect(zero.trainingExp).toBe(0)
    const minimum = sparkOutcome('loss', 'turn-limit', [0, 0, 1], [500, 650, 900], 0, 1, 100, 100)
    expect(minimum.trainingExp).toBe(1)
    const clear = sparkOutcome('clear', 'circuit-cleared', [500, 650, 900], [500, 650, 900], 30, 20, 50, 100)
    expect(clear).toEqual({
      kind: 'clear', reason: 'circuit-cleared', trainingExp: 2_150, waveExp: [500, 650, 800],
      clearBonus: 50, comboBonus: 100, driveBonus: 50,
    })
    expect(clear.trainingExp).toBeGreaterThan(loss.trainingExp)
  })
})
