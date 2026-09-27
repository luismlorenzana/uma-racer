import { describe, expect, it } from 'vitest'
import {
  SPARK_RIVAL_RECIPES,
  parseSparkRivalContentPack,
  type SparkRivalContentPackV1,
  type SparkRivalRecipeId,
  type Strategy,
} from './index'

const strategies = ['front', 'pace', 'late', 'end'] as const
const styleRecipe: Record<Strategy, SparkRivalRecipeId> = {
  front: 'rush-pressure',
  pace: 'tracker-guard',
  late: 'surge-convert',
  end: 'finisher-delay',
}

function pack(): SparkRivalContentPackV1 {
  return {
    version: '1',
    items: Array.from({ length: 14 }, (_, index) => {
      const tier = index + 1
      return {
        id: `tier:${tier}`,
        tier,
        ordinary: strategies.map((strategy, candidate) => ({
          templateId: `synthetic-uma-${tier}-${candidate + 1}`,
          charaId: `synthetic-character-${candidate + 1}`,
          strategy,
          recipe: styleRecipe[strategy],
        })),
        bosses: [0, 1].map((candidate) => ({
          templateId: `synthetic-boss-${tier}-${candidate + 1}`,
          charaId: `synthetic-character-${candidate + 5}`,
          strategy: strategies[(candidate + tier) % strategies.length]!,
          recipe: 'circuit-boss' as const,
        })),
      }
    }),
  }
}

describe('Spark rival private content pack', () => {
  it('strictly parses and canonically sorts all fourteen synthetic scenarios', () => {
    const raw = pack()
    raw.items.reverse()
    raw.items[0]!.ordinary.reverse()

    const parsed = parseSparkRivalContentPack(JSON.parse(JSON.stringify(raw)) as unknown)

    expect(parsed.items.map((item) => item.tier)).toEqual(Array.from({ length: 14 }, (_, index) => index + 1))
    expect(parsed.items[13]!.ordinary.map((candidate) => candidate.charaId)).toEqual([
      'synthetic-character-1', 'synthetic-character-2', 'synthetic-character-3', 'synthetic-character-4',
    ])
    expect(SPARK_RIVAL_RECIPES).toEqual([
      'rush-pressure', 'tracker-guard', 'surge-convert', 'finisher-delay', 'adaptive-duel', 'circuit-boss',
    ])
  })

  it('rejects header, tier, id, key, duplicate, role, strategy, and coverage errors', () => {
    const mutate = (change: (value: Record<string, unknown>) => void) => {
      const value = JSON.parse(JSON.stringify(pack())) as Record<string, unknown>
      change(value)
      return () => parseSparkRivalContentPack(value)
    }
    expect(mutate((value) => { value.version = 2 })).toThrow(/header/)
    expect(mutate((value) => { (value.items as unknown[]).pop() })).toThrow(/header/)
    expect(mutate((value) => { ((value.items as Record<string, unknown>[])[0]!).tier = 2 })).toThrow(/tiers 1 through 14|scenario id/)
    expect(mutate((value) => { ((value.items as Record<string, unknown>[])[0]!).id = 'synthetic-wrong' })).toThrow(/scenario id/)
    expect(mutate((value) => { ((value.items as Record<string, unknown>[])[0]!).extra = true })).toThrow(/scenario/)
    expect(mutate((value) => {
      const ordinary = ((value.items as Record<string, unknown>[])[0]!.ordinary as Record<string, unknown>[])
      ordinary[1]!.templateId = ordinary[0]!.templateId
    })).toThrow(/Duplicate/)
    expect(mutate((value) => {
      const bosses = ((value.items as Record<string, unknown>[])[0]!.bosses as Record<string, unknown>[])
      bosses[0]!.recipe = 'rush-pressure'
    })).toThrow(/recipe role/)
    expect(mutate((value) => {
      const ordinary = ((value.items as Record<string, unknown>[])[0]!.ordinary as Record<string, unknown>[])
      ordinary[0]!.strategy = 'pace'
    })).toThrow(/recipe strategy/)
    expect(mutate((value) => {
      const ordinary = ((value.items as Record<string, unknown>[])[0]!.ordinary as Record<string, unknown>[])
      ordinary[3]!.charaId = ordinary[2]!.charaId
    })).toThrow(/character coverage/)
  })

  it('never includes a rejected private identity in an error', () => {
    const raw = pack() as unknown as Record<string, unknown>
    const candidate = ((raw.items as Record<string, unknown>[])[0]!.ordinary as Record<string, unknown>[])[0]!
    candidate.templateId = 'private-secret/invalid'
    expect(() => parseSparkRivalContentPack(raw)).toThrow(/tier 1 ordinary\[0\]/)
    try {
      parseSparkRivalContentPack(raw)
    } catch (error) {
      expect(String(error)).not.toContain('private-secret')
    }
  })
})
