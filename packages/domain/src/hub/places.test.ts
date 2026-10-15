// The place registry (docs/rework/11-hub-and-places.md §1, §3, §10) and its frames against the pinned uma-art index,
// as uma-rpg's `frames.test` checks its own: a frame the pinned release lacks fails here, never a blank building, and a
// release that draws one of the four new buildings fails until the registry wires it.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { BUILDING_IDS, BUILDINGS, FACILITY_IDS, FARM_BUILDING_IDS, type BuildingId } from '../rework/farm/buildings'
import { FAMILY_SITE } from '../rework/farm/jobs'
import { FAMILY_RING } from '../rework/items/families'
import {
  buildingOf, HUB_PAGE_NAMES, HUB_PAGES, isHubPage, isPlaceId, pageRows, PLACE_IDS, PLACES, placeById, placeOnPage, placesOn, PLAZA_CELL, type Place,
} from './places'

const require = createRequire(import.meta.url)
const ART = '@luismlorenzana/uma-art'
const read = (path: string): unknown => JSON.parse(readFileSync(require.resolve(`${ART}/${path}`), 'utf8'))
const atlas = read('buildings/atlas.json') as { frames: Record<string, { page: string; w: number; h: number }> }
const art = read('package.json') as { version: string }

const drawn = PLACES.filter((place) => !place.hidden)
const id = (place: Place) => place.id

describe('the place registry (rework/11 §3)', () => {
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

  it("puts every drawn place in its own cell of §3's three-column sketches", () => {
    for (const page of HUB_PAGES) {
      const cells = placesOn(page).map((place) => `${place.cell!.row}:${place.cell!.col}`)
      if (page === 'town') cells.push(`${PLAZA_CELL.row}:${PLAZA_CELL.col}`)
      expect(new Set(cells).size, page).toBe(cells.length)
      for (const place of placesOn(page)) {
        expect([1, 2, 3]).toContain(place.cell!.col)
        expect(place.cell!.row).toBeGreaterThanOrEqual(1)
      }
    }
    expect(placeById('account')!.cell).toBeNull()
    expect(HUB_PAGES.map(pageRows)).toEqual([3, 3, 3, 4])
    // The Racecourse sits lowest and central, nearest the raised RACE button (§3.3).
    expect(placeById('racecourse')!.cell).toEqual({ row: 3, col: 2 })
  })

  it("rings the Farm's sites in uma-art's Duo order, so neighbours on the page are Duo partners (§3.4)", () => {
    const cellOf = (building: BuildingId) => placeById(building)!.cell!
    FAMILY_RING.forEach((family, i) => {
      const a = cellOf(FAMILY_SITE[family])
      const b = cellOf(FAMILY_SITE[FAMILY_RING[(i + 1) % FAMILY_RING.length]!])
      expect(Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)), `${family} → next`).toBe(1)
    })
    expect([cellOf('pantry'), cellOf('kitchen')]).toEqual([{ row: 2, col: 2 }, { row: 3, col: 2 }])
  })
})

describe('frames (rework/11 §10)', () => {
  /** §10.1's source page for each reused frame. */
  const PAGES: Readonly<Record<string, string>> = {
    stable: 'town', warehouse: 'town', exchange: 'town', observatory: 'town', 'lineage-hall': 'town', 'scenario-gate': 'town',
    'expedition-map': 'town', dojo: 'learning', ...Object.fromEntries(FARM_BUILDING_IDS.map((building) => [building, 'farmlands'])),
  }

  it('reads the pinned 2.4.0 release', () => {
    expect(art.version).toBe('2.4.0')
  })

  it("finds every frame in the pinned index, 48 × 48 on §10.1's atlas page", () => {
    const framed = PLACES.filter((place) => place.frame !== null)
    expect(framed.map(id).sort()).toEqual(Object.keys(PAGES).sort())
    for (const place of framed) {
      const frame = atlas.frames[place.frame!]
      expect(frame, `${place.id}: ${place.frame}`).toBeDefined()
      expect(frame).toMatchObject({ page: PAGES[place.id], w: 48, h: 48 })
    }
    expect(placeById('lineage-hall')!.frame).toBe('party-hall')
    expect(placeById('dojo')!.frame).toBe('brawler-dojo')
    expect(placeById('expedition-map')!.frame).toBe('tier-finale')
  })

  it("leaves exactly §10.3's four new buildings plain, and fails once a release draws one", () => {
    const plain = drawn.filter((place) => place.frame === null).map(id).sort()
    expect(plain).toEqual(['card-library', 'gym', 'racecourse', 'trophy-hall'])
    for (const building of plain) expect(atlas.frames[building], `${building} is drawn now: wire its frame`).toBeUndefined()
    expect(placeById('account')!.frame).toBeNull()
  })
})
