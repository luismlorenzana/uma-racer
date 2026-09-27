// Invented fixtures for tests, simulation, and the development touch proof. No original-game data belongs here.
import {
  SPARK_RIVAL_WAVE_PRESSURE,
  SPARK_RIVAL_WAVE_RESOLVE,
  SPARK_RIVAL_RECIPE_COUNTDOWNS,
  SPARK_RIVAL_PHASE_RESOLVE_PERCENT,
  SPARK_RIVAL_GUARD_REDUCTION,
  SPARK_RIVAL_GUARD_COMBOS,
  SPARK_RIVAL_CONVERT_MAXIMUM,
  SPARK_RIVAL_PRESSURE_MULTIPLIER,
  SPARK_RIVAL_SHIFT_DELAY,
  sparkRivalDifficulty,
  type Grade,
  type Strategy,
} from '@racer/domain'
import { bestSparkStrategy, sparkAdvantagedStrategy } from './combat'
import type { RivalPhase, RivalTurnIntent, SparkRivalDefinition, SparkRivalEncounterV1 } from './types'

export const SPARK_RIVAL_RECIPES = [
  'rush-pressure',
  'tracker-guard',
  'surge-convert',
  'finisher-delay',
  'adaptive-duel',
  'circuit-boss',
] as const
export type SparkRivalRecipe = (typeof SPARK_RIVAL_RECIPES)[number]

const PRESSURE_STYLE: Record<SparkRivalRecipe, Strategy> = {
  'rush-pressure': 'front',
  'tracker-guard': 'pace',
  'surge-convert': 'late',
  'finisher-delay': 'end',
  'adaptive-duel': 'pace',
  'circuit-boss': 'end',
}

export function syntheticAptitudes(best: Strategy, bestGrade: Grade = 'A'): Record<Strategy, Grade> {
  return {
    front: best === 'front' ? bestGrade : 'B',
    pace: best === 'pace' ? bestGrade : 'B',
    late: best === 'late' ? bestGrade : 'B',
    end: best === 'end' ? bestGrade : 'B',
  }
}

function styleThatResists(strategy: Strategy): Strategy {
  return sparkAdvantagedStrategy(strategy)
}

export function syntheticRival(
  recipe: SparkRivalRecipe,
  wave: 0 | 1 | 2,
  scenarioTier: number,
  trainingLevel: number,
  traineeAptitudes: Readonly<Record<Strategy, Grade>>,
  suffix = '',
): SparkRivalDefinition {
  const difficulty = sparkRivalDifficulty(scenarioTier, trainingLevel)
  const maxResolve = Math.round(SPARK_RIVAL_WAVE_RESOLVE[wave] * difficulty)
  const pressure = Math.round(SPARK_RIVAL_WAVE_PRESSURE[wave] * difficulty)
  const strategy = PRESSURE_STYLE[recipe]
  let openingCountdown: number = SPARK_RIVAL_RECIPE_COUNTDOWNS[recipe]
  let intents: RivalTurnIntent[]
  let phases: RivalPhase[] = []

  switch (recipe) {
    case 'rush-pressure':
      intents = [{ type: 'pressure', amount: pressure }]
      phases = [{ atResolvePercent: SPARK_RIVAL_PHASE_RESOLVE_PERCENT, intent: { type: 'enrage', multiplier: SPARK_RIVAL_PRESSURE_MULTIPLIER } }]
      break
    case 'tracker-guard':
      intents = [
        { type: 'guard', reduction: SPARK_RIVAL_GUARD_REDUCTION, comboThreshold: SPARK_RIVAL_GUARD_COMBOS },
        { type: 'pressure', amount: pressure },
      ]
      break
    case 'surge-convert':
      intents = [
        { type: 'convert', source: sparkAdvantagedStrategy(strategy), target: strategy, maximum: SPARK_RIVAL_CONVERT_MAXIMUM },
        { type: 'pressure', amount: pressure },
      ]
      break
    case 'finisher-delay':
      intents = [
        { type: 'delay', amount: SPARK_RIVAL_SHIFT_DELAY },
        { type: 'pressure', amount: Math.round(pressure * SPARK_RIVAL_PRESSURE_MULTIPLIER) },
      ]
      break
    case 'adaptive-duel': {
      const traineeBest = bestSparkStrategy(traineeAptitudes)
      intents = [{ type: 'pressure', amount: pressure }]
      phases = [{ atResolvePercent: SPARK_RIVAL_PHASE_RESOLVE_PERCENT, intent: { type: 'change-style', strategy: styleThatResists(traineeBest) } }]
      break
    }
    case 'circuit-boss': {
      const traineeBest = bestSparkStrategy(traineeAptitudes)
      intents = [
        { type: 'guard', reduction: SPARK_RIVAL_GUARD_REDUCTION, comboThreshold: SPARK_RIVAL_GUARD_COMBOS },
        { type: 'convert', source: sparkAdvantagedStrategy(strategy), target: strategy, maximum: SPARK_RIVAL_CONVERT_MAXIMUM },
        { type: 'pressure', amount: pressure },
      ]
      phases = [{ atResolvePercent: SPARK_RIVAL_PHASE_RESOLVE_PERCENT, intent: { type: 'change-style', strategy: styleThatResists(traineeBest) } }]
      break
    }
  }

  return {
    id: `synthetic-rival-${wave + 1}${suffix}`,
    label: wave === 2 ? 'Circuit Captain' : `Training Rival ${wave + 1}`,
    strategy,
    maxResolve,
    openingCountdown,
    intents,
    phases,
  }
}

export interface SyntheticEncounterOptions {
  scenarioTier?: number
  trainingLevel?: number
  traineeBest?: Strategy
  bestGrade?: Grade
  recipes?: readonly [SparkRivalRecipe, SparkRivalRecipe, SparkRivalRecipe]
}

export function syntheticSparkEncounter(options: SyntheticEncounterOptions = {}): SparkRivalEncounterV1 {
  const scenarioTier = options.scenarioTier ?? 1
  const trainingLevel = options.trainingLevel ?? 1
  const traineeBest = options.traineeBest ?? 'pace'
  const aptitudes = syntheticAptitudes(traineeBest, options.bestGrade)
  const recipes = options.recipes ?? ['rush-pressure', 'surge-convert', 'circuit-boss']
  return {
    version: 1,
    scenarioTier,
    trainingLevel,
    trainee: { templateId: 'synthetic-trainee-a', label: 'Astra Runner', strategyAptitudes: aptitudes },
    waves: [
      syntheticRival(recipes[0], 0, scenarioTier, trainingLevel, aptitudes, '-a'),
      syntheticRival(recipes[1], 1, scenarioTier, trainingLevel, aptitudes, '-b'),
      syntheticRival(recipes[2], 2, scenarioTier, trainingLevel, aptitudes, '-c'),
    ],
  }
}
