// Invented fixtures for tests, simulation, and the development touch proof. No original-game data belongs here.
import {
  SPARK_RIVAL_RECIPES,
  type SparkRivalRecipeId,
} from '../../spark-rival'
import type { Grade, Strategy } from '../../types'
import { sparkRivalDefinition } from './recipes'
import type { SparkRivalDefinition, SparkRivalEncounterV1 } from './types'

export type SparkRivalRecipe = SparkRivalRecipeId

const PRESSURE_STYLE: Record<SparkRivalRecipe, Strategy> = {
  'rush-pressure': 'front',
  'tracker-guard': 'pace',
  'surge-convert': 'late',
  'finisher-delay': 'end',
  'adaptive-duel': 'pace',
  'circuit-boss': 'end',
}

export function syntheticAptitudes(best: Strategy, bestGrade: Grade = 'A', otherGrade: Grade = 'B'): Record<Strategy, Grade> {
  return {
    front: best === 'front' ? bestGrade : otherGrade,
    pace: best === 'pace' ? bestGrade : otherGrade,
    late: best === 'late' ? bestGrade : otherGrade,
    end: best === 'end' ? bestGrade : otherGrade,
  }
}

export function syntheticRival(
  recipe: SparkRivalRecipe,
  wave: 0 | 1 | 2,
  scenarioTier: number,
  trainingLevel: number,
  traineeAptitudes: Readonly<Record<Strategy, Grade>>,
  suffix = '',
  strategyOverride?: Strategy,
): SparkRivalDefinition {
  const strategy = strategyOverride ?? PRESSURE_STYLE[recipe]
  return sparkRivalDefinition({
    id: `synthetic-rival-${wave + 1}${suffix}`,
    label: wave === 2 ? 'Circuit Captain' : `Training Rival ${wave + 1}`,
    recipe,
    strategy,
    wave,
    scenarioTier,
    trainingLevel,
    traineeAptitudes,
  })
}

export interface SyntheticEncounterOptions {
  scenarioTier?: number
  trainingLevel?: number
  traineeBest?: Strategy
  bestGrade?: Grade
  otherGrade?: Grade
  recipes?: readonly [SparkRivalRecipe, SparkRivalRecipe, SparkRivalRecipe]
  adaptiveStrategy?: Strategy
  bossStrategy?: Strategy
}

export function syntheticSparkEncounter(options: SyntheticEncounterOptions = {}): SparkRivalEncounterV1 {
  const scenarioTier = options.scenarioTier ?? 1
  const trainingLevel = options.trainingLevel ?? 1
  const traineeBest = options.traineeBest ?? 'pace'
  const aptitudes = syntheticAptitudes(traineeBest, options.bestGrade, options.otherGrade)
  const recipes = options.recipes ?? ['rush-pressure', 'surge-convert', 'circuit-boss']
  return {
    version: 1,
    scenarioTier,
    trainingLevel,
    trainee: { templateId: 'synthetic-trainee-a', label: 'Astra Runner', strategyAptitudes: aptitudes },
    waves: [
      syntheticRival(recipes[0], 0, scenarioTier, trainingLevel, aptitudes, '-a', recipes[0] === 'adaptive-duel' ? options.adaptiveStrategy : undefined),
      syntheticRival(recipes[1], 1, scenarioTier, trainingLevel, aptitudes, '-b', recipes[1] === 'adaptive-duel' ? options.adaptiveStrategy : undefined),
      syntheticRival(recipes[2], 2, scenarioTier, trainingLevel, aptitudes, '-c', recipes[2] === 'circuit-boss' ? options.bossStrategy : undefined),
    ],
  }
}
