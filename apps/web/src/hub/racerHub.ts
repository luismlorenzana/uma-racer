// uma-racer's Hub as uma-kit's map draws it (docs/game/11-hub-and-places.md §1, §10.2; T147, T152): which uma-art tile
// page and palette each racer page stands on, and the Town Hall plaza's crowd (SA7). Pure, so the props the map takes
// are tested without it.
import { PALETTES, type PageGround } from '@luismlorenzana/uma-kit/hub'
import type { HubPage } from '@racer/domain/hub'

/** uma-art's tile pages the racer's Hub draws with. */
export type TilePage = 'town' | 'learning'

/** Each racer page's own tile page (§10.2): Town Hall on the town's, Career on the Training page's old `learning` ground. */
export const TILE_PAGES: Readonly<Record<HubPage, TilePage>> = { town: 'town', career: 'learning' }

/** A racer page's ground: seeded by the page's own id, on its tile page, in that tile page's palette and props. */
export const pageGround = (page: HubPage): PageGround => ({
  id: page,
  tiles: TILE_PAGES[page],
  palette: PALETTES[TILE_PAGES[page]]!,
})

/** How many stand in the Town Hall plaza's crowd: uma-kit's `CROWD_SPOTS` (SA7). */
export const PLAZA_CROWD = 5

/** The Town Hall plaza's crowd (§5, SA7): the owned Umas, newest unlock first (the hub view's order); five at most. */
export const plazaCrowd = (owned: readonly string[]): string[] => owned.slice(0, PLAZA_CROWD)
