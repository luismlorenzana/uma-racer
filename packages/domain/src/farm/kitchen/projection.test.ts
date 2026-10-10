// Public rules plus invented ownership, no game data.
import { describe, expect, it } from 'vitest'
import { DISTANCE_CATEGORIES, STATS, zeroStats } from '../../types'
import { SCENARIOS } from '../../scenarios'
import { FARM_EXTRA_NODES, buyFarmExtraNode, createFarmExtraBlock, farmExtraCapacity, farmExtraVector, projectFarmExtraStats, setFarmActiveNodes } from './extra-map'
import { farmIngredientBlock } from './progression'
import { farmMealId } from './catalogue'
const generation = 'invented-generation', outfitId = 'invented-outfit'
describe('the canonical Farm projection boundary', () => {
  it('joins all fourteen actual units and four distances; new units/blocks/outfits do not inherit a build', () => {
    for (const scenario of SCENARIOS) {
      const empty = createFarmExtraBlock(generation, outfitId, farmIngredientBlock(scenario.tier))
      let map = { ...empty, boughtNodeIds: FARM_EXTRA_NODES.map(n => n.id) }
      for (const [i, distance] of DISTANCE_CATEGORIES.entries()) {
        const nodeIds = FARM_EXTRA_NODES.slice(i, i + farmExtraCapacity(scenario.tier)).map(n => n.id)
        const result = setFarmActiveNodes({ map, outfitId, scenarioId: scenario.id, distance, nodeIds, unlockedScenarioIds: new Set([scenario.id]) })
        if (!result.ok) throw new Error(result.error.detail)
        map = result.value
        expect(projectFarmExtraStats({ map, generation, outfitId, scenarioId: scenario.id, distance })).toEqual(farmExtraVector(nodeIds))
        for (const other of DISTANCE_CATEGORIES.slice(i + 1)) expect(map.activeByScenario[scenario.id]?.[other]).toEqual([])
      }
      const next = SCENARIOS.find(s => s.tier === scenario.tier + 1)
      if (next && farmIngredientBlock(next.tier) === map.block) expect(projectFarmExtraStats({ map, generation, outfitId, scenarioId: next.id, distance: 'long' })).toEqual({ ok: true, value: zeroStats() })
      expect(projectFarmExtraStats({ map, generation, outfitId: 'another-outfit', scenarioId: scenario.id, distance: 'long' }).ok).toBe(false)
      expect(projectFarmExtraStats({ generation, outfitId, scenarioId: scenario.id, distance: 'long' })).toEqual({ ok: true, value: zeroStats() })
    }
  })
  it.each(FARM_EXTRA_NODES)('can buy $name first, with exactly its signature, then project it', node => {
    const input = { map: createFarmExtraBlock(generation, outfitId, 1), outfitId, scenarioId: 'ura-finale', distance: 'mile' as const,
      nodeId: node.id, autoactivate: true, unlockedScenarioIds: new Set(['ura-finale']), inventory: { [farmMealId(1, node.signature)]: 1 } }
    const bought = buyFarmExtraNode(input)
    if (!bought.ok) throw new Error(bought.error.detail)
    expect(projectFarmExtraStats({ ...input, map: bought.value.map, generation })).toEqual({ ok: true, value: node.stats })
    expect(STATS.reduce((n, stat) => n + node.stats[stat], 0)).toBe(20)
    expect(buyFarmExtraNode({ ...input, inventory: { [farmMealId(2, node.signature)]: 1 } }).ok).toBe(false)
    expect(buyFarmExtraNode({ ...input, map: bought.value.map, inventory: {} }).ok).toBe(true)
  })
  it('fails visibly on future templates, null/corrupt rows and wrong generation/block rather than legacy fallback', () => {
    const map = createFarmExtraBlock(generation, outfitId, 1), input = { generation, outfitId, scenarioId: 'ura-finale', distance: 'sprint' as const }
    for (const value of [null, { ...map, templateVersion: 2 }, { ...map, generation: 'other' }, { ...map, block: 2 }]) expect(projectFarmExtraStats({ ...input, map: value }).ok).toBe(false)
  })
})
