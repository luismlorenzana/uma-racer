// The place registry (docs/game/11-hub-and-places.md §1, §3, §10) and its frames against the pinned uma-art index,
// as uma-rpg's `frames.test` checks its own: a frame the pinned release lacks fails here, except `AWAITING_ART`'s four
// new drawings (A01), each reported by name until the release that draws them is pinned and the list is emptied.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { BUILDING_IDS, BUILDINGS, FACILITY_IDS, FARM_BUILDING_IDS, type BuildingId } from '../farm/buildings'
import { FAMILY_SITE } from '../farm/jobs'
import { FAMILY_RING } from '../items/families'
import {
  AWAITING_ART, buildingOf, HUB_PAGE_NAMES, HUB_PAGES, isHubPage, isPlaceId, PLACE_IDS, PLACES, placeById, placeOnPage, placesOn, PLAZA_AT, type Place,
} from './places'

const require = createRequire(import.meta.url)
const ART = '@luismlorenzana/uma-art'
const read = (path: string): unknown => JSON.parse(readFileSync(require.resolve(`${ART}/${path}`), 'utf8'))
const atlas = read('buildings/atlas.json') as { frames: Record<string, { page: string; w: number; h: number }> }
const art = read('package.json') as { version: string }

const drawn = PLACES.filter((place) => !place.hidden)
const id = (place: Place) => place.id

describe('the place registry (game/11 §3)', () => {
  it('holds 23 places, page by page: 22 drawn and the hidden Account', () => {
    expect(PLACES.map(id)).toEqual([...PLACE_IDS])
    expect(new Set(PLACE_IDS).size).toBe(23)
    expect(drawn).toHaveLength(22)
    expect(HUB_PAGES).toEqual(['town', 'training', 'racing', 'farm'])
    expect(HUB_PAGES.map((page) => HUB_PAGE_NAMES[page])).toEqual(['Town Hall', 'Training', 'Racing', 'Farm'])
    expect(HUB_PAGES.map((page) => placesOn(page).map(id))).toEqual([
      ['stable', 'warehouse', 'exchange', 'card-library'],
      ['observatory', 'lineage-hall', 'gym', 'dojo'],
      ['racecourse', 'scenario-gate', 'expedition-map', 'trophy-hall'],
      [...FARM_BUILDING_IDS],
    ])
  })

  it('routes every place under its page (§7.1) and finds it only there', () => {
    for (const place of PLACES) {
      expect(place.route).toBe(`/${place.page}/${place.id}`)
      expect(placeOnPage(place.page, place.id)).toBe(place)
      expect(placeById(place.id)).toBe(place)
      expect(isPlaceId(place.id)).toBe(true)
    }
    expect(placeOnPage('town', 'account')?.hidden).toBe(true)
    expect(placeOnPage('farm', 'stable')).toBeUndefined()
    expect(placeOnPage('training', 'sim-uma-01')).toBeUndefined()
    expect(placeById('nowhere')).toBeUndefined()
    expect([isHubPage('farm'), isHubPage('stable'), isHubPage(undefined), isHubPage('')]).toEqual([true, false, false, false])
  })

  it('names each kind, with one direct place and one hidden', () => {
    const kinds = Object.fromEntries(PLACES.map((place) => [place.id, place.kind]))
    expect(kinds).toMatchObject({ stable: 'town', warehouse: 'town', exchange: 'town', 'card-library': 'town', account: 'town' })
    for (const facility of FACILITY_IDS) expect(kinds[facility]).toBe('facility')
    for (const site of Object.values(FAMILY_SITE)) expect(kinds[site]).toBe('site')
    expect([kinds.pantry, kinds.kitchen]).toEqual(['station', 'station'])
    for (const racing of ['racecourse', 'scenario-gate', 'expedition-map', 'trophy-hall']) expect(kinds[racing]).toBe('racing')
    expect(PLACES.filter((place) => place.direct).map(id)).toEqual(['racecourse'])
    expect(PLACES.filter((place) => place.hidden).map(id)).toEqual(['account'])
  })

  it("carries §3's counters", () => {
    const counters = Object.fromEntries(PLACES.map((place) => [place.id, place.counter]))
    expect(counters).toEqual({
      stable: 'uma-tickets', warehouse: null, exchange: null, 'card-library': null, account: null,
      racecourse: 'featured-open', 'scenario-gate': 'ready-to-advance', 'expedition-map': 'promotable', 'trophy-hall': 'new-flair',
      ...Object.fromEntries(BUILDING_IDS.map((building) => [building, 'finished-here'])),
    })
  })

  it("shows pips exactly on the work engine's 14 buildings, named as they are", () => {
    expect(PLACES.filter((place) => place.pips).map(id).sort()).toEqual([...BUILDING_IDS].sort())
    for (const place of PLACES) {
      expect(buildingOf(place)).toBe(place.pips ? place.id : null)
      if (place.pips) expect(place.name).toBe(BUILDINGS[place.id as BuildingId].name)
    }
  })

  it("stands every drawn place on its page map, uma-rpg's way: beside the road down the middle, or on it (§3)", () => {
    const columns = [0.2, 0.24, 0.5, 0.76, 0.79]
    for (const page of HUB_PAGES) {
      const spots = placesOn(page).map((place) => place.at!)
      if (page === 'town') spots.push(PLAZA_AT)
      for (const spot of spots) {
        expect(columns).toContain(spot.x)
        expect(spot.y).toBeGreaterThanOrEqual(0.12)
        expect(spot.y).toBeLessThanOrEqual(0.78)
      }
      // Never two on one spot, and any two in one column well apart (the map checks the real boxes at 390 × 844).
      for (const [i, a] of spots.entries()) {
        for (const b of spots.slice(i + 1)) {
          if (a.x === b.x) expect(Math.abs(a.y - b.y), page).toBeGreaterThanOrEqual(0.2)
          else expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y), page).toBeGreaterThan(0.2)
        }
      }
      // The two sides mirror each other about the road.
      const sides = spots.filter((spot) => spot.x !== 0.5)
      for (const spot of sides) expect(sides.some((other) => other.y === spot.y && Math.abs(other.x + spot.x - 1) < 0.04), page).toBe(true)
    }
    expect(placeById('account')!.at).toBeNull()
    // The plaza and the Racecourse stand on the road; the Racecourse lowest, nearest the raised RACE button (§3.3).
    expect(PLAZA_AT.x).toBe(0.5)
    const racecourse = placeById('racecourse')!.at!
    expect(racecourse.x).toBe(0.5)
    for (const place of placesOn('racing')) if (place.id !== 'racecourse') expect(place.at!.y).toBeLessThan(racecourse.y)
  })

  it("rings the Farm's sites in uma-art's Duo order around the Pantry and Kitchen, so map neighbours are Duo partners (§3.4)", () => {
    const centre = { x: 0.5, y: 0.45 }
    const angle = (building: BuildingId) => {
      const spot = placeById(building)!.at!
      return Math.atan2(spot.y - centre.y, spot.x - centre.x)
    }
    // Clockwise on the screen (y grows downward): sorted by angle, the sites read the ring from some starting site.
    const around = Object.values(FAMILY_SITE).sort((a, b) => angle(a) - angle(b))
    const ring = FAMILY_RING.map((family) => FAMILY_SITE[family])
    const start = ring.indexOf(around[0]!)
    expect(around).toEqual([...ring.slice(start), ...ring.slice(0, start)])
    expect([placeById('pantry')!.at, placeById('kitchen')!.at]).toEqual([{ x: 0.5, y: 0.34 }, { x: 0.5, y: 0.56 }])
  })
})

describe('frames (game/11 §10)', () => {
  /** §10.1's source page for each reused frame. */
  const PAGES: Readonly<Record<string, string>> = {
    stable: 'town', warehouse: 'town', exchange: 'town', observatory: 'town', 'lineage-hall': 'town', 'scenario-gate': 'town',
    'expedition-map': 'town', dojo: 'learning', ...Object.fromEntries(FARM_BUILDING_IDS.map((building) => [building, 'farmlands'])),
  }

  it('reads the pinned 2.5.0 release', () => {
    expect(art.version).toBe('2.5.0')
  })

  it("finds every frame in the pinned index, 48 × 48 on §10.1's atlas page, but AWAITING_ART's", () => {
    const framed = drawn.filter((place) => !AWAITING_ART.includes(place.frame!))
    expect(framed.map(id).sort()).toEqual(Object.keys(PAGES).sort())
    for (const place of framed) {
      const frame = atlas.frames[place.frame!]
      expect(frame, `${place.id}: ${place.frame}`).toBeDefined()
      expect(frame).toMatchObject({ page: PAGES[place.id], w: 48, h: 48 })
    }
    expect(placeById('lineage-hall')!.frame).toBe('party-hall')
    expect(placeById('dojo')!.frame).toBe('brawler-dojo')
    expect(placeById('expedition-map')!.frame).toBe('tier-finale')
    expect(placeById('account')!.frame).toBeNull()
  })

  it("gives §10.3's four new places A01's frame ids, and allows only those to wait for their release", () => {
    for (const building of ['card-library', 'gym', 'racecourse', 'trophy-hall']) expect(placeById(building)!.frame).toBe(building)
    expect(AWAITING_ART.every((frame) => drawn.some((place) => place.frame === frame))).toBe(true)
    expect([...AWAITING_ART].sort()).toEqual(AWAITING_ART.length === 0 ? [] : ['card-library', 'gym', 'racecourse', 'trophy-hall'])
  })

  // The report: one line per frame still waiting. A release that draws one fails here until it leaves the list, so an
  // empty list (uma-art 2.6.0 pinned) makes the frames test above strict.
  it.each(AWAITING_ART.map((frame) => [frame]))('%s waits for uma-art 2.6.0 (A01): the Hub draws its placeholder', (frame) => {
    expect(atlas.frames[frame], `${frame} is drawn in ${art.version}: take it off AWAITING_ART`).toBeUndefined()
  })
})
