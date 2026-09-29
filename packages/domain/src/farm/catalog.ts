// Authored synthetic produce catalog for Stable Farm (docs/design/farm.md#crop-catalog).

import { STATS, type StatKey } from '../types'
import {
  FARM_CROP_LEVEL_REQUIREMENTS,
  FARM_CROP_YIELD,
  FARM_GROWTH_HOURS,
  FARM_OUTFIT_LEVEL_REQUIREMENTS,
  FARMING_EXP_PER_HARVEST,
} from './constants'
import { parseFarmCropDefinition, type FarmCropDefinition, type FarmCropId } from './types'

const CROP_NAMES: readonly (readonly [string, string, string, string, string])[] = [
  ['Carrot', 'Sweet Potato', 'Corn', 'Chili Pepper', 'Blueberry'],
  ['Radish', 'Yam', 'Potato', 'Bell Pepper', 'Strawberry'],
  ['Snap Pea', 'Taro', 'Daikon', 'Shishito Pepper', 'Tomato'],
  ['Cucumber', 'Cassava', 'Onion', 'Jalapeño', 'Grape'],
  ['Asparagus', 'Beet', 'Garlic', 'Ginger', 'Apple'],
  ['Green Bean', 'Turnip', 'Leek', 'Mustard Greens', 'Pear'],
  ['Zucchini', 'Parsnip', 'Broccoli', 'Horseradish', 'Peach'],
  ['Okra', 'Pumpkin', 'Cauliflower', 'Wasabi Root', 'Plum'],
  ['Celery', 'Butternut Squash', 'Cabbage', 'Red Pepper', 'Cherry'],
  ['Scallion', 'Acorn Squash', 'Eggplant', 'Radicchio', 'Persimmon'],
  ['Bamboo Shoot', 'Plantain', 'Artichoke', 'Bitter Melon', 'Fig'],
  ['Fennel', 'Breadfruit', 'Avocado', 'Turmeric Root', 'Pomegranate'],
  ['Starfruit', 'Lotus Root', 'Jackfruit', 'Habanero', 'Kiwi'],
  ['Snow Pea', 'Winter Melon', 'Romanesco', 'Scotch Bonnet', 'Dragon Fruit'],
]

const definition = (scenarioTier: number, stat: StatKey, name: string): FarmCropDefinition => Object.freeze({
  id: `produce:t${scenarioTier}:${stat}` as FarmCropId,
  name,
  stat,
  scenarioTier,
  outfitLevelRequired: FARM_OUTFIT_LEVEL_REQUIREMENTS[scenarioTier - 1]!,
  farmLevelRequired: FARM_CROP_LEVEL_REQUIREMENTS[scenarioTier - 1]!,
  growthHours: FARM_GROWTH_HOURS,
  yield: FARM_CROP_YIELD,
  farmingExp: FARMING_EXP_PER_HARVEST,
})

export const FARM_CROPS: readonly FarmCropDefinition[] = Object.freeze(CROP_NAMES.flatMap((names, tierIndex) =>
  STATS.map((stat, statIndex) => definition(tierIndex + 1, stat, names[statIndex]!))))

const BY_ID = new Map(FARM_CROPS.map((crop) => [crop.id, crop]))

export const farmCropById = (id: string): FarmCropDefinition | null => BY_ID.get(id as FarmCropId) ?? null

export const farmCropFor = (scenarioTier: number, stat: StatKey): FarmCropDefinition | null =>
  farmCropById(`produce:t${scenarioTier}:${stat}`)

export function assertFarmCropCatalog(catalog: readonly FarmCropDefinition[] = FARM_CROPS): void {
  if (catalog.length !== CROP_NAMES.length * STATS.length) throw new Error('Farm crop catalog must contain 70 crops')
  const ids = new Set<string>()
  const pairs = new Set<string>()
  for (const crop of catalog) {
    const parsed = parseFarmCropDefinition(crop)
    if (!parsed) throw new Error(`Farm crop definition is invalid: ${String(crop.id)}`)
    if (ids.has(parsed.id)) throw new Error(`Farm crop id is duplicated: ${parsed.id}`)
    ids.add(parsed.id)
    const pair = `${parsed.scenarioTier}:${parsed.stat}`
    if (pairs.has(pair)) throw new Error(`Farm crop tier/stat pair is duplicated: ${pair}`)
    pairs.add(pair)
    if (parsed.outfitLevelRequired !== FARM_OUTFIT_LEVEL_REQUIREMENTS[parsed.scenarioTier - 1] ||
      parsed.farmLevelRequired !== FARM_CROP_LEVEL_REQUIREMENTS[parsed.scenarioTier - 1]) {
      throw new Error(`Farm crop requirements drifted: ${parsed.id}`)
    }
  }
  for (let tier = 1; tier <= CROP_NAMES.length; tier += 1) {
    for (const stat of STATS) {
      if (!pairs.has(`${tier}:${stat}`)) throw new Error(`Farm crop is missing for tier ${tier} ${stat}`)
    }
  }
}

