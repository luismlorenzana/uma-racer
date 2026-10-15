// The loop simulation's clock and dice (T132's "Event-stepped", "Seeded"). The clock starts at
// 00:00 on a synthetic date, local time is UTC (`utcOffsetMin` 0), and the purse's local day is the civil date of a
// timestamp, worked out without a Date. The dice are the race engine's: `loopRng` is mulberry32, as `createRng` in
// packages/race/src/rng.ts, which the domain can't import; scripts pass `createRng` itself, and the script checks they
// agree.
import type { LocalDay } from '../exchange/purse'

export const MS_PER_MINUTE = 60_000
export const MS_PER_HOUR = 60 * MS_PER_MINUTE
export const MS_PER_DAY = 24 * MS_PER_HOUR
/** Day 0 of every run: 00:00 UTC on Monday 2027-01-04, a synthetic date. */
export const LOOP_EPOCH = 1_799_020_800_000
/** The device's offset the sim passes everywhere: local time is UTC (T132). */
export const UTC_OFFSET_MIN = 0

/** The race engine's RNG shape: uniform in [0, 1). */
export interface LoopRng {
  next(): number
}

/** mulberry32, step for step the race engine's `createRng(seed).next` (packages/race/src/rng.ts). */
export function loopRng(seed: number): LoopRng {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

/** Whole days since the run's day 0 at `at`. */
export const dayOf = (at: number): number => Math.floor((at - LOOP_EPOCH) / MS_PER_DAY)
/** Day `day`'s 00:00. */
export const dayStart = (day: number): number => LOOP_EPOCH + day * MS_PER_DAY
/** Days since day 0, as a decimal. */
export const daysSince = (at: number, from = LOOP_EPOCH): number => (at - from) / MS_PER_DAY

/** The civil date of `at` in UTC, `YYYY-MM-DD`: the purse's local day (09 §3.3), by H. Hinnant's days-to-civil. */
export function localDay(at: number): LocalDay {
  const z = Math.floor(at / MS_PER_DAY) + 719_468
  const era = Math.floor(z / 146_097)
  const doe = z - era * 146_097
  const yoe = Math.floor((doe - Math.floor(doe / 1_460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0)
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
