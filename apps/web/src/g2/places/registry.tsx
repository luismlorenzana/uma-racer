// What each place shows (docs/rework/11-hub-and-places.md §1, §5, §6; uma-rpg's `places/registry.tsx`): a Peek (the
// quick look over its page), a Page (its full screen) with sub-page slots, an optional full-screen rule, and an optional
// counter hook. Every body is a lazy chunk. T137 fills none of them; the place tasks do (T138 Town Hall's places, the
// plaza, the featured sheet and the reveal; T139 the facilities; T140 the Farm; T141 Racing; T142 the check-in sheet
// and the Needs sub-pages), each emptying its part of `PENDING`, which T143 requires empty. An unfilled slot shows the
// place's name, its blurb behind (i) and Enter.
import type { Place, PlaceId } from '@racer/domain/hub'
import type { ComponentType, LazyExoticComponent } from 'react'
import { matchPath } from 'react-router'

export type Lazy<P> = LazyExoticComponent<ComponentType<P>>
export type RouteParams = Readonly<Record<string, string | undefined>>

export interface PeekProps {
  readonly place: Place
}

export interface PageProps {
  readonly place: Place
  /** The sub-route inside the place, e.g. `outfit/sim-uma-01`; empty at its root. */
  readonly rest: string
}

export interface SubPageProps extends PageProps {
  /** The sub-page pattern's params, e.g. `{ umaId }` for `outfit/:umaId/needs`. */
  readonly params: RouteParams
}

export interface PlaceUi {
  readonly Peek?: Lazy<PeekProps>
  readonly Page?: Lazy<PageProps>
  /**
   * Sub-routes owned by another task than the Page's, by `rest` pattern (`needs`, `outfit/:umaId/needs`), so one task
   * can own a sub-route of another's place. The first pattern that matches renders instead of the Page.
   */
  readonly subPages?: Readonly<Record<string, Lazy<SubPageProps>>>
  /** True where `rest` is a full-screen flow that hides both bars (§6). */
  readonly fullScreen?: (rest: string) => boolean
  /**
   * The place's counter where the rework state can't give it (T141's Racecourse and Trophy Hall): a small hook outside
   * the lazy chunks. Null while unknown. The hub view's `counts` are every other place's.
   */
  readonly useCounter?: () => number | null
}

/** One path segment: an Uma's build view at a facility (`/training/observatory/:umaId`). */
const oneSegment = (rest: string): boolean => /^[^/]+$/.test(rest)

export const PLACE_UI: Readonly<Partial<Record<PlaceId, PlaceUi>>> = {
  // §6's full-screen flows inside place routes: the race run and result, the constellation tree and the Extra Stats map.
  racecourse: { fullScreen: (rest) => rest === 'run' || rest.startsWith('run/') },
  observatory: { fullScreen: oneSegment },
  gym: { fullScreen: oneSegment },
}

export interface SheetProps {
  readonly onClose: () => void
}

/** `?sheet=check-in` (T142): `collect` is Collect all's intent, from navigation state, so a reload never collects again. */
export interface CheckInSheetProps extends SheetProps {
  readonly collect: boolean
}

/** `?sheet=featured` (T138): the featured Uma's quick sheet (§5). */
export interface FeaturedSheetProps extends SheetProps {
  readonly umaId: string | null
}

export const SHEET_UI: {
  readonly 'check-in'?: Lazy<CheckInSheetProps>
  readonly featured?: Lazy<FeaturedSheetProps>
} = {}

/** The Town Hall plaza's cell (§5): T138's `FeaturedUmaCard`. It opens `?sheet=featured` itself. */
export interface PlazaProps {
  readonly umaId: string | null
}

export const TOWN_PLAZA: { readonly Card?: Lazy<PlazaProps> } = {}

/** A full-screen flow outside the shell: `/collection/reveal/uma/:umaId` (T138). */
export interface FlowProps {
  readonly params: RouteParams
}

export const FLOW_UI: { readonly reveal?: Lazy<FlowProps> } = {}

export type SlotId = PlaceId | 'sheet:check-in' | 'sheet:featured' | 'plaza' | 'flow:reveal'

/**
 * Slots still waiting for their task. A place leaves once it has a Page and, unless it is `direct` or `hidden`, a
 * Peek; a sheet, the plaza or the reveal once it is set. The registry test holds both directions.
 */
export const PENDING: readonly SlotId[] = Object.freeze([
  'stable', 'warehouse', 'exchange', 'card-library', 'account', 'plaza', 'sheet:featured', 'flow:reveal', // T138
  'observatory', 'lineage-hall', 'gym', 'dojo', // T139
  'sugar-grove', 'orchard', 'fishery', 'nut-grove', 'herb-garden', 'fields', 'vegetable-garden', 'mushroom-cave', 'pantry', 'kitchen', // T140
  'racecourse', 'scenario-gate', 'expedition-map', 'trophy-hall', // T141
  'sheet:check-in', // T142
] as const)

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
