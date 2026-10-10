// Card/base and buff invariance; invented cards/growth, no extracted fixtures (docs/technical/farm-kitchen-implementation.md#8-extra-stats-and-racing).
import { expect, it } from 'vitest'
import { capProfile, constellationTemplate, deriveStats, type CardNodeState, type NodeAssignment } from '../../constellation'
import { SCENARIOS } from '../../scenarios'
import { STATS, zeroStats, type Stats } from '../../types'
import { previewFarmStats } from './extra-map'

it('retains exact card-only stats/SP through all 14 buffs, all star ranks, eras and both growth profiles', () => {
  const baseStats = { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }
  const profile = { trainingBonus: 1, friendshipBonus: 1, statBonus: 1, skillPointBonus: 1, specialtyPriority: 1, hintFrequency: 1, raceBonus: 1, initialStats: 1 }
  for (const scenario of SCENARIOS) for (const stars of [0, 1, 2, 3]) for (const era of [1, scenario.tier]) {
    for (const growthRates of [zeroStats(), { speed: 0.1, stamina: 0.1, power: 0, guts: 0, wit: 0 }]) {
      const template = constellationTemplate(scenario.tier), deck = ['speed', 'speed', 'stamina', 'wit', 'wit', 'friend'] as const
      const ids = deck.map((type, index) => `invented-${type}-${index}`)
      const cards = new Map<string, CardNodeState>(ids.map((id, index) => [id, {
        template: { id, type: deck[index]!, era, effectProfile: profile, hintSkillIds: [] }, stars,
      }]))
      const assignments: Record<string, NodeAssignment> = {}
      template.nodes.filter(n => n.kind === 'card').forEach((node, index) => { assignments[node.id] = { kind: 'card', cardId: ids[index % 6]! } })
      const card = deriveStats({ tier: scenario.tier, trainingLevel: 10, template, assignments, cardSetIds: ids, cards,
        umaTemplate: { baseStats, growthRates } })
      const before = Object.fromEntries(STATS.map(stat => [stat, baseStats[stat] + card.raw[stat] * (1 + growthRates[stat])])) as Stats
      const noFarm = previewFarmStats(before, zeroStats(), capProfile(scenario.tier))
      expect(noFarm.ok).toBe(true)
      if (!noFarm.ok) throw new Error(noFarm.error.detail)
      expect(noFarm.value.stats).toEqual(card.stats)
      const joined = deriveStats({ tier: scenario.tier, trainingLevel: 10, template, assignments, cardSetIds: ids, cards,
        umaTemplate: { baseStats, growthRates }, farmStats: zeroStats() })
      const { farmSources: _sources, ...cardOnly } = joined
      expect(cardOnly).toEqual(card)
      const snapshot = structuredClone(card)
      const farm = previewFarmStats(before, { speed: 20, stamina: 20, power: 20, guts: 20, wit: 20 }, capProfile(scenario.tier))
      expect(farm.ok).toBe(true)
      if (!farm.ok) throw new Error(farm.error.detail)
      for (const stat of STATS) expect(farm.value.beforeCap[stat]).toBe(before[stat] + 20)
      const live = deriveStats({ tier: scenario.tier, trainingLevel: 10, template, assignments, cardSetIds: ids, cards,
        umaTemplate: { baseStats, growthRates }, farmStats: { speed: 20, stamina: 20, power: 20, guts: 20, wit: 20 },
        extraStats: { unlocked: { speed: 4, stamina: 2, power: 0, guts: 0, wit: 0 }, active: ['speed-1', 'stamina-1'] } })
      expect(live.stats).toEqual(farm.value.stats)
      expect(live.raw).toEqual(card.raw) // Foundation/Shared Light never read Farm or retired crop evidence.
      expect(live.assignedNodes).toBe(card.assignedNodes)
      expect(live.farmSources?.beforeCap).toEqual(farm.value.beforeCap)
      expect(card).toEqual(snapshot)
    }
  }
})

it('adds flat Farm before the single rounding/cap boundary and exposes honest +0/marginal waste', () => {
  const input = { tier: 1, trainingLevel: 1, template: constellationTemplate(1), assignments: {}, cardSetIds: [], cards: new Map(),
    umaTemplate: { baseStats: { speed: 1199.49, stamina: 1200, power: 100.49, guts: 100.5, wit: 100 }, growthRates: zeroStats() } }
  const result = deriveStats({ ...input, farmStats: { speed: 20, stamina: 20, power: 4, guts: 4, wit: 4 } })
  expect(result.stats).toEqual({ speed: 1200, stamina: 1200, power: 104, guts: 105, wit: 104 })
  expect(result.farmSources?.marginal).toEqual({ speed: 1, stamina: 0, power: 4, guts: 4, wit: 4 })
  expect(result.farmSources?.waste).toEqual({ speed: 19, stamina: 20, power: 0, guts: 0, wit: 0 })
  expect(result.raw).toEqual(zeroStats())
  expect(() => deriveStats({ ...input, farmStats: { ...zeroStats(), speed: NaN } })).toThrow(/vector/)
})
