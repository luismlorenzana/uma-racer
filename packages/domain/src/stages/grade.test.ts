// Grades and the pay ladder (D384): the floors, S by score or by every task, and the multipliers.
import { describe, expect, it } from 'vitest'
import { grade, GRADE_FLOORS, payMultiplier, PAY_MULTIPLIERS, STAGE_GRADES } from './grade'

describe('grade', () => {
  it('reads p against the floors: D under 0.5, C, B, A, and S from 1.2', () => {
    expect(GRADE_FLOORS).toEqual({ C: 0.5, B: 0.75, A: 1, S: 1.2 })
    const none = [false, false, false]
    expect([0, 0.49, 0.5, 0.74, 0.75, 0.99, 1, 1.19, 1.2, 3].map((p) => grade(p, none))).toEqual(['D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S', 'S'])
  })

  it('lifts an A with every task to S, and nothing below A', () => {
    const all = [true, true, true]
    expect(grade(1, all)).toBe('S')
    expect(grade(1.1, [true, true, false])).toBe('A')
    expect(grade(0.99, all)).toBe('B')
    expect(grade(0.4, all)).toBe('D')
    expect(grade(1, [])).toBe('A') // a game with no tasks reaches S by score alone
  })

  it('grades a broken score D', () => {
    expect(grade(Number.NaN, [true])).toBe('D')
    expect(grade(-1, [])).toBe('D')
  })

  it('pays D 0.25, C 0.6, B 0.8, A 1 and S 1.2', () => {
    expect(STAGE_GRADES.map(payMultiplier)).toEqual([0.25, 0.6, 0.8, 1, 1.2])
    expect(PAY_MULTIPLIERS).toEqual({ D: 0.25, C: 0.6, B: 0.8, A: 1, S: 1.2 })
  })
})
