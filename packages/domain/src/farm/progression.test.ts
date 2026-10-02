import { describe, expect, it } from 'vitest'
import {
  applyFarmingXp,
  cropGrowthMinutes,
  cropTierOpenLevel,
  cropTiersUnlockedBetween,
  farmLevel,
  farmPlotNumber,
  farmPlotRequirement,
  farmSectionOf,
  farmSectionPlotIds,
  farmingProgressFromTotalXp,
  farmingXpToNext,
  farmingXpToReachLevel,
  highestCropTier,
  isCropTierUnlocked,
  isFarmGrowthDuration,
  plotsUnlockedBetween,
  unlockedPlotCount,
} from './progression'

describe('Farm progression (D234)', () => {
  it('costs the same two harvests for every level, without a cap: the vertical track is linear', () => {
    expect([1, 9, 10, 130, 5_000].map(farmingXpToNext)).toEqual([24, 24, 24, 24, 24])
    expect(farmingXpToReachLevel(10) / 12).toBe(18)
    expect(farmingXpToReachLevel(130) / 12).toBe(258)
    expect(farmingProgressFromTotalXp(468)).toEqual({ level: 20, exp: 12 })
  })

  it('applies overflow across levels and never clamps', () => {
    expect(applyFarmingXp({ level: 1, exp: 12 }, 12)).toEqual({ progress: { level: 2, exp: 0 }, levelsCrossed: [2] })
    expect(applyFarmingXp({ level: 10, exp: 23 }, 25)).toEqual({ progress: { level: 12, exp: 0 }, levelsCrossed: [11, 12] })
    expect(applyFarmingXp({ level: 500, exp: 0 }, 12)).toEqual({ progress: { level: 500, exp: 12 }, levelsCrossed: [] })
    expect(() => applyFarmingXp({ level: 2, exp: 24 }, 0)).toThrow(/invalid/)
  })

  it('derives account Farm Level only from levels earned after each baseline', () => {
    expect(farmLevel({})).toBe(1)
    expect(farmLevel({ a: { level: 1, exp: 6 }, b: { level: 1, exp: 0 } })).toBe(1)
    expect(farmLevel({ a: { level: 80, exp: 0 }, b: { level: 25, exp: 0 }, c: { level: 2, exp: 0 } })).toBe(105)
  })

  it('opens plots in order, each costing twice the square of the plots already open more than the last', () => {
    expect(Array.from({ length: 13 }, (_, index) => farmPlotRequirement(index + 1)))
      .toEqual([1, 3, 11, 29, 61, 111, 183, 281, 409, 571, 771, 1_013, 1_301])
    expect([1, 2, 3, 110, 111, 182, 183].map(unlockedPlotCount)).toEqual([1, 1, 2, 5, 6, 6, 7])
    expect(plotsUnlockedBetween(100, 190)).toEqual(['plot-6', 'plot-7'])
    expect(plotsUnlockedBetween(190, 100)).toEqual([])
    expect([1, 6, 7, 12, 13].map(farmSectionOf)).toEqual([1, 1, 2, 2, 3])
    expect(farmSectionPlotIds(2)).toEqual(['plot-7', 'plot-8', 'plot-9', 'plot-10', 'plot-11', 'plot-12'])
    expect(['plot-1', 'plot-600', 'plot-0', 'plot-01', 'plot-601', 'plot-x'].map(farmPlotNumber)).toEqual([1, 600, null, null, null, null])
  })

  it('opens a scenario row every ten Farming Levels', () => {
    expect([1, 2, 3, 14].map(cropTierOpenLevel)).toEqual([1, 10, 20, 130])
    expect([1, 9, 10, 129, 130, 500].map(highestCropTier)).toEqual([1, 1, 2, 13, 14, 14])
    expect(isCropTierUnlocked(2, 9)).toBe(false)
    expect(isCropTierUnlocked(2, 10)).toBe(true)
    expect(cropTiersUnlockedBetween(9, 10)).toEqual([2])
    expect(cropTiersUnlockedBetween(19, 31)).toEqual([3, 4])
  })

  it('grows a row 24 minutes faster for each of the ten levels after it opens, from 12 hours to 8', () => {
    expect([1, 2, 6, 11, 50].map((level) => cropGrowthMinutes(1, level))).toEqual([720, 696, 600, 480, 480])
    expect([10, 15, 20].map((level) => cropGrowthMinutes(2, level))).toEqual([720, 600, 480])
    expect(cropGrowthMinutes(14, 140)).toBe(480)
    expect(() => cropGrowthMinutes(3, 19)).toThrow(/not opened/)
    const minutes = (value: number) => value * 60_000
    expect([720, 696, 480].map((value) => isFarmGrowthDuration(minutes(value)))).toEqual([true, true, true])
    expect([456, 700, 744].map((value) => isFarmGrowthDuration(minutes(value)))).toEqual([false, false, false])
    expect(isFarmGrowthDuration(minutes(720) + 1)).toBe(false)
  })
})
