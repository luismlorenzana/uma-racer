import { describe, expect, it } from 'vitest'
import {
  applyFarmingXp,
  cropRequirements,
  cropTiersUnlockedBetween,
  farmLevel,
  farmingXpToNext,
  farmingXpToReachLevel,
  isCropTierUnlocked,
  plotsUnlockedBetween,
  unlockedPlotIds,
} from './progression'

describe('Farm progression', () => {
  it('pins the outfit curve through level 20', () => {
    expect([1, 4, 5, 8, 9, 12, 13, 16, 17, 19, 20].map(farmingXpToNext))
      .toEqual([48, 48, 60, 60, 72, 72, 84, 84, 96, 96, 0])
    expect(farmingXpToReachLevel(2)).toBe(48)
    expect(farmingXpToReachLevel(20)).toBe(1_344)
    expect(1_344 / 12).toBe(112)
  })

  it('applies overflow across levels and clamps max-level XP', () => {
    expect(applyFarmingXp({ level: 1, exp: 36 }, 12)).toEqual({
      progress: { level: 2, exp: 0 }, levelsCrossed: [2],
    })
    expect(applyFarmingXp({ level: 4, exp: 47 }, 62)).toEqual({
      progress: { level: 6, exp: 1 }, levelsCrossed: [5, 6],
    })
    expect(applyFarmingXp({ level: 19, exp: 95 }, 10_000)).toEqual({
      progress: { level: 20, exp: 0 }, levelsCrossed: [20],
    })
    expect(applyFarmingXp({ level: 20, exp: 0 }, 12)).toEqual({
      progress: { level: 20, exp: 0 }, levelsCrossed: [],
    })
  })

  it('derives account Farm Level only from levels earned after each baseline', () => {
    expect(farmLevel({})).toBe(1)
    expect(farmLevel({ a: { level: 1, exp: 36 }, b: { level: 1, exp: 0 } })).toBe(1)
    expect(farmLevel({ a: { level: 8, exp: 0 }, b: { level: 5, exp: 0 }, c: { level: 2, exp: 0 } })).toBe(13)
  })

  it('pins plot and dual crop gates', () => {
    expect([1, 2, 6, 13, 27, 42].map((level) => unlockedPlotIds(level).length)).toEqual([1, 2, 3, 4, 5, 6])
    expect(plotsUnlockedBetween(12, 42)).toEqual(['plot-4', 'plot-5', 'plot-6'])
    expect(cropRequirements(14)).toEqual({ outfitLevel: 20, farmLevel: 92 })
    expect(isCropTierUnlocked(8, 11, 29)).toBe(true)
    expect(isCropTierUnlocked(8, 10, 29)).toBe(false)
    expect(isCropTierUnlocked(8, 11, 28)).toBe(false)
    expect(cropTiersUnlockedBetween(10, 11, 28, 29)).toEqual([8])
  })
})

