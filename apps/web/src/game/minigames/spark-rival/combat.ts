// Combat and reward formulas for Spark Rival Circuit (docs/design/minigames.md#turn-resolution, D172).
import {
  SPARK_RIVAL_ADVANTAGE_MULTIPLIER,
  SPARK_RIVAL_APTITUDE_MULTIPLIERS,
  SPARK_RIVAL_CLEAR_BONUS,
  SPARK_RIVAL_COMBO_BONUS_CAP,
  SPARK_RIVAL_COMBO_PER_MATCH,
  SPARK_RIVAL_DRIVE_BONUS_CAP,
  SPARK_RIVAL_LOSS_EXP_SHARE,
  SPARK_RIVAL_MATCH_SHAPE_PER_ORB,
  SPARK_RIVAL_NEUTRAL_ATTACK,
  SPARK_RIVAL_RECOVERY_PER_ORB,
  SPARK_RIVAL_RESISTED_MULTIPLIER,
  SPARK_RIVAL_STYLE_ATTACK,
  SPARK_RIVAL_WAVE_EXP,
  STRATEGIES,
  sparkRivalBestStrategy,
  type Grade,
  type Strategy,
} from '@racer/domain'
import { SPARK_ORBS, type SparkAttackTotal, type SparkCascade, type SparkOrb, type SparkRivalOutcome } from './types'

const BEATS: Record<Strategy, Strategy> = {
  pace: 'front',
  front: 'end',
  end: 'late',
  late: 'pace',
}

export type SparkMatchup = SparkAttackTotal['matchup']

export function sparkMatchup(attacker: Strategy, defender: Strategy): SparkMatchup {
  if (BEATS[attacker] === defender) return 'advantaged'
  if (BEATS[defender] === attacker) return 'resisted'
  return 'neutral'
}

export function sparkAdvantagedStrategy(defender: Strategy): Strategy {
  return STRATEGIES.find((strategy) => BEATS[strategy] === defender)!
}

export function sparkMatchupMultiplier(matchup: SparkMatchup): number {
  return matchup === 'advantaged'
    ? SPARK_RIVAL_ADVANTAGE_MULTIPLIER
    : matchup === 'resisted' ? SPARK_RIVAL_RESISTED_MULTIPLIER : 1
}

export function sparkAptitudeMultiplier(grade: Grade): number {
  return SPARK_RIVAL_APTITUDE_MULTIPLIERS[grade]
}

export function bestSparkStrategy(aptitudes: Readonly<Record<Strategy, Grade>>): Strategy {
  return sparkRivalBestStrategy(aptitudes)
}

export function sparkMatchShape(orbs: number): number {
  return 1 + SPARK_RIVAL_MATCH_SHAPE_PER_ORB * (orbs - 3)
}

export function sparkComboMultiplier(combos: number): number {
  return 1 + SPARK_RIVAL_COMBO_PER_MATCH * Math.max(0, combos - 1)
}

export interface SparkTurnTotals {
  combos: number
  cleared: Readonly<Record<SparkOrb, number>>
  attacks: readonly SparkAttackTotal[]
  recovery: number
  charge: number
}

export function sparkTurnTotals(
  cascades: readonly SparkCascade[],
  aptitudes: Readonly<Record<Strategy, Grade>>,
  defender: Strategy,
  guard: { reduction: number; comboThreshold: number } | null,
): SparkTurnTotals {
  const groups = cascades.flatMap((cascade) => cascade.groups)
  const combos = groups.length
  const combo = sparkComboMultiplier(combos)
  const cleared = Object.fromEntries(SPARK_ORBS.map((orb) => [orb, 0])) as Record<SparkOrb, number>
  for (const group of groups) cleared[group.orb] += group.indices.length
  const guarded = guard !== null && combos < guard.comboThreshold

  const attacks = [...STRATEGIES, 'spark' as const].map((orb): SparkAttackTotal => {
    const matches = groups.filter((group) => group.orb === orb)
    const rawAmount = matches.reduce((sum, group) => {
      const base = orb === 'spark'
        ? SPARK_RIVAL_NEUTRAL_ATTACK * sparkMatchShape(group.indices.length) * combo
        : SPARK_RIVAL_STYLE_ATTACK * sparkMatchShape(group.indices.length) * combo *
          sparkAptitudeMultiplier(aptitudes[orb]) * sparkMatchupMultiplier(sparkMatchup(orb, defender))
      return sum + Math.round(base)
    }, 0)
    const appliedAmount = guarded ? Math.round(rawAmount * (1 - guard.reduction)) : rawAmount
    return {
      orb,
      orbs: cleared[orb],
      groups: matches.length,
      rawAmount,
      appliedAmount,
      matchup: orb === 'spark' ? 'neutral' : sparkMatchup(orb, defender),
    }
  })

  return {
    combos,
    cleared,
    attacks,
    recovery: Math.round(SPARK_RIVAL_RECOVERY_PER_ORB * cleared.recovery * combo),
    charge: cleared.spark,
  }
}

export function sparkOutcome(
  kind: 'clear' | 'loss',
  reason: SparkRivalOutcome['reason'],
  waveDamage: readonly [number, number, number],
  waveMaxResolve: readonly [number, number, number],
  totalCombos: number,
  totalDrags: number,
  drive: number,
  maxDrive: number,
): SparkRivalOutcome {
  const waveExp = SPARK_RIVAL_WAVE_EXP.map((budget, index) => {
    const maximum = waveMaxResolve[index]!
    const damage = Math.min(maximum, Math.max(0, waveDamage[index]!))
    if (damage >= maximum) return budget
    return damage === 0 ? 0 : Math.max(1, Math.floor(budget * damage / maximum))
  }) as unknown as [number, number, number]
  const progress = waveExp.reduce((sum, value) => sum + value, 0)
  if (kind === 'loss') {
    const lossCap = Math.floor(SPARK_RIVAL_WAVE_EXP.reduce((sum, value) => sum + value, 0) * SPARK_RIVAL_LOSS_EXP_SHARE)
    return {
      kind,
      reason,
      trainingExp: Math.min(progress, lossCap),
      waveExp,
      clearBonus: 0,
      comboBonus: 0,
      driveBonus: 0,
    }
  }
  const comboBonus = Math.min(SPARK_RIVAL_COMBO_BONUS_CAP, 10 * Math.max(0, totalCombos - totalDrags))
  const driveBonus = Math.round(SPARK_RIVAL_DRIVE_BONUS_CAP * drive / maxDrive)
  return {
    kind,
    reason,
    trainingExp: progress + SPARK_RIVAL_CLEAR_BONUS + comboBonus + driveBonus,
    waveExp,
    clearBonus: SPARK_RIVAL_CLEAR_BONUS,
    comboBonus,
    driveBonus,
  }
}
