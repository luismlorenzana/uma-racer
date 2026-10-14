// The owner's check-in times and batch sizing (docs/rework/02-check-ins-and-notifications.md §1, §3, §8, §10;
// docs/rework/12-economy-and-pacing.md §12; docs/rework/13-removals-and-plan-changes.md §6). One to four times a day,
// by default 08:00, 13:00 and 22:30, in minutes after local midnight. The size picker gives each size its end and the
// wait to the first check-in after it, and marks the largest size ending by the next check-in ("Fits 13:00"), or by
// the one after when even ×1 overruns it; the day's earliest check-in reads "Overnight". Local time is the device's,
// passed in as `utcOffsetMin` (minutes east of UTC), so the rules stay pure; the sim passes 0. A clock moved back only
// moves the next check-in later: every wait is measured from `now` and is never negative.
import { assertNow } from '../tiers/ledger'
import { MS_PER_SECOND } from '../time'
import type { OpResult, ReworkState } from '../types'
import { CHECK_IN_WORDS, checkInRefusal, say, type Words } from './words'

/** The default check-in times, 08:00, 13:00 and 22:30, in minutes after local midnight (02 §1, §3; 12 §12; 13 §6). */
export const DEFAULT_CHECK_INS: readonly number[] = Object.freeze([480, 780, 1350])
/** "Up to four times" (02 §3, §10). */
export const MAX_CHECK_INS = 4
/** Fitting needs at least one (T131). */
export const MIN_CHECK_INS = 1
export const MINUTES_PER_DAY = 1_440
const MS_PER_MINUTE = 60_000
const MS_PER_DAY = MINUTES_PER_DAY * MS_PER_MINUTE
/** UTC−14 to UTC+14: every offset a device can report. */
const MAX_OFFSET_MINUTES = 14 * 60

function assertOffset(utcOffsetMin: number): void {
  if (!Number.isInteger(utcOffsetMin) || Math.abs(utcOffsetMin) > MAX_OFFSET_MINUTES) {
    throw new RangeError(`A UTC offset is whole minutes within ±${MAX_OFFSET_MINUTES}: ${utcOffsetMin}`)
  }
}

const isClockMinute = (t: number): boolean => Number.isInteger(t) && t >= 0 && t < MINUTES_PER_DAY

/** Whether `times` is a valid setting: one to four distinct minutes of the day. */
export function checkInTimesValid(times: readonly number[]): boolean {
  return times.length >= MIN_CHECK_INS && times.length <= MAX_CHECK_INS && times.every(isClockMinute) && new Set(times).size === times.length
}

function sorted(times: readonly number[]): number[] {
  if (!checkInTimesValid(times)) throw new RangeError(`Check-in times are 1–${MAX_CHECK_INS} distinct minutes of the day: ${times.join(', ')}`)
  return [...times].sort((a, b) => a - b)
}

/** The local minute of the day at `at`, 0–1439. */
export function localMinute(at: number, utcOffsetMin: number): number {
  assertOffset(utcOffsetMin)
  const local = at + utcOffsetMin * MS_PER_MINUTE
  return Math.floor((((local % MS_PER_DAY) + MS_PER_DAY) % MS_PER_DAY) / MS_PER_MINUTE)
}

/** `at` as a local clock time, `HH:MM`, cut to the minute (02 §3's 12:52:30 reads 12:52). */
export function clockTime(at: number, utcOffsetMin: number): string {
  const minute = localMinute(at, utcOffsetMin)
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

/** The first check-in strictly after `now`. A clock moved back gives a later one, never a past one. */
export function nextCheckIn(now: number, times: readonly number[], utcOffsetMin: number): number {
  if (!Number.isSafeInteger(now)) throw new RangeError(`now must be integer milliseconds: ${now}`)
  assertOffset(utcOffsetMin)
  const offset = utcOffsetMin * MS_PER_MINUTE
  const dayStart = Math.floor((now + offset) / MS_PER_DAY) * MS_PER_DAY - offset
  for (const day of [0, 1]) {
    for (const t of sorted(times)) {
      const at = dayStart + day * MS_PER_DAY + t * MS_PER_MINUTE
      if (at > now) return at
    }
  }
  throw new Error('Unreachable: a day always holds a check-in')
}

/** The first check-in at or after `at`: when an Uma who finishes then is next seen. */
export const checkInAtOrAfter = (at: number, times: readonly number[], utcOffsetMin: number): number => nextCheckIn(at - 1, times, utcOffsetMin)

/** Whether the check-in at `at` is the day's earliest, which the picker reads as **Overnight** (02 §3). */
export const isOvernight = (at: number, times: readonly number[], utcOffsetMin: number): boolean =>
  localMinute(at, utcOffsetMin) === Math.min(...times)

/** One size on the picker (02 §3): when it ends, and the check-in that then sees her and how long she waits for it. */
export interface SizeChip {
  readonly size: number
  readonly endsAt: number
  /** The first check-in at or after `endsAt`. */
  readonly checkIn: number
  /** `checkIn − endsAt`: "then free until 22:30". */
  readonly idleMs: number
}

export interface SizeChips {
  readonly chips: readonly SizeChip[]
  /** The marked size: the largest ending by `fits`. */
  readonly marked: number
  /** The check-in the marked size fits: the next one, or the one after when even ×1 overruns it. */
  readonly fits: number
  /** True when `fits` is the day's earliest check-in: the chip reads **Overnight**, else **Fits HH:MM**. */
  readonly overnight: boolean
}

/**
 * The picker's chips for items of `itemSeconds`, made one after another from `start` (02 §3): a chip per size with its
 * end and the wait after it. A session passes one time per unlock, a Farm job the same time ten times.
 */
export function sizeChips(start: number, itemSeconds: readonly number[], times: readonly number[], utcOffsetMin: number): SizeChips {
  if (!Number.isSafeInteger(start)) throw new RangeError(`start must be integer milliseconds: ${start}`)
  if (itemSeconds.length === 0) throw new RangeError('Size at least one item')
  let end = start
  const chips = itemSeconds.map((seconds, i): SizeChip => {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new RangeError(`An item takes some time: ${seconds}`)
    end += Math.round(seconds * MS_PER_SECOND)
    const checkIn = checkInAtOrAfter(end, times, utcOffsetMin)
    return { size: i + 1, endsAt: end, checkIn, idleMs: checkIn - end }
  })
  const next = nextCheckIn(start, times, utcOffsetMin)
  // ×1 overrunning the next check-in idles her until the one after anyway, so fit that one (T131).
  const fits = chips[0]!.endsAt > next ? checkInAtOrAfter(chips[0]!.endsAt, times, utcOffsetMin) : next
  const marked = chips.filter((chip) => chip.endsAt <= fits).length
  return { chips, marked, fits, overnight: isOvernight(fits, times, utcOffsetMin) }
}

/** The size the picker marks and Repeat's "Fit to next check-in" takes (02 §3, §5). */
export const fitSize = (start: number, itemSeconds: readonly number[], times: readonly number[], utcOffsetMin: number): number =>
  sizeChips(start, itemSeconds, times, utcOffsetMin).marked

/** A chip's words (02 §3): "ends 14:00 · then free until 22:30", or "ends 13:00" when it ends at a check-in. */
export const chipWords = (chip: SizeChip, utcOffsetMin: number): Words =>
  chip.idleMs > 0
    ? say(CHECK_IN_WORDS.chip, { end: clockTime(chip.endsAt, utcOffsetMin), checkIn: clockTime(chip.checkIn, utcOffsetMin) })
    : say(CHECK_IN_WORDS['chip-on-time'], { end: clockTime(chip.endsAt, utcOffsetMin) })

/** The marked chip's badge (02 §3): **Overnight** for the day's earliest check-in, else **Fits 13:00**. */
export const fitWords = (chips: SizeChips, utcOffsetMin: number): Words =>
  chips.overnight ? say(CHECK_IN_WORDS.overnight) : say(CHECK_IN_WORDS.fits, { time: clockTime(chips.fits, utcOffsetMin) })

// --- set-check-in-times ---------------------------------------------------------------------------------------------

export interface CheckInTimesReceipt {
  /** The times kept, ascending. */
  readonly times: readonly number[]
}

/**
 * `set-check-in-times { times }` (02 §3, §10; 13 §6): one to four distinct times, stored ascending. A time that isn't a
 * whole minute of the day is a caller's bug and throws.
 */
export function setCheckInTimes<S extends ReworkState>(state: S, input: { readonly times: readonly number[] }, now: number): OpResult<CheckInTimesReceipt, S> {
  assertNow(now)
  const bad = input.times.find((t) => !isClockMinute(t))
  if (bad !== undefined) throw new RangeError(`A check-in time is a whole minute of the day: ${bad}`)
  if (!checkInTimesValid(input.times)) return checkInRefusal('check-in-times')
  const times = sorted(input.times)
  return { state: { ...state, profile: { ...state.profile, checkIns: times } }, receipt: { times } }
}
