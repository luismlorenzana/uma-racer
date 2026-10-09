// Invented outfit identity; map/food definitions are original design code, not extracted fixtures.
import { describe, expect, it } from 'vitest'
import { STATS, zeroStats } from '../../types'
import { SCENARIOS } from '../../scenarios'
import { FARM_EXTRA_NODES, createFarmExtraBlock, farmExtraCapacity, farmExtraVector, farmIngredientBlock,
  farmMealId, buyFarmExtraNode, setFarmActiveNodes, parseFarmExtraBlock, previewFarmStats, type FarmResult } from './index'

function take<T>(result: FarmResult<T>): T { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.value }
const outfitId = 'invented-worker'
const unlockedScenarioIds = new Set(SCENARIOS.map(s => s.id))
const context = () => ({ map: createFarmExtraBlock('invented', outfitId, 1), outfitId, scenarioId: 'ura-finale',
  distance: 'sprint' as const, unlockedScenarioIds })

describe('meal-funded shared map and independent distance builds', () => {
  it('has stable names/unique positions, 50 pure/10 pairs/5 Suns, equal total node power and 260 per stat', () => {
    expect(FARM_EXTRA_NODES).toHaveLength(65)
    expect(new Set(FARM_EXTRA_NODES.map(node => node.id)).size).toBe(65)
    expect(new Set(FARM_EXTRA_NODES.map(node => `${node.x}:${node.y}`)).size).toBe(65)
    expect(FARM_EXTRA_NODES.filter(node => node.kind === 'pure')).toHaveLength(50)
    expect(FARM_EXTRA_NODES.filter(node => node.kind === 'dual')).toHaveLength(10)
    expect(FARM_EXTRA_NODES.filter(node => node.kind === 'sun')).toHaveLength(5)
    for (const node of FARM_EXTRA_NODES) expect(STATS.reduce((sum, stat) => sum + node.stats[stat], 0)).toBe(20)
    expect(take(farmExtraVector(FARM_EXTRA_NODES.map(node => node.id)))).toEqual({ speed: 260, stamina: 260, power: 260, guts: 260, wit: 260 })
    const best = [...FARM_EXTRA_NODES].sort((a, b) => b.stats.speed - a.stats.speed).slice(0, farmExtraCapacity(1))
    expect(take(farmExtraVector(best.map(node => node.id))).speed).toBe(256)
    expect(() => farmExtraCapacity(25)).toThrow()
  })
  it('every named node can be purchased FIRST with one matching meal, and duplicate never spends/activates', () => {
    for (const node of FARM_EXTRA_NODES) {
      const input = context(), meal = farmMealId(1, node.signature)
      const result = take(buyFarmExtraNode({ ...input, nodeId: node.id, inventory: { [meal]: 1 } }))
      expect(result.node.name).toBe(node.name)
      expect(result.map.boughtNodeIds).toEqual([node.id])
      expect(result.map.activeByScenario).toEqual({})
      expect(result.inventory[meal]).toBe(0)
      const retry = take(buyFarmExtraNode({ ...input, map: result.map, nodeId: node.id, inventory: {}, autoactivate: true }))
      expect(retry.duplicate).toBe(true)
      expect(retry.map.activeByScenario).toEqual({})
      expect(retry.purchaseId).toBe(result.purchaseId)
      expect(buyFarmExtraNode({ ...input, nodeId: node.id, inventory: { [farmMealId(2, node.signature)]: 1 } }).ok).toBe(false)
    }
  })
  it('shares purchases, NOT active builds, between scenarios/presets; full purchase stays bought/idle', () => {
    const input = context()
    const bought = { ...input.map, boughtNodeIds: FARM_EXTRA_NODES.map(node => node.id) }
    let map = take(setFarmActiveNodes({ ...input, map: bought, nodeIds: FARM_EXTRA_NODES.slice(0, 18).map(node => node.id) }))
    const before = structuredClone(map)
    map = take(setFarmActiveNodes({ ...input, map, scenarioId: 'unity-cup', distance: 'long', nodeIds: ['sun-05'] }))
    expect(map.activeByScenario['ura-finale']).toEqual(before.activeByScenario['ura-finale'])
    expect(map.activeByScenario['unity-cup']).toEqual({ sprint: [], mile: [], medium: [], long: ['sun-05'] })
    expect(map.activeByScenario['trackblazer']).toBeUndefined()
    expect(setFarmActiveNodes({ ...input, map, nodeIds: FARM_EXTRA_NODES.slice(0, 19).map(n => n.id) })).toMatchObject({ ok: false, error: { code: 'capacity' } })
    expect(setFarmActiveNodes({ ...input, map, nodeIds: ['sun-01', 'sun-01'] }).ok).toBe(false)
    expect(setFarmActiveNodes({ ...input, nodeIds: ['sun-01'] }).ok).toBe(false)
    expect(setFarmActiveNodes({ ...input, map, outfitId: 'another', nodeIds: [] }).ok).toBe(false)
    expect(setFarmActiveNodes({ ...input, map, scenarioId: 'project-larc', nodeIds: [] })).toMatchObject({ ok: false, error: { code: 'wrong-block' } })
    const without = { ...map, boughtNodeIds: map.boughtNodeIds.filter(id => id !== 'sun-05'), activeByScenario: before.activeByScenario }
    const purchased = take(buyFarmExtraNode({ ...input, map: without, nodeId: 'sun-05', inventory: { [farmMealId(1, 'sun')]: 1 }, autoactivate: true }))
    expect(purchased.map.activeByScenario['ura-finale']!.sprint).toHaveLength(18)
    expect(purchased.map.boughtNodeIds).toContain('sun-05')
  })
  it.each(SCENARIOS)('validates all four presets at scenario $tier without cross-block state', scenario => {
    const map = { ...createFarmExtraBlock('invented', outfitId, farmIngredientBlock(scenario.tier)), boughtNodeIds: ['sun-01'] }
    for (const distance of ['sprint', 'mile', 'medium', 'long'] as const) {
      const next = take(setFarmActiveNodes({ map, outfitId, scenarioId: scenario.id, distance, unlockedScenarioIds, nodeIds: ['sun-01'] }))
      expect(next.activeByScenario[scenario.id]![distance]).toEqual(['sun-01'])
      expect(parseFarmExtraBlock(JSON.parse(JSON.stringify(next)))).toEqual(next)
    }
  })
  it('rejects future templates, wrong identities, unknown bought/active IDs and unsafe capacities', () => {
    const { map } = context()
    for (const change of [{ schemaVersion: 2 }, { templateVersion: 2 }, { block: 4 }, { extra: 1 },
      { boughtNodeIds: ['not-a-node'] }, { boughtNodeIds: ['sun-01', 'sun-01'] },
      { activeByScenario: { 'ura-finale': { sprint: ['sun-01'], mile: [], medium: [], long: [] } } }]) {
      expect(parseFarmExtraBlock({ ...map, ...change })).toBeNull()
    }
    expect(farmExtraVector(['unknown']).ok).toBe(false)
    expect(farmExtraVector(['sun-01', 'sun-01']).ok).toBe(false)
    expect(() => farmExtraCapacity(NaN)).toThrow()
  })
})

describe('flat post-growth Farm contribution', () => {
  it('takes uncapped values, rounds/caps once and reports only Farm waste without a Foundation/growth multiplier', () => {
    const base = { speed: 1190.4, stamina: 1200.8, power: 100.6, guts: 200, wit: 300 }
    const farm = { speed: 20, stamina: 20, power: 10, guts: 4, wit: 20 }
    const caps = Object.fromEntries(STATS.map(s => [s, 1200])) as typeof farm
    const preview = take(previewFarmStats(base, farm, caps))
    expect(preview.stats).toEqual({ speed: 1200, stamina: 1200, power: 111, guts: 204, wit: 320 })
    expect(preview.beforeCap.speed).toBe(1210.4)
    expect(preview.marginal.speed).toBe(10)
    expect(preview.farmWaste.speed).toBe(10)
    expect(preview.marginal.stamina).toBe(0)
    expect(preview.farmWaste.stamina).toBe(20)
    expect(take(previewFarmStats(base, zeroStats(), caps)).stats).toEqual(preview.baseCapped)
  })
  it('rejects malformed/unsafe stat numbers instead of silently producing nonfinite race stats', () => {
    const caps = { speed: 1200, stamina: 1200, power: 1200, guts: 1200, wit: 1200 }
    for (const bad of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(previewFarmStats({ ...zeroStats(), speed: bad }, zeroStats(), caps).ok).toBe(false)
    }
    expect(previewFarmStats(zeroStats(), { ...zeroStats(), speed: 0.5 }, caps).ok).toBe(false)
  })
})
