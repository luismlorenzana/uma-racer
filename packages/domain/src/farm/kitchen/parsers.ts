// Strict frozen pure values; unknown/future/corrupt data is never an empty success (docs/technical/farm-kitchen-implementation.md#3-records-and-ownership).
import { FARM_KITCHEN_CATALOGUE } from './catalogue'
import { resolveFarmInputs } from './inputs'
import { farmCookingLevel, farmProcessingLevel } from './progression'
import { FARM_KITCHEN_MAX_INPUTS, FARM_KITCHEN_RULES_VERSION, FARM_KITCHEN_SCHEMA_VERSION, FARM_STATION_IDS,
  farmExactKeys, farmRecord, farmSafeId, farmSafeInteger, isFarmStationId } from './rules'
import type { FarmBlockRecipes, FarmCatalogue, FarmKitchenJob, FarmKitchenState, FarmKitchenWorker, FarmMilestone } from './types'

export const isFarmGeneration = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(value)

export function parseFarmKitchenWorker(value: unknown): FarmKitchenWorker | null {
  if (!farmRecord(value) || !farmExactKeys(value, ['schemaVersion', 'generation', 'outfitId', 'totalExp']) ||
    value.schemaVersion !== 1 || !isFarmGeneration(value.generation) || !farmSafeId(value.outfitId) || !farmSafeInteger(value.totalExp)) return null
  return { schemaVersion: 1, generation: value.generation, outfitId: value.outfitId, totalExp: value.totalExp }
}

export function parseFarmKitchenJob(value: unknown, catalogue: FarmCatalogue = FARM_KITCHEN_CATALOGUE): FarmKitchenJob | null {
  if (!farmRecord(value) || !farmExactKeys(value, ['rulesVersion', 'id', 'generation', 'stationId', 'attempt', 'outfitId',
    'recipeId', 'block', 'quantity', 'startedAt', 'durationMs', 'accelerationMs', 'readyAt', 'inputs', 'output', 'expAward']) ||
    value.rulesVersion !== FARM_KITCHEN_RULES_VERSION || !isFarmGeneration(value.generation) || !isFarmStationId(value.stationId) ||
    !farmSafeInteger(value.attempt, 1) || !farmSafeId(value.outfitId) || typeof value.recipeId !== 'string' ||
    !farmSafeInteger(value.startedAt) || !farmSafeInteger(value.readyAt) || !farmSafeInteger(value.accelerationMs) ||
    !farmSafeInteger(value.quantity, 1) || !Array.isArray(value.inputs) || value.inputs.length > FARM_KITCHEN_MAX_INPUTS ||
    !farmRecord(value.output) || !farmExactKeys(value.output, ['itemId', 'amount'])) return null
  const recipe = catalogue.recipesById.get(value.recipeId)
  if (!recipe || value.block !== recipe.block || value.durationMs !== recipe.durationMs || value.quantity > recipe.maxQuantity ||
    value.expAward !== recipe.expAward || value.output.itemId !== recipe.outputItemId ||
    value.output.amount !== recipe.outputPerQuantity * value.quantity || value.accelerationMs > recipe.durationMs ||
    !farmSafeInteger(value.startedAt + recipe.durationMs) || value.readyAt !== value.startedAt + recipe.durationMs - value.accelerationMs ||
    value.id !== `farm-job:${value.generation}:${value.stationId}:${value.attempt}` || !value.stationId.startsWith(`${recipe.district}-`)) return null
  const choices: Record<string, string> = {}
  for (const entry of value.inputs) {
    if (!farmRecord(entry) || !farmExactKeys(entry, ['itemId', 'amount']) || typeof entry.itemId !== 'string' || !farmSafeInteger(entry.amount, 1)) return null
    const food = catalogue.foodsById.get(entry.itemId)
    const slot = recipe.inputs.find(s => food?.stage === s.stage && food.stat === s.stat &&
      (s.fixedItemId === null || s.fixedItemId === food.id))
    if (!slot || Object.hasOwn(choices, slot.id)) return null
    choices[slot.id] = entry.itemId
  }
  const inputs = resolveFarmInputs(catalogue, recipe.id, value.quantity, choices)
  const storedInputs = value.inputs
  if (!inputs.ok || inputs.value.length !== storedInputs.length || inputs.value.some((entry, i) => {
    const stored: unknown = storedInputs[i]
    return !farmRecord(stored) || stored.itemId !== entry.itemId || stored.amount !== entry.amount
  })) return null
  return { rulesVersion: FARM_KITCHEN_RULES_VERSION, id: value.id as string, generation: value.generation, stationId: value.stationId,
    attempt: value.attempt, outfitId: value.outfitId, recipeId: value.recipeId, block: recipe.block, quantity: value.quantity,
    startedAt: value.startedAt, durationMs: recipe.durationMs, accelerationMs: value.accelerationMs, readyAt: value.readyAt,
    inputs: inputs.value, output: { itemId: recipe.outputItemId, amount: recipe.outputPerQuantity * value.quantity }, expAward: recipe.expAward }
}

export function parseFarmKitchenState(value: unknown, catalogue: FarmCatalogue = FARM_KITCHEN_CATALOGUE): FarmKitchenState | null {
  if (!farmRecord(value) || !farmExactKeys(value, ['schemaVersion', 'generation', 'stations']) ||
    value.schemaVersion !== FARM_KITCHEN_SCHEMA_VERSION || !isFarmGeneration(value.generation) || !Array.isArray(value.stations) ||
    value.stations.length > FARM_STATION_IDS.length) return null
  const stations: FarmKitchenState['stations'] = []
  const workers = new Set<string>()
  let last = -1
  for (const entry of value.stations) {
    if (!farmRecord(entry) || !farmExactKeys(entry, ['id', 'outfitId', 'attempt', 'job']) || !isFarmStationId(entry.id) ||
      !farmSafeInteger(entry.attempt) || (entry.outfitId !== null && !farmSafeId(entry.outfitId))) return null
    const order = FARM_STATION_IDS.indexOf(entry.id)
    if (order <= last || (entry.outfitId !== null && workers.has(entry.outfitId))) return null
    last = order
    if (entry.outfitId !== null) workers.add(entry.outfitId)
    const job = entry.job === null ? null : parseFarmKitchenJob(entry.job, catalogue)
    if (entry.job !== null && (!job || job.generation !== value.generation || job.stationId !== entry.id ||
      job.attempt !== entry.attempt || job.outfitId !== entry.outfitId)) return null
    // Canonical sparse data excludes never-used empty stations, but retains attempts after unassignment.
    if (entry.outfitId === null && entry.attempt === 0 && job === null) return null
    stations.push({ id: entry.id, outfitId: entry.outfitId, attempt: entry.attempt, job })
  }
  return { schemaVersion: FARM_KITCHEN_SCHEMA_VERSION, generation: value.generation, stations }
}

function milestone(value: unknown, generation: string, threshold: number): FarmMilestone | null {
  if (!farmRecord(value) || !farmExactKeys(value, ['jobId', 'outfitId', 'level']) || !farmSafeId(value.jobId) ||
    !value.jobId.startsWith(`farm-job:${generation}:`) || !farmSafeId(value.outfitId) || !farmSafeInteger(value.level, threshold)) return null
  const parts = value.jobId.split(':'), attempt = Number(parts[3])
  if (parts.length !== 4 || !isFarmStationId(parts[2]) || !farmSafeInteger(attempt, 1) || String(attempt) !== parts[3]) return null
  return { jobId: value.jobId, outfitId: value.outfitId, level: value.level }
}

export function parseFarmBlockRecipes(value: unknown, catalogue: FarmCatalogue = FARM_KITCHEN_CATALOGUE): FarmBlockRecipes | null {
  if (!farmRecord(value) || !farmExactKeys(value, ['schemaVersion', 'generation', 'block', 'processing', 'cooking', 'cookbook']) ||
    value.schemaVersion !== 1 || !isFarmGeneration(value.generation) || !farmSafeInteger(value.block, 1) ||
    !catalogue.blocks.includes(value.block) || !farmRecord(value.cookbook) || Object.keys(value.cookbook).length > 16) return null
  const processing = value.processing === null ? null : milestone(value.processing, value.generation, farmProcessingLevel(value.block))
  const cooking = value.cooking === null ? null : milestone(value.cooking, value.generation, farmCookingLevel(value.block))
  if ((value.processing !== null && !processing) || (value.cooking !== null && !cooking) || (cooking && !processing)) return null
  const cookbook: FarmBlockRecipes['cookbook'] = {}
  for (const [id, record] of Object.entries(value.cookbook)) {
    const recipe = catalogue.recipesById.get(id)
    if (!recipe || recipe.kind !== 'cooking' || recipe.block !== value.block || !cooking || !farmRecord(record) ||
      !farmExactKeys(record, ['count', 'firstPreparedAt']) || !farmSafeInteger(record.count, 1) || !farmSafeInteger(record.firstPreparedAt)) return null
    cookbook[id] = { count: record.count, firstPreparedAt: record.firstPreparedAt }
  }
  return { schemaVersion: 1, generation: value.generation, block: value.block, processing, cooking, cookbook }
}
