// Named, arbitrary-order purchases and four free active builds (docs/design/farm-kitchen-rework.md#9-extra-stats-map-and-ownership).
import { DISTANCE_CATEGORIES, STATS, zeroStats, type DistanceCategory, type StatKey, type Stats } from '../../types'
import { FARM_KITCHEN_CATALOGUE, FARM_PAIR_MEALS, farmMealId } from './catalogue'
import { applyFarmInventory } from './inputs'
import { isFarmGeneration } from './parsers'
import { farmIngredientBlock } from './progression'
import { FARM_EXTRA_CAPACITY_STEP, FARM_EXTRA_INITIAL_CAPACITY, FARM_EXTRA_NODE_COUNT, FARM_EXTRA_NODE_TOTAL,
  FARM_EXTRA_PURE_PER_STAT, FARM_EXTRA_SUNS, FARM_EXTRA_TEMPLATE_VERSION, farmExactKeys, farmFailure, farmRecord,
  farmSafeId, farmSafeInteger, farmSuccess, type FarmResult } from './rules'
import type { FarmCatalogue, FarmExtraBlock, FarmExtraNode, FarmInventory } from './types'

const CLUSTERS: Record<StatKey, readonly [number, number]> = {
  speed: [50, 15], stamina: [83, 40], power: [70, 78], guts: [30, 78], wit: [17, 40],
}
const PURE_NAMES = ['Seed', 'Sprout', 'Leaf', 'Bloom', 'Harvest', 'Basket', 'Table', 'Feast', 'Abundance', 'Legacy'] as const
export const FARM_EXTRA_NODES: readonly FarmExtraNode[] = [
  ...STATS.flatMap(stat => Array.from({ length: FARM_EXTRA_PURE_PER_STAT }, (_, i) => ({
    id: `${stat}-${String(i + 1).padStart(2, '0')}`, name: `${stat[0]!.toUpperCase()}${stat.slice(1)} ${PURE_NAMES[i]}`,
    kind: 'pure' as const, signature: stat, stats: { ...zeroStats(), [stat]: FARM_EXTRA_NODE_TOTAL },
    x: CLUSTERS[stat][0] + (i % 5 - 2) * 4, y: CLUSTERS[stat][1] + (Math.floor(i / 5) * 6 - 3),
  }))),
  ...FARM_PAIR_MEALS.map(([a, b, name]) => ({ id: `dual-${a}-${b}`, name: `${name} Bridge`, kind: 'dual' as const,
    signature: `${a}-${b}`, stats: { ...zeroStats(), [a]: FARM_EXTRA_NODE_TOTAL / 2, [b]: FARM_EXTRA_NODE_TOTAL / 2 },
    x: (CLUSTERS[a][0] + CLUSTERS[b][0]) / 2, y: (CLUSTERS[a][1] + CLUSTERS[b][1]) / 2 })),
  ...Array.from({ length: FARM_EXTRA_SUNS }, (_, i) => ({ id: `sun-${String(i + 1).padStart(2, '0')}`, name: `Sun ${PURE_NAMES[i]}`,
    kind: 'sun' as const, signature: 'sun', stats: Object.fromEntries(STATS.map(stat => [stat, FARM_EXTRA_NODE_TOTAL / STATS.length])) as Stats,
    x: 40 + i * 5, y: 48 })),
]
const NODES = new Map(FARM_EXTRA_NODES.map(node => [node.id, node]))
export const farmExtraNode = (id: string): FarmExtraNode | undefined => NODES.get(id)

/** Exact outfit/block/unit/distance projection. Missing rows are empty, never corrupt rows. */
export function projectFarmExtraStats(input: { map?: unknown; generation: string; outfitId: string; scenarioId: string;
  distance: DistanceCategory }): FarmResult<Stats> {
  const scenario = FARM_KITCHEN_CATALOGUE.scenarios.find(s => s.id === input.scenarioId)
  if (!scenario || !DISTANCE_CATEGORIES.includes(input.distance)) return farmFailure('invalid', 'Unknown Farm scenario or distance')
  if (input.map === undefined) return farmSuccess(zeroStats())
  const map = parseFarmExtraBlock(input.map)
  if (!map || map.generation !== input.generation || map.outfitId !== input.outfitId || map.block !== farmIngredientBlock(scenario.tier))
    return farmFailure('invalid', 'Farm map identity or template requires recovery')
  return farmExtraVector(map.activeByScenario[input.scenarioId]?.[input.distance] ?? [])
}

export function farmExtraCapacity(scenarioIndex: number): number {
  if (!farmSafeInteger(scenarioIndex, 1)) throw new RangeError('Invalid Farm scenario index')
  const capacity = FARM_EXTRA_INITIAL_CAPACITY + FARM_EXTRA_CAPACITY_STEP * (scenarioIndex - 1)
  if (capacity > FARM_EXTRA_NODE_COUNT) throw new RangeError('Review Farm map/capacity before extending the registry')
  return capacity
}
const orderedNodes = (ids: readonly string[]): string[] => FARM_EXTRA_NODES.filter(node => ids.includes(node.id)).map(node => node.id)
export const emptyFarmDistanceBuilds = (): Record<DistanceCategory, string[]> => ({ sprint: [], mile: [], medium: [], long: [] })
export function createFarmExtraBlock(generation: string, outfitId: string, block: number,
  catalogue: FarmCatalogue = FARM_KITCHEN_CATALOGUE): FarmExtraBlock {
  if (!isFarmGeneration(generation) || !farmSafeId(outfitId) || !catalogue.blocks.includes(block)) throw new RangeError('Invalid Farm map identity')
  return { schemaVersion: 1, templateVersion: FARM_EXTRA_TEMPLATE_VERSION, generation, outfitId, block, boughtNodeIds: [], activeByScenario: {} }
}
export function parseFarmExtraBlock(value: unknown, catalogue: FarmCatalogue = FARM_KITCHEN_CATALOGUE): FarmExtraBlock | null {
  if (!farmRecord(value) || !farmExactKeys(value, ['schemaVersion', 'templateVersion', 'generation', 'outfitId', 'block', 'boughtNodeIds', 'activeByScenario']) ||
    value.schemaVersion !== 1 || value.templateVersion !== FARM_EXTRA_TEMPLATE_VERSION || !isFarmGeneration(value.generation) ||
    !farmSafeId(value.outfitId) || !farmSafeInteger(value.block, 1) || !catalogue.blocks.includes(value.block) ||
    !Array.isArray(value.boughtNodeIds) || value.boughtNodeIds.length > FARM_EXTRA_NODE_COUNT ||
    value.boughtNodeIds.some(id => typeof id !== 'string' || !NODES.has(id)) ||
    new Set(value.boughtNodeIds).size !== value.boughtNodeIds.length || !farmRecord(value.activeByScenario)) return null
  const boughtNodeIds = value.boughtNodeIds as string[]
  const activeByScenario: FarmExtraBlock['activeByScenario'] = {}
  for (const [scenarioId, builds] of Object.entries(value.activeByScenario)) {
    const scenario = catalogue.scenarios.find(s => s.id === scenarioId)
    if (!scenario || farmIngredientBlock(scenario.tier) !== value.block || !farmRecord(builds) || !farmExactKeys(builds, DISTANCE_CATEGORIES)) return null
    const checked = emptyFarmDistanceBuilds()
    for (const distance of DISTANCE_CATEGORIES) {
      const ids = builds[distance]
      if (!Array.isArray(ids) || ids.length > farmExtraCapacity(scenario.tier) || new Set(ids).size !== ids.length ||
        ids.some(id => typeof id !== 'string' || !boughtNodeIds.includes(id))) return null
      checked[distance] = orderedNodes(ids as string[])
    }
    activeByScenario[scenarioId] = checked
  }
  return { schemaVersion: 1, templateVersion: FARM_EXTRA_TEMPLATE_VERSION, generation: value.generation,
    outfitId: value.outfitId, block: value.block, boughtNodeIds: orderedNodes(boughtNodeIds), activeByScenario }
}

interface ExtraContext {
  map: FarmExtraBlock
  outfitId: string
  scenarioId: string
  distance: DistanceCategory
  /** The resolver's actual owned scenario units, not a request to create/promote one. */
  unlockedScenarioIds: ReadonlySet<string>
  catalogue?: FarmCatalogue
}
function validateExtra(input: ExtraContext): FarmResult<{ map: FarmExtraBlock; capacity: number }> {
  const catalogue = input.catalogue ?? FARM_KITCHEN_CATALOGUE
  const map = parseFarmExtraBlock(input.map, catalogue)
  const scenario = catalogue.scenarios.find(s => s.id === input.scenarioId)
  if (!map || !DISTANCE_CATEGORIES.includes(input.distance)) return farmFailure('invalid', 'Farm map/distance')
  if (!scenario) return farmFailure('unknown-scenario', input.scenarioId)
  if (map.outfitId !== input.outfitId || !input.unlockedScenarioIds.has(input.scenarioId)) return farmFailure('not-owned', input.outfitId)
  if (map.block !== farmIngredientBlock(scenario.tier)) return farmFailure('wrong-block', input.scenarioId)
  return farmSuccess({ map, capacity: farmExtraCapacity(scenario.tier) })
}
export function setFarmActiveNodes(input: ExtraContext & { nodeIds: readonly string[] }): FarmResult<FarmExtraBlock> {
  const checked = validateExtra(input)
  if (!checked.ok) return checked
  const { map, capacity } = checked.value
  if (input.nodeIds.some(id => !map.boughtNodeIds.includes(id))) return farmFailure('not-bought', 'Only bought nodes can be active')
  if (new Set(input.nodeIds).size !== input.nodeIds.length) return farmFailure('invalid', 'Duplicate active node')
  if (input.nodeIds.length > capacity) return farmFailure('capacity', String(capacity))
  const builds = map.activeByScenario[input.scenarioId] ?? emptyFarmDistanceBuilds()
  return farmSuccess({ ...map, activeByScenario: { ...map.activeByScenario,
    [input.scenarioId]: { ...builds, [input.distance]: orderedNodes(input.nodeIds) } } })
}
export function buyFarmExtraNode(input: ExtraContext & { nodeId: string; inventory: FarmInventory; autoactivate?: boolean }):
  FarmResult<{ map: FarmExtraBlock; inventory: FarmInventory; duplicate: boolean; purchaseId: string; node: FarmExtraNode }> {
  const checked = validateExtra(input)
  if (!checked.ok) return checked
  const { map, capacity } = checked.value
  const node = NODES.get(input.nodeId)
  if (!node) return farmFailure('unknown-node', input.nodeId)
  const purchaseId = `farm-buy:${map.generation}:${map.outfitId}:b${map.block}:${node.id}`
  if (map.boughtNodeIds.includes(node.id)) return farmSuccess({ map, inventory: input.inventory, duplicate: true, purchaseId, node })
  const inventory = applyFarmInventory(input.inventory, [{ itemId: farmMealId(map.block, node.signature), amount: 1 }], [])
  if (!inventory.ok) return inventory
  const bought = { ...map, boughtNodeIds: orderedNodes([...map.boughtNodeIds, node.id]) }
  const active = map.activeByScenario[input.scenarioId]?.[input.distance] ?? []
  const selected = input.autoactivate && active.length < capacity
    ? setFarmActiveNodes({ ...input, map: bought, nodeIds: [...active, node.id] }) : farmSuccess(bought)
  if (!selected.ok) return selected
  return farmSuccess({ map: selected.value, inventory: inventory.value, duplicate: false, purchaseId, node })
}
export function farmExtraVector(nodeIds: readonly string[]): FarmResult<Stats> {
  if (nodeIds.length > FARM_EXTRA_NODE_COUNT || new Set(nodeIds).size !== nodeIds.length) return farmFailure('invalid', 'Node list')
  const stats = zeroStats()
  for (const id of nodeIds) {
    const node = NODES.get(id)
    if (!node) return farmFailure('unknown-node', id)
    for (const stat of STATS) stats[stat] += node.stats[stat]
  }
  return farmSuccess(stats)
}

/** Accept UNCAPPED post-growth card/base values; adding to a capped result would hide waste and rounding. */
export function previewFarmStats(basePreCap: Stats, farm: Stats, caps: Stats): FarmResult<{
  stats: Stats; beforeCap: Stats; baseCapped: Stats; marginal: Stats; farmWaste: Stats;
}> {
  if (STATS.some(s => !Number.isFinite(basePreCap[s]) || basePreCap[s] < 0 || basePreCap[s] > Number.MAX_SAFE_INTEGER ||
    !farmSafeInteger(farm[s]) || !farmSafeInteger(caps[s], 1) || !Number.isFinite(basePreCap[s] + farm[s]) ||
    basePreCap[s] + farm[s] > Number.MAX_SAFE_INTEGER)) return farmFailure('invalid', 'Stat values')
  const stats = zeroStats(), beforeCap = zeroStats(), baseCapped = zeroStats(), marginal = zeroStats(), farmWaste = zeroStats()
  for (const stat of STATS) {
    beforeCap[stat] = basePreCap[stat] + farm[stat]
    stats[stat] = Math.min(caps[stat], Math.round(beforeCap[stat]))
    baseCapped[stat] = Math.min(caps[stat], Math.round(basePreCap[stat]))
    marginal[stat] = stats[stat] - baseCapped[stat]
    farmWaste[stat] = farm[stat] - marginal[stat]
  }
  return farmSuccess({ stats, beforeCap, baseCapped, marginal, farmWaste })
}
