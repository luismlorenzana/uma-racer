// The Farm's eight families and what each one feeds (docs/game/08-item-catalogue-and-recipes.md §2, §4.2, D330, D374):
// uma-rpg's farming half on uma-art's Duo ring. The five stat families make meals for their stat; Vegetables,
// Mushrooms and Grains make tonics. Each family's planet dishes keep the destination they were cooked for: the three
// tonic families' salads, soups and breads are retired (D374).
import type { StatKey } from '../types'

/** The eight families in 08 §2's order. */
export const FAMILY_IDS = ['sweets', 'fruits', 'fish', 'nuts-seeds', 'herbs-spices', 'grains', 'vegetables', 'mushrooms'] as const
export type FamilyId = (typeof FAMILY_IDS)[number]

/**
 * Where a family's planet dishes go: a stat's Gym room, or, for the retired salads, soups and breads, the unlock they
 * were cooked for before D374 (a constellation node, an Inspiration unlock, a Friend or Group bond).
 */
export type Destination = StatKey | 'skill' | 'constellation' | 'inspiration'

/** What a family's crafted items feed (D374): its stat's meals, or tonics. */
export type Feeds = StatKey | 'tonic'

export interface Family {
  readonly id: FamilyId
  readonly name: string
  readonly destination: Destination
  readonly feeds: Feeds
  /** The style of its planet dishes (08 §2), e.g. Cakes. */
  readonly dishStyle: string
}

/** The destinations whose families make tonics since D374. */
const RETIRED_DESTINATIONS: readonly Destination[] = ['skill', 'constellation', 'inspiration']

const family = (id: FamilyId, name: string, destination: Destination, dishStyle: string): Family => Object.freeze({
  id, name, destination, dishStyle,
  feeds: RETIRED_DESTINATIONS.includes(destination) ? 'tonic' : (destination as StatKey),
})

/** Every family by id, in `FAMILY_IDS` order (08 §2). */
export const FAMILIES: Readonly<Record<FamilyId, Family>> = Object.freeze({
  sweets: family('sweets', 'Sweets', 'speed', 'Cakes'),
  fruits: family('fruits', 'Fruits', 'stamina', 'Tarts'),
  fish: family('fish', 'Fish', 'power', 'Grills'),
  'nuts-seeds': family('nuts-seeds', 'Nuts & Seeds', 'guts', 'Cookies'),
  'herbs-spices': family('herbs-spices', 'Herbs & Spices', 'wit', 'Curries'),
  grains: family('grains', 'Grains', 'skill', 'Breads'),
  vegetables: family('vegetables', 'Vegetables', 'constellation', 'Salads'),
  mushrooms: family('mushrooms', 'Mushrooms', 'inspiration', 'Soups'),
})

/** A tonic's three families, in its recipe's order (08 §4, D374): one crafted item of each at the tonic's grade. */
export const TONIC_FAMILIES: readonly FamilyId[] = Object.freeze(['vegetables', 'mushrooms', 'grains'] as const)

/** uma-art's Duo ring (08 §2): each family's neighbours; the last joins the first. */
export const FAMILY_RING: readonly FamilyId[] = Object.freeze(
  ['grains', 'vegetables', 'mushrooms', 'fruits', 'herbs-spices', 'fish', 'sweets', 'nuts-seeds'] as const,
)

/**
 * The stat families in the stat row's order, Stamina – Wit – Power – Speed – Guts (08 §4.2 rule 2): the cycle stat
 * dishes' sides walk around, and the order Grains dishes take their sides in.
 */
export const STAT_CYCLE: readonly FamilyId[] = Object.freeze(['fruits', 'herbs-spices', 'fish', 'sweets', 'nuts-seeds'] as const)

const BY_DESTINATION = new Map<Destination, FamilyId>(FAMILY_IDS.map((id) => [FAMILIES[id].destination, id]))

/** The one family whose planet dishes go to `destination`. */
export function familyFor(destination: Destination): FamilyId {
  const id = BY_DESTINATION.get(destination)
  if (id === undefined) throw new RangeError(`No family feeds ${destination}`)
  return id
}
