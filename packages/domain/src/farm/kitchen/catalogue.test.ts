// Repo-original food definitions; all injected scenario/flavour rows below are invented.
import { describe, expect, it } from 'vitest'
import { STATS } from '../../types'
import { SCENARIOS } from '../../scenarios'
import { FARM_KITCHEN_CATALOGUE, FARM_PROCESSES, FARM_RAW_FAMILIES, FARM_SCENARIO_FLAVOURS, createFarmKitchenCatalogue,
  farmIngredientBlock, farmRawLevel, farmBlockLevel, farmProcessingLevel, farmCookingLevel, farmWorkerProgress,
  applyFarmInventory, legalFarmIngredients, resolveFarmInputs, type FarmScenarioFlavours } from './index'

const invented = (count: number) => Array.from({ length: count }, (_, i) => ({ tier: i + 1, id: `invented-scene-${i + 1}`,
  name: `Invented ${i}`, jpName: 'Invented', jpRelease: '2000-01-01' }))
const row: FarmScenarioFlavours = { vegetables: ['V1', 'V2', 'V3', 'V4', 'V5'], fruit: ['F1', 'F2', 'F3', 'F4', 'F5'], barnTheme: 'Invented' }

describe('original symmetric Farm catalogue', () => {
  it('covers the actual registry with 490 raw, 630 processed, 48 meals and one Energy', () => {
    const counts = (stage: string) => FARM_KITCHEN_CATALOGUE.foods.filter(food => food.stage === stage).length
    expect(SCENARIOS).toHaveLength(14)
    expect([counts('raw'), counts('processed'), counts('meal'), counts('energy')]).toEqual([490, 630, 48, 1])
    expect(FARM_KITCHEN_CATALOGUE.recipes).toHaveLength(1168)
    expect(FARM_KITCHEN_CATALOGUE.foodsById.size).toBe(1169)
    for (const scenario of SCENARIOS) for (const stat of STATS) {
      const foods = FARM_KITCHEN_CATALOGUE.foods.filter(f => f.scenarioId === scenario.id && f.stat === stat)
      expect(foods.filter(f => f.stage === 'raw').map(f => f.family)).toEqual([...FARM_RAW_FAMILIES])
      expect(foods.filter(f => f.stage === 'processed').map(f => f.family)).toEqual(FARM_PROCESSES.map(p => p.id))
    }
  })
  it('has distinct original vegetables, fruit and milk/cheese variants for every scenario', () => {
    expect(new Set(FARM_SCENARIO_FLAVOURS.flatMap(row => row.vegetables)).size).toBe(70)
    expect(new Set(FARM_SCENARIO_FLAVOURS.flatMap(row => row.fruit)).size).toBe(70)
    for (const family of ['milk', 'cheese']) {
      const foods = FARM_KITCHEN_CATALOGUE.foods.filter(food => food.family === family)
      expect(new Set(foods.map(food => food.name)).size).toBe(70)
    }
  })
  it('requires explicit appended rows, adds foods without multiplying same-block meal sinks', () => {
    const fourteen = createFarmKitchenCatalogue(invented(14), Array.from({ length: 14 }, () => row))
    const fifteen = createFarmKitchenCatalogue(invented(15), Array.from({ length: 15 }, () => row))
    const sixteen = createFarmKitchenCatalogue(invented(16), Array.from({ length: 16 }, () => row))
    expect(fifteen.foods.length - fourteen.foods.length).toBe(80)
    expect(sixteen.foods.length - fifteen.foods.length).toBe(96)
    expect(() => createFarmKitchenCatalogue(invented(15), [row])).toThrow()
    expect(() => createFarmKitchenCatalogue(invented(25), Array.from({ length: 25 }, () => row))).toThrow(/capacity/)
    expect(() => createFarmKitchenCatalogue([{ ...invented(1)[0]!, id: '__proto__' }], [row])).toThrow()
    expect(() => createFarmKitchenCatalogue([{ ...invented(1)[0]!, id: 'x'.repeat(120) }], [row])).toThrow(/bound/)
    expect(() => createFarmKitchenCatalogue([{ ...invented(1)[0]!, tier: 2 }], [row])).toThrow()
  })
  it('every processing/cooking slot has known same-block sources and its DAG is raw → processed → meal', () => {
    for (const recipe of FARM_KITCHEN_CATALOGUE.recipes) {
      for (const slot of recipe.inputs) {
        const candidates = legalFarmIngredients(FARM_KITCHEN_CATALOGUE, recipe, slot)
        expect(candidates.length).toBeGreaterThan(0)
        expect(candidates.every(food => food.block === recipe.block && food.stat === slot.stat)).toBe(true)
        expect(candidates.every(food => food.potency === (slot.stage === 'raw' ? 1 : 2))).toBe(true)
        if (recipe.kind === 'processing') expect(candidates).toHaveLength(1)
      }
    }
  })
  it('concrete input slots reject wrong stat, block, stage, arbitrary ingredients and split allocations', () => {
    const recipe = FARM_KITCHEN_CATALOGUE.recipesById.get('farm:meal:b1:speed')!
    const valid = { 'raw-speed': 'farm:raw:ura-finale:vegetable:speed', 'processed-speed': 'farm:processed:unity-cup:cheese:speed' }
    expect(resolveFarmInputs(FARM_KITCHEN_CATALOGUE, recipe.id, 4, valid)).toMatchObject({ ok: true,
      value: [{ amount: 4 }, { amount: 4 }] })
    for (const item of ['invented-points', 'farm:raw:ura-finale:vegetable:stamina', 'farm:raw:project-larc:vegetable:speed',
      'farm:processed:ura-finale:cheese:speed']) {
      expect(resolveFarmInputs(FARM_KITCHEN_CATALOGUE, recipe.id, 1, { ...valid, 'raw-speed': item }).ok).toBe(false)
    }
    expect(resolveFarmInputs(FARM_KITCHEN_CATALOGUE, recipe.id, 0, valid).ok).toBe(false)
    expect(resolveFarmInputs(FARM_KITCHEN_CATALOGUE, recipe.id, 5, valid).ok).toBe(false)
    expect(resolveFarmInputs(FARM_KITCHEN_CATALOGUE, recipe.id, NaN, valid).ok).toBe(false)
    expect(resolveFarmInputs(FARM_KITCHEN_CATALOGUE, recipe.id, 1, { ...valid, extra: 'invented' }).ok).toBe(false)
  })
  it('debits before crediting without borrowing, mutation, reserved keys or unsafe inventory arithmetic', () => {
    const bag = { 'invented-a': 2, 'other-mode:item': 3 }, snapshot = structuredClone(bag)
    expect(applyFarmInventory(bag, [{ itemId: 'invented-a', amount: 3 }], [{ itemId: 'invented-a', amount: 6 }]).ok).toBe(false)
    expect(bag).toEqual(snapshot)
    expect(applyFarmInventory(bag, [{ itemId: 'invented-a', amount: 2 }], [{ itemId: 'invented-b', amount: 6 }]))
      .toEqual({ ok: true, value: { 'invented-a': 0, 'other-mode:item': 3, 'invented-b': 6 } })
    expect(applyFarmInventory({ 'invented-a': Number.MAX_SAFE_INTEGER }, [], [{ itemId: 'invented-a', amount: 1 }]).ok).toBe(false)
    expect(applyFarmInventory(bag, [], [{ itemId: '__proto__', amount: 1 }]).ok).toBe(false)
    expect(applyFarmInventory(bag, [{ itemId: 'invented-a', amount: -1 }], []).ok).toBe(false)
    expect(applyFarmInventory({ 'invented-a': NaN }, [], []).ok).toBe(false)
  })
})

describe('independent EXP and registry gates', () => {
  it.each([1, 6, 9, 11, 41, 50, 51, 56, 59, 101, 131])('level %i uses lifetime EXP with two completions/level', level => {
    expect(farmWorkerProgress((level - 1) * 24)).toEqual({ level, remainder: 0, toNext: 24 })
    expect(farmWorkerProgress((level - 1) * 24 + 12)).toEqual({ level, remainder: 12, toNext: 12 })
  })
  it('keeps no cap, validates unsafe values and retains block-local recipe gates', () => {
    expect(farmWorkerProgress(1176).level).toBe(50)
    expect(farmWorkerProgress(24 * 200).level).toBe(201)
    expect([1, 6, 11, 14].map(farmIngredientBlock)).toEqual([1, 2, 3, 3])
    expect([1, 2, 3].map(farmBlockLevel)).toEqual([1, 51, 101])
    expect([1, 2, 3].map(farmProcessingLevel)).toEqual([6, 56, 106])
    expect([1, 2, 3].map(farmCookingLevel)).toEqual([9, 59, 109])
    expect(SCENARIOS.map(s => farmRawLevel(s.tier))).toEqual([1, 11, 21, 31, 41, 51, 61, 71, 81, 91, 101, 111, 121, 131])
    for (const bad of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => farmWorkerProgress(bad)).toThrow()
    expect(() => farmRawLevel(Number.MAX_SAFE_INTEGER)).toThrow()
  })
})
