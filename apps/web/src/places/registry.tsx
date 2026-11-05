// What each place shows (docs/game/11-hub-and-places.md §1, §6; uma-rpg's `places/registry.tsx`): a Peek (the quick look
// over its page), a Page (its full screen) with sub-page slots, and an optional full-screen rule. Every body is a lazy
// chunk. Generation 3 starts with Account alone (T152); every other place opens the not-ready state (`Unfilled.tsx`)
// until its part of M036 fills its slot (T155 Training Yard, T156 Furlong Hand, T157 the Town Hall and Career places,
// T158 the race).
import type { Place, PlaceId } from '@racer/domain/hub'
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { matchPath } from 'react-router'

export type Lazy<P> = LazyExoticComponent<ComponentType<P>>
export type RouteParams = Readonly<Record<string, string | undefined>>

export interface PeekProps {
  readonly place: Place
}

export interface PageProps {
  readonly place: Place
  /** The sub-route inside the place, e.g. `outfit/uma-1`; empty at its root. */
  readonly rest: string
}

export interface SubPageProps extends PageProps {
  /** The sub-page pattern's params, e.g. `{ umaId }` for `outfit/:umaId`. */
  readonly params: RouteParams
}

export interface PlaceUi {
  readonly Peek?: Lazy<PeekProps>
  readonly Page?: Lazy<PageProps>
  /**
   * Sub-routes owned by another part than the Page's, by `rest` pattern (`outfit/:umaId`), so one part can own a
   * sub-route of another's place. The first pattern that matches renders instead of the Page.
   */
  readonly subPages?: Readonly<Record<string, Lazy<SubPageProps>>>
  /** True where `rest` is a full-screen flow that hides both bars (§6). */
  readonly fullScreen?: (rest: string) => boolean
}

export const PLACE_UI: Readonly<Partial<Record<PlaceId, PlaceUi>>> = {
  account: { Page: lazy(() => import('./account/Page')) },
  // The stage hosts, full screen: practice until the career screens (T158) open them for a season.
  'training-yard': { Page: lazy(() => import('./training-yard/Page')), fullScreen: () => true },
  'furlong-hand': { Page: lazy(() => import('./furlong-hand/Page')), fullScreen: () => true },
}

/** The sub-page `rest` names, if any, with its params. */
export function matchSubPage(ui: PlaceUi | undefined, rest: string): { readonly Page: Lazy<SubPageProps>; readonly params: RouteParams } | null {
  for (const [pattern, Page] of Object.entries(ui?.subPages ?? {})) {
    const match = matchPath({ path: `/${pattern}`, end: true }, `/${rest}`)
    if (match !== null) return { Page, params: match.params }
  }
  return null
}

export const isFullScreen = (place: Place | undefined, rest: string): boolean =>
  place !== undefined && PLACE_UI[place.id]?.fullScreen?.(rest) === true
