// Immutable station/job effects, frozen inputs and one EXP award (docs/design/farm-kitchen-rework.md#15-persistence-and-sync-contract).
import { FARM_KITCHEN_CATALOGUE } from './catalogue'
import { applyFarmInventory, resolveFarmInputs } from './inputs'
import { isFarmGeneration, parseFarmBlockRecipes, parseFarmKitchenState, parseFarmKitchenWorker } from './parsers'
import { farmCookingLevel, farmProcessingLevel, farmWorkerProgress } from './progression'
import { FARM_KITCHEN_ENERGY_ID, FARM_KITCHEN_ENERGY_MS, FARM_KITCHEN_SCHEMA_VERSION, FARM_STATION_IDS,
  farmFailure, farmSafeId, farmSafeInteger, farmSuccess, isFarmStationId, type FarmResult, type FarmStationId } from './rules'
import type { FarmBlockRecipes, FarmCatalogue, FarmClaimReceipt, FarmInventory, FarmItemAmount, FarmKitchenJob,
  FarmKitchenState, FarmKitchenStation, FarmKitchenWorker } from './types'

export function createFarmKitchen(generation: string): FarmKitchenState {
  if (!isFarmGeneration(generation)) throw new RangeError('Invalid Farm generation')
  return { schemaVersion: FARM_KITCHEN_SCHEMA_VERSION, generation, stations: [] }
}
export function createFarmKitchenWorker(generation: string, outfitId: string, totalExp = 0): FarmKitchenWorker {
  const worker = parseFarmKitchenWorker({ schemaVersion: 1, generation, outfitId, totalExp })
  if (!worker) throw new RangeError('Invalid Farm worker')
  return worker
}
export const emptyFarmRecipes = (generation: string, block: number): FarmBlockRecipes =>
  ({ schemaVersion: 1, generation, block, processing: null, cooking: null, cookbook: {} })
export const farmStation = (farm: FarmKitchenState, id: FarmStationId): FarmKitchenStation =>
  farm.stations.find(station => station.id === id) ?? { id, outfitId: null, attempt: 0, job: null }

function withStation(farm: FarmKitchenState, station: FarmKitchenStation): FarmKitchenState {
  const stations = [...farm.stations.filter(s => s.id !== station.id), station]
    .filter(s => s.outfitId !== null || s.attempt !== 0 || s.job !== null)
    .sort((a, b) => FARM_STATION_IDS.indexOf(a.id) - FARM_STATION_IDS.indexOf(b.id))
  return { ...farm, stations }
}

export function assignFarmWorker(farm: FarmKitchenState, stationId: FarmStationId, outfitId: string,
  ownedOutfits: ReadonlySet<string>, catalogue: FarmCatalogue = FARM_KITCHEN_CATALOGUE): FarmResult<FarmKitchenState> {
  const state = parseFarmKitchenState(farm, catalogue)
  if (!state || !isFarmStationId(stationId) || !farmSafeId(outfitId)) return farmFailure('invalid', 'Station/worker')
  if (!ownedOutfits.has(outfitId)) return farmFailure('not-owned', outfitId)
  const target = farmStation(state, stationId)
  const held = state.stations.find(s => s.outfitId === outfitId)
  if (held?.id === stationId) return farmSuccess(state)
  if (target.job || held?.job) return farmFailure('busy', 'Claim the existing job before moving either worker')
  const released = held ? withStation(state, { ...held, outfitId: null }) : state
  return farmSuccess(withStation(released, { ...target, outfitId }))
}

export function removeFarmWorker(farm: FarmKitchenState, stationId: FarmStationId,
  catalogue: FarmCatalogue = FARM_KITCHEN_CATALOGUE): FarmResult<FarmKitchenState> {
  const state = parseFarmKitchenState(farm, catalogue)
  if (!state || !isFarmStationId(stationId)) return farmFailure('invalid', 'Station')
  const station = farmStation(state, stationId)
  return station.job ? farmFailure('busy', 'Claim first') : farmSuccess(withStation(state, { ...station, outfitId: null }))
}

export function farmJobRemaining(job: FarmKitchenJob, now: number): number {
  if (!farmSafeInteger(now)) throw new RangeError('Invalid Farm clock')
  return Math.max(0, job.readyAt - now)
}

interface ProductionContext {
  farm: FarmKitchenState
  stationId: FarmStationId
  worker: FarmKitchenWorker
  ownedOutfits: ReadonlySet<string>
  recipeStates: readonly FarmBlockRecipes[]
  inventory: FarmInventory
  now: number
  catalogue?: FarmCatalogue
}
function validateContext(input: ProductionContext): FarmResult<{ catalogue: FarmCatalogue; farm: FarmKitchenState;
  worker: FarmKitchenWorker; recipes: FarmBlockRecipes[]; station: FarmKitchenStation }> {
  const catalogue = input.catalogue ?? FARM_KITCHEN_CATALOGUE
  const farm = parseFarmKitchenState(input.farm, catalogue)
  const worker = parseFarmKitchenWorker(input.worker)
  if (!farm || !worker || worker.generation !== farm.generation || !isFarmStationId(input.stationId) || !farmSafeInteger(input.now)) {
    return farmFailure('invalid', 'Farm/worker/clock')
  }
  if (!input.ownedOutfits.has(worker.outfitId)) return farmFailure('not-owned', worker.outfitId)
  const station = farmStation(farm, input.stationId)
  if (station.outfitId === null) return farmFailure('no-worker', input.stationId)
  if (station.outfitId !== worker.outfitId) return farmFailure('invalid', 'Worker does not match station')
  const recipes = input.recipeStates.map(row => parseFarmBlockRecipes(row, catalogue))
  if (recipes.some(row => row === null || row.generation !== farm.generation) ||
    new Set(recipes.map(row => row?.block)).size !== recipes.length) return farmFailure('invalid', 'Recipe rows')
  return farmSuccess({ catalogue, farm, worker, station, recipes: recipes as FarmBlockRecipes[] })
}

export function startFarmJob(input: ProductionContext & { recipeId: string; quantity: number; choices: Readonly<Record<string, string>> }):
  FarmResult<{ farm: FarmKitchenState; inventory: Record<string, number>; job: FarmKitchenJob; debits: FarmItemAmount[] }> {
  const checked = validateContext(input)
  if (!checked.ok) return checked
  const { catalogue, farm, worker, station, recipes } = checked.value
  if (station.job) return farmFailure('busy', 'Existing job is still running or ready')
  const recipe = catalogue.recipesById.get(input.recipeId)
  if (!recipe) return farmFailure('unknown-recipe', input.recipeId)
  if (!station.id.startsWith(`${recipe.district}-`)) return farmFailure('wrong-district', recipe.district)
  if (farmWorkerProgress(worker.totalExp).level < recipe.requiredLevel) return farmFailure('worker-level', String(recipe.requiredLevel))
  const milestone = recipes.find(row => row.block === recipe.block)
  if (recipe.kind !== 'raw' && !milestone?.[recipe.kind === 'processing' ? 'processing' : 'cooking']) return farmFailure('recipe-locked', recipe.kind)
  const debits = resolveFarmInputs(catalogue, recipe.id, input.quantity, input.choices)
  if (!debits.ok) return debits
  const inventory = applyFarmInventory(input.inventory, debits.value, [])
  if (!inventory.ok) return inventory
  const attempt = station.attempt + 1
  const readyAt = input.now + recipe.durationMs
  if (!farmSafeInteger(attempt, 1) || !farmSafeInteger(readyAt)) return farmFailure('invalid', 'Attempt/deadline overflow')
  const job: FarmKitchenJob = { rulesVersion: recipe.rulesVersion, id: `farm-job:${farm.generation}:${station.id}:${attempt}`,
    generation: farm.generation, stationId: station.id, attempt, outfitId: worker.outfitId, recipeId: recipe.id,
    block: recipe.block, quantity: input.quantity, startedAt: input.now, durationMs: recipe.durationMs,
    accelerationMs: 0, readyAt, inputs: debits.value, output: { itemId: recipe.outputItemId, amount: recipe.outputPerQuantity * input.quantity },
    expAward: recipe.expAward }
  return farmSuccess({ farm: withStation(farm, { ...station, attempt, job }), inventory: inventory.value, job, debits: debits.value })
}

export function claimFarmJob(input: ProductionContext): FarmResult<{ farm: FarmKitchenState; inventory: Record<string, number>;
  worker: FarmKitchenWorker; recipeStates: FarmBlockRecipes[]; receipt: FarmClaimReceipt }> {
  const checked = validateContext(input)
  if (!checked.ok) return checked
  const { farm, worker, station, catalogue, recipes } = checked.value
  const job = station.job
  if (!job) return farmFailure('not-running', station.id)
  if (farmJobRemaining(job, input.now) !== 0) return farmFailure('not-ready', String(job.readyAt))
  const totalExp = worker.totalExp + job.expAward
  if (!farmSafeInteger(totalExp)) return farmFailure('invalid', 'EXP overflow')
  const inventory = applyFarmInventory(input.inventory, [], [job.output])
  if (!inventory.ok) return inventory
  const beforeLevel = farmWorkerProgress(worker.totalExp).level
  const afterLevel = farmWorkerProgress(totalExp).level
  const milestones: FarmClaimReceipt['milestones'] = []
  const firstPrepared: string[] = []
  const recipeStates = catalogue.blocks.map(block => {
    const previous = recipes.find(row => row.block === block) ?? emptyFarmRecipes(farm.generation, block)
    const row: FarmBlockRecipes = { ...previous, cookbook: { ...previous.cookbook } }
    for (const [kind, threshold] of [['processing', farmProcessingLevel(block)], ['cooking', farmCookingLevel(block)]] as const) {
      if (!row[kind] && afterLevel >= threshold) {
        row[kind] = { jobId: job.id, outfitId: worker.outfitId, level: afterLevel }
        milestones.push({ block, kind })
      }
    }
    if (catalogue.recipesById.get(job.recipeId)!.kind === 'cooking' && block === job.block) {
      const old = row.cookbook[job.recipeId]
      const count = (old?.count ?? 0) + job.output.amount
      if (!farmSafeInteger(count)) return null
      if (!old) firstPrepared.push(job.recipeId)
      row.cookbook[job.recipeId] = { count, firstPreparedAt: old?.firstPreparedAt ?? input.now }
    }
    return row
  })
  if (recipeStates.some(row => !row)) return farmFailure('invalid', 'Cookbook overflow')
  return farmSuccess({ farm: withStation(farm, { ...station, job: null }), inventory: inventory.value,
    worker: { ...worker, totalExp }, recipeStates: recipeStates as FarmBlockRecipes[],
    receipt: { jobId: job.id, outfitId: worker.outfitId, output: { ...job.output }, expAward: job.expAward,
      beforeLevel, afterLevel, levelsCrossed: Array.from({ length: afterLevel - beforeLevel }, (_, i) => beforeLevel + i + 1), milestones, firstPrepared } })
}

export function spendFarmEnergy(input: { farm: FarmKitchenState; stationId: FarmStationId; inventory: FarmInventory;
  now: number; catalogue?: FarmCatalogue }): FarmResult<{ farm: FarmKitchenState; inventory: Record<string, number>;
    usedMs: number; wastedMs: number }> {
  const farm = parseFarmKitchenState(input.farm, input.catalogue)
  if (!farm || !isFarmStationId(input.stationId) || !farmSafeInteger(input.now)) return farmFailure('invalid', 'Farm/clock')
  const station = farmStation(farm, input.stationId)
  const job = station.job
  if (!job) return farmFailure('not-running', station.id)
  if (input.now < job.startedAt) return farmFailure('invalid', 'Clock precedes this job')
  const remaining = farmJobRemaining(job, input.now)
  if (remaining === 0) return farmFailure('already-ready', job.id)
  const inventory = applyFarmInventory(input.inventory, [{ itemId: FARM_KITCHEN_ENERGY_ID, amount: 1 }], [])
  if (!inventory.ok) return inventory
  const usedMs = Math.min(remaining, FARM_KITCHEN_ENERGY_MS)
  return farmSuccess({ farm: withStation(farm, { ...station, job: { ...job, readyAt: job.readyAt - usedMs,
    accelerationMs: job.accelerationMs + usedMs } }), inventory: inventory.value, usedMs, wastedMs: FARM_KITCHEN_ENERGY_MS - usedMs })
}
