// What each place shows (docs/game/11-hub-and-places.md §1, §5, §6; uma-rpg's `places/registry.tsx`): a Peek (the
// quick look over its page), a Page (its full screen) with sub-page slots, an optional full-screen rule, and an optional
// counter hook. Every body is a lazy chunk. T137 fills none of them; the place tasks do (T138 Town Hall's places, the
// plaza, the featured sheet and the reveal; T139 the facilities; T140 the Farm; T141 Racing; T142 the check-in sheet
// and the Needs sub-pages), each emptying its part of `PENDING`, which T143 requires empty. An unfilled slot shows the
// place's name, its blurb behind (i) and Enter.
import { placesOn, type Place, type PlaceId } from '@racer/domain/hub'
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { matchPath } from 'react-router'
import { RACING_UI } from './racing/ui'

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

// T140: the ten Farm buildings share one Page (07 §10's building page with its job sheet) and one Peek (§3.4); their
// Counter is the hub view's `finished-here`. Read from the registry, so the entry holds no Farm rule.
const FarmPage = lazy(() => import('./farm/building/BuildingPage'))
const FarmPeek = lazy(() => import('./farm/building/BuildingPeek'))
const FARM_UI: Readonly<Partial<Record<PlaceId, PlaceUi>>> = Object.fromEntries(placesOn('farm').map((place) => [place.id, { Page: FarmPage, Peek: FarmPeek }]))

// T142: the planner's roster view lives under the Stable (11 §7.1); her Needs tab is the profile's `PROFILE_UI.Needs`.
const NEEDS_PAGES: PlaceUi['subPages'] = {
  needs: lazy(() => import('./needs/RosterNeeds')),
}

// T139: the Training page's four facilities.
const TrainingPage = lazy(() => import('./training/Page'))
const TrainingPeek = lazy(() => import('./training/Peek'))

export const PLACE_UI: Readonly<Partial<Record<PlaceId, PlaceUi>>> = {
  // T139: the four facilities share one Page (the facility page, its session sheet and each Uma's build view at
  // `:umaId`) and one Peek. §6's full-screen flows inside place routes: the constellation tree and the Extra Stats map;
  // the race run and result and the Scenario Gate's ceremony are the Racing page's (T141).
  observatory: { Page: TrainingPage, Peek: TrainingPeek, fullScreen: oneSegment },
  'lineage-hall': { Page: TrainingPage, Peek: TrainingPeek },
  gym: { Page: TrainingPage, Peek: TrainingPeek, fullScreen: oneSegment },
  dojo: { Page: TrainingPage, Peek: TrainingPeek },
  ...FARM_UI,
  ...RACING_UI, // T141
  // T138: the Town Hall's places. The Stable's Page holds the roster and each profile (`outfit/:umaId`, `/skills`,
  // `/needs`, whose tab is T142's); T142's roster view is its `needs` sub-page. The Card Library's holds each card page.
  stable: { Peek: lazy(() => import('./stable/Peek')), Page: lazy(() => import('./stable/Page')), subPages: NEEDS_PAGES },
  warehouse: { Peek: lazy(() => import('./warehouse/Peek')), Page: lazy(() => import('./warehouse/Page')) },
  exchange: { Peek: lazy(() => import('./exchange/Peek')), Page: lazy(() => import('./exchange/Page')) },
  'card-library': { Peek: lazy(() => import('./card-library/Peek')), Page: lazy(() => import('./card-library/Page')) },
  account: { Page: lazy(() => import('./account/Page')) },
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
} = {
  featured: lazy(() => import('./stable/Featured').then((mod) => ({ default: mod.FeaturedSheet }))),
  'check-in': lazy(() => import('./check-in/CheckInSheet')), // T142
}

/** The Town Hall plaza's cell (§5): T138's `FeaturedUmaCard`. It opens `?sheet=featured` itself. */
export interface PlazaProps {
  readonly umaId: string | null
}

export const TOWN_PLAZA: { readonly Card?: Lazy<PlazaProps> } = {
  Card: lazy(() => import('./stable/Featured').then((mod) => ({ default: mod.FeaturedUmaCard }))),
}

/** A full-screen flow outside the shell: `/collection/reveal/uma/:umaId` (T138). */
export interface FlowProps {
  readonly params: RouteParams
}

export const FLOW_UI: { readonly reveal?: Lazy<FlowProps> } = {
  reveal: lazy(() => import('./reveal/Reveal')),
}

/**
 * The Uma profile's slots (T138's profile, 11 §3.1): T142 fills its header's target toggle and its Needs tab
 * (`/town/stable/outfit/:umaId/needs`) with the planner's views.
 */
export interface ProfileSlotProps {
  readonly umaId: string
}

export const PROFILE_UI: { readonly TargetToggle?: Lazy<ProfileSlotProps>; readonly Needs?: Lazy<ProfileSlotProps> } = {
  TargetToggle: lazy(() => import('./needs/TargetToggle')), // T142
  Needs: lazy(() => import('./needs/NeedsTab')), // T142
}

export type SlotId = PlaceId | 'sheet:check-in' | 'sheet:featured' | 'plaza' | 'flow:reveal'

/**
 * Slots still waiting for their task. A place leaves once it has a Page and, unless it is `direct` or `hidden`, a
 * Peek; a sheet, the plaza or the reveal once it is set. The registry test holds both directions.
 */
export const PENDING: readonly SlotId[] = Object.freeze([] as const)

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
