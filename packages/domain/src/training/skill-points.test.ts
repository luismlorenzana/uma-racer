// Pins Skill Points from the open tree (docs/rework/03-uma-progression.md §8): the baseline and a Friend or Group node's
// SP at every T, and 03 §8's URA Finale example.
import { describe, expect, it } from 'vitest'
import { spCapAt } from '../tiers/scaling'
import { baselineSp, reworkSpNodeValue } from './skill-points'

const ALL_T = Array.from({ length: 15 }, (_, i) => i + 1)
const FULL = [12, 16, 20, 24, 28]

describe('baselineSp', () => {
  it('pays 40% of the SP cap with the whole tree open, at every T', () => {
    expect(ALL_T.map((T) => baselineSp(T, FULL[(T - 1) % 5]!)))
      .toEqual([800, 960, 1120, 1200, 1280, 1360, 1440, 1520, 1600, 1680, 1760, 1840, 1920, 2000, 2080])
    expect(ALL_T.map((T) => baselineSp(T, FULL[(T - 1) % 5]!) / spCapAt(T))).toEqual(ALL_T.map(() => 0.4))
  })

  it('follows the open nodes and rounds once', () => {
    expect(baselineSp(1, 0)).toBe(0)
    expect(baselineSp(1, 6)).toBe(400)
    expect(baselineSp(2, 12)).toBe(720)
    expect(baselineSp(5, 24)).toBe(1097)
    expect(() => baselineSp(1, 13)).toThrow(RangeError)
    expect(() => baselineSp(1, -1)).toThrow(RangeError)
  })
})

describe('reworkSpNodeValue', () => {
  it('is round(0.60 × spCap ÷ ceil(N / 6)) at every T', () => {
    expect(ALL_T.map(reworkSpNodeValue)).toEqual([600, 480, 420, 450, 384, 1020, 720, 570, 600, 504, 1320, 920, 720, 750, 624])
  })

  it("gives 03 §8's example: 12 open nodes pay 800 SP, a Friend card on two adds 1,200, reaching the 2,000 cap", () => {
    expect(baselineSp(1, 12)).toBe(800)
    expect(2 * reworkSpNodeValue(1)).toBe(1200)
    expect(baselineSp(1, 12) + 2 * reworkSpNodeValue(1)).toBe(spCapAt(1))
  })
})
