// The place registry (docs/rework/11-hub-and-places.md §1, §3, §10.1; D333): every place on the Hub's four pages, one
// table for the page grids, the tiles, the ☰ menu, the routes and the live manual. Phase 3 draws each page as a DOM
// grid of tiles (§11), so a place carries a grid `cell` from §3's sketches; phase 6 adds map positions. Imports from
// the rules' areas are type-only, so the shell's entry chunk can read this file without the rules.
import type { BuildingId } from '../farm/buildings'

/** The four pages, in the bottom bar's order (§2.2) and the order of swiping (§3). */
export const HUB_PAGES = Object.freeze(['town', 'training', 'racing', 'farm'] as const)
export type HubPage = (typeof HUB_PAGES)[number]

export const HUB_PAGE_NAMES: Readonly<Record<HubPage, string>> = Object.freeze({
  town: 'Town Hall',
  training: 'Training',
  racing: 'Racing',
  farm: 'Farm',
})

/** What a place is: a Town Hall place, a Training Hub facility, a Farm site or station, or a Racing place. */
export type PlaceKind = 'town' | 'facility' | 'site' | 'station' | 'racing'

/**
 * §3's counter on a place's name pill and menu row. The hub view counts the first, second, third and fifth from the
 * rework state; `featured-open` and `new-flair` need data outside it (T141's `useCounter`).
 */
export type PlaceCounter = 'uma-tickets' | 'finished-here' | 'ready-to-advance' | 'featured-open' | 'promotable' | 'new-flair'

/** A cell on a page's three-column grid, from §3's sketches; rows count from 1. */
export interface PlaceCell {
  readonly row: number
  readonly col: 1 | 2 | 3
}

export const PLACE_IDS = Object.freeze([
  'stable', 'warehouse', 'exchange', 'card-library', 'account',
  'observatory', 'lineage-hall', 'gym', 'dojo',
  'racecourse', 'scenario-gate', 'expedition-map', 'trophy-hall',
  'sugar-grove', 'orchard', 'fishery', 'nut-grove', 'herb-garden', 'fields', 'vegetable-garden', 'mushroom-cave', 'pantry', 'kitchen',
] as const)
export type PlaceId = (typeof PLACE_IDS)[number]

export interface Place {
  readonly id: PlaceId
  readonly page: HubPage
  readonly kind: PlaceKind
  readonly name: string
  /** One line for the (i) help and an unfilled Peek. */
  readonly blurb: string
  /** `/${page}/${id}` (§7.1). */
  readonly route: string
  /** Its tile opens the Page at once, with no Peek (§1: only the Racecourse). */
  readonly direct: boolean
  /** Reachable by its route and the menu, not drawn on a page (only Account). */
  readonly hidden: boolean
  readonly counter: PlaceCounter | null
  /** uma-art's `buildings` frame (§10.1), or null where a new drawing isn't released yet (§10.3) or nothing is drawn. */
  readonly frame: string | null
  /** Whether its tile shows slot pips: the ten Farm buildings and four facilities, by their `BuildingId` (§4). */
  readonly pips: boolean
  /** Where its tile sits on the page grid; null for the hidden Account. */
  readonly cell: PlaceCell | null
}

/** The Town Hall plaza, the featured Uma's cell (§3.1, §5). */
export const PLAZA_CELL: PlaceCell = Object.freeze({ row: 2, col: 2 })

interface Spec {
  readonly id: PlaceId
  readonly name: string
  readonly blurb: string
  readonly cell: PlaceCell | null
  readonly frame: string | null
  readonly counter?: PlaceCounter | null
  readonly direct?: boolean
  readonly hidden?: boolean
}

const at = (row: number, col: 1 | 2 | 3): PlaceCell => Object.freeze({ row, col })

function places(page: HubPage, kind: PlaceKind | ((id: PlaceId) => PlaceKind), pips: boolean, specs: readonly Spec[]): Place[] {
  return specs.map((spec) => Object.freeze({
    id: spec.id,
    page,
    kind: typeof kind === 'function' ? kind(spec.id) : kind,
    name: spec.name,
    blurb: spec.blurb,
    route: `/${page}/${spec.id}`,
    direct: spec.direct ?? false,
    hidden: spec.hidden ?? false,
    counter: spec.counter ?? (pips ? 'finished-here' : null),
    frame: spec.frame,
    pips,
    cell: spec.cell,
  }))
}

// §3.1: [ Stable ] · [ Card Library ] above the plaza, [ Warehouse ] · [ Exchange ] below it.
const TOWN = places('town', 'town', false, [
  { id: 'stable', name: 'Stable', frame: 'stable', cell: at(1, 1), counter: 'uma-tickets',
    blurb: 'Every Uma: unlock new ones with Uma Tickets, and see each one\'s tier, levels and build.' },
  { id: 'warehouse', name: 'Warehouse', frame: 'warehouse', cell: at(3, 1),
    blurb: 'Every item you hold: raw, crafted, dishes and tickets. Sell what you don\'t need.' },
  { id: 'exchange', name: 'Exchange', frame: 'exchange', cell: at(3, 3),
    blurb: 'Speed Tickets and raw ingredients, bought with Prize Money.' },
  { id: 'card-library', name: 'Card Library', frame: null, cell: at(1, 3),
    blurb: 'Every SSR card, open to all: what each one pays, and Bond to give it to an Uma.' },
  { id: 'account', name: 'Account', frame: null, cell: null, hidden: true,
    blurb: 'Your trainer, check-in times, sync and the app.' },
])

// §3.2: [ Observatory ] · [ Lineage Hall ], the lawn, then [ Gym ] · [ Dojo ].
const TRAINING = places('training', 'facility', true, [
  { id: 'observatory', name: 'Observatory', frame: 'observatory', cell: at(1, 1),
    blurb: 'Constellation sessions: each opens a node of an Uma\'s tree, paid with a Vegetables dish.' },
  { id: 'lineage-hall', name: 'Lineage Hall', frame: 'party-hall', cell: at(1, 3),
    blurb: 'Inspiration sessions: each opens a slot or a gold of an Uma\'s lineage, paid with a Mushrooms dish.' },
  { id: 'gym', name: 'Gym', frame: null, cell: at(3, 1),
    blurb: 'Five stat rooms of Extra Stats sessions, paid with stat, Duo and Feast dishes.' },
  { id: 'dojo', name: 'Dojo', frame: 'brawler-dojo', cell: at(3, 3),
    blurb: 'Six card-type rooms of bond sessions: each bonds a card to an Uma.' },
])

// §3.3: [ Scenario Gate ] on top, [ Trophy Hall ] · [ Expedition Map ], and the Racecourse lowest, in the thumb zone.
const RACING = places('racing', 'racing', false, [
  { id: 'racecourse', name: 'Racecourse', frame: null, cell: at(3, 2), counter: 'featured-open', direct: true,
    blurb: 'Race select, the Daily Purse and today\'s featured races.' },
  { id: 'scenario-gate', name: 'Scenario Gate', frame: 'scenario-gate', cell: at(1, 2), counter: 'ready-to-advance',
    blurb: 'Every Uma\'s career: goals, holds, and advancing to the next scenario.' },
  { id: 'expedition-map', name: 'Expedition Map', frame: 'tier-finale', cell: at(2, 3), counter: 'promotable',
    blurb: 'World Expeditions, and promotion to the next tier.' },
  { id: 'trophy-hall', name: 'Trophy Hall', frame: null, cell: at(2, 1), counter: 'new-flair',
    blurb: 'Badges, titles, showcases, records and the trainer profile.' },
])

// §3.4: the eight sites on uma-art's Duo ring, so map neighbours are Duo partners (Grains – Vegetables – Mushrooms –
// Fruits – Herbs & Spices – Fish – Sweets – Nuts & Seeds), with the Pantry and Kitchen in the middle. 07 §1's order.
const FARM = places('farm', (id) => (id === 'pantry' || id === 'kitchen' ? 'station' : 'site'), true, [
  { id: 'sugar-grove', name: 'Sugar Grove', frame: 'sugar-grove', cell: at(3, 1), blurb: 'Gathers Sweets, for Speed dishes.' },
  { id: 'orchard', name: 'Orchard', frame: 'orchard', cell: at(2, 3), blurb: 'Gathers Fruits, for Stamina dishes.' },
  { id: 'fishery', name: 'Fishery', frame: 'fishery', cell: at(4, 2), blurb: 'Gathers Fish, for Power dishes.' },
  { id: 'nut-grove', name: 'Nut Grove', frame: 'nut-grove', cell: at(2, 1), blurb: 'Gathers Nuts & Seeds, for Guts dishes.' },
  { id: 'herb-garden', name: 'Herb Garden', frame: 'herb-garden', cell: at(3, 3), blurb: 'Gathers Herbs & Spices, for Wit dishes.' },
  { id: 'fields', name: 'Fields', frame: 'fields', cell: at(1, 1), blurb: 'Gathers Grains, for the dishes that bond Friend and Group cards.' },
  { id: 'vegetable-garden', name: 'Vegetable Garden', frame: 'vegetable-garden', cell: at(1, 2),
    blurb: 'Gathers Vegetables, for the Observatory\'s dishes.' },
  { id: 'mushroom-cave', name: 'Mushroom Cave', frame: 'mushroom-cave', cell: at(1, 3), blurb: 'Gathers Mushrooms, for the Lineage Hall\'s dishes.' },
  { id: 'pantry', name: 'Pantry', frame: 'pantry', cell: at(2, 2), blurb: 'Crafts raw ingredients into crafted ones, every family.' },
  { id: 'kitchen', name: 'Kitchen', frame: 'kitchen', cell: at(3, 2), blurb: 'Cooks the dishes every session and bond is paid with.' },
])

/** Every place, page by page in the bar's order: 22 drawn and the hidden Account. */
export const PLACES: readonly Place[] = Object.freeze([...TOWN, ...TRAINING, ...RACING, ...FARM])

const BY_ID: ReadonlyMap<string, Place> = new Map(PLACES.map((place) => [place.id, place]))

export const isHubPage = (value: string | null | undefined): value is HubPage => (HUB_PAGES as readonly string[]).includes(value ?? '')

export const isPlaceId = (value: string | null | undefined): value is PlaceId => BY_ID.has(value ?? '')

export const placeById = (id: string | null | undefined): Place | undefined => (id == null ? undefined : BY_ID.get(id))

/** The places drawn on a page, in registry order. */
export const placesOn = (page: HubPage): readonly Place[] => PLACES.filter((place) => place.page === page && !place.hidden)

/** The place a route names, only when it lives on that page (hidden ones included: `/town/account`). */
export function placeOnPage(page: string | undefined, id: string | undefined): Place | undefined {
  const place = placeById(id)
  return place !== undefined && place.page === page ? place : undefined
}

/** The rows a page's grid takes: its lowest cell, and the plaza on Town Hall. */
export function pageRows(page: HubPage): number {
  const rows = placesOn(page).map((place) => place.cell?.row ?? 1)
  return Math.max(...rows, page === 'town' ? PLAZA_CELL.row : 1)
}

/** A place that is one of the work engine's buildings shows pips; its id is the `BuildingId`. */
export const buildingOf = (place: Place): BuildingId | null => (place.pips ? (place.id as BuildingId) : null)
