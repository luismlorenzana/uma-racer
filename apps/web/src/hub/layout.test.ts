// The Hub's layout at the owner's screen (docs/game/11-hub-and-places.md §1, §3, §12): every place link, from its
// building's top down to its name pill and pips, and the Town Hall plaza, inside the map, clear of the floating pill and
// of one another, at least 44 pt, on the 390 × 844 portrait screen with its bars and safe areas or without them (the
// preview). Box sizes are the links' as measured in the browser (T145): 66 pt of building, then 24 pt for the name pill
// and 24 more for each row of pips (with the Kitchen's eight at Lv 3, two rows).
import { buildingOf, HUB_PAGES, placesOn, PLAZA_AT, type Place } from '@racer/domain/hub'
import { MAX_BUILDING_LEVEL, totalSlots } from '@racer/domain/farm'
import { describe, expect, it } from 'vitest'
import { BUILDING, hubGrid, placeAnchor, TARGET_W } from './grid'

interface Box {
  readonly id: string
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
}

/** The rows of pips a place shows at its fullest: up to eight, four to a row (§4). */
function pipRows(place: Place): number {
  const building = buildingOf(place)
  return building === null ? 0 : Math.ceil(Math.min(8, totalSlots(building, MAX_BUILDING_LEVEL)) / 4)
}

/** The measured label under the ground line: the name pill's 24, then each pip row's 20 and their gaps on a backing. */
const label = (rows: number): number => 24 + (rows === 0 ? 0 : 4 + rows * 20 + (rows - 1) * 4)

/** The map between the bars at 390 or 393 wide: the preview (no safe areas), and the phone in standalone. */
const SCREENS = [
  { name: 'the preview at 390 × 844', w: 390, h: 729 },
  { name: 'an iPhone at 390 × 844, safe areas in', w: 390, h: 648 },
  { name: 'an iPhone at 393 × 852, safe areas in', w: 393, h: 644 },
] as const

const PILL = { w: 180, h: 44, right: 16, bottom: 12 }

describe('the Hub layout at 390 × 844 (§12)', () => {
  it('measures each place link as the browser does', () => {
    expect([label(0), label(1), label(2)]).toEqual([24, 48, 72])
    expect(BUILDING.anchorY * 1.5).toBe(66)
    expect(TARGET_W).toBeGreaterThanOrEqual(4 * 20 + 3 * 4)
  })

  for (const screen of SCREENS) {
    for (const page of HUB_PAGES) {
      it(`fits ${page} on ${screen.name}: inside the map, clear of the pill and of each other, at least 44 pt`, () => {
        const grid = hubGrid(screen.w, screen.h, 2)
        const tapH = BUILDING.anchorY * grid.scale
        const boxes: Box[] = placesOn(page).map((place) => {
          const anchor = placeAnchor(place.at!, grid)
          return { id: place.id, x0: anchor.x - TARGET_W / 2, y0: anchor.y - tapH, x1: anchor.x + TARGET_W / 2, y1: anchor.y + label(pipRows(place)) }
        })
        if (page === 'town') {
          const anchor = placeAnchor(PLAZA_AT, grid)
          boxes.push({ id: 'plaza', x0: anchor.x - TARGET_W / 2, y0: anchor.y - 76, x1: anchor.x + TARGET_W / 2, y1: anchor.y + 30 })
        }
        const pill: Box = { id: 'pill', x0: screen.w - PILL.right - PILL.w, y0: screen.h - PILL.bottom - PILL.h, x1: screen.w - PILL.right, y1: screen.h - PILL.bottom }
        for (const box of boxes) {
          expect(box.x0, `${box.id} left`).toBeGreaterThanOrEqual(0)
          expect(box.x1, `${box.id} right`).toBeLessThanOrEqual(screen.w)
          expect(box.y0, `${box.id} top`).toBeGreaterThanOrEqual(0)
          expect(box.y1, `${box.id} bottom`).toBeLessThanOrEqual(screen.h)
          expect(Math.min(box.x1 - box.x0, box.y1 - box.y0), box.id).toBeGreaterThanOrEqual(44)
        }
        const overlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
        for (const [i, a] of boxes.entries()) {
          expect(overlap(a, pill), `${a.id} under the pill`).toBe(false)
          for (const b of boxes.slice(i + 1)) expect(overlap(a, b), `${a.id} and ${b.id}`).toBe(false)
        }
      })
    }
  }

  it('centres the road: the middle column on the middle of the screen, the sides mirrored', () => {
    for (const screen of SCREENS) {
      const grid = hubGrid(screen.w, screen.h, 2)
      expect(grid.cols % 2).toBe(1)
      expect(placeAnchor({ x: 0.5, y: 0.5 }, grid).x).toBe(screen.w / 2)
      for (const [left, right] of [[0.24, 0.76], [0.2, 0.79]] as const) {
        expect(placeAnchor({ x: left, y: 0.5 }, grid).x + placeAnchor({ x: right, y: 0.5 }, grid).x).toBe(screen.w)
      }
      // Whole device pixels: the art lands crisp.
      expect((grid.left * 2) % 1).toBe(0)
    }
  })
})
