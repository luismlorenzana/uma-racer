// The Hub's words (docs/game/11-hub-and-places.md): each tile's VoiceOver line, the counters' words and the shell's
// copy. Templates take `{name}` placeholders. Imports only types, so the shell's entry chunk can read it.
import type { Place, PlaceCounter } from './places'

/** The shell's sentences. */
export const HUB_WORDS = Object.freeze({
  /** The Sync chip, hidden when synced (D157). */
  offline: 'Offline',
  'sync-paused': 'Sync paused',
  sync: 'Sync',
  'offline-label': "Offline. Changes are saved on this phone. Open Account.",
  'sync-paused-label': 'Sync paused while signed out. Open Account.',
  'sync-waiting-label': 'Changes have waited over a day to sync. Open Account.',
  'sync-failing-label': "Sync isn't going through. Open Account.",
  /** The top bar's chips, for VoiceOver. */
  trainer: 'Account: {name}',
  'uma-tickets': 'Uma Tickets {n}. Open the Stable.',
  'card-tickets': 'Card Tickets {n}. Open the Card Library.',
  /** A page's map, for VoiceOver. */
  map: '{page} map',
  /** The bottom bar. */
  bar: 'Hub pages',
  career: 'Career',
  menu: 'Menu',
  'menu-label': 'Menu: every place',
  /** The menu sheet. */
  'menu-title': 'Every place',
  /** Peeks, Pages and the plaza. */
  enter: 'Enter {place}',
  about: 'About {place}',
  close: 'Close',
  'back-to': 'Back to {to}',
  'peek-label': '{place}, quick look',
  'crowd-figure': '{uma}: Profile',
  'no-umas': 'No Umas yet',
  profile: 'Profile',
  /** A save that can't open. */
  loading: 'Opening the game',
  'save-error-title': 'Save needs attention',
  'save-error-reason': "The save on this phone couldn't open.",
  'save-error-kept': 'Your progress is kept as it is. Nothing is cleared.',
  'try-again': 'Try again',
  'copy-details': 'Copy details',
  copied: 'Copied',
  /** A place whose screen hasn't landed yet (M036 builds them in parts). */
  'not-ready': 'Coming soon',
  /** The quick looks (D386): the Stable's and the Card Library's tickets and owned count, and the careers in progress. */
  'peek-uma-tickets': 'Uma Tickets',
  'peek-card-tickets': 'Card Tickets',
  'peek-owned': 'Owned',
  'peek-owned-of': '{n} of {total}',
  'peek-latest-umas': 'Latest unlocks',
  'peek-careers': 'In progress',
  'peek-no-careers': "No career running. Start one in Careers, or from an Uma's profile in the Stable.",
  'next-objective': 'Next: {race}',
  'next-finale': 'Next: the URA Finals',
  'open-career': '{uma}: open her career',
} as const)

export type HubWord = keyof typeof HUB_WORDS

/** Fills `{name}` placeholders; a missing value leaves its placeholder. */
export function fill(template: string, data?: Readonly<Record<string, string | number>>): string {
  if (data === undefined) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (Object.hasOwn(data, key) ? String(data[key]) : whole))
}

/** A shell sentence with its placeholders filled. */
export const hubWords = (key: HubWord, data?: Readonly<Record<string, string | number>>): string => fill(HUB_WORDS[key], data)

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** A counter's words for VoiceOver and the menu: "3 Uma Tickets", "2 careers open". */
export function counterWords(counter: PlaceCounter, n: number): string {
  switch (counter) {
    case 'uma-tickets': return plural(n, 'Uma Ticket', 'Uma Tickets')
    case 'card-tickets': return plural(n, 'Card Ticket', 'Card Tickets')
    case 'careers-open': return plural(n, 'career open', 'careers open')
  }
}

/** A tile's VoiceOver line: its name, then its counter when above 0 ("Stable. 3 Uma Tickets."). */
export function tileLabel(place: Place, count: number | null = null): string {
  if (place.counter !== null && count !== null && count > 0) return `${place.name}. ${counterWords(place.counter, count)}.`
  return `${place.name}.`
}
