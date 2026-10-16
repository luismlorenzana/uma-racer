// The Hub's ground as a tile grid (docs/game/11-hub-and-places.md §10.2; ported from uma-rpg's `hub/scene/terrain.ts`,
// its D61 and D64): seeded ground variants, a trunk road down the middle, a branch path from every place's door to it,
// and props scattered on free ground away from paths, buildings and label rows. Pure, so the same page always lays out
// the same way; the scene only draws what this returns. Frame ids follow uma-art's `tiles` atlas (`<tiles>/ground-<n>`,
// `<tiles>/path-<mask>`, `<tiles>/<prop>`), on the tile page each racer page draws with (`tilePageFor`).
import type { HubPage, PlaceAt } from '@racer/domain/hub'
import { placeCell } from '../grid'

/** Connection bits for path masks; a map edge counts as connected. */
export const N = 1, E = 2, S = 4, W = 8

/** uma-art's tile pages the Hub draws with. */
export type TilePage = 'town' | 'learning' | 'farmlands' | 'racing'

/** Each racer page's own tile page (§10.2). */
export const TILE_PAGES: Readonly<Record<HubPage, TilePage>> = { town: 'town', training: 'learning', racing: 'racing', farm: 'farmlands' }

/**
 * The tile page a racer page draws with: its own, except that Racing borrows Town's ground until the pinned atlas draws
 * `racing/ground-0` (A01, uma-art 2.6.0), and switches by itself once it does.
 */
export function tilePageFor(page: HubPage, frames: Readonly<Record<string, unknown>>): TilePage {
  const own = TILE_PAGES[page]
  return own === 'racing' && frames['racing/ground-0'] === undefined ? 'town' : own
}

/** Each tile page's props: uma-rpg's lists, and A01's for Racing. Tall ones are 16 × 32 and stand one row up. */
export const PROPS: Readonly<Record<TilePage, readonly { readonly id: string; readonly tall: boolean }[]>> = {
  farmlands: [{ id: 'bush', tall: false }, { id: 'flowers-a', tall: false }, { id: 'flowers-b', tall: false }, { id: 'hay-bale', tall: false }, { id: 'tree', tall: true }, { id: 'rock', tall: false }],
  learning: [{ id: 'lamp', tall: true }, { id: 'hedge', tall: false }, { id: 'bench', tall: false }, { id: 'banner', tall: true }, { id: 'flower-bed', tall: false }],
  town: [{ id: 'lamp', tall: true }, { id: 'barrel', tall: false }, { id: 'crate', tall: false }, { id: 'flower-pot', tall: false }, { id: 'bench', tall: false }, { id: 'tree', tall: true }],
  racing: [{ id: 'rail', tall: false }, { id: 'furlong-post', tall: true }, { id: 'pennant', tall: true }, { id: 'flower-box', tall: false }],
}

export interface TerrainPlace {
  readonly id: string
  readonly at: PlaceAt
}

export interface Terrain {
  readonly cols: number
  readonly rows: number
  /** One frame id per cell, row by row: ground or path. */
  readonly cells: readonly string[]
  /** Props, bottom-left cell; tall ones take the cell above too. */
  readonly props: readonly { readonly col: number; readonly row: number; readonly frame: string; readonly tall: boolean }[]
  /** Each place's footprint: columns c−1…c+1 and rows r−2…r. */
  readonly footprints: Readonly<Record<string, { readonly col: number; readonly row: number }>>
}

function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** The page's seed: its own, so Racing on Town's tiles still lays out its own ground. */
export const pageSeed = (page: HubPage): number => page.length * 31 + page.charCodeAt(0)

/**
 * Lays one page's ground. `clearings` are spots kept free of props without a building (the Town Hall plaza, where the
 * featured Uma stands).
 */
export function layTerrain(page: HubPage, tiles: TilePage, places: readonly TerrainPlace[], cols: number, rows: number, clearings: readonly PlaceAt[] = []): Terrain {
  const seed = pageSeed(page)
  const kind: ('ground' | 'path' | 'block' | 'clear')[] = Array.from({ length: cols * rows }, () => 'ground')
  const at = (c: number, r: number) => (c >= 0 && r >= 0 && c < cols && r < rows ? kind[r * cols + c] : undefined)
  const set = (c: number, r: number, k: (typeof kind)[number], over: readonly string[] = ['ground', 'clear']) => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return
    if (over.includes(kind[r * cols + c]!)) kind[r * cols + c] = k
  }
  const footprints: Record<string, { col: number; row: number }> = {}
  for (const p of places) {
    const cell = placeCell(p.at, cols, rows)
    footprints[p.id] = cell
    for (let c = cell.col - 1; c <= cell.col + 1; c++) for (let r = cell.row - 2; r <= cell.row; r++) set(c, r, 'block', ['ground', 'clear', 'path'])
  }
  // One road down the middle. No cross road: place rows sit too close together, so it would run into buildings and
  // double up beside their doors (uma-rpg D64).
  const trunk = Math.floor(cols / 2)
  for (let r = 0; r < rows; r++) set(trunk, r, 'path')
  // Branches: from each place's door (the cell below its footprint) to the trunk.
  for (const p of places) {
    const { col, row } = footprints[p.id]!
    const door = row + 1
    if (door >= rows) continue
    const step = trunk >= col ? 1 : -1
    for (let c = col; c !== trunk + step; c += step) set(c, door, 'path')
  }
  // A building standing on the road (the Scenario Gate and Racecourse, the Pantry and Kitchen) gets a lane round one side
  // of it, from the road above its roof down to its door, so the road still runs from edge to edge. A lane joins a road
  // it meets instead of doubling it, and is never laid where it would close a 2 × 2 of road (uma-platform D90), which
  // the path tiles can't draw. uma-rpg's pages put at most one building on the road and need none.
  const isPath = (c: number, r: number) => at(c, r) === 'path'
  const closesSquare = (c: number, r: number) => [[-1, -1], [0, -1], [-1, 0], [0, 0]].some(([dc, dr]) =>
    [[0, 0], [1, 0], [0, 1], [1, 1]].every(([ec, er]) => {
      const cc = c + dc! + ec!
      const rr = r + dr! + er!
      return (cc === c && rr === r) || isPath(cc, rr)
    }))
  for (const p of places) {
    const { col, row } = footprints[p.id]!
    if (col !== trunk) continue
    const top = row - 3
    const bottom = row + 1
    for (const side of hash(col, row, seed) < 0.5 ? [-1, 1] : [1, -1]) {
      const lane = col + side * 2
      // Down the lane to the door row, then in to the door; in from the road above the roof, unless the lane meets a
      // road there already.
      const joined = isPath(lane, top - 1)
      const route: [number, number][] = joined ? [] : [[col + side, top]]
      for (let r = top; r <= bottom; r++) route.push([lane, r])
      route.push([col + side, bottom])
      const onMap = route.filter(([c, r]) => c >= 0 && r >= 0 && c < cols && r < rows)
      if (onMap.some(([c, r]) => at(c, r) === 'block')) continue
      const laid: [number, number][] = []
      let closed = false
      for (const [c, r] of onMap) {
        if (isPath(c, r)) continue
        if (closesSquare(c, r)) {
          closed = true
          break
        }
        set(c, r, 'path')
        laid.push([c, r])
      }
      if (!closed) break
      for (const [c, r] of laid) kind[r * cols + c] = 'ground'
    }
  }
  // Keep each place's label rows clear of props: its name pill and up to two rows of pips hang under the door.
  for (const p of places) {
    const { col, row } = footprints[p.id]!
    for (let c = col - 2; c <= col + 2; c++) for (let r = row + 1; r <= row + 3; r++) set(c, r, 'clear')
  }
  for (const spot of clearings) {
    const { col, row } = placeCell(spot, cols, rows)
    for (let c = col - 2; c <= col + 2; c++) for (let r = row - 3; r <= row + 2; r++) set(c, r, 'clear')
  }
  // Paths at the map's edge run on off the map.
  const mask = (c: number, r: number) => {
    const same = (cc: number, rr: number) => {
      const v = at(cc, rr)
      return v === undefined ? true : v === 'path'
    }
    return (same(c, r - 1) ? N : 0) | (same(c + 1, r) ? E : 0) | (same(c, r + 1) ? S : 0) | (same(c - 1, r) ? W : 0)
  }
  const cells: string[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (kind[r * cols + c] === 'path') cells.push(`${tiles}/path-${mask(c, r)}`)
      else {
        const v = hash(c, r, seed)
        cells.push(`${tiles}/ground-${v < 0.62 ? 0 : v < 0.82 ? 1 : v < 0.92 ? 2 : 3}`)
      }
    }
  }
  // Props: on plain ground away from paths and buildings, about one cell in eight.
  const props: { col: number; row: number; frame: string; tall: boolean }[] = []
  const free = (c: number, r: number) => at(c, r) === 'ground'
  const nearBusy = (c: number, r: number) => {
    for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
      const v = at(c + dc, r + dr)
      if (v === 'block' || (v === 'path' && dc === 0 && dr === 0)) return true
    }
    return false
  }
  const list = PROPS[tiles]
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!free(c, r) || nearBusy(c, r) || hash(c, r, seed + 7) > 0.12) continue
      const prop = list[Math.floor(hash(c, r, seed + 13) * list.length)]!
      if (prop.tall && (!free(c, r - 1) || nearBusy(c, r - 1))) continue
      if (props.some((p) => Math.abs(p.col - c) <= 1 && Math.abs(p.row - r) <= 1)) continue
      props.push({ col: c, row: r, frame: `${tiles}/${prop.id}`, tall: prop.tall })
    }
  }
  return { cols, rows, cells, props, footprints }
}
