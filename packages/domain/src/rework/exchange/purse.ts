// The Daily Purse (docs/rework/09-racing-rewards-and-exchange.md §3.3, §3.4, §8, §9): every race's gross prize fills
// the account's purse for the day, in order. The first 6,000 pay in full, the next 6,000 a quarter, the rest a
// twentieth; a race that crosses an edge is split. The day is the device's local date at race start, passed in by the
// caller (a pure rule can't know the time zone), and the purse never goes back to an earlier day. Prize Money only:
// Racing EXP, featured bonuses and sales never touch it.
import type { DailyPurse } from '../types'

/** The device's local calendar date, `YYYY-MM-DD`. */
export type LocalDay = string

export type PurseBand = 'full' | 'tired' | 'spent'

export interface PurseBandRule {
  readonly band: PurseBand
  /** The day's gross this band runs up to; null for the last, which never ends. An edge belongs to the band below. */
  readonly upTo: number | null
  /** What it pays of each gross Prize Money, in twentieths. */
  readonly paidTwentieths: number
}

/** Twentieths, so every band's share is a whole number: 20, 5 and 1. */
export const PURSE_SHARE_DENOMINATOR = 20

/** 09 §3.3 (draft): full to 6,000 at 20/20, tired to 12,000 at 5/20, spent beyond at 1/20. */
export const PURSE_BANDS: readonly PurseBandRule[] = Object.freeze([
  Object.freeze({ band: 'full', upTo: 6_000, paidTwentieths: 20 } as const),
  Object.freeze({ band: 'tired', upTo: 12_000, paidTwentieths: 5 } as const),
  Object.freeze({ band: 'spent', upTo: null, paidTwentieths: 1 } as const),
])

/** A new account's purse day: day 0, which every real race day is later than, so the first race starts a fresh purse. */
export const PURSE_START_DAY: LocalDay = '1970-01-01'

/** An empty purse on `day`: nothing gross, nothing featured paid. */
export const emptyPurse = (day: LocalDay = PURSE_START_DAY): DailyPurse => ({ day, gross: 0, featuredPaid: [] })

// --- Days -----------------------------------------------------------------------------------------------------------

const LOCAL_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const isLeap = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

function parseDay(day: LocalDay): readonly [year: number, month: number, date: number] {
  const match = LOCAL_DAY.exec(day)
  const [year, month, date] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0]
  const length = month === 2 && isLeap(year) ? 29 : DAYS_IN_MONTH[month - 1]
  if (!match || length === undefined || date < 1 || date > length) throw new RangeError(`A local day is a real YYYY-MM-DD date: ${day}`)
  return [year, month, date]
}

/** A caller's day that isn't a real `YYYY-MM-DD` date is a bug that phase 3's parsers keep out. */
export function assertLocalDay(day: LocalDay): void {
  parseDay(day)
}

/** Days since 1970-01-01 (negative before it), from the civil calendar alone: no clock, no time zone. */
export function dayNumber(day: LocalDay): number {
  const [year, month, date] = parseDay(day)
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yearOfEra = y - era * 400
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + date - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146_097 + dayOfEra - 719_468
}

/** The later of the purse's day and the device's: the day whose featured board shows (09 §8). */
export function boardDay(purse: DailyPurse, localDay: LocalDay): LocalDay {
  assertLocalDay(localDay)
  return localDay > purse.day ? localDay : purse.day
}

/** The purse a race on `localDay` fills: a later day starts an empty one; an equal or earlier day keeps the stored one. */
export const purseFor = (purse: DailyPurse, localDay: LocalDay): DailyPurse =>
  boardDay(purse, localDay) === purse.day ? purse : emptyPurse(localDay)

// --- Paying ---------------------------------------------------------------------------------------------------------

/** The band a day's gross sits in; an edge belongs to the band below (6,000 is full). */
export function bandAt(gross: number): PurseBand {
  const rule = PURSE_BANDS.find((band) => band.upTo === null || gross <= band.upTo)
  return rule!.band
}

export interface PursePayment {
  /** The purse after the race: its day, and its gross grown by the race's whole gross. */
  readonly purse: DailyPurse
  /** ⌊(20 × full + 5 × tired + 1 × spent) ÷ 20⌋. */
  readonly paid: number
  /** The band the purse ends in. */
  readonly band: PurseBand
  /** How much of the race's gross fell in each band. */
  readonly split: Readonly<Record<PurseBand, number>>
}

const assertAmount = (what: string, n: number): void => {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${what} must be a whole number ≥ 0: ${n}`)
}

/** Fill the purse for `localDay` with one race's `gross`, splitting it across the bands it crosses, and pay it. */
export function payFromPurse(purse: DailyPurse, localDay: LocalDay, gross: number): PursePayment {
  assertAmount('A gross prize', gross)
  assertAmount("The purse's gross", purse.gross)
  const current = purseFor(purse, localDay)
  const start = current.gross
  const end = start + gross
  const split: Record<PurseBand, number> = { full: 0, tired: 0, spent: 0 }
  let floor = 0
  let twentieths = 0
  for (const rule of PURSE_BANDS) {
    const top = rule.upTo ?? Number.POSITIVE_INFINITY
    const inBand = Math.max(0, Math.min(end, top) - Math.max(start, floor))
    split[rule.band] = inBand
    twentieths += inBand * rule.paidTwentieths
    floor = top
  }
  return {
    purse: { ...current, gross: end },
    paid: Math.floor(twentieths / PURSE_SHARE_DENOMINATOR),
    band: bandAt(end),
    split,
  }
}
