// Checked-in Spark rival behavior vocabulary compiled into bounded engine definitions
// (docs/design/minigames.md#spark-match--rival-circuit).
import {
  SPARK_RIVAL_CONVERT_MAXIMUM,
  SPARK_RIVAL_GUARD_COMBOS,
  SPARK_RIVAL_GUARD_REDUCTION,
  SPARK_RIVAL_PHASE_RESOLVE_PERCENT,
  SPARK_RIVAL_PRESSURE_MULTIPLIER,
  SPARK_RIVAL_RECIPE_COUNTDOWNS,
  SPARK_RIVAL_SHIFT_DELAY,
  SPARK_RIVAL_WAVE_PRESSURE,
  SPARK_RIVAL_WAVE_RESOLVE,
  sparkRivalDifficulty,
  type SparkRivalRecipeId,
} from '../../spark-rival'
import type { Grade, Strategy } from '../../types'
import { bestSparkStrategy, sparkAdvantagedStrategy } from './combat'
import type { RivalPhase, RivalTurnIntent, SparkRivalDefinition } from './types'

export interface SparkRivalRecipeInput {
  id: string
  label: string
  recipe: SparkRivalRecipeId
  strategy: Strategy
  wave: 0 | 1 | 2
  scenarioTier: number
  trainingLevel: number
  traineeAptitudes: Readonly<Record<Strategy, Grade>>
}

/** Expands semantic private content into the complete numeric script snapshotted by T073. */
export function sparkRivalDefinition(input: SparkRivalRecipeInput): SparkRivalDefinition {
  const difficulty = sparkRivalDifficulty(input.scenarioTier, input.trainingLevel)
  const maxResolve = Math.round(SPARK_RIVAL_WAVE_RESOLVE[input.wave] * difficulty)
  const pressure = Math.round(SPARK_RIVAL_WAVE_PRESSURE[input.wave] * difficulty)
  const openingCountdown: number = SPARK_RIVAL_RECIPE_COUNTDOWNS[input.recipe]
  let intents: RivalTurnIntent[]
  let phases: RivalPhase[] = []

  switch (input.recipe) {
    case 'rush-pressure':
      intents = [{ type: 'pressure', amount: pressure }]
      phases = [{
        atResolvePercent: SPARK_RIVAL_PHASE_RESOLVE_PERCENT,
        intent: { type: 'enrage', multiplier: SPARK_RIVAL_PRESSURE_MULTIPLIER },
      }]
      break
    case 'tracker-guard':
      intents = [
        { type: 'guard', reduction: SPARK_RIVAL_GUARD_REDUCTION, comboThreshold: SPARK_RIVAL_GUARD_COMBOS },
        { type: 'pressure', amount: pressure },
      ]
      break
    case 'surge-convert':
      intents = [
        {
          type: 'convert',
          source: sparkAdvantagedStrategy(input.strategy),
          target: input.strategy,
          maximum: SPARK_RIVAL_CONVERT_MAXIMUM,
        },
        { type: 'pressure', amount: pressure },
      ]
      break
    case 'finisher-delay':
      intents = [
        { type: 'delay', amount: SPARK_RIVAL_SHIFT_DELAY },
        { type: 'pressure', amount: Math.round(pressure * SPARK_RIVAL_PRESSURE_MULTIPLIER) },
      ]
      break
    case 'adaptive-duel':
      intents = [{ type: 'pressure', amount: pressure }]
      phases = [{
        atResolvePercent: SPARK_RIVAL_PHASE_RESOLVE_PERCENT,
        intent: { type: 'change-style', strategy: sparkAdvantagedStrategy(bestSparkStrategy(input.traineeAptitudes)) },
      }]
      break
    case 'circuit-boss':
      intents = [
        { type: 'pressure', amount: pressure },
        { type: 'guard', reduction: SPARK_RIVAL_GUARD_REDUCTION, comboThreshold: SPARK_RIVAL_GUARD_COMBOS },
        {
          type: 'convert',
          source: sparkAdvantagedStrategy(input.strategy),
          target: input.strategy,
          maximum: SPARK_RIVAL_CONVERT_MAXIMUM,
        },
      ]
      phases = [{
        atResolvePercent: SPARK_RIVAL_PHASE_RESOLVE_PERCENT,
        intent: { type: 'change-style', strategy: sparkAdvantagedStrategy(bestSparkStrategy(input.traineeAptitudes)) },
      }]
      break
  }

  return {
    id: input.id,
    label: input.label,
    strategy: input.strategy,
    maxResolve,
    openingCountdown,
    intents,
    phases,
  }
}
