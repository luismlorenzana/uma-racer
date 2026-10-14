// Pins the prize table (docs/rework/09-racing-rewards-and-exchange.md §2.1, README "Money", rework/10). Expected values
// are 09 §2.1's rows copied as written.
import { describe, expect, it } from 'vitest'
import type { RaceGrade } from '../../types'
import { EXPEDITION_RATE_PERCENT, HOME_RATE_PERCENT, PLACE_SHARE_PERCENT, WIN_PRIZE, grossPrize, placeShare, prizeRate } from './prizes'

/** 09 §2.1: grade, then 1st … 5th, then 6th and below. */
const SECTION_2_1 = [
  '| Debut, Maiden | 60 | 24 | 12 | 6 | 3 | 0 |',
  '| Pre-OP | 80 | 32 | 16 | 8 | 4 | 0 |',
  '| OP | 100 | 40 | 20 | 10 | 5 | 0 |',
  '| G3 | 150 | 60 | 30 | 15 | 7 | 0 |',
  '| G2 | 200 | 80 | 40 | 20 | 10 | 0 |',
  '| G1 | 300 | 120 | 60 | 30 | 15 | 0 |',
]
const GRADES_OF: Readonly<Record<string, readonly RaceGrade[]>> = {
  'Debut, Maiden': ['debut', 'maiden'], 'Pre-OP': ['pre-op'], OP: ['op'], G3: ['g3'], G2: ['g2'], G1: ['g1'],
}
const cells = (row: string) => row.split('|').slice(1, -1).map((cell) => cell.trim())
const paid = (query: Parameters<typeof grossPrize>[0]): number => {
  const prize = grossPrize(query)
  if (typeof prize !== 'number') throw new Error(prize.reason)
  return prize
}

describe('the numbers', () => {
  it('are 60 / 80 / 100 / 150 / 200 / 300 a win, 100-40-20-10-5% a place and 150% abroad', () => {
    expect(WIN_PRIZE).toEqual({ debut: 60, maiden: 60, 'pre-op': 80, op: 100, g3: 150, g2: 200, g1: 300 })
    expect(PLACE_SHARE_PERCENT).toEqual([100, 40, 20, 10, 5])
    expect([EXPEDITION_RATE_PERCENT, HOME_RATE_PERCENT]).toEqual([150, 100])
  })
})

describe('grossPrize (09 §2.1)', () => {
  it('pays every cell of the table, rounding down once (a G3 5th pays 7)', () => {
    for (const row of SECTION_2_1) {
      const [label, ...amounts] = cells(row)
      for (const grade of GRADES_OF[label!]!) {
        amounts.forEach((amount, i) => expect(paid({ grade, place: i + 1 }), `${grade} place ${i + 1}`).toBe(Number(amount)))
      }
    }
    expect(paid({ grade: 'g3', place: 5 })).toBe(7)
  })

  it('pays nothing from 6th down', () => {
    for (const grade of Object.keys(WIN_PRIZE) as RaceGrade[]) {
      for (const place of [6, 7, 10, 18, 99]) expect(paid({ grade, place })).toBe(0)
    }
    expect([placeShare(5), placeShare(6)]).toEqual([5, 0])
  })

  it('pays an Expedition race 1.5× the G1 row, whatever its local grade: 450 / 180 / 90 / 45 / 22', () => {
    for (const grade of ['g1', 'g3', 'op'] as const) {
      expect([1, 2, 3, 4, 5, 6].map((place) => paid({ grade, place, expedition: { familyWon: false } }))).toEqual([450, 180, 90, 45, 22, 0])
    }
    expect(prizeRate({ familyWon: false })).toBe(150)
  })

  it('pays a family already won on her run the home G1 row: 300 / 120 / 60 / 30 / 15', () => {
    for (const grade of ['g1', 'g2', 'pre-op'] as const) {
      expect([1, 2, 3, 4, 5, 6].map((place) => paid({ grade, place, expedition: { familyWon: true } }))).toEqual([300, 120, 60, 30, 15, 0])
    }
    expect([prizeRate({ familyWon: true }), prizeRate()]).toEqual([100, 100])
  })

  it('refuses a place that is not a whole number from 1, in plain words', () => {
    for (const place of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(grossPrize({ grade: 'g1', place })).toEqual({
        refused: true, code: 'place', reason: "{place} isn't a finishing place.", data: { place: String(place) },
      })
    }
    expect(() => grossPrize({ grade: 'g4' as RaceGrade, place: 1 })).toThrow(RangeError)
  })
})
