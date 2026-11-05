// The Card Library's view model (docs/game/02-unlocks.md §3, docs/game/11-hub-and-places.md §3.1; D386): every SSR in
// the content as an album row, owned or locked, with its type and its running-style and distance focus (`cardFocus`);
// the filters as the URL carries them (`?tab=`, `type`, `style`, `distance`, `q`), run by uma-kit's album engine and
// sorted newest release first; a card's power against its type's median (T153's `cardPower`); its era as the first
// scenario it can be used in; and the place's words. The card values are read from the content at runtime. Pure.
import type { AlbumQuery, AlbumRow, FacetDef } from '@luismlorenzana/uma-kit/roster'
import { runAlbumQuery } from '@luismlorenzana/uma-kit/roster'
import {
  cardFocus, scenarioForTier, type CardDistanceFocus, type CardStyleFocus, type SkillTemplate, type SupportCardTemplate, type SupportCardType,
} from '@racer/domain'
import { cardPower } from '@racer/domain/build'
import { OPEN_SCENARIOS } from '@racer/domain/career'
import type { UnlockRecord } from '@racer/domain/save'
import { DISTANCES, STYLES } from '../../ui/labels'
import type { OwnershipTab } from '../../hub/nav'
import { titledCardName } from '../../ui/words'

export const LIBRARY_WORDS = Object.freeze({
  'about-tickets': 'Each Card Ticket unlocks one SSR support card, for good. Cards are shared by every Uma.',
  'about-effects': 'A card counts at its top level, level 50: its page shows its real effects there.',
  tabs: 'Cards',
  owned: 'Owned',
  locked: 'Locked',
  search: 'Search cards',
  types: 'Card type',
  focus: 'Focus',
  clear: 'Clear filters',
  'no-owned': 'No cards yet. Each Card Ticket unlocks one from the Locked tab.',
  'see-locked': 'Unlock your first cards',
  'all-owned': 'Every card is in your Library.',
  'nothing-matches': 'No card matches these filters.',
  /** A card's page. */
  unlock: 'Unlock · 1 Card Ticket',
  'tickets-move': 'Card Tickets: {n} to {next}',
  'no-tickets': 'No Card Tickets left. Winning an objective earns one.',
  final: 'Unlocking is final.',
  unlocked: 'In your Library',
  failed: "Couldn't unlock. Try again.",
  effects: 'Effects at level 50',
  'no-effects': 'No effects in this content.',
  unique: 'Unique effect',
  'hint-skills': 'Hint skills',
  'event-skills': 'Event skills',
  'no-skills': 'None.',
  era: 'First usable in {scenario}',
  'era-open': 'Usable in URA Finale careers.',
  'era-later': 'Not usable in URA Finale careers.',
  power: 'Power',
  'power-line': '{power} · {type} median {median}',
  'power-note': 'The stats it adds to a level-3 session at its own branch, bonded, beside a reference deck.',
  'unknown-card': "That card isn't in this game's content.",
  'style-focus': 'Running style focus',
  'distance-focus': 'Distance focus',
} as const)

export type LibraryWord = keyof typeof LIBRARY_WORDS

export const libraryWords = (key: LibraryWord, data?: Readonly<Record<string, string | number>>): string =>
  LIBRARY_WORDS[key].replace(/\{(\w+)\}/g, (whole, name: string) => (data !== undefined && Object.hasOwn(data, name) ? String(data[name]) : whole))

export const CARD_TYPES: readonly SupportCardType[] = Object.freeze(['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group'])

/** One card in the album. */
export interface CardRow extends AlbumRow {
  readonly name: string
  readonly type: SupportCardType
  readonly owned: boolean
  readonly style: CardStyleFocus
  readonly distance: CardDistanceFocus
}

export const LIBRARY_FACETS: readonly FacetDef[] = Object.freeze([
  { key: 'type', label: 'Type', kind: 'enum', group: 'Card', options: CARD_TYPES.map((value) => ({ value, label: value })) },
  { key: 'style', label: 'Running style', kind: 'enum', group: 'Focus', options: STYLES.map((value) => ({ value, label: value })) },
  { key: 'distance', label: 'Distance', kind: 'enum', group: 'Focus', options: DISTANCES.map((value) => ({ value, label: value })) },
])

/** Every card in the content, as album rows. */
export function libraryRows(cards: Iterable<SupportCardTemplate>, skills: ReadonlyMap<string, SkillTemplate>, owned: Readonly<Record<string, UnlockRecord>>): CardRow[] {
  return [...cards].map((card) => {
    const focus = cardFocus(card, skills)
    const name = titledCardName(card)
    return {
      id: card.id,
      name,
      search: name.toLowerCase(),
      facets: {
        type: [card.type],
        style: focus.style === 'generalist' ? [] : [focus.style],
        distance: focus.distance === 'generalist' ? [] : [focus.distance],
      },
      sorts: { release: card.jpRelease, name },
      type: card.type,
      owned: owned[card.id] !== undefined,
      style: focus.style,
      distance: focus.distance,
    }
  })
}

/** The filters the URL holds: one type, one running style, one distance and a search, each optional. */
export interface LibraryFilters {
  readonly type: SupportCardType | null
  readonly style: string | null
  readonly distance: string | null
  readonly search: string
}

export function readFilters(params: URLSearchParams): LibraryFilters {
  const type = params.get('type')
  const style = params.get('style')
  const distance = params.get('distance')
  return {
    type: (CARD_TYPES as readonly string[]).includes(type ?? '') ? type as SupportCardType : null,
    style: (STYLES as readonly string[]).includes(style ?? '') ? style : null,
    distance: (DISTANCES as readonly string[]).includes(distance ?? '') ? distance : null,
    search: params.get('q') ?? '',
  }
}

/** The album query the filters make: newest release first. */
export function libraryQuery(filters: LibraryFilters): AlbumQuery {
  const pick = (value: string | null) => (value === null ? [] : [value])
  return {
    search: filters.search,
    filters: { type: pick(filters.type), style: pick(filters.style), distance: pick(filters.distance) },
    sort: 'release', direction: 'desc', group: null, view: 'icons', mode: null,
  }
}

/** The cards a tab and its filters show, newest release first. */
export function libraryResult(rows: readonly CardRow[], tab: OwnershipTab, filters: LibraryFilters): CardRow[] {
  const scoped = rows.filter((row) => row.owned === (tab === 'owned'))
  return runAlbumQuery(scoped, LIBRARY_FACETS, libraryQuery(filters), [{ key: 'name', direction: 'asc' }]).rows as CardRow[]
}

/** The tab asked for, else Owned once any card is, else Locked. */
export function libraryTab(asked: string | null, ownedCount: number): OwnershipTab {
  if (asked === 'owned' || asked === 'locked') return asked
  return ownedCount > 0 ? 'owned' : 'locked'
}

/** A card's power beside its type's: the median and the strongest, for the bar. */
export interface PowerReading {
  readonly power: number
  readonly median: number
  readonly max: number
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

const typePowers = new WeakMap<ReadonlyMap<string, SupportCardTemplate>, Map<SupportCardType, number[]>>()

/** Every card's power by type, once per content. */
function powersByType(cards: ReadonlyMap<string, SupportCardTemplate>): Map<SupportCardType, number[]> {
  const known = typePowers.get(cards)
  if (known !== undefined) return known
  const out = new Map<SupportCardType, number[]>()
  for (const card of cards.values()) out.set(card.type, [...(out.get(card.type) ?? []), cardPower(card)])
  typePowers.set(cards, out)
  return out
}

/** The card's power, its type's median power and the type's strongest, all from the content's real effects. */
export function powerReading(card: SupportCardTemplate, cards: ReadonlyMap<string, SupportCardTemplate>): PowerReading {
  const powers = powersByType(cards).get(card.type) ?? []
  const power = cardPower(card)
  return { power, median: median(powers), max: Math.max(power, ...powers) }
}

/** A power for the page: whole when it is, else one decimal. */
export const powerText = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1))

/** The first scenario a card of this era can be used in, and whether this release's careers take it. */
export function eraReading(era: number): { readonly scenario: string; readonly open: boolean } {
  return { scenario: scenarioForTier(era)?.name ?? `Scenario ${era}`, open: OPEN_SCENARIOS.some((T) => T >= era) }
}
