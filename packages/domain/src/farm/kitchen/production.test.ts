// Invented owned workers and local clocks; no private saves or network.
import { describe, expect, it } from 'vitest'
import { FARM_KITCHEN_CATALOGUE, FARM_KITCHEN_JOB_MS, FARM_KITCHEN_ENERGY_ID, FARM_STATION_IDS,
  assignFarmWorker, removeFarmWorker, createFarmKitchen, createFarmKitchenWorker, emptyFarmRecipes, farmStation,
  farmJobRemaining, startFarmJob, claimFarmJob, spendFarmEnergy, parseFarmKitchenState, parseFarmKitchenWorker,
  parseFarmKitchenJob, parseFarmBlockRecipes, farmWorkerProgress, type FarmResult } from './index'

function take<T>(result: FarmResult<T>): T { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.value }
const generation = 'invented-generation'
const owned = new Set(['invented-a', 'invented-b'])
function context(totalExp = 0) {
  const farm = take(assignFarmWorker(createFarmKitchen(generation), 'garden-1', 'invented-a', owned))
  return { farm, stationId: 'garden-1' as const, worker: createFarmKitchenWorker(generation, 'invented-a', totalExp),
    ownedOutfits: owned, recipeStates: FARM_KITCHEN_CATALOGUE.blocks.map(b => emptyFarmRecipes(generation, b)), inventory: {}, now: 1000 }
}
const raw = { recipeId: 'farm:raw:ura-finale:vegetable:speed', quantity: 1, choices: {} }

describe('station ownership and frozen production', () => {
  it('opens thirty views without expansion, moves/removes only idle workers and preserves attempts', () => {
    const empty = createFarmKitchen(generation)
    expect(FARM_STATION_IDS).toHaveLength(30)
    expect(empty.stations).toEqual([])
    const assigned = take(assignFarmWorker(empty, 'kitchen-6', 'invented-a', owned))
    const moved = take(assignFarmWorker(assigned, 'barn-6', 'invented-a', owned))
    expect(moved.stations).toHaveLength(1)
    expect(farmStation(moved, 'barn-6').outfitId).toBe('invented-a')
    expect(take(removeFarmWorker(moved, 'barn-6'))).toEqual(empty)
    expect(assignFarmWorker(empty, 'garden-1', 'not-owned', owned)).toMatchObject({ ok: false, error: { code: 'not-owned' } })
  })
  it('raw start/JSON/reload/claim has no immediate reward and pays exactly once', () => {
    const input = context()
    const start = take(startFarmJob({ ...input, ...raw }))
    expect(start.debits).toEqual([])
    expect(input.worker.totalExp).toBe(0)
    expect(start.inventory).toEqual({})
    expect(start.job.readyAt - start.job.startedAt).toBe(FARM_KITCHEN_JOB_MS)
    expect(parseFarmKitchenState(JSON.parse(JSON.stringify(start.farm)))).toEqual(start.farm)
    expect(claimFarmJob({ ...input, farm: start.farm })).toMatchObject({ ok: false, error: { code: 'not-ready' } })
    const claim = take(claimFarmJob({ ...input, farm: start.farm, now: start.job.readyAt }))
    expect(claim.inventory[raw.recipeId]).toBe(6)
    expect(claim.worker.totalExp).toBe(12)
    expect(claim.receipt.levelsCrossed).toEqual([])
    expect(farmStation(claim.farm, 'garden-1')).toMatchObject({ outfitId: 'invented-a', attempt: 1, job: null })
    expect(claimFarmJob({ ...input, ...claim, now: start.job.readyAt }).ok).toBe(false)
    const again = take(startFarmJob({ ...input, ...claim, now: start.job.readyAt, ...raw }))
    expect(again.job.id).toBe(`farm-job:${generation}:garden-1:2`)
    expect(input.farm.stations[0]!.job).toBeNull()
  })
  it('does not move or replace busy OR ready workers, nor reroll an existing job', () => {
    const input = context()
    const start = take(startFarmJob({ ...input, ...raw }))
    expect(assignFarmWorker(start.farm, 'orchard-1', 'invented-a', owned)).toMatchObject({ ok: false, error: { code: 'busy' } })
    expect(assignFarmWorker(start.farm, 'garden-1', 'invented-b', owned).ok).toBe(false)
    expect(removeFarmWorker(start.farm, 'garden-1').ok).toBe(false)
    expect(startFarmJob({ ...input, farm: start.farm, now: start.job.readyAt, ...raw }).ok).toBe(false)
    expect(farmJobRemaining(start.job, 0)).toBeGreaterThan(FARM_KITCHEN_JOB_MS)
    expect(farmJobRemaining(start.job, start.job.readyAt + 100000)).toBe(0)
  })
  it('old-block claims unlock all eligible registered milestones, including over-threshold workers', () => {
    const input = context((59 - 1) * 24)
    const start = take(startFarmJob({ ...input, ...raw }))
    const claim = take(claimFarmJob({ ...input, farm: start.farm, now: start.job.readyAt }))
    expect(claim.receipt.milestones).toEqual([{ block: 1, kind: 'processing' }, { block: 1, kind: 'cooking' },
      { block: 2, kind: 'processing' }, { block: 2, kind: 'cooking' }])
    expect(claim.recipeStates.map(row => row.cooking !== null)).toEqual([true, true, false])
    const next = take(startFarmJob({ ...input, ...claim, now: start.job.readyAt, ...raw }))
    expect(take(claimFarmJob({ ...input, ...claim, farm: next.farm, now: next.job.readyAt })).receipt.milestones).toEqual([])
  })
  it.each([6, 9, 56, 59, 106, 109])('reports an exact threshold at level %i', level => {
    const input = context((level - 1) * 24 - 12)
    const start = take(startFarmJob({ ...input, ...raw }))
    const claim = take(claimFarmJob({ ...input, farm: start.farm, now: start.job.readyAt }))
    expect(claim.receipt.levelsCrossed).toEqual([level])
    expect(farmWorkerProgress(claim.worker.totalExp).level).toBe(level)
    expect(claim.receipt.milestones.length).toBeGreaterThan(0)
  })
  it('a fresh cook can use later same-block stock after the shared gate, not another block', () => {
    const input = context()
    const evidence = { jobId: `farm-job:${generation}:garden-1:1`, outfitId: 'invented-b', level: 9 }
    const recipes = { ...emptyFarmRecipes(generation, 1), processing: evidence, cooking: evidence }
    const farm = take(assignFarmWorker(input.farm, 'kitchen-1', input.worker.outfitId, owned))
    const choices = { 'raw-speed': 'farm:raw:grand-masters:vegetable:speed', 'processed-speed': 'farm:processed:grand-masters:cheese:speed' }
    const inventory = Object.fromEntries(Object.values(choices).map(id => [id, 4]))
    const cook = { ...input, farm, stationId: 'kitchen-1' as const, recipeStates: [recipes], inventory,
      recipeId: 'farm:meal:b1:speed', quantity: 4, choices }
    expect(startFarmJob({ ...cook, recipeStates: [] })).toMatchObject({ ok: false, error: { code: 'recipe-locked' } })
    const start = take(startFarmJob(cook))
    expect(Object.values(start.inventory)).toEqual([0, 0])
    const claim = take(claimFarmJob({ ...cook, farm: start.farm, inventory: start.inventory, now: start.job.readyAt }))
    expect(claim.worker.totalExp).toBe(12)
    expect(claim.inventory['farm:meal:b1:speed']).toBe(4)
    expect(claim.receipt.firstPrepared).toEqual(['farm:meal:b1:speed'])
    expect(claim.recipeStates[0]!.cookbook['farm:meal:b1:speed']).toEqual({ count: 4, firstPreparedAt: start.job.readyAt })
    expect(startFarmJob({ ...cook, recipeId: 'farm:meal:b2:speed' })).toMatchObject({ ok: false, error: { code: 'worker-level' } })
    expect(startFarmJob({ ...cook, inventory: { ...inventory, [choices['raw-speed']]: 3 } })).toMatchObject({ ok: false, error: { code: 'insufficient-stock' } })
    expect(parseFarmKitchenJob({ ...start.job, inputs: start.job.inputs.map(i => ({ amount: i.amount, itemId: i.itemId })) })).toEqual(start.job)
  })
  it('Energy affects one job only, clamps waste, awards no EXP and never collects', () => {
    const input = context()
    const start = take(startFarmJob({ ...input, ...raw }))
    const assigned = take(assignFarmWorker(start.farm, 'garden-2', 'invented-b', owned))
    const second = take(startFarmJob({ ...input, farm: assigned, stationId: 'garden-2', worker: createFarmKitchenWorker(generation, 'invented-b'), ...raw }))
    const inventory = { [FARM_KITCHEN_ENERGY_ID]: 1 }
    const used = take(spendFarmEnergy({ farm: second.farm, stationId: input.stationId, inventory, now: start.job.readyAt - 1000 }))
    expect(farmStation(used.farm, 'garden-2').job).toEqual(second.job)
    expect(used.usedMs).toBe(1000)
    expect(used.wastedMs).toBe(1800000 - 1000)
    expect(used.inventory[FARM_KITCHEN_ENERGY_ID]).toBe(0)
    expect(farmStation(used.farm, input.stationId).job).not.toBeNull()
    expect(input.worker.totalExp).toBe(0)
    expect(spendFarmEnergy({ farm: used.farm, stationId: input.stationId, inventory, now: start.job.readyAt }).ok).toBe(false)
    expect(spendFarmEnergy({ farm: start.farm, stationId: input.stationId, inventory: {}, now: input.now }).ok).toBe(false)
    expect(spendFarmEnergy({ farm: start.farm, stationId: input.stationId, inventory, now: 0 }).ok).toBe(false)
    expect(parseFarmKitchenState(used.farm)).toEqual(used.farm)
  })
  it.each([1, 2, 3, 4])('freezes %i banquets with ten exact input stacks but only one EXP award', quantity => {
    const input = context(), evidence = { jobId: `farm-job:${generation}:garden-1:1`, outfitId: 'invented-b', level: 9 }
    const recipe = FARM_KITCHEN_CATALOGUE.recipesById.get('farm:meal:b1:sun')!
    const choices = Object.fromEntries(recipe.inputs.map(slot => [slot.id, FARM_KITCHEN_CATALOGUE.foods.find(food =>
      food.stage === slot.stage && food.stat === slot.stat && food.scenarioId === 'ura-finale')!.id]))
    const inventory = Object.fromEntries(Object.values(choices).map(id => [id, quantity]))
    const cook = { ...input, farm: take(assignFarmWorker(input.farm, 'kitchen-1', 'invented-a', owned)),
      stationId: 'kitchen-1' as const, recipeStates: [{ ...emptyFarmRecipes(generation, 1), processing: evidence, cooking: evidence }],
      inventory, recipeId: recipe.id, quantity, choices }
    const start = take(startFarmJob(cook))
    expect(start.debits).toHaveLength(10)
    expect(start.debits.every(debit => debit.amount === quantity)).toBe(true)
    expect(parseFarmKitchenJob(JSON.parse(JSON.stringify(start.job)))).toEqual(start.job)
    const claim = take(claimFarmJob({ ...cook, farm: start.farm, inventory: start.inventory, now: start.job.readyAt }))
    expect(claim.inventory[recipe.id]).toBe(quantity)
    expect(claim.worker.totalExp).toBe(12)
    expect(Object.values(start.inventory).every(n => n === 0)).toBe(true)
    expect(startFarmJob({ ...cook, choices: { ...choices, 'raw-speed': 'farm:raw:project-larc:vegetable:speed' } }).ok).toBe(false)
  })
  it('processes the bound later variant for a Lv1 specialist with an earned shared milestone', () => {
    const input = context(), recipeId = 'farm:processed:grand-masters:cheese:speed', itemId = 'farm:raw:grand-masters:milk:speed'
    const evidence = { jobId: `farm-job:${generation}:garden-1:1`, outfitId: 'invented-b', level: 6 }
    const craft = { ...input, farm: take(assignFarmWorker(input.farm, 'workshop-1', 'invented-a', owned)),
      stationId: 'workshop-1' as const, recipeStates: [{ ...emptyFarmRecipes(generation, 1), processing: evidence }],
      inventory: { [itemId]: 6 }, recipeId, quantity: 1, choices: { 'raw-speed': itemId } }
    const start = take(startFarmJob(craft))
    expect(start.debits).toEqual([{ itemId, amount: 6 }])
    expect(startFarmJob({ ...craft, choices: { 'raw-speed': 'farm:raw:ura-finale:milk:speed' } }).ok).toBe(false)
    const claim = take(claimFarmJob({ ...craft, farm: start.farm, inventory: start.inventory, now: start.job.readyAt }))
    expect(claim.inventory[recipeId]).toBe(6)
    expect(claim.inventory[itemId]).toBe(0)
    expect(claim.worker.totalExp).toBe(12)
  })
})

describe('strict frozen value parsers and arithmetic bounds', () => {
  it('rejects future schemas, unknown fields, duplicate/out-of-order stations and generation mismatches', () => {
    const input = context()
    expect(parseFarmKitchenState({ ...input.farm, schemaVersion: 4 })).toBeNull()
    expect(parseFarmKitchenState({ ...input.farm, unknown: true })).toBeNull()
    expect(parseFarmKitchenState({ ...input.farm, stations: [...input.farm.stations, ...input.farm.stations] })).toBeNull()
    expect(parseFarmKitchenWorker({ ...input.worker, totalExp: Number.MAX_SAFE_INTEGER + 1 })).toBeNull()
    expect(parseFarmKitchenWorker({ ...input.worker, schemaVersion: 2 })).toBeNull()
    expect(startFarmJob({ ...input, worker: { ...input.worker, generation: 'another' }, ...raw }).ok).toBe(false)
  })
  it('rejects forged EXP/output/timer/inputs/recipe and unsafe start deadlines without mutation', () => {
    const input = context()
    const start = take(startFarmJob({ ...input, ...raw }))
    for (const changes of [{ expAward: 100 }, { output: { ...start.job.output, amount: 600 } }, { rulesVersion: 2 },
      { recipeId: 'arbitrary' }, { accelerationMs: -1 }, { readyAt: start.job.readyAt + 1 }, { block: 2 },
      { id: 'wrong' }, { inputs: [{ itemId: 'arbitrary', amount: 1 }] }]) {
      expect(parseFarmKitchenJob({ ...start.job, ...changes })).toBeNull()
    }
    expect(startFarmJob({ ...input, now: Number.MAX_SAFE_INTEGER, ...raw }).ok).toBe(false)
    expect(startFarmJob({ ...input, now: -1, ...raw }).ok).toBe(false)
    expect(startFarmJob({ ...input, farm: { ...input.farm, stations: [{ ...input.farm.stations[0]!, attempt: Number.MAX_SAFE_INTEGER }] }, ...raw }).ok).toBe(false)
    const overflow = context(Number.MAX_SAFE_INTEGER)
    const running = take(startFarmJob({ ...overflow, ...raw }))
    expect(claimFarmJob({ ...overflow, farm: running.farm, now: running.job.readyAt }).ok).toBe(false)
    expect(parseFarmBlockRecipes({ ...emptyFarmRecipes(generation, 1), cookbook: { arbitrary: { count: 1, firstPreparedAt: 0 } } })).toBeNull()
  })
})
