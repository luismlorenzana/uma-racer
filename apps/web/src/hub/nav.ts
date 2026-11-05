// How the shell moves (docs/game/11-hub-and-places.md §1, §2): every place is a link, so Back and the iPhone's edge
// swipe work everywhere. A Peek is `/:page?peek=:place` and the menu `?sheet=menu` on the route it opens over, so Back
// closes either. uma-kit's `withParam`, `useLeave`, `navState` and `peekPath` move between them (an entry pushed from
// inside the app carries `back`, and leaving it pops history); this file holds what is uma-racer's own: its global
// sheets and the paths into the places' sub-pages (D386), the career's own included (D387).

export const GLOBAL_SHEETS = Object.freeze(['menu'] as const)
export type GlobalSheet = (typeof GLOBAL_SHEETS)[number]

export const isGlobalSheet = (value: string | null): value is GlobalSheet => (GLOBAL_SHEETS as readonly string[]).includes(value ?? '')

/** The Stable's and the Card Library's two tabs. */
export type OwnershipTab = 'owned' | 'locked'

/** The Stable, on a tab: `/town/stable?tab=locked`. */
export const stablePath = (tab?: OwnershipTab): string => `/town/stable${tab === undefined ? '' : `?tab=${tab}`}`

/** An Uma's profile in the Stable. */
export const profilePath = (umaId: string): string => `/town/stable/outfit/${encodeURIComponent(umaId)}`

/** The Card Library, on a tab. */
export const libraryPath = (tab?: OwnershipTab): string => `/town/card-library${tab === undefined ? '' : `?tab=${tab}`}`

/** A card's page in the Card Library. */
export const cardPath = (cardId: string): string => `/town/card-library/card/${encodeURIComponent(cardId)}`

/** Every career, in the Careers place. */
export const CAREERS_PATH = '/career/careers'

/** One career (`{umaId}:{T}`), in the Careers place. */
export const careerPath = (careerId: string): string => `${CAREERS_PATH}/${encodeURIComponent(careerId)}`

/** The Upgrade screen's four tabs (D387). */
export const UPGRADE_TABS = Object.freeze(['tree', 'deck', 'bonds', 'skills'] as const)
export type UpgradeTab = (typeof UPGRADE_TABS)[number]
export const isUpgradeTab = (value: string | null): value is UpgradeTab => (UPGRADE_TABS as readonly string[]).includes(value ?? '')

/** A career's Upgrade screen, on a tab. */
export const upgradePath = (careerId: string, tab?: UpgradeTab): string =>
  `${careerPath(careerId)}/upgrade${tab === undefined ? '' : `?tab=${tab}`}`

/** The two career games, as a play's route names them. */
export type PlayKind = 'training-yard' | 'furlong-hand'
export const isPlayKind = (value: string | undefined): value is PlayKind => value === 'training-yard' || value === 'furlong-hand'

/** A career's play of a game, full screen: the season's Play, or Play again from the career's header. */
export const playPath = (careerId: string, kind: PlayKind): string => `${careerPath(careerId)}/play/${kind}`

/** A career race's run and result, full screen, by its operation's id. */
export const racePath = (careerId: string, operationId: string): string => `${careerPath(careerId)}/race/${encodeURIComponent(operationId)}`
