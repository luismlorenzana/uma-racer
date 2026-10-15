// The Hub's words (docs/rework/11-hub-and-places.md §2, §4, §12; docs/rework/02-check-ins-and-notifications.md §9):
// each tile's VoiceOver line, the counters' words and the shell's copy. Templates take `{name}` placeholders, filled by
// `fill`. 02 §9's banned words never appear here; `hub/words.test.ts` holds every string to `hasBannedWord`. Imports
// only types and the check-in's two word helpers, so the shell's entry chunk can read it.
import { fill, say } from '../rework/check-in/words'
import type { Place, PlaceCounter } from './places'
import type { HubBuilding, HubView } from './view'

/** The shell's sentences. */
export const HUB_WORDS = Object.freeze({
  /** §2.3: the floating pill. */
  'collect-all': 'Collect all · {n} ready',
  'check-in': 'Check-in · {n} free',
  /** §2.1: the Sync chip, hidden when synced (D157). */
  offline: 'Offline',
  'sync-paused': 'Sync paused',
  sync: 'Sync',
  'offline-label': "Offline. Changes are saved on this phone. Open Account.",
  'sync-paused-label': 'Sync paused while signed out. Open Account.',
  'sync-waiting-label': 'Changes have waited over a day to sync. Open Account.',
  'sync-failing-label': "Sync isn't going through. Open Account.",
  /** §2.1: the chips' names for VoiceOver. */
  trainer: 'Account: {name}',
  'prize-money': 'Prize Money {n}. Open the Exchange.',
  'speed-tickets': 'Speed Tickets {n}. Open the Exchange.',
  'uma-tickets': 'Uma Tickets {n}, Uma Shards {shards} of {per}. Open the Stable.',
  /** §2.2: the bottom bar. */
  bar: 'Hub pages',
  race: 'Race',
  menu: 'Menu',
  'menu-label': 'Menu: every place',
  'tab-ready': '{page}, {n} ready',
  /** §2.2: the menu sheet. */
  'menu-title': 'Every place',
  'menu-needs': 'Needs of every Uma',
  /** §1, §5: Peeks, Pages and the plaza. */
  enter: 'Enter {place}',
  about: 'About {place}',
  close: 'Close',
  'back-to': 'Back to {to}',
  'peek-label': '{place}, quick look',
  featured: 'Featured Uma: {uma}',
  'no-umas': 'No Umas yet',
  train: 'Train',
  profile: 'Profile',
  /** ux "Principles": a save that can't open. */
  loading: 'Opening the game',
  'save-error-title': 'Save needs attention',
  'save-error-reason': "The save on this phone couldn't open.",
  'save-error-kept': 'Your progress is kept as it is. Nothing is cleared.',
  'try-again': 'Try again',
  'copy-details': 'Copy details',
  copied: 'Copied',
  /** A Page whose screen hasn't landed yet. */
  'check-in-title': 'Check-in',
  'check-in-counts': '{ready} ready · {free} free',
} as const)

export type HubWord = keyof typeof HUB_WORDS

/** A shell sentence with its placeholders filled. */
export const hubWords = (key: HubWord, data?: Readonly<Record<string, string | number>>): string => fill(say(HUB_WORDS[key], data))

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** A counter's words for VoiceOver and the menu: "3 Uma Tickets", "2 ready to advance". */
export function counterWords(counter: PlaceCounter, n: number): string {
  switch (counter) {
    case 'uma-tickets': return plural(n, 'Uma Ticket', 'Uma Tickets')
    case 'finished-here': return `${n} ready`
    case 'ready-to-advance': return `${n} ready to advance`
    case 'featured-open': return plural(n, 'featured race open', 'featured races open')
    case 'promotable': return `${n} ready to promote`
    case 'new-flair': return `${n} new`
  }
}

/** A building's slots in one line (§4): "6 of 8 slots busy, 2 ready, 1 queued". */
export function slotWords(building: HubBuilding): string {
  const parts = [`${building.busy} of ${plural(building.slots, 'slot', 'slots')} busy`]
  if (building.ready > 0) parts.push(`${building.ready} ready`)
  if (building.queued > 0) parts.push(`${building.queued} queued`)
  return parts.join(', ')
}

/**
 * A tile's VoiceOver line (§4, §12): its name, then its slots where it shows pips ("Kitchen. 6 of 8 slots busy, 2
 * ready, 1 queued."), else its counter when above 0 ("Stable. 3 Uma Tickets."). Without a view yet, the name alone.
 */
export function tileLabel(place: Place, view: HubView | null, count: number | null = null): string {
  const building = place.pips && view !== null ? view.buildings[place.id as keyof HubView['buildings']] : undefined
  if (building !== undefined) return `${place.name}. ${slotWords(building)}.`
  if (place.counter !== null && count !== null && count > 0) return `${place.name}. ${counterWords(place.counter, count)}.`
  return `${place.name}.`
}

/** The floating pill (§2.3): Collect all when anything is ready, else Check-in when anyone is free, else nothing. */
export function pillWords(view: HubView | null): { readonly collect: boolean; readonly text: string } | null {
  if (view === null) return null
  if (view.ready > 0) return { collect: true, text: hubWords('collect-all', { n: view.ready }) }
  if (view.free > 0) return { collect: false, text: hubWords('check-in', { n: view.free }) }
  return null
}

/** The Uma Tickets chip (§2.1): "2 · 3/5", the Shards held at 5/5 once a ticket can be made. */
export function umaTicketChip(wallet: HubView['wallet']): string {
  return `${wallet.umaTickets} · ${Math.min(wallet.shards, wallet.shardsPerTicket)}/${wallet.shardsPerTicket}`
}
