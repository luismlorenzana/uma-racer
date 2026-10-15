// Pins the grade gate: grade g opens at Farm Lv 5g − 4 (docs/rework/08-item-catalogue-and-recipes.md §3, 07 §4, D330).
import { expect, it } from 'vitest'
import { ITEM_GRADE_LIST } from './catalogue'
import { canWorkGrade, gradeOpensAtFarmLevel, highestOpenGrade } from './grades'

it('opens grades 1–10 at Farm Lv 1, 6 … 46 (08 §3\'s Farm Lv column)', () => {
  expect(ITEM_GRADE_LIST.map(gradeOpensAtFarmLevel)).toEqual([1, 6, 11, 16, 21, 26, 31, 36, 41, 46])
  expect(() => gradeOpensAtFarmLevel(0 as never)).toThrow(RangeError)
})

it('gives the highest open grade at a Farm Level', () => {
  expect(highestOpenGrade(1)).toBe(1)
  expect(highestOpenGrade(5)).toBe(1)
  expect(highestOpenGrade(6)).toBe(2)
  expect(highestOpenGrade(45)).toBe(9)
  expect(highestOpenGrade(46)).toBe(10)
  expect(highestOpenGrade(50)).toBe(10)
  expect(() => highestOpenGrade(0)).toThrow(RangeError)
  expect(() => highestOpenGrade(2.5)).toThrow(RangeError)
})

it('lets an Uma work a grade from the level that opens it', () => {
  expect(canWorkGrade(1, 1)).toBe(true)
  expect(canWorkGrade(5, 2)).toBe(false)
  expect(canWorkGrade(6, 2)).toBe(true)
  expect(canWorkGrade(45, 10)).toBe(false)
  expect(canWorkGrade(46, 10)).toBe(true)
  for (let level = 1; level <= 50; level++) {
    for (const g of ITEM_GRADE_LIST) expect(canWorkGrade(level, g)).toBe(g <= highestOpenGrade(level))
  }
})
