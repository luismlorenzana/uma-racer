import { SPARK_RIVAL_ACTION_LIMIT, SPARK_RIVAL_PATH_LIMIT } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { syntheticSparkEncounter } from './fixtures'
import { parseSparkRivalAction, parseSparkRivalActions, parseSparkRivalEncounter } from './types'

describe('Spark Rival parsers', () => {
  it('round-trips one strict synthetic encounter and rejects extra keys', () => {
    const encounter = syntheticSparkEncounter()
    expect(parseSparkRivalEncounter(JSON.parse(JSON.stringify(encounter)))).toEqual(encounter)
    expect(parseSparkRivalEncounter({ ...encounter, surprise: true })).toBeNull()
    expect(parseSparkRivalEncounter({ ...encounter, version: 2 })).toBeNull()
    expect(parseSparkRivalEncounter({ ...encounter, scenarioTier: 15 })).toBeNull()
    expect(parseSparkRivalEncounter({ ...encounter, trainingLevel: Number.NaN })).toBeNull()
    expect(parseSparkRivalEncounter({ ...encounter, waves: [encounter.waves[0]] })).toBeNull()
    expect(parseSparkRivalEncounter({ ...encounter, waves: [encounter.waves[0], encounter.waves[0], encounter.waves[2]] })).toBeNull()
  })

  it('accepts diagonal/revisited paths and rejects malformed or unbounded actions', () => {
    const action = {
      type: 'drag',
      path: [{ row: 0, column: 0 }, { row: 1, column: 1 }, { row: 0, column: 0 }],
      movementMs: 7_000,
    }
    expect(parseSparkRivalAction(action)).toEqual(action)
    expect(parseSparkRivalAction({ ...action, movementMs: 0 })).toBeNull()
    expect(parseSparkRivalAction({ ...action, movementMs: 7_001 })).toBeNull()
    expect(parseSparkRivalAction({ ...action, path: [action.path[0]] })).toBeNull()
    expect(parseSparkRivalAction({ ...action, path: [{ row: 0, column: 0 }, { row: 0, column: 2 }] })).toBeNull()
    expect(parseSparkRivalAction({ ...action, path: [{ row: 0, column: 0 }, { row: 0, column: 0 }] })).toBeNull()
    expect(parseSparkRivalAction({ ...action, path: [{ row: -1, column: 0 }, { row: 0, column: 0 }] })).toBeNull()
    expect(parseSparkRivalAction({ ...action, extra: true })).toBeNull()
    expect(parseSparkRivalAction({ type: 'spark-shift' })).toEqual({ type: 'spark-shift' })
    expect(parseSparkRivalAction({ type: 'spark-shift', extra: true })).toBeNull()
    expect(parseSparkRivalAction({ ...action, path: Array.from({ length: SPARK_RIVAL_PATH_LIMIT }, (_, index) => ({ row: 0, column: index % 2 })) })).not.toBeNull()
    expect(parseSparkRivalAction({ ...action, path: Array.from({ length: SPARK_RIVAL_PATH_LIMIT + 1 }, (_, index) => ({ row: 0, column: index % 2 })) })).toBeNull()
  })

  it('bounds the replay action list', () => {
    expect(parseSparkRivalActions([])).toEqual([])
    expect(parseSparkRivalActions(Array.from({ length: SPARK_RIVAL_ACTION_LIMIT }, () => ({ type: 'spark-shift' })))).toHaveLength(SPARK_RIVAL_ACTION_LIMIT)
    expect(parseSparkRivalActions(Array.from({ length: SPARK_RIVAL_ACTION_LIMIT + 1 }, () => ({ type: 'spark-shift' })))).toBeNull()
    expect(parseSparkRivalActions([null])).toBeNull()
  })

  it('rejects every unbounded rival script shape without throwing', () => {
    const encounter = syntheticSparkEncounter()
    const rival = encounter.waves[0]
    const candidates: unknown[] = [
      { ...rival, maxResolve: Number.POSITIVE_INFINITY },
      { ...rival, openingCountdown: 0 },
      { ...rival, intents: [] },
      { ...rival, intents: Array.from({ length: 9 }, () => ({ type: 'pressure', amount: 1 })) },
      { ...rival, intents: [{ type: 'pressure', amount: 0 }] },
      { ...rival, intents: [{ type: 'guard', reduction: 1, comboThreshold: 4 }] },
      { ...rival, intents: [{ type: 'convert', source: 'front', target: 'front', maximum: 4 }] },
      { ...rival, phases: [{ atResolvePercent: 0, intent: { type: 'enrage', multiplier: 1.5 } }] },
      { ...rival, phases: Array.from({ length: 3 }, (_, index) => ({ atResolvePercent: 25 + index, intent: { type: 'change-style', strategy: 'pace' } })) },
    ]
    for (const candidate of candidates) {
      const parsed = parseSparkRivalEncounter({ ...encounter, waves: [candidate, encounter.waves[1], encounter.waves[2]] })
      expect(parsed).toBeNull()
    }
  })
})
