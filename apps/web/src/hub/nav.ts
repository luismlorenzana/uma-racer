// How the shell moves (docs/game/11-hub-and-places.md §1, §2): every place is a link, so Back and the iPhone's edge
// swipe work everywhere. A Peek is `/:page?peek=:place` and a global sheet `?sheet=…` on the route it opens over, so
// Back closes either. uma-kit's `withParam`, `useLeave`, `navState` and `peekPath` move between them (an entry pushed
// from inside the app carries `back`, and leaving it pops history); this file holds what is uma-racer's own: the global
// sheets and the check-in sheet's navigation state.
import type { KitNavState } from '@luismlorenzana/uma-kit/shell'

export interface G2NavState extends KitNavState {
  /** Collect all's intent for the check-in sheet (T142); a reload never collects again. */
  readonly collect?: boolean
  /** The check-in sheet's Collect all, once it ran: its receipt is the summary's, on a reload too (T142). */
  readonly collectId?: string
  /** The check-in sheet's latest Repeat all, the same way (T142). */
  readonly repeatId?: string
}

export const GLOBAL_SHEETS = Object.freeze(['menu', 'featured', 'check-in'] as const)
export type GlobalSheet = (typeof GLOBAL_SHEETS)[number]

export const isGlobalSheet = (value: string | null): value is GlobalSheet => (GLOBAL_SHEETS as readonly string[]).includes(value ?? '')
