// Today's routes, sent to the new ones (docs/rework/11-hub-and-places.md §7.2): the router makes each row a
// `<Navigate replace>` that carries its params and search. DELETED WITH PHASE 4: the redirects ship with phase 3 and
// leave with the next phase that ships, by when the installed app, bookmarks and notification links all use the new
// paths (§7.2's rule). Deleted paths need no row: they fall to `/` through the route rules (a page that isn't one, or a
// place not on its page), so `/training/:umaId`, the minigames, `/rpg/*`, `/puzzles/*`, today's `/dev/*` proofs and the
// card reveal all land on the start rule. `/cards/redeem` is listed only so `/cards/:cardId` can't catch it.

export interface RedirectRow {
  /** Today's path, with its params. */
  readonly from: string
  /** The new path; its params are filled from `from`'s. `/` drops the search: the start rule reads none. */
  readonly to: string
}

export const REDIRECTS: readonly RedirectRow[] = Object.freeze([
  { from: '/stable', to: '/town/stable' },
  { from: '/stable/:umaId', to: '/town/stable/outfit/:umaId' },
  { from: '/stable/:umaId/skills', to: '/town/stable/outfit/:umaId/skills' },
  { from: '/stable/:umaId/deck', to: '/training/dojo/:umaId' },
  { from: '/scenario/:umaId/start', to: '/racing/scenario-gate/:umaId' },
  { from: '/race', to: '/racing/racecourse' },
  { from: '/race/run', to: '/racing/racecourse/run' },
  { from: '/cards', to: '/town/card-library' },
  { from: '/cards/redeem', to: '/' },
  { from: '/cards/:cardId', to: '/town/card-library/card/:cardId' },
  { from: '/badges', to: '/racing/trophy-hall' },
  { from: '/trainer', to: '/racing/trophy-hall/trainer' },
  { from: '/settings', to: '/town/account' },
  { from: '/constellation/:umaId', to: '/training/observatory/:umaId' },
  { from: '/constellation/:umaId/cards', to: '/training/dojo/:umaId' },
  { from: '/constellation/:umaId/inspiration', to: '/training/lineage-hall/:umaId' },
  { from: '/constellation/:umaId/extra-stats', to: '/training/gym/:umaId' },
  { from: '/farm/district/:districtId', to: '/farm' },
  { from: '/farm/crew', to: '/town/stable' },
  { from: '/farm/recipes', to: '/farm/kitchen' },
  { from: '/farm/wishlist', to: '/town/stable/needs' },
  { from: '/farm/items', to: '/town/warehouse' },
])

/** `to` with `from`'s params filled in. */
export function redirectPath(to: string, params: Readonly<Record<string, string | undefined>>): string {
  return to.replace(/:(\w+)/g, (_, name: string) => encodeURIComponent(params[name] ?? ''))
}
