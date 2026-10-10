// Account-local device preferences for Farm navigation and planning. Reads never manufacture rows (T122).
import { FARM_DISTRICTS, FARM_KITCHEN_CATALOGUE, farmSafeId, type FarmDistrict } from '@racer/domain/farm/kitchen'
import type { RacerDb } from '../../db'
import { ingredientChoices, type FarmWishlistGoal } from './presentation'

export interface FarmKitchenPreferences {
  lastDistrict: FarmDistrict
  density: 'comfortable' | 'compact'
  stage: 'all' | 'raw' | 'processed' | 'meal' | 'energy'
  block: 'all' | `${number}`
  stat: 'all' | 'speed' | 'stamina' | 'power' | 'guts' | 'wit'
  goals: FarmWishlistGoal[]
}
export const DEFAULT_FARM_KITCHEN_PREFERENCES: FarmKitchenPreferences = {
  lastDistrict: 'garden', density: 'comfortable', stage: 'all', block: 'all', stat: 'all', goals: [],
}
const ID = 'ui:kitchen'

export function parseFarmKitchenPreferences(value: unknown): FarmKitchenPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_FARM_KITCHEN_PREFERENCES
  const record = value as Record<string, unknown>
  const goals = Array.isArray(record.goals) ? record.goals.flatMap((candidate): FarmWishlistGoal[] => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return []
    const goal = candidate as Record<string, unknown>
    const recipe = typeof goal.recipeId === 'string' ? FARM_KITCHEN_CATALOGUE.recipesById.get(goal.recipeId) : undefined
    if (!recipe || recipe.kind !== 'cooking' || !farmSafeId(goal.id) || !Number.isSafeInteger(goal.quantity) ||
      Number(goal.quantity) < 1 || Number(goal.quantity) > 99 || !goal.choices || typeof goal.choices !== 'object' || Array.isArray(goal.choices)) return []
    return [{ id: String(goal.id), recipeId: recipe.id, quantity: Number(goal.quantity),
      choices: ingredientChoices(recipe, {}, goal.choices as Record<string, string>) }]
  }).slice(0, 3) : []
  const stage = ['all', 'raw', 'processed', 'meal', 'energy'].includes(String(record.stage))
    ? record.stage as FarmKitchenPreferences['stage'] : 'all'
  const block = record.block === 'all' || FARM_KITCHEN_CATALOGUE.blocks.includes(Number(record.block))
    ? String(record.block) as FarmKitchenPreferences['block'] : 'all'
  const stat = ['all', 'speed', 'stamina', 'power', 'guts', 'wit'].includes(String(record.stat))
    ? record.stat as FarmKitchenPreferences['stat'] : 'all'
  return {
    lastDistrict: FARM_DISTRICTS.includes(record.lastDistrict as FarmDistrict) ? record.lastDistrict as FarmDistrict : 'garden',
    density: record.density === 'compact' ? 'compact' : 'comfortable', stage, block, stat, goals,
  }
}

export async function loadFarmKitchenPreferences(database: RacerDb): Promise<FarmKitchenPreferences> {
  return parseFarmKitchenPreferences((await database.farmPreferences.get(ID))?.value)
}
export async function saveFarmKitchenPreferences(database: RacerDb, preferences: FarmKitchenPreferences): Promise<void> {
  await database.farmPreferences.put({ id: ID, value: parseFarmKitchenPreferences(preferences) })
}
