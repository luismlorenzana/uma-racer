// Stable Farm outfit, field, and crop progression (docs/design/farm.md#outfit-farming-level-and-aggregate-farm-level).

import {
  FARM_CROP_LEVEL_REQUIREMENTS,
  FARM_OUTFIT_LEVEL_REQUIREMENTS,
  FARM_PLOT_IDS,
  FARM_PLOT_LEVEL_REQUIREMENTS,
  MAX_OUTFIT_FARMING_LEVEL,
  type FarmPlotId,
} from './constants'
import type { OutfitFarmingProgress } from './types'

export interface FarmingExpResult {
  progress: OutfitFarmingProgress
  levelsCrossed: number[]
}

function requireLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > MAX_OUTFIT_FARMING_LEVEL) {
    throw new Error(`Farming Level must be 1–${MAX_OUTFIT_FARMING_LEVEL}`)
  }
  return level
}

export function farmingXpToNext(level: number): number {
  const checked = requireLevel(level)
  return checked === MAX_OUTFIT_FARMING_LEVEL ? 0 : 48 + 12 * Math.floor((checked - 1) / 4)
}

export function farmingXpToReachLevel(level: number): number {
  const checked = requireLevel(level)
  let total = 0
  for (let current = 1; current < checked; current += 1) total += farmingXpToNext(current)
  return total
}

export function applyFarmingXp(progress: OutfitFarmingProgress, amount: number): FarmingExpResult {
  let level = requireLevel(progress.level)
  if (!Number.isSafeInteger(progress.exp) || progress.exp < 0 ||
    (level === MAX_OUTFIT_FARMING_LEVEL ? progress.exp !== 0 : progress.exp >= farmingXpToNext(level))) {
    throw new Error('Farming progress is invalid')
  }
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Farming XP must be a non-negative safe integer')
  if (level === MAX_OUTFIT_FARMING_LEVEL) return { progress: { level, exp: 0 }, levelsCrossed: [] }

  let exp = progress.exp + amount
  if (!Number.isSafeInteger(exp)) throw new Error('Farming XP overflow')
  const levelsCrossed: number[] = []
  while (level < MAX_OUTFIT_FARMING_LEVEL) {
    const required = farmingXpToNext(level)
    if (exp < required) break
    exp -= required
    level += 1
    levelsCrossed.push(level)
  }
  if (level === MAX_OUTFIT_FARMING_LEVEL) exp = 0
  return { progress: { level, exp }, levelsCrossed }
}

export const defaultOutfitFarmingProgress = (): OutfitFarmingProgress => ({ level: 1, exp: 0 })

export function farmLevel(workers: Readonly<Record<string, OutfitFarmingProgress>>): number {
  return 1 + Object.values(workers).reduce((sum, progress) => sum + requireLevel(progress.level) - 1, 0)
}

export function plotLevelRequirement(plotId: FarmPlotId): number {
  return FARM_PLOT_LEVEL_REQUIREMENTS[FARM_PLOT_IDS.indexOf(plotId)]!
}

export const isPlotUnlocked = (plotId: FarmPlotId, level: number): boolean =>
  Number.isSafeInteger(level) && level >= plotLevelRequirement(plotId)

export const unlockedPlotIds = (level: number): FarmPlotId[] =>
  FARM_PLOT_IDS.filter((plotId) => isPlotUnlocked(plotId, level))

export function plotsUnlockedBetween(before: number, after: number): FarmPlotId[] {
  if (after <= before) return []
  return FARM_PLOT_IDS.filter((plotId) => !isPlotUnlocked(plotId, before) && isPlotUnlocked(plotId, after))
}

export function cropRequirements(scenarioTier: number): { outfitLevel: number; farmLevel: number } {
  if (!Number.isSafeInteger(scenarioTier) || scenarioTier < 1 || scenarioTier > FARM_OUTFIT_LEVEL_REQUIREMENTS.length) {
    throw new Error('Farm crop scenario tier is invalid')
  }
  return {
    outfitLevel: FARM_OUTFIT_LEVEL_REQUIREMENTS[scenarioTier - 1]!,
    farmLevel: FARM_CROP_LEVEL_REQUIREMENTS[scenarioTier - 1]!,
  }
}

export const isCropTierUnlocked = (scenarioTier: number, outfitLevel: number, accountFarmLevel: number): boolean => {
  const required = cropRequirements(scenarioTier)
  return outfitLevel >= required.outfitLevel && accountFarmLevel >= required.farmLevel
}

export function cropTiersUnlockedBetween(
  outfitLevelBefore: number,
  outfitLevelAfter: number,
  farmLevelBefore: number,
  farmLevelAfter: number,
): number[] {
  return FARM_OUTFIT_LEVEL_REQUIREMENTS.map((_, index) => index + 1).filter((tier) =>
    !isCropTierUnlocked(tier, outfitLevelBefore, farmLevelBefore) &&
    isCropTierUnlocked(tier, outfitLevelAfter, farmLevelAfter))
}

