// How the shell moves (docs/game/11-hub-and-places.md §1, §2): every place is a link, so Back and the iPhone's edge
// swipe work everywhere. A Peek is `/:page?peek=:place` and the menu `?sheet=menu` on the route it opens over, so Back
// closes either. uma-kit's `withParam`, `useLeave`, `navState` and `peekPath` move between them (an entry pushed from
// inside the app carries `back`, and leaving it pops history); this file holds what is uma-racer's own: its global sheets.

export const GLOBAL_SHEETS = Object.freeze(['menu'] as const)
export type GlobalSheet = (typeof GLOBAL_SHEETS)[number]

export const isGlobalSheet = (value: string | null): value is GlobalSheet => (GLOBAL_SHEETS as readonly string[]).includes(value ?? '')
