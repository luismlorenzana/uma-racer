// Page swipes on the Hub map (docs/game/11-hub-and-places.md §1; ported from uma-rpg's `hub/swipe.ts`): a mostly
// horizontal drag of more than 60 px changes page, in the bottom bar's order, without wrapping. The last page viewed is
// remembered by the start rule (`app/start.ts`).
import { HUB_PAGES, type HubPage } from '@racer/domain/hub'

export interface Point {
  readonly x: number
  readonly y: number
}

export const SWIPE_MIN_PX = 60

/** -1 = previous page (finger moved right), 1 = next page (moved left), 0 = not a swipe. */
export function swipeDirection(start: Point, end: Point): -1 | 0 | 1 {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0
  if (Math.abs(dx) <= SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return 0
  return dx < 0 ? 1 : -1
}

/** The neighbouring page, or null at either end. */
export function neighbourPage(page: HubPage, direction: -1 | 1): HubPage | null {
  return HUB_PAGES[HUB_PAGES.indexOf(page) + direction] ?? null
}
