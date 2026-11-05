// Account's view model (docs/game/11-hub-and-places.md §3.1; D157; M034 "Dev shortcuts are dev-only"; T138, T152): the
// sync row's words, and the dev section's grants for `dev-grant`. Pure.
import type { DevGrantInput } from '@racer/domain/account'
import type { RacerSync } from '../../app/game'

/** The sync row's words (D157): no codes, no numbers. */
export const SYNC_WORDS: Readonly<Record<RacerSync, string>> = Object.freeze({
  synced: 'Synced. Everything on this phone is saved to your account.',
  offline: "Offline. Saved on this phone; it'll sync when you're back online.",
  paused: 'Sync paused: sign in and your changes go up.',
  waiting: 'Some changes have waited over a day to sync. They are safe on this phone.',
  failing: "Sync isn't going through. Your changes are safe on this phone, and it keeps trying.",
})

/** The dev section's grants (M034), each one `dev-grant` input; dev builds only. */
export const DEV_GRANTS: readonly { readonly key: string; readonly label: string; readonly input: DevGrantInput }[] = [
  { key: 'uma-tickets', label: '+5 Uma Tickets', input: { umaTickets: 5, cardTickets: 0 } },
  { key: 'card-tickets', label: '+5 Card Tickets', input: { umaTickets: 0, cardTickets: 5 } },
]
