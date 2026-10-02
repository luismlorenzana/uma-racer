// Stable Farm outfit, field, and crop progression (docs/design/farm.md#outfit-farming-level-and-aggregate-farm-level, D234).

import {
  FARM_BASE_GROWTH_MINUTES,
  FARM_CROP_TIERS,
  FARM_GROWTH_STEP_MINUTES,
  FARM_GROWTH_STEPS,
  FARM_LEVELS_PER_CROP_TIER,
  FARM_PLOT_ID_PATTERN,
  FARM_PLOT_STEP_FACTOR,
  FARM_PLOTS_PER_SECTION,
  FARMING_EXP_PER_LEVEL,
  MAX_FARM_PLOTS,
  MAX_FARMING_LEVEL_BOUND,
  MINUTE_MS,
  type FarmPlotId,
} from './constants'
import type { OutfitFarmingProgress } from './types'

export interface FarmingExpResult {
  progress: OutfitFarmingProgress
  levelsCrossed: number[]
}

function requireLevel(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1 || level > MAX_FARMING_LEVEL_BOUND) {
    throw new Error(`Farming Level must be 1–${MAX_FARMING_LEVEL_BOUND}`)
  }
  return level
}

/** Every level costs the same (D234): two harvests. */
export function farmingXpToNext(level: number): number {
  requireLevel(level)
  return FARMING_EXP_PER_LEVEL
}

export const farmingXpToReachLevel = (level: number): number => FARMING_EXP_PER_LEVEL * (requireLevel(level) - 1)

/** A worker's lifetime Farming XP, which is what a harvest count or a curve change preserves. */
export const farmingTotalXp = (progress: OutfitFarmingProgress): number => farmingXpToReachLevel(progress.level) + progress.exp

export function applyFarmingXp(progress: OutfitFarmingProgress, amount: number): FarmingExpResult {
  let level = requireLevel(progress.level)
  if (!Number.isSafeInteger(progress.exp) || progress.exp < 0 || progress.exp >= farmingXpToNext(level)) {
    throw new Error('Farming progress is invalid')
  }
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Farming XP must be a non-negative safe integer')
  const total = progress.exp + amount
  if (!Number.isSafeInteger(total)) throw new Error('Farming XP overflow')
  const gained = Math.floor(total / FARMING_EXP_PER_LEVEL)
  if (level + gained > MAX_FARMING_LEVEL_BOUND) throw new Error('Farming Level overflow')
  const levelsCrossed = Array.from({ length: gained }, (_, index) => level + index + 1)
  level += gained
  return { progress: { level, exp: total % FARMING_EXP_PER_LEVEL }, levelsCrossed }
}

export const farmingProgressFromTotalXp = (total: number): OutfitFarmingProgress =>
  applyFarmingXp(defaultOutfitFarmingProgress(), total).progress

export const defaultOutfitFarmingProgress = (): OutfitFarmingProgress => ({ level: 1, exp: 0 })

/** Farm Level: 1 plus every level each outfit has earned past its first. It has no cap. */
export function farmLevel(workers: Readonly<Record<string, OutfitFarmingProgress>>): number {
  return 1 + Object.values(workers).reduce((sum, progress) => sum + requireLevel(progress.level) - 1, 0)
}

// Plots and Sections ---------------------------------------------------------------------------------------------------

export const farmPlotId = (number: number): FarmPlotId => `plot-${number}`

/** The plot's number across every Section, or null for anything that is not a plot id. */
export function farmPlotNumber(plotId: string): number | null {
  const match = FARM_PLOT_ID_PATTERN.exec(plotId)
  const number = match ? Number(match[1]) : NaN
  return Number.isSafeInteger(number) && number >= 1 && number <= MAX_FARM_PLOTS ? number : null
}

export const isFarmPlotId = (value: unknown): value is FarmPlotId => typeof value === 'string' && farmPlotNumber(value) !== null

export const farmSectionOf = (plotNumber: number): number => Math.ceil(plotNumber / FARM_PLOTS_PER_SECTION)

/** The plots of one Section, first to sixth. */
export const farmSectionPlotIds = (section: number): FarmPlotId[] =>
  Array.from({ length: FARM_PLOTS_PER_SECTION }, (_, index) => farmPlotId((section - 1) * FARM_PLOTS_PER_SECTION + index + 1))

/** What plot `n` costs over plot `n − 1` (D234): twice the square of the plots already open. */
export const farmPlotStep = (plotNumber: number): number => FARM_PLOT_STEP_FACTOR * (plotNumber - 1) ** 2

const PLOT_REQUIREMENTS: readonly number[] = (() => {
  const levels = [0, 1]
  for (let number = 2; number <= MAX_FARM_PLOTS; number += 1) levels.push(levels[number - 1]! + farmPlotStep(number))
  return levels
})()

/** The Farm Level that opens plot `n`. Plot 1 is open from the start. */
export function farmPlotRequirement(plotNumber: number): number {
  if (!Number.isSafeInteger(plotNumber) || plotNumber < 1 || plotNumber > MAX_FARM_PLOTS) throw new Error('Farm plot number is invalid')
  return PLOT_REQUIREMENTS[plotNumber]!
}

export function plotLevelRequirement(plotId: FarmPlotId): number {
  const number = farmPlotNumber(plotId)
  if (number === null) throw new Error(`Farm plot id is invalid: ${plotId}`)
  return farmPlotRequirement(number)
}

/** How many plots a Farm Level opens; they open in order, Section by Section. */
export function unlockedPlotCount(level: number): number {
  if (!Number.isSafeInteger(level) || level < 1) return 0
  let count = 0
  while (count < MAX_FARM_PLOTS && PLOT_REQUIREMENTS[count + 1]! <= level) count += 1
  return count
}

export const isPlotUnlocked = (plotId: FarmPlotId, level: number): boolean =>
  Number.isSafeInteger(level) && level >= plotLevelRequirement(plotId)

export const unlockedPlotIds = (level: number): FarmPlotId[] =>
  Array.from({ length: unlockedPlotCount(level) }, (_, index) => farmPlotId(index + 1))

export function plotsUnlockedBetween(before: number, after: number): FarmPlotId[] {
  const from = unlockedPlotCount(before)
  const to = unlockedPlotCount(after)
  return Array.from({ length: Math.max(0, to - from) }, (_, index) => farmPlotId(from + index + 1))
}

// Crop tiers and growth time ----------------------------------------------------------------------------------------------

function requireTier(scenarioTier: number): number {
  if (!Number.isSafeInteger(scenarioTier) || scenarioTier < 1 || scenarioTier > FARM_CROP_TIERS) {
    throw new Error('Farm crop scenario tier is invalid')
  }
  return scenarioTier
}

/** The Farming Level that opens a scenario's crops: Lv1 for the first, then every tenth level (D234). */
export const cropTierOpenLevel = (scenarioTier: number): number =>
  requireTier(scenarioTier) === 1 ? 1 : FARM_LEVELS_PER_CROP_TIER * (scenarioTier - 1)

/** The newest scenario row a worker at this level can grow. */
export const highestCropTier = (outfitLevel: number): number =>
  Math.min(FARM_CROP_TIERS, 1 + Math.floor(requireLevel(outfitLevel) / FARM_LEVELS_PER_CROP_TIER))

export const isCropTierUnlocked = (scenarioTier: number, outfitLevel: number): boolean =>
  outfitLevel >= cropTierOpenLevel(scenarioTier)

export function cropTiersUnlockedBetween(outfitLevelBefore: number, outfitLevelAfter: number): number[] {
  return Array.from({ length: FARM_CROP_TIERS }, (_, index) => index + 1).filter((tier) =>
    !isCropTierUnlocked(tier, outfitLevelBefore) && isCropTierUnlocked(tier, outfitLevelAfter))
}

/**
 * How long a worker takes to grow a scenario's crop: twelve hours when the row opens, 24 minutes less for each of her
 * next ten levels, then eight hours (D234). A row she has not opened has no time.
 */
export function cropGrowthMinutes(scenarioTier: number, outfitLevel: number): number {
  const past = requireLevel(outfitLevel) - cropTierOpenLevel(scenarioTier)
  if (past < 0) throw new Error('This worker has not opened that crop row')
  return FARM_BASE_GROWTH_MINUTES - FARM_GROWTH_STEP_MINUTES * Math.min(FARM_GROWTH_STEPS, past)
}

export const cropGrowthMs = (scenarioTier: number, outfitLevel: number): number =>
  cropGrowthMinutes(scenarioTier, outfitLevel) * MINUTE_MS

/** Every growth time a stored cycle may carry: 12h, 11h 36m … 8h. */
export function isFarmGrowthDuration(ms: number): boolean {
  if (!Number.isSafeInteger(ms) || ms % MINUTE_MS !== 0) return false
  const saved = FARM_BASE_GROWTH_MINUTES - ms / MINUTE_MS
  return saved >= 0 && saved % FARM_GROWTH_STEP_MINUTES === 0 && saved / FARM_GROWTH_STEP_MINUTES <= FARM_GROWTH_STEPS
}
