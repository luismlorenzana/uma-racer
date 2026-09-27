// Invented fixtures for tests, simulation, and the development touch proof. No original-game data belongs here.
import {
  SPARK_RIVAL_RECIPES,
  type Grade,
  type SparkRivalRecipeId,
  type Strategy,
} from '@racer/domain'
import { sparkRivalDefinition } from './recipes'
import type { SparkRivalDefinition, SparkRivalEncounterV1 } from './types'

export { SPARK_RIVAL_RECIPES }
export type SparkRivalRecipe = SparkRivalRecipeId

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

export function syntheticRival(
  recipe: SparkRivalRecipe,
  wave: 0 | 1 | 2,
  scenarioTier: number,
  trainingLevel: number,
  traineeAptitudes: Readonly<Record<Strategy, Grade>>,
  suffix = '',
): SparkRivalDefinition {
  const strategy = PRESSURE_STYLE[recipe]
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
