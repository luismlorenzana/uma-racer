// Account's view model (docs/game/11-hub-and-places.md §3.1; docs/game/02-check-ins-and-notifications.md §3, §9;
// M034 "Dev shortcuts are dev-only"; T138): check-in times as clock times, the sync row's words (D157), and the dev
// section's grants for `dev-grant`. Pure.
import { MAX_CHECK_INS, MINUTES_PER_DAY, type DevGrantInput } from '@racer/domain/check-in'
import { FAMILY_IDS, craftedItem, planetDish, rawItem } from '@racer/domain/items'
import type { G2Sync } from '../../app/game'

export { MAX_CHECK_INS }

/** 480 → "08:00". */
export const clockOf = (minute: number): string => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`

/** "08:00" → 480; null for anything that isn't a clock time. */
export function minuteOf(clock: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim())
  if (match === null) return null
  const minute = Number(match[1]) * 60 + Number(match[2])
  return Number(match[2]) < 60 && minute < MINUTES_PER_DAY ? minute : null
}

/** The times to send, ascending; null while any field isn't a time. `set-check-in-times` judges the rest. */
export function checkInTimes(fields: readonly string[]): number[] | null {
  const minutes = fields.map(minuteOf)
  return minutes.every((minute): minute is number => minute !== null) ? [...minutes].sort((a, b) => a - b) : null
}

/** The sync row's words (D157, 02 §9): no codes, no numbers. */
export const SYNC_WORDS: Readonly<Record<G2Sync, string>> = Object.freeze({
  synced: 'Synced. Everything on this phone is saved to your account.',
  offline: "Offline. Saved on this phone; it'll sync when you're back online.",
  paused: 'Sync paused: sign in and your changes go up.',
  waiting: 'Some changes have waited over a day to sync. They are safe on this phone.',
  failing: "Sync isn't going through. Your changes are safe on this phone, and it keeps trying.",
})

/** The dev section's grants (M034): each one `dev-grant` input, recorded in the ledger as a dev grant. */
export const DEV_GRANTS: readonly { readonly key: string; readonly label: string; readonly input: DevGrantInput }[] = [
  { key: 'prize-money', label: '+5,000 Prize Money', input: { prizeMoney: 5_000 } },
  { key: 'uma-tickets', label: '+5 Uma Tickets', input: { umaTickets: 5 } },
  {
    key: 'grade-1',
    label: '+10 of every grade-1 raw, crafted and dish',
    input: { items: Object.fromEntries(FAMILY_IDS.flatMap((family) => [rawItem(family, 1).id, craftedItem(family, 1).id, planetDish(family, 1).id]).map((id) => [id, 10])) },
  },
]
