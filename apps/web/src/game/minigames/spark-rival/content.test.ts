import { describe, expect, it } from 'vitest'
import {
  parseSparkRivalContentPack,
  type SparkRivalContentPackV1,
  type SparkRivalRecipeId,
  type Strategy,
  type UmaTemplate,
} from '@racer/domain'
import { buildSparkRivalEncounter, selectSparkEncounter } from './content'
import { parseSparkRivalEncounter } from './types'

const strategies = ['front', 'pace', 'late', 'end'] as const
const recipe: Record<Strategy, SparkRivalRecipeId> = {
  front: 'rush-pressure', pace: 'tracker-guard', late: 'surge-convert', end: 'finisher-delay',
}

function uma(index: number, best: Strategy, charaId = `synthetic-character-${index}`): UmaTemplate {
  return {
    id: `synthetic-uma-${index}`,
    charaId,
    name: `Synthetic Runner ${index}`,
    outfit: null,
    jpRelease: '2099-01-01',
    globalRelease: null,
    starter: false,
    baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: {
      surface: { turf: 'A', dirt: 'G' },
      distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' },
      strategy: Object.fromEntries(strategies.map((strategy) => [strategy, strategy === best ? 'A' : 'C'])) as UmaTemplate['aptitudes']['strategy'],
    },
    uniqueSkillId: null,
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaceFamilyIds: [],
    imageSource: 'https://example.invalid/synthetic.png',
  }
}

const catalogue = [
  uma(1, 'front'), uma(2, 'pace'), uma(3, 'late'), uma(4, 'end'), uma(5, 'front'), uma(6, 'pace'), uma(7, 'late'),
  uma(8, 'pace', 'synthetic-character-2'),
]

function pack(): SparkRivalContentPackV1 {
  return {
    version: '1',
    items: Array.from({ length: 14 }, (_, index) => ({
      id: `tier:${index + 1}`,
      tier: index + 1,
      ordinary: [catalogue[0]!, catalogue[1]!, catalogue[7]!, catalogue[2]!, catalogue[3]!, catalogue[4]!]
        .map((entry) => {
          const best = strategies.find((strategy) => entry.aptitudes.strategy[strategy] === 'A')!
          return { templateId: entry.id, charaId: entry.charaId, strategy: best, recipe: recipe[best] }
        }),
      bosses: [catalogue[0]!, catalogue[5]!, catalogue[6]!].map((entry) => ({
        templateId: entry.id,
        charaId: entry.charaId,
        strategy: strategies.find((strategy) => entry.aptitudes.strategy[strategy] === 'A')!,
        recipe: 'circuit-boss' as const,
      })),
    })),
  }
}

describe('Spark rival encounter selection', () => {
  it('pins a seeded authored lineup while excluding the trainee and alternate outfits', () => {
    const rosters = parseSparkRivalContentPack(pack()).items
    const selection = selectSparkEncounter(rosters, catalogue, 'synthetic-character-1', 1, 'fixed-seed-t072')
    const ids = [...selection.ordinary, selection.boss].map((entry) => entry.templateId)

    expect(selection.diagnostic).toEqual({ source: 'authored', reason: null, severe: false })
    expect(ids).toEqual(['synthetic-uma-8', 'synthetic-uma-3', 'synthetic-uma-6'])
    expect(new Set([...selection.ordinary, selection.boss].map((entry) => entry.charaId)).size).toBe(3)
    expect(ids).not.toContain('synthetic-uma-1')
    expect(ids.filter((id) => id === 'synthetic-uma-2' || id === 'synthetic-uma-8')).toHaveLength(1)
  })

  it('pins missing-pack, missing-tier, exhausted-roster, and tiny-catalogue fallbacks', () => {
    const missing = selectSparkEncounter(null, catalogue, 'synthetic-character-1', 3, 'fallback-seed')
    expect(missing.diagnostic).toEqual({ source: 'fallback', reason: 'missing-pack', severe: false })
    expect([...missing.ordinary, missing.boss].map((entry) => entry.templateId)).toEqual([
      'synthetic-uma-7', 'synthetic-uma-5', 'synthetic-uma-4',
    ])
    expect(selectSparkEncounter([], catalogue, 'synthetic-character-1', 3, 'fallback-seed').diagnostic.reason)
      .toBe('tier-missing')

    const rosters = parseSparkRivalContentPack(pack()).items
    expect(selectSparkEncounter(rosters, catalogue.slice(0, 4), 'synthetic-character-1', 1, 'fixed-seed-t072').diagnostic.reason)
      .toBe('roster-exhausted')

    const tiny = selectSparkEncounter(null, catalogue.slice(0, 3), 'synthetic-character-1', 1, 'tiny-seed')
    expect(tiny.diagnostic).toEqual({ source: 'fallback', reason: 'roster-exhausted', severe: true })
    expect([...tiny.ordinary, tiny.boss].every((entry) => entry.templateId === null && entry.charaId === null)).toBe(true)
  })

  it('is stable after pack JSON round-trip and builds every tier into a valid replay snapshot', () => {
    const first = parseSparkRivalContentPack(pack()).items
    const roundTrip = parseSparkRivalContentPack(JSON.parse(JSON.stringify({ version: '1', items: first })) as unknown).items
    for (let tier = 1; tier <= 14; tier += 1) {
      const left = selectSparkEncounter(first, catalogue, 'synthetic-character-1', tier, 'offline-stable-seed')
      const right = selectSparkEncounter(roundTrip, catalogue, 'synthetic-character-1', tier, 'offline-stable-seed')
      expect(right).toEqual(left)
      const encounter = buildSparkRivalEncounter(left, catalogue[0]!, tier, Math.min(10, tier))
      expect(parseSparkRivalEncounter(encounter)).toEqual(encounter)
      expect(new Set(encounter.waves.map((wave) => wave.id)).size).toBe(3)
    }
  })
})
