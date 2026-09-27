import { describe, expect, it } from 'vitest'
import { type SparkRivalRecipeId, type Strategy, type UmaTemplate } from '@racer/domain'
import { sha256 } from '../pack'
import { normalizeSparkRivals } from './spark-rivals'

const strategies = ['front', 'pace', 'late', 'end'] as const
const styleRecipe: Record<Strategy, SparkRivalRecipeId> = {
  front: 'rush-pressure',
  pace: 'tracker-guard',
  late: 'surge-convert',
  end: 'finisher-delay',
}

function uma(index: number, strategy: Strategy, charaId = `synthetic-character-${index}`): UmaTemplate {
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
      strategy: Object.fromEntries(strategies.map((entry) => [entry, entry === strategy ? 'A' : 'C'])) as UmaTemplate['aptitudes']['strategy'],
    },
    uniqueSkillId: null,
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaceFamilyIds: [],
    imageSource: 'https://example.invalid/synthetic.png',
  }
}

const umas = [
  uma(1, 'front'), uma(2, 'pace'), uma(3, 'late'), uma(4, 'end'), uma(5, 'front'), uma(6, 'pace'),
]

function override() {
  return {
    version: 1,
    scenarios: Array.from({ length: 14 }, (_, index) => ({
      tier: index + 1,
      ordinary: umas.slice(0, 4).map((entry) => ({
        templateId: entry.id,
        recipe: styleRecipe[strategies.find((strategy) => entry.aptitudes.strategy[strategy] === 'A')!],
      })),
      bosses: umas.slice(4, 6).map((entry) => ({ templateId: entry.id, recipe: 'circuit-boss' as const })),
    })),
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('Spark rival override normalization', () => {
  it('joins private identities, reports only aggregate coverage, and sorts independently of input order', () => {
    const first = normalizeSparkRivals(umas, override())
    const shuffled = override()
    shuffled.scenarios.reverse()
    for (const scenario of shuffled.scenarios) {
      scenario.ordinary.reverse()
      scenario.bosses.reverse()
    }
    const second = normalizeSparkRivals([...umas].reverse(), shuffled)

    expect(first.items).toEqual(second.items)
    expect(sha256(JSON.stringify(first.items))).toBe(sha256(JSON.stringify(second.items)))
    expect(first.coverage).toEqual({
      scenarios: 14,
      ordinaryCandidates: 56,
      bossCandidates: 28,
      distinctCharacters: 6,
      recipeCounts: {
        'rush-pressure': 14,
        'tracker-guard': 14,
        'surge-convert': 14,
        'finisher-delay': 14,
        'adaptive-duel': 0,
        'circuit-boss': 28,
      },
      failures: 0,
    })
    expect(JSON.stringify(first.coverage)).not.toContain('synthetic-uma')
  })

  it('allows missing development input and omits the optional pack', () => {
    const result = normalizeSparkRivals(umas, null)
    expect(result.items).toEqual([])
    expect(result.coverage.scenarios).toBe(0)
    expect(result.warnings).toEqual([expect.stringMatching(/catalogue fallback/)])
  })

  it('rejects malformed structure, duplicate/missing tiers, unknown recipes, duplicate templates, and role mismatches', () => {
    expect(() => normalizeSparkRivals(umas, { ...override(), extra: true })).toThrow(/header/)
    const missing = override()
    missing.scenarios.pop()
    expect(() => normalizeSparkRivals(umas, missing)).toThrow(/header/)
    const duplicateTier = override()
    duplicateTier.scenarios[13]!.tier = 13
    expect(() => normalizeSparkRivals(umas, duplicateTier)).toThrow(/tiers 1 through 14/)
    const unknownRecipe = clone(override()) as unknown as { scenarios: { ordinary: { recipe: string }[] }[] }
    unknownRecipe.scenarios[0]!.ordinary[0]!.recipe = 'unknown-recipe'
    expect(() => normalizeSparkRivals(umas, unknownRecipe)).toThrow(/unknown recipe/)
    const duplicate = override()
    duplicate.scenarios[0]!.ordinary[1]!.templateId = duplicate.scenarios[0]!.ordinary[0]!.templateId
    expect(() => normalizeSparkRivals(umas, duplicate)).toThrow(/repeats a template/)
    const wrongRole = override()
    wrongRole.scenarios[0]!.bosses[0]!.recipe = 'adaptive-duel' as 'circuit-boss'
    expect(() => normalizeSparkRivals(umas, wrongRole)).toThrow(/recipe role/)
  })

  it('rejects unresolved identities, style-recipe mismatches, and outfit aliases that do not meet no-self coverage without leaking identities', () => {
    const unknown = override()
    unknown.scenarios[0]!.ordinary[0]!.templateId = 'private-secret-identity'
    expect(() => normalizeSparkRivals(umas, unknown)).toThrow(/tier 1 ordinary\[0\]/)
    try {
      normalizeSparkRivals(umas, unknown)
    } catch (error) {
      expect(String(error)).not.toContain('private-secret-identity')
    }

    const mismatch = override()
    mismatch.scenarios[0]!.ordinary[0]!.recipe = 'tracker-guard'
    expect(() => normalizeSparkRivals(umas, mismatch)).toThrow(/best strategy/)

    const alias = uma(7, 'end', umas[2]!.charaId)
    const insufficient = override()
    insufficient.scenarios[0]!.ordinary[3]!.templateId = alias.id
    expect(() => normalizeSparkRivals([...umas, alias], insufficient)).toThrow(/no-self coverage/)
  })
})
