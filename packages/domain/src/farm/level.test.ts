// Pins Farm EXP and Farm Level (docs/rework/07-farm.md §3–§4, README "Shared numbers", D336): the curve, the gate
// levels' EXP, the cap, the six multipliers and the family → aptitude map.
import { describe, expect, it } from 'vitest'
import { gradeOpensAtFarmLevel } from '../items/grades'
import { ITEM_GRADE_LIST } from '../items/catalogue'
import {
  addFarmExp, FAMILY_APTITUDE, FARM_EXP_CAP, FARM_EXP_CAP_QUARTERS, FARM_EXP_TENTHS, FARM_LEVEL_CAP, farmExpAtLevel, farmExpMultiplier,
  farmExpPerItem, farmExpToNext, farmLevel, familyAptitude, QUARTERS_PER_EXP, SECONDS_PER_QUARTER_TENTH,
} from './level'

describe('the Farm Level curve', () => {
  it('costs 480 + 5(L − 1): 480 at Lv 1, 720 at Lv 49', () => {
    expect(farmExpToNext(1)).toBe(480)
    expect(farmExpToNext(2)).toBe(485)
    expect(farmExpToNext(49)).toBe(720)
    expect(() => farmExpToNext(50)).toThrow(RangeError)
    expect(() => farmExpToNext(0)).toThrow(RangeError)
  })

  it('reaches each grade gate at 07 §4’s EXP, and Lv 50 at 29,400', () => {
    expect(ITEM_GRADE_LIST.map((g) => farmExpAtLevel(gradeOpensAtFarmLevel(g)))).toEqual([
      0, 2_450, 5_025, 7_725, 10_550, 13_500, 16_575, 19_775, 23_100, 26_550,
    ])
    expect(FARM_LEVEL_CAP).toBe(50)
    expect(FARM_EXP_CAP).toBe(29_400)
    expect(QUARTERS_PER_EXP).toBe(4)
    expect(FARM_EXP_CAP_QUARTERS).toBe(117_600)
  })

  it('reads the level from quarter points, capped at 50', () => {
    expect(farmLevel(0)).toBe(1)
    expect(farmLevel(480 * 4 - 1)).toBe(1)
    expect(farmLevel(480 * 4)).toBe(2)
    expect(farmLevel(2_450 * 4)).toBe(6)
    expect(farmLevel(26_550 * 4)).toBe(46)
    expect(farmLevel(FARM_EXP_CAP_QUARTERS)).toBe(50)
    expect(farmLevel(FARM_EXP_CAP_QUARTERS * 2)).toBe(50)
    expect(() => farmLevel(1.5)).toThrow(RangeError)
  })

  it('crosses several levels in one go and stops counting at Lv 50', () => {
    expect(addFarmExp({ level: 1, exp: 0 }, 1_950 * 4)).toEqual({ level: 5, exp: 7_800 })
    expect(addFarmExp({ level: 49, exp: (FARM_EXP_CAP - 10) * 4 }, 5_000)).toEqual({ level: 50, exp: FARM_EXP_CAP_QUARTERS })
    expect(addFarmExp({ level: 50, exp: FARM_EXP_CAP_QUARTERS }, 400)).toEqual({ level: 50, exp: FARM_EXP_CAP_QUARTERS })
    expect(addFarmExp({ level: 3, exp: 3_900 }, 0)).toEqual({ level: 3, exp: 3_900 })
  })
})

describe('aptitudes (07 §3)', () => {
  it('pins the six multipliers, in tenths', () => {
    expect(FARM_EXP_TENTHS).toEqual({ S: 18, A: 16, B: 12, C: 10, D: 9, E: 8, F: 8, G: 8 })
    expect((['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const).map(farmExpMultiplier)).toEqual([18, 16, 12, 10, 9, 8, 8, 8])
  })

  it('pairs each family with one distance or running style', () => {
    expect(FAMILY_APTITUDE).toEqual({
      sweets: { kind: 'distance', key: 'sprint' },
      fish: { kind: 'distance', key: 'mile' },
      'herbs-spices': { kind: 'distance', key: 'medium' },
      fruits: { kind: 'distance', key: 'long' },
      'nuts-seeds': { kind: 'strategy', key: 'end' },
      grains: { kind: 'strategy', key: 'pace' },
      vegetables: { kind: 'strategy', key: 'front' },
      mushrooms: { kind: 'strategy', key: 'late' },
    })
    const her = {
      distance: { sprint: 'S', mile: 'A', medium: 'B', long: 'C' },
      strategy: { front: 'D', pace: 'E', late: 'F', end: 'G' },
    } as const
    expect((['sweets', 'fish', 'herbs-spices', 'fruits', 'vegetables', 'grains', 'mushrooms', 'nuts-seeds'] as const).map((f) => familyAptitude(her, f)))
      .toEqual(['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'])
  })

  it('pays one item round(listed seconds × tenths ÷ 150) quarter points', () => {
    expect(SECONDS_PER_QUARTER_TENTH).toBe(150)
    expect(farmExpPerItem(6_480, 10)).toBe(432) // a grade-1 gather at C: 108 EXP, its 108 real minutes
    expect(farmExpPerItem(5_700, 10)).toBe(380) // 07 §2's Potato in base seconds: 95 EXP
    expect(farmExpPerItem(1_620, 10)).toBe(108) // a grade-1 craft: 27 EXP
    expect(farmExpPerItem(1_620, 9)).toBe(97) // ×0.9 rounds once: 97.2 → 97 quarter points
    expect(farmExpPerItem(1_620, 18)).toBe(194)
    expect(farmExpPerItem(17_280, 16)).toBe(1_843)
    expect(() => farmExpPerItem(1.5, 10)).toThrow(RangeError)
  })
})
