// The Hub's ground (docs/game/11-hub-and-places.md §10.2; uma-rpg's `hub/scene/terrain.test.ts`, its D61 and P38):
// deterministic per page, every door on the road network, masks that agree with their neighbours, props on free ground;
// the tile page each racer page draws with, Racing's borrowed until its own ground is in the pinned atlas; and every
// frame the map draws in the pinned atlas, but any building still awaiting its art (`AWAITING_ART`, empty since uma-art 2.6.0), which gets a placeholder.
import buildingsIndex from '@luismlorenzana/uma-art/buildings/atlas.json'
import tilesIndex from '@luismlorenzana/uma-art/tiles/atlas.json'
import { AWAITING_ART, HUB_PAGES, placesOn, PLAZA_AT, type HubPage } from '@racer/domain/hub'
import { describe, expect, it } from 'vitest'
import { E, layTerrain, N, PROPS, S, TILE_PAGES, tilePageFor, W, type TilePage } from './terrain'

const TILES = tilesIndex.frames as Record<string, { w: number; h: number }>
const BUILDINGS = buildingsIndex.frames as Record<string, { smoke?: unknown }>

/** The map at 390 × 642 (the owner's phone in standalone, 17 × 27 tiles at dpr 2), the preview's 17 × 31, dpr 1's 13 × 23. */
const SIZES = [[17, 27], [17, 31], [13, 23]] as const

const places = (page: HubPage) => placesOn(page).map((place) => ({ id: place.id, at: place.at! }))
const clearings = (page: HubPage) => (page === 'town' ? [PLAZA_AT] : [])

describe('the tile page each racer page draws with (§10.2)', () => {
  it('maps town, training and farm to uma-art\'s town, learning and farmlands', () => {
    expect(TILE_PAGES).toEqual({ town: 'town', training: 'learning', racing: 'racing', farm: 'farmlands' })
    for (const page of ['town', 'training', 'farm'] as const) {
      expect(tilePageFor(page, {})).toBe(TILE_PAGES[page])
      expect(tilePageFor(page, TILES)).toBe(TILE_PAGES[page])
    }
  })

  it('draws Racing on its own tiles when the atlas has racing/ground-0, else on Town\'s', () => {
    expect(tilePageFor('racing', { 'racing/ground-0': {} })).toBe('racing')
    expect(tilePageFor('racing', { 'town/ground-0': {} })).toBe('town')
    // The pinned release (2.7.0) draws A01's Racing ground.
    expect(tilePageFor('racing', TILES)).toBe('racing')
  })
})

describe('Hub terrain (uma-rpg D61)', () => {
  for (const page of HUB_PAGES) {
    for (const tiles of new Set<TilePage>([TILE_PAGES[page], tilePageFor(page, TILES)])) {
      for (const [cols, rows] of SIZES) {
        it(`lays out ${page} on ${tiles} tiles at ${cols} × ${rows}: deterministic, doors on the roads, joined masks, props on free ground`, () => {
          const t = layTerrain(page, tiles, places(page), cols, rows, clearings(page))
          expect(layTerrain(page, tiles, places(page), cols, rows, clearings(page))).toEqual(t)
          expect(t.cells).toHaveLength(cols * rows)
          for (const cell of t.cells) expect(cell.startsWith(`${tiles}/`)).toBe(true)
          const kindAt = (c: number, r: number) => (c < 0 || r < 0 || c >= cols || r >= rows ? 'edge' : t.cells[r * cols + c]!.split('/')[1]!.split('-')[0]!)
          const maskAt = (c: number, r: number) => Number(t.cells[r * cols + c]!.split('-').pop())
          for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (kindAt(c, r) !== 'path') continue
            const m = maskAt(c, r)
            for (const [bit, dc, dr] of [[N, 0, -1], [E, 1, 0], [S, 0, 1], [W, -1, 0]] as const) {
              const n = kindAt(c + dc, r + dr)
              expect(Boolean(m & bit)).toBe(n === 'path' || n === 'edge')
            }
          }
          // Roads never close a 2 × 2 block: the path tiles can't draw one (uma-platform D90).
          for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) {
            const square = [kindAt(c, r), kindAt(c + 1, r), kindAt(c, r + 1), kindAt(c + 1, r + 1)]
            expect(square.every((k) => k === 'path'), `a 2 × 2 of road at ${c},${r}`).toBe(false)
          }
          // Every place's door is a path cell that reaches the map edge through paths.
          const seen = new Set<string>()
          const queue: [number, number][] = []
          for (let c = 0; c < cols; c++) for (const r of [0, rows - 1]) if (kindAt(c, r) === 'path') queue.push([c, r])
          while (queue.length) {
            const [c, r] = queue.pop()!
            const key = `${c},${r}`
            if (seen.has(key) || kindAt(c, r) !== 'path') continue
            seen.add(key)
            queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1])
          }
          for (const p of places(page)) {
            const { col, row } = t.footprints[p.id]!
            expect(row, `${p.id} stands on the map`).toBeGreaterThanOrEqual(2)
            expect(seen.has(`${col},${row + 1}`), `${p.id}'s door`).toBe(true)
          }
          // Buildings never share a tile.
          const covered = new Set<string>()
          for (const p of places(page)) {
            const { col, row } = t.footprints[p.id]!
            for (let c = col - 1; c <= col + 1; c++) for (let r = row - 2; r <= row; r++) {
              expect(covered.has(`${c},${r}`), `${p.id} at ${c},${r}`).toBe(false)
              covered.add(`${c},${r}`)
            }
          }
          for (const prop of t.props) {
            expect(kindAt(prop.col, prop.row)).toBe('ground')
            if (prop.tall) expect(kindAt(prop.col, prop.row - 1)).toBe('ground')
            expect(covered.has(`${prop.col},${prop.row}`)).toBe(false)
          }
          expect(t.props.length).toBeGreaterThan(3)
        })
      }
    }
  }

  it('lays each page its own way, Racing included on borrowed tiles', () => {
    const cells = (page: HubPage) => layTerrain(page, 'town', places(page), 17, 27).cells.join()
    expect(new Set(HUB_PAGES.map(cells)).size).toBe(4)
  })
})

describe('Hub art in the pinned uma-art (P38)', () => {
  it('has every ground, path and prop frame each page draws with, and every building but those awaiting art', () => {
    for (const page of HUB_PAGES) {
      const tiles = tilePageFor(page, TILES)
      for (const n of [0, 1, 2, 3]) expect(TILES[`${tiles}/ground-${n}`], `${tiles}/ground-${n}`).toBeDefined()
      for (let m = 0; m < 16; m++) expect(TILES[`${tiles}/path-${m}`], `${tiles}/path-${m}`).toBeDefined()
      for (const prop of PROPS[tiles]) {
        expect(TILES[`${tiles}/${prop.id}`], `${tiles}/${prop.id}`).toMatchObject({ w: 16, h: prop.tall ? 32 : 16 })
      }
      for (const [cols, rows] of SIZES) for (const f of layTerrain(page, tiles, places(page), cols, rows, clearings(page)).cells) expect(TILES[f], f).toBeDefined()
      for (const place of placesOn(page)) {
        if (AWAITING_ART.includes(place.frame!)) expect(BUILDINGS[place.frame!], `${place.frame} is drawn now`).toBeUndefined()
        else expect(BUILDINGS[place.frame!], place.id).toBeDefined()
      }
    }
  })

  it('smokes only from a chimney the atlas marks: the Kitchen today', () => {
    const smoking = HUB_PAGES.flatMap((page) => placesOn(page)).filter((place) => BUILDINGS[place.frame!]?.smoke !== undefined).map((place) => place.id)
    expect(smoking).toEqual(['kitchen'])
  })
})
