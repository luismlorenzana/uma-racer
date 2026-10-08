// Engine-agnostic Item inventory join and filtering (docs/design/farm.md#global-item-inventory, T085).

import { SCENARIOS, STRATEGIES, puzzleMaterialCatalogue, type PuzzleScenarioRegistry, type PuzzleMaterialDefinition, type FarmCropDefinition, type InventoryStackData, type StatKey } from '@racer/domain'

export interface ItemCatalogDefinition {
  id: string
  name: string
  category: string
  /** Category-owned stable order; later categories can choose their own dimensions. */
  order: readonly (number | string)[]
  facets: Readonly<Record<string, string>>
}

export interface ItemInventoryEntry<T extends ItemCatalogDefinition = ItemCatalogDefinition> {
  itemId: string
  definition: T | null
  quantity: number
  orphaned: boolean
}

export interface ItemInventoryFilters {
  visibility: 'owned' | 'all'
  facets: Readonly<Record<string, string | null>>
}

export interface ItemInventoryView<T extends ItemCatalogDefinition = ItemCatalogDefinition> {
  items: ItemInventoryEntry<T>[]
  catalogTotal: number
  ownedUnique: number
  totalQuantity: number
  orphanedStacks: number
}

export type ItemLinkResolution<T extends ItemCatalogDefinition> =
  | { status: 'absent'; definition: null }
  | { status: 'ready'; definition: T }
  | { status: 'invalid'; definition: null }

const SAFE_ITEM_LINK = /^[A-Za-z0-9_.:-]{1,120}$/

export function resolveItemLink<T extends ItemCatalogDefinition>(
  raw: string | null,
  definitions: readonly T[],
): ItemLinkResolution<T> {
  if (raw === null) return { status: 'absent', definition: null }
  if (!SAFE_ITEM_LINK.test(raw)) return { status: 'invalid', definition: null }
  const definition = definitions.find((candidate) => candidate.id === raw)
  return definition ? { status: 'ready', definition } : { status: 'invalid', definition: null }
}

/** Safe orphan links are inspectable only when the stack actually exists. Never manufacture an item. */
export function savedOrphanItem(raw: string | null, stacks: Readonly<Record<string, number>>, definitions: readonly ItemCatalogDefinition[]): string | null {
  return raw && SAFE_ITEM_LINK.test(raw) && Object.hasOwn(stacks, raw) && !definitions.some(d => d.id === raw) ? raw : null
}

export interface ConstellationItemDefinition extends ItemCatalogDefinition {
  category: 'constellation'
  material: PuzzleMaterialDefinition
}
/** Global catalogue extension: registry order (not a hard-coded count), then original source style. */
export function constellationItemDefinitions(registry: PuzzleScenarioRegistry = SCENARIOS): ConstellationItemDefinition[] {
  return puzzleMaterialCatalogue(registry).map(material => ({ id: material.id, name: material.name, category: 'constellation', material,
    order: [registry.findIndex(s => s.id === material.scenarioId), STRATEGIES.indexOf(material.style)],
    facets: { scenario: String(material.scenarioTier), scenarioId: material.scenarioId, style: material.style } }))
}

function compareOrder(left: ItemCatalogDefinition, right: ItemCatalogDefinition): number {
  const length = Math.max(left.order.length, right.order.length)
  for (let index = 0; index < length; index += 1) {
    const leftValue = left.order[index]
    const rightValue = right.order[index]
    if (leftValue === undefined && rightValue === undefined) break
    if (leftValue === undefined) return 1
    if (rightValue === undefined) return -1
    const compared = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue))
    if (compared !== 0) return compared
  }
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
}

function validQuantity(quantity: number): boolean {
  return Number.isSafeInteger(quantity) && quantity >= 0
}

export function buildItemInventory<T extends ItemCatalogDefinition>(
  definitions: readonly T[],
  stacks: readonly InventoryStackData[],
  filters: ItemInventoryFilters,
): ItemInventoryView<T> {
  const byId = new Map<string, T>()
  for (const definition of definitions) {
    if (!definition.id || byId.has(definition.id)) throw new Error(`Item catalog id is invalid or duplicated: ${definition.id}`)
    byId.set(definition.id, definition)
  }
  const quantities = new Map<string, number>()
  for (const stack of stacks) {
    if (!stack.itemId || !validQuantity(stack.quantity) || quantities.has(stack.itemId)) {
      throw new Error(`Item stack is invalid or duplicated: ${stack.itemId}`)
    }
    quantities.set(stack.itemId, stack.quantity)
  }
  const known: ItemInventoryEntry<T>[] = [...definitions].sort(compareOrder).map((definition) => ({
    itemId: definition.id,
    definition,
    quantity: quantities.get(definition.id) ?? 0,
    orphaned: false,
  }))
  const orphaned: ItemInventoryEntry<T>[] = [...quantities.entries()]
    .filter(([itemId]) => !byId.has(itemId))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([itemId, quantity]) => ({ itemId, definition: null, quantity, orphaned: true }))
  const all = [...known, ...orphaned]
  const items = all.filter((entry) => {
    if (filters.visibility === 'owned' && entry.quantity === 0) return false
    for (const [facet, selected] of Object.entries(filters.facets)) {
      if (selected !== null && entry.definition?.facets[facet] !== selected) return false
    }
    return true
  })
  return {
    items,
    catalogTotal: definitions.length,
    ownedUnique: all.filter((entry) => entry.quantity > 0).length,
    totalQuantity: all.reduce((sum, entry) => sum + entry.quantity, 0),
    orphanedStacks: orphaned.filter((entry) => entry.quantity > 0).length,
  }
}

const STAT_ORDER: Record<StatKey, number> = { speed: 0, stamina: 1, power: 2, guts: 3, wit: 4 }

export interface ProduceItemDefinition extends ItemCatalogDefinition {
  category: 'produce'
  crop: FarmCropDefinition
}

export const produceItemDefinitions = (crops: readonly FarmCropDefinition[]): ProduceItemDefinition[] => crops.map((crop) => ({
  id: crop.id,
  name: crop.name,
  category: 'produce',
  order: [crop.scenarioTier, STAT_ORDER[crop.stat], crop.name],
  facets: { stat: crop.stat, scenario: String(crop.scenarioTier) },
  crop,
}))
