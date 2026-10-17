// uma-racer's Hub as uma-kit's map draws it (docs/game/11-hub-and-places.md §1, §4, §10.2; T147): which uma-art tile
// page and palette each racer page stands on, a building's slot pips with the Gym's and Dojo's room colours, and the
// Town Hall plaza's crowd (SA7). Pure, so the props the map takes are tested without it.
import { PALETTES, type PageGround, type PipModel } from '@luismlorenzana/uma-kit/hub'
import type { RoomId } from '@racer/domain/farm'
import type { HubBuilding, HubPage } from '@racer/domain/hub'
import type { UmaState } from '@racer/domain/state'
import { lifetimeLevel } from '@racer/domain/tiers'
import type { ReactNode } from 'react'

/** uma-art's tile pages the racer's Hub draws with. */
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

/**
 * A racer page's ground: seeded by the page's own id (so Racing on borrowed tiles still lays out its own way), on its
 * tile page, in its own tile page's palette, with that tile page's props.
 */
export const pageGround = (page: HubPage, frames: Readonly<Record<string, unknown>>): PageGround => ({
  id: page,
  tiles: tilePageFor(page, frames),
  palette: PALETTES[TILE_PAGES[page]]!,
})

/** The Gym's stat rooms and the Dojo's Friend and Group room tint their pips' rings and dots (§4). */
export const ROOM_TONE: Readonly<Record<RoomId, string>> = {
  speed: 'var(--color-stat-speed)',
  stamina: 'var(--color-stat-stamina)',
  power: 'var(--color-stat-power)',
  guts: 'var(--color-stat-guts)',
  wit: 'var(--color-stat-wit)',
  'friend-group': 'var(--g2-room-friend)',
}

/** A building's pips for the map: busy and ready ones carry her face; every one in a room carries its colour. */
export function pipModels(building: HubBuilding, face: (outfitId: string) => ReactNode): PipModel[] {
  return building.pips.map((pip) => ({
    state: pip.state,
    progress: pip.progress,
    queued: pip.queued,
    face: pip.outfitId === null ? undefined : face(pip.outfitId),
    tone: pip.room === null ? undefined : ROOM_TONE[pip.room],
  }))
}

/** How many stand in the Town Hall plaza's crowd: uma-kit's `CROWD_SPOTS` (SA7). */
export const PLAZA_CROWD = 5

/**
 * The Town Hall plaza's crowd (§5, SA7): the featured Uma in front, then the Umas with the highest lifetime level,
 * newest release first, then name; five at most, fewer when fewer are owned. uma-racer has no parties, so the level rule
 * fills it (P48's level rule).
 */
export function plazaCrowd(
  umas: Readonly<Record<string, Pick<UmaState, 'outfitId' | 'tier' | 'racing'>>>,
  featured: string | null,
  about: (umaId: string) => { readonly name: string; readonly release: string },
): string[] {
  const rest = Object.values(umas)
    .filter((uma) => uma.outfitId !== featured)
    .map((uma) => ({ id: uma.outfitId, level: lifetimeLevel(uma.tier, uma.racing.level), ...about(uma.outfitId) }))
    .sort((a, b) => b.level - a.level || b.release.localeCompare(a.release) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((row) => row.id)
  const front = featured !== null && umas[featured] !== undefined ? [featured] : []
  return [...front, ...rest].slice(0, PLAZA_CROWD)
}
