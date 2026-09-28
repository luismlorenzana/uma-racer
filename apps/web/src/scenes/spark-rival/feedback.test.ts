import type { SparkAttackTotal, SparkRivalResolution } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import {
  SPARK_EFFECT_CAPACITY,
  SPARK_LABEL_CAPACITY,
  sparkAttackLabel,
  sparkIntentAnnouncement,
  sparkResolutionAnnouncement,
} from './feedback'

const attack = (matchup: SparkAttackTotal['matchup']): SparkAttackTotal => ({
  orb: 'pace', orbs: 3, groups: 1, rawAmount: 52, appliedAmount: 52, matchup,
})

describe('Spark Rival feedback', () => {
  it('keeps every live presentation pool explicitly bounded', () => {
    expect(SPARK_EFFECT_CAPACITY).toBe(24)
    expect(SPARK_LABEL_CAPACITY).toBe(8)
  })

  it('puts glyph, integer damage and matchup meaning in the attack label', () => {
    expect(sparkAttackLabel(attack('advantaged'))).toBe('P -52 WEAK')
    expect(sparkAttackLabel(attack('resisted'))).toBe('P -52 RESIST')
    expect(sparkAttackLabel(attack('neutral'))).toBe('P -52')
  })

  it('announces pressure by its actual Drive movement', () => {
    expect(sparkIntentAnnouncement({ type: 'pressure', amount: 40 }, 80, 40)).toBe('Rival Pressure removed 40 Drive')
    expect(sparkIntentAnnouncement({ type: 'convert', source: 'pace', target: 'front', maximum: 4 }, 80, 80, 3)).toBe('Rival converted 3 pace orbs into front')
  })

  it('summarizes a whole turn once instead of narrating pointer cells', () => {
    const finalState = {
      board: Array.from({ length: 30 }, () => 'front' as const), boardRngState: 1, rivalRngState: 2,
      waveIndex: 0, waveTurn: 1, drive: 72, maxDrive: 100, sparkCharge: 3, sparkTarget: 9,
      totalDrags: 1, totalCombos: 2, waveDamage: [52, 0, 0] as const,
      rival: { strategy: 'front' as const, resolve: 448, maxResolve: 500, countdown: 2, intentIndex: 0, pressureMultiplier: 1, guard: null, firedPhases: [] },
      outcome: null,
    }
    const resolution: SparkRivalResolution = {
      actionIndex: 0,
      action: { type: 'drag', path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], movementMs: 100 },
      turnConsumed: true,
      cascades: [],
      combos: 2,
      steps: [{ type: 'attack', attack: attack('advantaged'), resolveBefore: 500, resolveAfter: 448 }],
    }
    expect(sparkResolutionAnnouncement(resolution, finalState)).toBe('2 combos. 52 Resolve damage. Rival has 448 Resolve; you have 72 Drive.')
  })
})
