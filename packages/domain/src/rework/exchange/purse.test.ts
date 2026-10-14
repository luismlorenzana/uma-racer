// Pins the Daily Purse (docs/rework/09-racing-rewards-and-exchange.md §3.3, §3.4, §8, §11). 09 §3.4's rows are copied
// as written; they model day totals, so they are checked on a day's whole gross, and race by race within the rounding.
import { describe, expect, it } from 'vitest'
import { days } from '../../__fixtures__/rework-races'
import type { DailyPurse } from '../types'
import {
  PURSE_BANDS, PURSE_START_DAY, assertLocalDay, bandAt, boardDay, dayNumber, emptyPurse, payFromPurse, purseFor,
} from './purse'

const purse = (gross: number, day = '2026-10-13', featuredPaid: readonly string[] = []): DailyPurse => ({ day, gross, featuredPaid })

/** 09 §3.4: races, then gross / paid at ~150 a race, then gross / paid at ~200 a race. */
const SECTION_3_4 = [
  '| 12 (the target) | 1,800 | 1,800 | 6.7% | 2,400 | 2,400 | 8.9% |',
  '| 25 | 3,750 | 3,750 | 13.9% | 5,000 | 5,000 | 18.5% |',
  '| **40 (a heavy evening)** | 6,000 | **6,000** | **22.2%** | 8,000 | **6,500** | **24.1%** |',
  '| 60 | 9,000 | 6,750 | 25.0% | 12,000 | 7,500 | 27.8% |',
  '| 100 | 15,000 | 7,650 | 28.3% | 20,000 | 7,900 | 29.3% |',
  '| 150 | 22,500 | 8,025 | 29.7% | 30,000 | 8,400 | 31.1% |',
]
const cells = (row: string) => row.split('|').slice(1, -1).map((cell) => cell.trim().replace(/\*/g, ''))
const n = (cell: string) => Number(cell.replace(/,/g, ''))
/** A day of `races` races of `gross` each, race by race from an empty purse: what they pay in all. */
const raceByRace = (races: number, gross: number): number => {
  let state = emptyPurse()
  let total = 0
  for (let i = 0; i < races; i += 1) {
    const payment = payFromPurse(state, '2026-10-13', gross)
    total += payment.paid
    state = payment.purse
  }
  return total
}

describe('the bands (09 §3.3)', () => {
  it('pay 20/20 to 6,000, 5/20 to 12,000 and 1/20 beyond', () => {
    expect(PURSE_BANDS).toEqual([
      { band: 'full', upTo: 6_000, paidTwentieths: 20 },
      { band: 'tired', upTo: 12_000, paidTwentieths: 5 },
      { band: 'spent', upTo: null, paidTwentieths: 1 },
    ])
  })

  it('give an edge to the band below', () => {
    expect([0, 6_000, 6_001, 12_000, 12_001, 1e9].map(bandAt)).toEqual(['full', 'full', 'tired', 'tired', 'spent', 'spent'])
  })
})

describe('payFromPurse', () => {
  it('splits a G1 win at 5,900: 100 in full and 200 at a quarter pay 150 (09 §3.3, §11)', () => {
    expect(payFromPurse(purse(5_900), '2026-10-13', 300)).toEqual({
      purse: purse(6_200), paid: 150, band: 'tired', split: { full: 100, tired: 200, spent: 0 },
    })
  })

  it('keeps a race ending at exactly 6,000 full, and the next tired', () => {
    const first = payFromPurse(purse(5_700), '2026-10-13', 300)
    expect(first).toMatchObject({ paid: 300, band: 'full', purse: { gross: 6_000 } })
    expect(payFromPurse(first.purse, '2026-10-13', 300)).toMatchObject({ paid: 75, band: 'tired', split: { full: 0, tired: 300, spent: 0 } })
    expect(payFromPurse(purse(11_700), '2026-10-13', 300)).toMatchObject({ paid: 75, band: 'tired', purse: { gross: 12_000 } })
    expect(payFromPurse(purse(12_000), '2026-10-13', 300)).toMatchObject({ paid: 15, band: 'spent' })
  })

  it('lets one gross span all three bands, rounding down once', () => {
    expect(payFromPurse(purse(5_900), '2026-10-13', 6_250)).toEqual({
      purse: purse(12_150), paid: 100 + 1_500 + 7, band: 'spent', split: { full: 100, tired: 6_000, spent: 150 },
    })
  })

  it('pays nothing for nothing, and leaves the band where it was', () => {
    expect(payFromPurse(purse(6_000), '2026-10-13', 0)).toEqual({ purse: purse(6_000), paid: 0, band: 'full', split: { full: 0, tired: 0, spent: 0 } })
  })

  it('starts a new purse on a later day, featured bonuses and all', () => {
    const spent = purse(20_000, '2026-10-13', ['g1-mile-a'])
    expect(payFromPurse(spent, '2026-10-14', 300)).toEqual({ purse: purse(300, '2026-10-14'), paid: 300, band: 'full', split: { full: 300, tired: 0, spent: 0 } })
    expect(purseFor(spent, '2027-01-01')).toEqual(emptyPurse('2027-01-01'))
  })

  it('keeps the stored day when the date goes back, so a time-zone hop reopens nothing (09 §3.3, §8)', () => {
    const tired = purse(8_000, '2026-10-14', ['g1-mile-a'])
    expect(payFromPurse(tired, '2026-10-13', 300)).toMatchObject({ paid: 75, band: 'tired', purse: { day: '2026-10-14', gross: 8_300, featuredPaid: ['g1-mile-a'] } })
    expect(purseFor(tired, '2026-10-14')).toBe(tired)
    expect(boardDay(tired, '2026-10-12')).toBe('2026-10-14')
    expect(boardDay(tired, '2026-10-15')).toBe('2026-10-15')
  })

  it('refuses amounts that are not whole and days that are not real dates', () => {
    expect(() => payFromPurse(purse(0), '2026-10-13', 1.5)).toThrow(RangeError)
    expect(() => payFromPurse(purse(0), '2026-10-13', -1)).toThrow(RangeError)
    expect(() => payFromPurse(purse(0.5), '2026-10-13', 1)).toThrow(RangeError)
    expect(() => payFromPurse(purse(0), '2026-13-01', 1)).toThrow(RangeError)
  })
})

describe('09 §3.4: what a day pays', () => {
  it("comes out of a day's whole gross: 8,000 → 6,500, 15,000 → 7,650, 30,000 → 8,400 …", () => {
    for (const row of SECTION_3_4) {
      const [, gross150, paid150, , gross200, paid200] = cells(row).map(n)
      for (const [gross, paid] of [[gross150!, paid150!], [gross200!, paid200!]] as const) {
        expect(payFromPurse(emptyPurse(), '2026-10-13', gross).paid, `${gross}`).toBe(paid)
      }
    }
  })

  it('matches race by race exactly at 200 a race, and within 1 a race at 150', () => {
    for (const row of SECTION_3_4) {
      const [races, , paid150, , , paid200] = cells(row).map((cell) => n(cell.split(' ')[0]!))
      expect(raceByRace(races!, 200)).toBe(paid200)
      const at150 = raceByRace(races!, 150)
      expect(at150).toBeLessThanOrEqual(paid150!)
      expect(paid150! - at150).toBeLessThanOrEqual(races!)
    }
  })
})

describe('days', () => {
  it('count from 1970-01-01 by the civil calendar, as the UTC calendar does', () => {
    expect(dayNumber(PURSE_START_DAY)).toBe(0)
    expect(dayNumber('2026-10-13')).toBe(Date.UTC(2026, 9, 13) / 86_400_000)
    for (const day of [...days('1969-12-25', 20), ...days('2023-12-30', 800), ...days('2099-12-31', 3), '2000-02-29', '2400-02-29']) {
      expect(dayNumber(day), day).toBe(Date.parse(`${day}T00:00:00Z`) / 86_400_000)
    }
  })

  it('are real YYYY-MM-DD dates only', () => {
    for (const day of ['2024-02-29', '2000-02-29', '2026-12-31']) expect(() => assertLocalDay(day)).not.toThrow()
    for (const day of ['2023-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-1-13', '2026-10-13T00:00', '', 'today']) {
      expect(() => assertLocalDay(day), day).toThrow(RangeError)
    }
  })

  it('start a new account on day 0, which every race day is later than', () => {
    expect(emptyPurse()).toEqual({ day: '1970-01-01', gross: 0, featuredPaid: [] })
    expect(boardDay(emptyPurse(), '2026-10-13')).toBe('2026-10-13')
  })
})
