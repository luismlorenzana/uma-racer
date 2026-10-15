// The work clock (docs/rework/07-farm.md §2 "The clock", §8; docs/rework/09-racing-rewards-and-exchange.md §5.1;
// docs/rework/02-check-ins-and-notifications.md §8). Numbers only, so phase 7 can move it to `uma-idle`
// (docs/rework/02-check-ins-and-notifications.md §8): an entry's item k ends at its start plus the first k items'
// seconds, less the milliseconds Speed Tickets took off. Nothing ticks; everything derives from the timestamps and the
// `now` passed in. A clock moved back lengthens the wait and never makes progress negative.
import { MS_PER_SECOND } from '../time'

/** A Speed Ticket takes 30 minutes off a running entry's whole remaining schedule (07 §8, 09 §5.1, README "Money"). */
export const SPEED_TICKET_MS = 1_800_000

/** The clock of one started entry: its start, each item's seconds and the milliseconds tickets took off. */
export interface Timed {
  readonly startedAt: number
  readonly seconds: readonly number[]
  readonly acceleratedMs: number
}

/** When each item ends: start + the first k items' seconds − acceleration. */
export function itemEnds(startedAt: number, seconds: readonly number[], acceleratedMs: number): number[] {
  let at = startedAt - acceleratedMs
  return seconds.map((s) => (at += s * MS_PER_SECOND))
}

const totalMs = (entry: Timed): number => entry.seconds.reduce((sum, s) => sum + s, 0) * MS_PER_SECOND

/** When the entry's last item ends. */
export const endsAt = (entry: Timed): number => entry.startedAt - entry.acceleratedMs + totalMs(entry)

/** Items finished by `now` (an item is finished at its end), collected or not. */
export function finishedCount(entry: Timed, now: number): number {
  return itemEnds(entry.startedAt, entry.seconds, entry.acceleratedMs).filter((end) => end <= now).length
}

/** Milliseconds until the entry's last item ends, never below 0. */
export const remainingMs = (entry: Timed, now: number): number => Math.max(0, endsAt(entry) - now)

/** How far through the whole entry it is at `now`, 0–1. */
export function progress(entry: Timed, now: number): number {
  const total = totalMs(entry)
  if (total <= 0) return 1
  return Math.min(1, Math.max(0, (now - (entry.startedAt - entry.acceleratedMs)) / total))
}

/**
 * How far through its current item the entry is at `now`, 0–1 (rework/11 §4: a busy pip's ring fills by "the current
 * output's or unlock's progress"): the first item not yet ended, from the previous item's end (or the start, less the
 * tickets) to its own. 0 before the entry starts and 1 once every item has ended, so a clock moved either way stays in
 * range.
 */
export function itemProgress(entry: Timed, now: number): number {
  let from = entry.startedAt - entry.acceleratedMs
  for (const end of itemEnds(entry.startedAt, entry.seconds, entry.acceleratedMs)) {
    // An item that hasn't started gives a negative share (−∞ for a zero-second one), clamped to 0.
    if (end > now) return Math.min(1, Math.max(0, (now - from) / (end - from)))
    from = end
  }
  return 1
}

/** Tickets that finish `ms` of remaining time: ⌈ms ÷ 30 minutes⌉ (07 §8 "Finish"). */
export const ticketsToFinish = (ms: number): number => (ms <= 0 ? 0 : Math.ceil(ms / SPEED_TICKET_MS))

export interface AppliedTickets {
  /** The entry's acceleration after the tickets. */
  readonly acceleratedMs: number
  /** What they took off: min(tickets × 30 minutes, the time remaining). */
  readonly appliedMs: number
  /** What the last ticket couldn't use (07 §8: "the minutes wasted"). */
  readonly wastedMs: number
}

/**
 * `tickets` Speed Tickets on an entry at `now`: they move every unfinished item's end earlier by up to 30 minutes each,
 * clamped to the time remaining, so a Finish ends exactly at `now` (07 §14). Integer milliseconds throughout.
 */
export function applyTickets(entry: Timed, tickets: number, now: number): AppliedTickets {
  if (!Number.isInteger(tickets) || tickets < 0) throw new RangeError(`Tickets must be a whole number ≥ 0: ${tickets}`)
  const offered = tickets * SPEED_TICKET_MS
  const appliedMs = Math.min(offered, remainingMs(entry, now))
  return { acceleratedMs: entry.acceleratedMs + appliedMs, appliedMs, wastedMs: offered - appliedMs }
}

export interface ChainLink {
  readonly startsAt: number
  /** Each item's end. */
  readonly ends: readonly number[]
  readonly endsAt: number
}

export interface ChainTimes {
  /** The started entries, oldest first. */
  readonly entries: readonly ChainLink[]
  /** Queued entries projected from `queued`'s seconds, each starting when the one before ends. */
  readonly queued: readonly ChainLink[]
  /** When the whole chain ends, or null for an empty one. */
  readonly endsAt: number | null
}

/**
 * A slot's whole timeline: each started entry's item ends, then queued entries, each starting at the end before it,
 * when the caller gives their planned seconds (07 §2 "Queue start", 02 §3's "then … → 17:30").
 */
export function chainTimes(row: { readonly entries: readonly Timed[] }, queued: readonly (readonly number[])[] = []): ChainTimes {
  const entries = row.entries.map((entry): ChainLink => {
    const ends = itemEnds(entry.startedAt, entry.seconds, entry.acceleratedMs)
    return { startsAt: entry.startedAt, ends, endsAt: endsAt(entry) }
  })
  let at = entries.length > 0 ? entries[entries.length - 1]!.endsAt : null
  const projected = at === null ? [] : queued.map((seconds): ChainLink => {
    const startsAt = at!
    const ends = itemEnds(startsAt, seconds, 0)
    at = ends.length > 0 ? ends[ends.length - 1]! : startsAt
    return { startsAt, ends, endsAt: at }
  })
  return { entries, queued: projected, endsAt: at }
}
