import { describe, expect, it } from 'vitest'
import { createFarmKitchenWorker, emptyFarmRecipes, FARM_KITCHEN_CATALOGUE, farmWorkerProgress, type FarmStationId } from '@racer/domain/farm/kitchen'
import { buildFarmCrew, ingredientChoices, maxSuppliedBatch, planFarmWishlist, recipeAvailability, repeatedIngredientChoices, type FarmWishlistGoal } from './presentation'
import type { FarmKitchenView } from './view'

const generation = 'farm-kitchen-v1'
const revision = { generation, versions: {}, pending: '0' }
function view(): FarmKitchenView {
  const worker = createFarmKitchenWorker(generation, 'invented-a', 0)
  return {
    mode: 'active', message: null, now: 1, control: { schemaVersion: 1, generation, phase: 'active', cohortDigest: 'a'.repeat(64), archiveDigest: 'b'.repeat(64), outfitCount: 1, pageCount: 1, nextOutfitIndex: 1, createdAt: 0, activatedAt: 1 }, revision,
    stations: Array.from({ length: 6 }, (_, index) => ({ id: `kitchen-${index + 1}` as FarmStationId, outfitId: index === 0 ? 'invented-a' : null,
      attempt: 0, job: null, status: index === 0 ? 'idle' as const : 'empty' as const, pending: false, remainingMs: 0, legacy: null })),
    workers: { 'invented-a': { canonical: worker, projected: worker, progress: farmWorkerProgress(0), pending: false } },
    recipes: Object.fromEntries(FARM_KITCHEN_CATALOGUE.blocks.map(block => [`b${block}`, { canonical: emptyFarmRecipes(generation, block), projected: emptyFarmRecipes(generation, block), pending: false }])),
    items: {}, extra: null, pending: [], receipts: {},
  }
}

describe('Farm kitchen presentation', () => {
  it('sorts outfits by Farm level, display name, outfit and id without collapsing characters', () => {
    const current = view()
    const high = createFarmKitchenWorker(generation, 'invented-b', 48)
    current.workers['invented-b'] = { canonical: high, projected: high, progress: farmWorkerProgress(high.totalExp), pending: false }
    expect(buildFarmCrew(current, [
      { id: 'invented-a', name: 'Amber', outfit: 'Spring' },
      { id: 'invented-b', name: 'Amber', outfit: 'Night' },
    ]).map(row => [row.id, row.level])).toEqual([['invented-b', 3], ['invented-a', 1]])
  })

  it('keeps substitutions in one block and chooses sufficient stock deterministically', () => {
    const recipe = FARM_KITCHEN_CATALOGUE.recipesById.get('farm:meal:b1:speed')!
    const legal = FARM_KITCHEN_CATALOGUE.foods.filter(food => food.block === 1 && food.stat === 'speed' && food.stage === 'raw')
    const stocked = legal.at(-1)!
    const current = view(); current.items[stocked.id] = { canonical: 4, reserved: 0, incoming: 0, projected: 4 }
    const choices = ingredientChoices(recipe, current.items)
    expect(choices['raw-speed']).toBe(stocked.id)
    expect(FARM_KITCHEN_CATALOGUE.foodsById.get(choices['raw-speed']!)!.block).toBe(1)
  })

  it('pins maximum and partial supplied batches without silently shrinking the requested amount', () => {
    const recipe = FARM_KITCHEN_CATALOGUE.recipesById.get('farm:meal:b1:speed')!
    const current = view(), choices = ingredientChoices(recipe, current.items)
    const open = { ...current.recipes.b1!.projected, cooking: { jobId: 'invented-job', outfitId: 'invented-a', level: 9 } }
    current.recipes.b1 = { ...current.recipes.b1!, canonical: open, projected: open }
    for (const itemId of Object.values(choices)) current.items[itemId] = { canonical: 2, reserved: 0, incoming: 0, projected: 2 }
    expect(maxSuppliedBatch(recipe, current.items, choices)).toBe(2)
    expect(recipeAvailability(current, recipe, 50, 3, choices).reason).toMatch(/Need 3/)
  })

  it('shares stock across wishlist goals and never counts pending output as spendable', () => {
    const current = view(), recipe = FARM_KITCHEN_CATALOGUE.recipesById.get('farm:meal:b1:speed')!
    const choices = ingredientChoices(recipe, current.items)
    for (const itemId of Object.values(choices)) current.items[itemId] = { canonical: 1, reserved: 0, incoming: 6, projected: 7 }
    const goals: FarmWishlistGoal[] = [1, 2].map(n => ({ id: `g${n}`, recipeId: recipe.id, quantity: 1, choices }))
    const plans = planFarmWishlist(current, goals)
    expect(plans[0]!.needs.every(need => need.allocated === 1)).toBe(true)
    expect(plans[1]!.needs.every(need => need.allocated === 0 && need.missing === 1 && need.incoming === 6)).toBe(true)
  })

  it('reports unclaimed station output separately and retains exact substitutions for Repeat', () => {
    const current = view(), recipe = FARM_KITCHEN_CATALOGUE.recipesById.get('farm:meal:b1:speed')!
    const choices = ingredientChoices(recipe, current.items)
    const inputs = Object.values(choices).map(itemId => ({ itemId, amount: 1 }))
    const job = { rulesVersion: 1 as const, id: 'invented-job', generation, stationId: 'kitchen-1' as const, attempt: 1,
      outfitId: 'invented-a', recipeId: recipe.id, block: 1, quantity: 1, startedAt: 0, durationMs: 1, accelerationMs: 0,
      readyAt: 0, inputs, output: { itemId: recipe.outputItemId, amount: 1 }, expAward: 12 }
    current.stations[0] = { ...current.stations[0]!, job, status: 'ready', remainingMs: 0 }
    const plan = planFarmWishlist(current, [{ id: 'g1', recipeId: recipe.id, quantity: 2, choices }])[0]!
    expect(plan.needs.every(need => need.ready === 0)).toBe(true)
    current.stations[0] = { ...current.stations[0]!, job: { ...job, output: { itemId: Object.values(choices)[0]!, amount: 6 } } }
    expect(planFarmWishlist(current, [{ id: 'g1', recipeId: recipe.id, quantity: 2, choices }])[0]!.needs.some(need => need.ready === 6)).toBe(true)
    expect(repeatedIngredientChoices(recipe, job)).toEqual(choices)
  })

  it('rounds missing processed stock to six-unit raw jobs', () => {
    const current = view(), recipe = FARM_KITCHEN_CATALOGUE.recipesById.get('farm:meal:b1:speed')!
    const choices = ingredientChoices(recipe, current.items)
    const plan = planFarmWishlist(current, [{ id: 'sun', recipeId: recipe.id, quantity: 4, choices }])[0]!
    expect(plan.needs.find(need => need.item.stage === 'processed')?.rawJobs).toBe(1)
  })
})
