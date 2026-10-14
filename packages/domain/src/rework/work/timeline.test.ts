// The work clock (docs/rework/07-farm.md §2, §8; docs/rework/09-racing-rewards-and-exchange.md §5.1): item ends from
// timestamps, progress, Speed Tickets and the chain of queued entries. 07 §2's and 09 §5.1's worked examples run here
// in base seconds (k = 1), as the pages write them.
import { describe, expect, it } from 'vitest'
import { clock, minutes } from '../../__fixtures__/rework-work'
import { farmExpPerItem } from '../farm/level'
import {
  applyTickets, chainTimes, endsAt, finishedCount, itemEnds, progress, remainingMs, SPEED_TICKET_MS, ticketsToFinish, type Timed,
} from './timeline'

const POTATO = 95 * 60 // 07 §2: a grade-2 gather in base seconds
const CARROT = 90 * 60

describe('the clock', () => {
  const entry: Timed = { startedAt: clock('08:00'), seconds: Array(10).fill(POTATO), acceleratedMs: 0 }

  it('ends item k at start + k items − acceleration', () => {
    const ends = itemEnds(entry.startedAt, entry.seconds, 0)
    expect(ends.slice(0, 3)).toEqual([clock('09:35'), clock('11:10'), clock('12:45')])
    expect(ends[9]).toBe(clock('23:50'))
    expect(endsAt(entry)).toBe(clock('23:50'))
    expect(itemEnds(entry.startedAt, entry.seconds, minutes(30))[9]).toBe(clock('23:20'))
  })

  it('counts an item finished at its end, and never goes below zero', () => {
    expect(finishedCount(entry, clock('09:34'))).toBe(0)
    expect(finishedCount(entry, clock('09:35'))).toBe(1)
    expect(finishedCount(entry, clock('13:00'))).toBe(3)
    expect(finishedCount(entry, clock('07:00'))).toBe(0)
    expect(progress(entry, clock('07:00'))).toBe(0)
    expect(progress(entry, clock('08:00'))).toBe(0)
    expect(progress(entry, clock('15:55'))).toBe(0.5)
    expect(progress(entry, clock('09:00', 1))).toBe(1)
    expect(remainingMs(entry, clock('23:00'))).toBe(minutes(50))
    expect(remainingMs(entry, clock('09:00', 1))).toBe(0)
    expect(progress({ startedAt: 0, seconds: [], acceleratedMs: 0 }, 0)).toBe(1)
  })
})

describe('Speed Tickets (07 §8)', () => {
  it('take 30 minutes; Finish costs ⌈remaining ÷ 30 minutes⌉', () => {
    expect(SPEED_TICKET_MS).toBe(1_800_000)
    expect(ticketsToFinish(0)).toBe(0)
    expect(ticketsToFinish(-5)).toBe(0)
    expect(ticketsToFinish(1)).toBe(1)
    expect(ticketsToFinish(SPEED_TICKET_MS)).toBe(1)
    expect(ticketsToFinish(SPEED_TICKET_MS + 1)).toBe(2)
  })

  it('apply at most the time remaining, and show the waste', () => {
    const entry: Timed = { startedAt: clock('08:00'), seconds: [3_600], acceleratedMs: 0 }
    expect(applyTickets(entry, 1, clock('08:20'))).toEqual({ acceleratedMs: minutes(30), appliedMs: minutes(30), wastedMs: 0 })
    expect(applyTickets(entry, 2, clock('08:20'))).toEqual({ acceleratedMs: minutes(40), appliedMs: minutes(40), wastedMs: minutes(20) })
    expect(applyTickets({ ...entry, acceleratedMs: minutes(10) }, 1, clock('08:40'))).toEqual({ acceleratedMs: minutes(20), appliedMs: minutes(10), wastedMs: minutes(20) })
    expect(() => applyTickets(entry, -1, 0)).toThrow(RangeError)
  })

  it("finish an item with 10 minutes left and take 20 off the next (09 §5.1's rule)", () => {
    const entry: Timed = { startedAt: clock('08:00'), seconds: [3_600, 3_600], acceleratedMs: 0 }
    const now = clock('08:50')
    const sped = { ...entry, acceleratedMs: applyTickets(entry, 1, now).acceleratedMs }
    expect(finishedCount(sped, now)).toBe(1)
    expect(itemEnds(sped.startedAt, sped.seconds, sped.acceleratedMs)).toEqual([clock('08:30'), clock('09:30')])
    expect(endsAt(sped) - now).toBe(minutes(40)) // the second item has 20 of its 60 minutes behind it
  })
})

describe("07 §2's worked example, in base seconds", () => {
  it('pays 3 Potatoes and 285 EXP at 13:00, ends at 23:20 after a ticket, then Carrots 23:20–08:20', () => {
    const potatoes: Timed = { startedAt: clock('08:00'), seconds: Array(10).fill(POTATO), acceleratedMs: 0 }
    const made = finishedCount(potatoes, clock('13:00'))
    expect(made).toBe(3)
    expect((made * farmExpPerItem(POTATO, 10)) / 4).toBe(285)
    const sped = { ...potatoes, acceleratedMs: applyTickets(potatoes, 1, clock('13:00')).acceleratedMs }
    expect(endsAt(sped)).toBe(clock('23:20'))
    const chain = chainTimes({ entries: [sped] }, [Array(6).fill(CARROT)])
    expect(chain.queued[0]).toMatchObject({ startsAt: clock('23:20'), endsAt: clock('08:20', 1) })
    expect(chain.endsAt).toBe(clock('08:20', 1))
  })

  it('a 22:30 recall pays 9 and loses 45 minutes of the tenth', () => {
    const sped: Timed = { startedAt: clock('08:00'), seconds: Array(10).fill(POTATO), acceleratedMs: minutes(30) }
    expect(finishedCount(sped, clock('22:30'))).toBe(9)
    expect(clock('22:30') - itemEnds(sped.startedAt, sped.seconds, sped.acceleratedMs)[8]!).toBe(minutes(45))
  })
})

describe("09 §5.1's worked example, in base seconds", () => {
  it('moves the dishes to 16:10 and 20:30 with one ticket, and Finish costs 18', () => {
    const dishes: Timed = { startedAt: clock('08:00'), seconds: Array(3).fill(260 * 60), acceleratedMs: 0 }
    const now = clock('12:00')
    expect(itemEnds(dishes.startedAt, dishes.seconds, 0)[0]).toBe(clock('12:20'))
    expect(remainingMs(dishes, now)).toBe(minutes(540))
    const sped = { ...dishes, acceleratedMs: applyTickets(dishes, 1, now).acceleratedMs }
    expect(finishedCount(sped, now)).toBe(1)
    expect(itemEnds(sped.startedAt, sped.seconds, sped.acceleratedMs).slice(1)).toEqual([clock('16:10'), clock('20:30')])
    expect(ticketsToFinish(remainingMs(dishes, now))).toBe(18)
  })
})

describe('chainTimes', () => {
  it('lists each started entry and starts each queued one at the end before it', () => {
    const a: Timed = { startedAt: 0, seconds: [10, 10], acceleratedMs: 0 }
    const b: Timed = { startedAt: 20_000, seconds: [5], acceleratedMs: 2_000 }
    expect(chainTimes({ entries: [a, b] }, [[1, 1], []])).toEqual({
      entries: [{ startsAt: 0, ends: [10_000, 20_000], endsAt: 20_000 }, { startsAt: 20_000, ends: [23_000], endsAt: 23_000 }],
      queued: [{ startsAt: 23_000, ends: [24_000, 25_000], endsAt: 25_000 }, { startsAt: 25_000, ends: [], endsAt: 25_000 }],
      endsAt: 25_000,
    })
    expect(chainTimes({ entries: [] }, [[1]])).toEqual({ entries: [], queued: [], endsAt: null })
  })
})
