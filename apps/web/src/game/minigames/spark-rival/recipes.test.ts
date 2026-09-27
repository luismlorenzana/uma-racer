import { describe, expect, it } from 'vitest'
import { SPARK_RIVAL_RECIPES, type SparkRivalRecipeId, type Strategy } from '@racer/domain'
import { syntheticAptitudes } from './fixtures'
import { sparkRivalDefinition } from './recipes'
import { parseSparkRivalEncounter, type SparkRivalEncounterV1 } from './types'

const strategyByRecipe: Record<SparkRivalRecipeId, Strategy> = {
  'rush-pressure': 'front',
  'tracker-guard': 'pace',
  'surge-convert': 'late',
  'finisher-delay': 'end',
  'adaptive-duel': 'pace',
  'circuit-boss': 'end',
}

describe('Spark rival recipes', () => {
  it('expands every checked-in recipe into a complete bounded T071 definition', () => {
    const traineeAptitudes = syntheticAptitudes('pace')
    for (const recipe of SPARK_RIVAL_RECIPES) {
      const definition = sparkRivalDefinition({
        id: `synthetic-${recipe}`,
        label: `Synthetic ${recipe}`,
        recipe,
        strategy: strategyByRecipe[recipe],
        wave: recipe === 'circuit-boss' ? 2 : 0,
        scenarioTier: 14,
        trainingLevel: 10,
        traineeAptitudes,
      })
      const encounter: SparkRivalEncounterV1 = {
        version: 1,
        scenarioTier: 14,
        trainingLevel: 10,
        trainee: { templateId: 'synthetic-trainee', label: 'Synthetic Trainee', strategyAptitudes: traineeAptitudes },
        waves: [definition, { ...definition, id: `${definition.id}-2` }, { ...definition, id: `${definition.id}-3` }],
      }
      expect(parseSparkRivalEncounter(encounter)).not.toBeNull()
      expect(definition.intents.length).toBeGreaterThan(0)
      expect(definition.intents.length).toBeLessThanOrEqual(3)
      expect(definition.phases.length).toBeLessThanOrEqual(1)
    }
  })
})
