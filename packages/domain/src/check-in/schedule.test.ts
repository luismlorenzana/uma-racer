// Check-in times and batch sizing (docs/rework/02-check-ins-and-notifications.md §3): the next check-in, the size
// picker's chips, the marked size, Overnight, and the times setting. Items in base minutes, as the page states them.
import { describe, expect, it } from 'vitest'
import { account, clock } from '../__fixtures__/check-in'
import { cookBaseMinutes, craftBaseMinutes, gatherBaseMinutes } from '../items/work'
import { sessionBaseMinutes } from '../training/unlocks'
import { isRefusal } from '../state/types'
import {
  checkInAtOrAfter, chipWords, clockTime, DEFAULT_CHECK_INS, fitSize, fitWords, localMinute, MAX_CHECK_INS, MIN_CHECK_INS, nextCheckIn,
  setCheckInTimes, sizeChips,
} from './schedule'
import { fill } from './words'

const HOUR = 3_600_000
const base = (minutes: number) => Array.from({ length: 10 }, () => minutes * 60)
const UTC = 0

describe('the numbers', () => {
  it('are 08:00, 13:00 and 22:30 by default, one to four times (02 §3, 12 §12, 13 §6)', () => {
    expect(DEFAULT_CHECK_INS).toEqual([480, 780, 1350])
    expect(DEFAULT_CHECK_INS.map((t) => clockTime(t * 60_000, UTC))).toEqual(['08:00', '13:00', '22:30'])
    expect([MIN_CHECK_INS, MAX_CHECK_INS]).toEqual([1, 4])
  })
})

describe('the next check-in', () => {
  it('is the first strictly after now, rolling over to the morning', () => {
    expect(nextCheckIn(clock('07:59'), DEFAULT_CHECK_INS, UTC)).toBe(clock('08:00'))
    expect(nextCheckIn(clock('08:00'), DEFAULT_CHECK_INS, UTC)).toBe(clock('13:00'))
    expect(nextCheckIn(clock('22:30'), DEFAULT_CHECK_INS, UTC)).toBe(clock('08:00', 1))
    expect(nextCheckIn(clock('23:59'), [720], UTC)).toBe(clock('12:00', 1))
    expect(checkInAtOrAfter(clock('13:00'), DEFAULT_CHECK_INS, UTC)).toBe(clock('13:00'))
  })

  it('reads local time on either side of UTC', () => {
    // Tokyo, UTC+9: 08:30 local is 23:30 UTC the day before; 13:00 local is 04:00 UTC.
    expect(nextCheckIn(clock('23:30', -1), DEFAULT_CHECK_INS, 540)).toBe(clock('04:00'))
    expect(localMinute(clock('04:00'), 540)).toBe(780)
    // New York, UTC−5: 22:00 local is 03:00 UTC; 22:30 local is 03:30 UTC.
    expect(nextCheckIn(clock('03:00'), DEFAULT_CHECK_INS, -300)).toBe(clock('03:30'))
    expect(clockTime(clock('03:30'), -300)).toBe('22:30')
  })

  it('is never in the past: a clock moved back only makes the wait longer', () => {
    for (let now = clock('20:00'); now >= clock('04:00', -1); now -= 7 * 60_000 + 13_000) {
      const wait = nextCheckIn(now, DEFAULT_CHECK_INS, UTC) - now
      expect(wait).toBeGreaterThan(0)
      expect(wait).toBeLessThanOrEqual(24 * HOUR)
    }
    const later = clock('13:30'), back = clock('12:30')
    expect(nextCheckIn(back, DEFAULT_CHECK_INS, UTC) - back).toBe(30 * 60_000)
    expect(nextCheckIn(later, DEFAULT_CHECK_INS, UTC) - later).toBe(9 * HOUR)
  })

  it('refuses a malformed setting or offset as a caller bug', () => {
    expect(() => nextCheckIn(clock('08:00'), [], UTC)).toThrow(RangeError)
    expect(() => nextCheckIn(clock('08:00'), [480, 480], UTC)).toThrow(RangeError)
    expect(() => nextCheckIn(clock('08:00'), DEFAULT_CHECK_INS, 15 * 60)).toThrow(RangeError)
    expect(() => sizeChips(clock('08:00'), [], DEFAULT_CHECK_INS, UTC)).toThrow(RangeError)
  })
})

describe('the size picker', () => {
  /** Fits a window from its check-in, queueing behind a ×10, as 02 §3's craft row does. */
  function window(minutes: number, start: string): [number[], string] {
    const sizes: number[] = []
    let at = clock(start)
    do {
      const chips = sizeChips(at, base(minutes), DEFAULT_CHECK_INS, UTC)
      sizes.push(chips.marked)
      at = chips.chips[chips.marked - 1]!.endsAt
    } while (sizes.at(-1) === 10)
    return [sizes, clockTime(at, UTC)]
  }

  it("marks 02 §3's gap table, cell by cell", () => {
    const rows: [number, [number[], string][]][] = [
      [gatherBaseMinutes(1), [[[3], '12:30'], [[6], '22:00'], [[6], '07:30']]],
      [craftBaseMinutes(1), [[[10, 3], '12:52'], [[10, 10, 5], '22:22'], [[10, 10, 5], '07:52']]],
      [cookBaseMinutes(1), [[[1], '12:00'], [[2], '21:00'], [[2], '06:30']]],
      [sessionBaseMinutes(1), [[[1], '11:00'], [[3], '22:00'], [[3], '07:30']]],
    ]
    for (const [minutes, cells] of rows) {
      expect(['08:00', '13:00', '22:30'].map((start) => window(minutes, start)), `${minutes} min`).toEqual(cells)
    }
  })

  it('gives every size its end and the wait after it: a ×2 session at 08:00 ends 14:00, then free until 22:30', () => {
    const chips = sizeChips(clock('08:00'), base(sessionBaseMinutes(1)).slice(0, 3), DEFAULT_CHECK_INS, UTC)
    expect(chips.chips.map((chip) => [chip.size, clockTime(chip.endsAt, UTC), clockTime(chip.checkIn, UTC), chip.idleMs / HOUR]))
      .toEqual([[1, '11:00', '13:00', 2], [2, '14:00', '22:30', 8.5], [3, '17:00', '22:30', 5.5]])
    expect(fill(chipWords(chips.chips[1]!, UTC))).toBe('ends 14:00 · then free until 22:30')
    expect(chips.marked).toBe(1)
    expect(fill(fitWords(chips, UTC))).toBe('Fits 13:00')
    const onTime = sizeChips(clock('11:00'), [7_200], DEFAULT_CHECK_INS, UTC)
    expect(fill(chipWords(onTime.chips[0]!, UTC))).toBe('ends 13:00')
  })

  it('reads Overnight when it fits the morning check-in, after the last of the day or before the first', () => {
    const night = sizeChips(clock('22:30'), base(gatherBaseMinutes(1)), DEFAULT_CHECK_INS, UTC)
    expect([night.marked, night.overnight, fill(fitWords(night, UTC))]).toEqual([6, true, 'Overnight'])
    expect(sizeChips(clock('05:00'), base(gatherBaseMinutes(1)), DEFAULT_CHECK_INS, UTC).overnight).toBe(true)
    expect(sizeChips(clock('13:00'), base(gatherBaseMinutes(1)), DEFAULT_CHECK_INS, UTC).overnight).toBe(false)
  })

  it('fits the check-in after the next when even ×1 overruns it', () => {
    const chips = sizeChips(clock('12:00'), base(cookBaseMinutes(1)), DEFAULT_CHECK_INS, UTC)
    expect([clockTime(chips.chips[0]!.endsAt, UTC), clockTime(chips.fits, UTC), chips.marked]).toEqual(['16:00', '22:30', 2])
    expect(fill(fitWords(chips, UTC))).toBe('Fits 22:30')
    // With one check-in a day, ×1 past it fits the next day's.
    expect(fitSize(clock('11:00'), base(cookBaseMinutes(1)), [720], UTC)).toBe(6)
  })

  it('fits local check-ins on either side of UTC', () => {
    const tokyo = sizeChips(clock('23:00', -1), base(gatherBaseMinutes(1)), DEFAULT_CHECK_INS, 540)
    expect([tokyo.marked, clockTime(tokyo.chips[tokyo.marked - 1]!.endsAt, 540), clockTime(tokyo.fits, 540)]).toEqual([3, '12:30', '13:00'])
    const newYork = sizeChips(clock('18:00'), base(gatherBaseMinutes(1)), DEFAULT_CHECK_INS, -300)
    expect([newYork.marked, clockTime(newYork.chips[newYork.marked - 1]!.endsAt, -300), clockTime(newYork.fits, -300)]).toEqual([6, '22:00', '22:30'])
  })
})

describe('set-check-in-times', () => {
  it('keeps one to four distinct times, ascending', () => {
    const result = setCheckInTimes(account(1), { times: [1350, 480] }, 5)
    if (isRefusal(result)) throw new Error(result.reason)
    expect(result.receipt).toEqual({ times: [480, 1350] })
    expect(result.state.profile.checkIns).toEqual([480, 1350])
  })

  it('refuses none, five or a time twice in plain words, and throws on a time that is not a minute of the day', () => {
    for (const times of [[], [1, 2, 3, 4, 5], [480, 480]]) {
      expect(setCheckInTimes(account(1), { times }, 5)).toMatchObject({ refused: true, code: 'check-in-times', reason: 'Pick one to four times.' })
    }
    for (const bad of [1_440, 1.5, -1]) expect(() => setCheckInTimes(account(1), { times: [bad] }, 5)).toThrow(RangeError)
  })
})
