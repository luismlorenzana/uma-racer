// The place registry (docs/game/11-hub-and-places.md §1, §3, §10.1; D333, D363): every place on the Hub's four pages,
// one table for the canvas maps, their place buttons, the ☰ menu, the routes and the live manual. A place stands at an
// `at` position on its page, fractions of the map's width and height, laid out as uma-rpg lays its pages (its
// `hub/places.ts`): the trunk road down the middle and the places on both sides. Imports from the rules' areas are
// type-only, so the shell's entry chunk can read this file without the rules.
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

/**
 * Where a place stands on its page map (§3): the middle of its building's ground line, as fractions of the map's width
 * and height. The map snaps it to its 16 px art grid (`apps/web/src/hub/grid.ts`), as uma-rpg's `at` does.
 */
export interface PlaceAt {
  readonly x: number
  readonly y: number
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
  /**
   * uma-art's `buildings` frame (§10.1); null only for the hidden Account, which is never drawn. The four new drawings
   * (§10.3, A01) carry their ids before the release that draws them: until it is pinned, the Hub draws a code
   * placeholder in their place.
   */
  readonly frame: string | null
  /** Whether its tile shows slot pips: the ten Farm buildings and four facilities, by their `BuildingId` (§4). */
  readonly pips: boolean
  /** Where it stands on its page map; null for the hidden Account. */
  readonly at: PlaceAt | null
}

// The map's columns, uma-rpg's: places a quarter in from either edge, beside the trunk road, or on the road itself.
// The Farm's ten buildings take wider sides, with the Pantry and Kitchen on the road between them (§3.4). At 390 pt
// each lands on a 16 px art column symmetric about the road's (17 columns at 1.5 CSS px per art pixel; 13 at 2).
const LEFT = 0.24
const RIGHT = 0.76
const MIDDLE = 0.5
const FAR_LEFT = 0.2
const FAR_RIGHT = 0.79

const at = (x: number, y: number): PlaceAt => Object.freeze({ x, y })

/**
 * §10.3's four new drawings (A01) that the pinned uma-art doesn't draw yet: the Hub draws a code placeholder for each,
 * and the registry test lets exactly these be missing from the atlas. Emptied when the release that draws them (2.6.0)
 * is pinned, which makes the test strict again.
 */
export const AWAITING_ART: readonly string[] = Object.freeze(['card-library', 'gym', 'racecourse', 'trophy-hall'])

/** The Town Hall plaza, where the featured Uma stands on the road between the four places (§3.1, §5). */
export const PLAZA_AT: PlaceAt = at(MIDDLE, 0.45)

interface Spec {
  readonly id: PlaceId
  readonly name: string
  readonly blurb: string
  readonly at: PlaceAt | null
  readonly frame: string | null
  readonly counter?: PlaceCounter | null
  readonly direct?: boolean
  readonly hidden?: boolean
}

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
    at: spec.at,
  }))
}

// §3.1: [ Stable ] · [ Card Library ] above the plaza, [ Warehouse ] · [ Exchange ] below it.
const TOWN = places('town', 'town', false, [
  { id: 'stable', name: 'Stable', frame: 'stable', at: at(LEFT, 0.18), counter: 'uma-tickets',
    blurb: 'Every Uma: unlock new ones with Uma Tickets, and see each one\'s tier, levels and build.' },
  { id: 'warehouse', name: 'Warehouse', frame: 'warehouse', at: at(LEFT, 0.72),
    blurb: 'Every item you hold: raw, crafted, dishes and tickets. Sell what you don\'t need.' },
  { id: 'exchange', name: 'Exchange', frame: 'exchange', at: at(RIGHT, 0.72),
    blurb: 'Speed Tickets and raw ingredients, bought with Prize Money.' },
  { id: 'card-library', name: 'Card Library', frame: 'card-library', at: at(RIGHT, 0.18),
    blurb: 'Every SSR card, open to all: what each one pays, and Bond to give it to an Uma.' },
  { id: 'account', name: 'Account', frame: null, at: null, hidden: true,
    blurb: 'Your trainer, check-in times, sync and the app.' },
])

// §3.2: [ Observatory ] · [ Lineage Hall ], the lawn, then [ Gym ] · [ Dojo ], whose two rows of pips need room.
const TRAINING = places('training', 'facility', true, [
  { id: 'observatory', name: 'Observatory', frame: 'observatory', at: at(LEFT, 0.18),
    blurb: 'Constellation sessions: each opens a node of an Uma\'s tree, paid with a Vegetables dish.' },
  { id: 'lineage-hall', name: 'Lineage Hall', frame: 'party-hall', at: at(RIGHT, 0.18),
    blurb: 'Inspiration sessions: each opens a slot or a gold of an Uma\'s lineage, paid with a Mushrooms dish.' },
  { id: 'gym', name: 'Gym', frame: 'gym', at: at(LEFT, 0.6),
    blurb: 'Five stat rooms of Extra Stats sessions, paid with stat, Duo and Feast dishes.' },
  { id: 'dojo', name: 'Dojo', frame: 'brawler-dojo', at: at(RIGHT, 0.6),
    blurb: 'Six card-type rooms of bond sessions: each bonds a card to an Uma.' },
])

// §3.3: [ Scenario Gate ] on the road at the top, [ Trophy Hall ] · [ Expedition Map ], and the Racecourse lowest on the
// road, in the thumb zone.
const RACING = places('racing', 'racing', false, [
  { id: 'racecourse', name: 'Racecourse', frame: 'racecourse', at: at(MIDDLE, 0.74), counter: 'featured-open', direct: true,
    blurb: 'Race select, the Daily Purse and today\'s featured races.' },
  { id: 'scenario-gate', name: 'Scenario Gate', frame: 'scenario-gate', at: at(MIDDLE, 0.2), counter: 'ready-to-advance',
    blurb: 'Every Uma\'s career: goals, holds, and advancing to the next scenario.' },
  { id: 'expedition-map', name: 'Expedition Map', frame: 'tier-finale', at: at(RIGHT, 0.46), counter: 'promotable',
    blurb: 'World Expeditions, and promotion to the next tier.' },
  { id: 'trophy-hall', name: 'Trophy Hall', frame: 'trophy-hall', at: at(LEFT, 0.46), counter: 'new-flair',
    blurb: 'Badges, titles, showcases, records and the trainer profile.' },
])

// §3.4: the eight sites ring the page clockwise in uma-art's Duo order, so map neighbours are Duo partners (Grains –
// Vegetables – Mushrooms – Fruits – Herbs & Spices – Fish – Sweets – Nuts & Seeds): four down each side of the road,
// joined across it at the top and the bottom, with the Pantry and Kitchen on the road in the middle. 07 §1's order.
const FARM = places('farm', (id) => (id === 'pantry' || id === 'kitchen' ? 'station' : 'site'), true, [
  { id: 'sugar-grove', name: 'Sugar Grove', frame: 'sugar-grove', at: at(FAR_LEFT, 0.56), blurb: 'Gathers Sweets, for Speed dishes.' },
  { id: 'orchard', name: 'Orchard', frame: 'orchard', at: at(FAR_RIGHT, 0.56), blurb: 'Gathers Fruits, for Stamina dishes.' },
  { id: 'fishery', name: 'Fishery', frame: 'fishery', at: at(FAR_LEFT, 0.78), blurb: 'Gathers Fish, for Power dishes.' },
  { id: 'nut-grove', name: 'Nut Grove', frame: 'nut-grove', at: at(FAR_LEFT, 0.34), blurb: 'Gathers Nuts & Seeds, for Guts dishes.' },
  { id: 'herb-garden', name: 'Herb Garden', frame: 'herb-garden', at: at(FAR_RIGHT, 0.78), blurb: 'Gathers Herbs & Spices, for Wit dishes.' },
  { id: 'fields', name: 'Fields', frame: 'fields', at: at(FAR_LEFT, 0.12), blurb: 'Gathers Grains, for the dishes that bond Friend and Group cards.' },
  { id: 'vegetable-garden', name: 'Vegetable Garden', frame: 'vegetable-garden', at: at(FAR_RIGHT, 0.12),
    blurb: 'Gathers Vegetables, for the Observatory\'s dishes.' },
  { id: 'mushroom-cave', name: 'Mushroom Cave', frame: 'mushroom-cave', at: at(FAR_RIGHT, 0.34), blurb: 'Gathers Mushrooms, for the Lineage Hall\'s dishes.' },
  { id: 'pantry', name: 'Pantry', frame: 'pantry', at: at(MIDDLE, 0.34), blurb: 'Crafts raw ingredients into crafted ones, every family.' },
  { id: 'kitchen', name: 'Kitchen', frame: 'kitchen', at: at(MIDDLE, 0.56), blurb: 'Cooks the dishes every session and bond is paid with.' },
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

/** A place that is one of the work engine's buildings shows pips; its id is the `BuildingId`. */
export const buildingOf = (place: Place): BuildingId | null => (place.pips ? (place.id as BuildingId) : null)
