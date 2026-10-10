// Pure phone presentation and stock planning for the Farm kitchen (docs/design/farm-kitchen-rework.md §§6–8, 13).
import {
  FARM_DISTRICTS,
  FARM_KITCHEN_CATALOGUE,
  FARM_KITCHEN_PROCESS_BATCH,
  FARM_KITCHEN_RAW_YIELD,
  legalFarmIngredients,
  resolveFarmInputs,
  type FarmDistrict,
  type FarmFood,
  type FarmKitchenJob,
  type FarmRecipe,
  type FarmStationId,
} from '@racer/domain/farm/kitchen'
import type { FarmKitchenView, FarmStockView } from './view'

export const FARM_DISTRICT_PRESENTATION: Record<FarmDistrict, { name: string; detail: string }> = {
  garden: { name: 'Garden', detail: 'Vegetables' },
  orchard: { name: 'Orchard', detail: 'Fruit' },
  barn: { name: 'Barnyard', detail: 'Milk, eggs and meats' },
  workshop: { name: 'Workshop', detail: 'Preserves and pantry goods' },
  kitchen: { name: 'Kitchen', detail: 'Scenario meals' },
}

export interface FarmWorkerLabel { id: string; name: string; outfit: string | null }
export interface FarmCrewRow extends FarmWorkerLabel {
  level: number
  totalExp: number
  stationId: FarmStationId | null
  status: 'available' | 'idle' | 'busy' | 'ready'
  pending: boolean
}

export function buildFarmCrew(view: FarmKitchenView, labels: readonly FarmWorkerLabel[]): FarmCrewRow[] {
  const stationByWorker = new Map(view.stations.filter(s => s.outfitId).map(s => [s.outfitId!, s]))
  return labels.map(label => {
    const worker = view.workers[label.id]
    if (!worker) throw new Error(`Farm worker view is missing: ${label.id}`)
    const station = stationByWorker.get(label.id)
    return {
      ...label,
      level: worker.progress.level,
      totalExp: worker.projected.totalExp,
      stationId: station?.id ?? null,
      status: (station ? station.status === 'empty' ? 'idle' : station.status : 'available') as FarmCrewRow['status'],
      pending: worker.pending || !!station?.pending,
    }
  }).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name) || (a.outfit ?? '').localeCompare(b.outfit ?? '') || a.id.localeCompare(b.id))
}

export interface FarmDistrictSummary {
  id: FarmDistrict
  assigned: number
  busy: number
  ready: number
  pending: number
  nextFinishAt: number | null
}

export function buildFarmDistrictSummaries(view: FarmKitchenView): FarmDistrictSummary[] {
  return FARM_DISTRICTS.map(id => {
    const stations = view.stations.filter(station => station.id.startsWith(`${id}-`))
    const busy = stations.filter(station => station.status === 'busy')
    return {
      id,
      assigned: stations.filter(station => station.outfitId !== null).length,
      busy: busy.length,
      ready: stations.filter(station => station.status === 'ready').length,
      pending: stations.filter(station => station.pending).length,
      nextFinishAt: busy.length ? Math.min(...busy.map(station => view.now + station.remainingMs)) : null,
    }
  })
}

export function spendableStock(stock: FarmStockView | undefined): number {
  return Math.max(0, (stock?.canonical ?? 0) - (stock?.reserved ?? 0))
}

export function ingredientChoices(
  recipe: FarmRecipe,
  items: Readonly<Record<string, FarmStockView>>,
  selected: Readonly<Record<string, string>> = {},
): Record<string, string> {
  return Object.fromEntries(recipe.inputs.map(slot => {
    const legal = legalFarmIngredients(FARM_KITCHEN_CATALOGUE, recipe, slot)
    const retained = legal.find(food => food.id === selected[slot.id])
    const ordered = [...legal].sort((a, b) => {
      const enoughA = spendableStock(items[a.id]) >= slot.amount ? 1 : 0
      const enoughB = spendableStock(items[b.id]) >= slot.amount ? 1 : 0
      return enoughB - enoughA || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    })
    const choice = retained ?? ordered[0]
    if (!choice) throw new Error(`Farm recipe slot has no legal ingredient: ${recipe.id}/${slot.id}`)
    return [slot.id, choice.id]
  }))
}

/** Recover the exact concrete substitutions recorded by a completed job for an explicit Repeat confirmation. */
export function repeatedIngredientChoices(recipe: FarmRecipe, job: FarmKitchenJob): Record<string, string> {
  const unused = [...job.inputs]
  return Object.fromEntries(recipe.inputs.map(slot => {
    const index = unused.findIndex(input => legalFarmIngredients(FARM_KITCHEN_CATALOGUE, recipe, slot).some(food => food.id === input.itemId))
    const input = index >= 0 ? unused.splice(index, 1)[0] : undefined
    if (!input) throw new Error(`Completed Farm job is missing its concrete substitution: ${job.id}/${slot.id}`)
    return [slot.id, input.itemId]
  }))
}

export function maxSuppliedBatch(
  recipe: FarmRecipe,
  items: Readonly<Record<string, FarmStockView>>,
  choices: Readonly<Record<string, string>>,
): number {
  if (recipe.inputs.length === 0) return recipe.maxQuantity
  for (let quantity = recipe.maxQuantity; quantity >= 1; quantity -= 1) {
    const resolved = resolveFarmInputs(FARM_KITCHEN_CATALOGUE, recipe.id, quantity, choices)
    if (resolved.ok && resolved.value.every(input => spendableStock(items[input.itemId]) >= input.amount)) return quantity
  }
  return 0
}

export interface RecipeAvailability {
  enabled: boolean
  reason: string | null
  href: string | null
}

export function recipeAvailability(
  view: FarmKitchenView,
  recipe: FarmRecipe,
  workerLevel: number,
  quantity: number,
  choices: Readonly<Record<string, string>>,
): RecipeAvailability {
  if (workerLevel < recipe.requiredLevel) return { enabled: false, reason: `Worker needs Farm Lv${recipe.requiredLevel}`, href: '/farm/crew' }
  const shared = view.recipes[`b${recipe.block}`]?.projected
  if (recipe.kind === 'processing' && !shared?.processing) return { enabled: false, reason: `Block ${recipe.block} processing needs its first Lv${recipe.requiredLevel + 5} worker claim`, href: '/farm/crew' }
  if (recipe.kind === 'cooking' && !shared?.cooking) return { enabled: false, reason: `Block ${recipe.block} cooking needs its first Lv${recipe.requiredLevel + 8} worker claim`, href: '/farm/crew' }
  const resolved = resolveFarmInputs(FARM_KITCHEN_CATALOGUE, recipe.id, quantity, choices)
  if (!resolved.ok) return { enabled: false, reason: 'Choose one concrete ingredient for every slot', href: '/farm/recipes' }
  const missing = resolved.value.find(input => spendableStock(view.items[input.itemId]) < input.amount)
  if (missing) {
    const food = FARM_KITCHEN_CATALOGUE.foodsById.get(missing.itemId)
    return { enabled: false, reason: `Need ${missing.amount} ${food?.name ?? 'ingredients'}; ${spendableStock(view.items[missing.itemId])} spendable`, href: food?.stage === 'processed' ? '/farm/district/workshop' : '/farm/recipes' }
  }
  return { enabled: true, reason: null, href: null }
}

export interface FarmWishlistGoal {
  id: string
  recipeId: string
  quantity: number
  choices: Readonly<Record<string, string>>
}
export interface FarmWishlistNeed {
  item: FarmFood
  required: number
  allocated: number
  missing: number
  incoming: number
  ready: number
  rawJobs: number
}
export interface FarmWishlistPlan {
  id: string
  recipe: FarmRecipe
  target: number
  ownedMeals: number
  remainingMeals: number
  unresolved: string[]
  needs: FarmWishlistNeed[]
}

/** Allocate canonical spendable stock once, in saved goal order. Pending/ready outputs stay informative, never spendable. */
export function planFarmWishlist(view: FarmKitchenView, goals: readonly FarmWishlistGoal[]): FarmWishlistPlan[] {
  const remaining = new Map(Object.entries(view.items).map(([id, stock]) => [id, spendableStock(stock)]))
  const running = new Map<string, number>(), ready = new Map<string, number>()
  for (const station of view.stations) {
    if (!station.job || station.status !== 'busy' && station.status !== 'ready') continue
    const target = station.status === 'ready' ? ready : running
    target.set(station.job.output.itemId, (target.get(station.job.output.itemId) ?? 0) + station.job.output.amount)
  }
  return goals.slice(0, 3).map(goal => {
    const recipe = FARM_KITCHEN_CATALOGUE.recipesById.get(goal.recipeId)
    if (!recipe || recipe.kind !== 'cooking') throw new Error(`Wishlist recipe is unavailable: ${goal.recipeId}`)
    const ownedMeals = Math.min(goal.quantity, remaining.get(recipe.outputItemId) ?? 0)
    remaining.set(recipe.outputItemId, Math.max(0, (remaining.get(recipe.outputItemId) ?? 0) - ownedMeals))
    const remainingMeals = Math.max(0, goal.quantity - ownedMeals)
    const resolved = resolveFarmInputs(FARM_KITCHEN_CATALOGUE, recipe.id, remainingMeals || 1, goal.choices)
    const unresolved: string[] = []
    if (!resolved.ok) for (const slot of recipe.inputs) if (!goal.choices[slot.id]) unresolved.push(slot.id)
    const requirements = remainingMeals === 0 ? [] : resolved.ok ? resolved.value : []
    const needs = requirements.map(requirement => {
      const stock = remaining.get(requirement.itemId) ?? 0
      const allocated = Math.min(stock, requirement.amount)
      remaining.set(requirement.itemId, stock - allocated)
      const missing = requirement.amount - allocated
      const item = FARM_KITCHEN_CATALOGUE.foodsById.get(requirement.itemId)
      if (!item) throw new Error(`Wishlist item is unavailable: ${requirement.itemId}`)
      const itemStock = view.items[requirement.itemId]
      return {
        item,
        required: requirement.amount,
        allocated,
        missing,
        incoming: (itemStock?.incoming ?? 0) + (running.get(requirement.itemId) ?? 0),
        ready: ready.get(requirement.itemId) ?? 0,
        rawJobs: item.stage === 'processed' && missing > 0 ? Math.ceil(missing / FARM_KITCHEN_PROCESS_BATCH) * Math.ceil(FARM_KITCHEN_PROCESS_BATCH / FARM_KITCHEN_RAW_YIELD) : 0,
      }
    })
    return { id: goal.id, recipe, target: goal.quantity, ownedMeals, remainingMeals, unresolved, needs }
  })
}

export function formatFarmTime(ms: number): string {
  if (ms <= 0) return 'Ready'
  const minutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return hours ? `${hours}h ${remainder ? `${remainder}m` : ''}`.trim() : `${minutes}m`
}
