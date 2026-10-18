// Bonds (docs/game/06-cards-and-bonds.md §2, D329, D374): a card enters an Uma's sets only once it is bonded to her, by
// one Dojo unlock that takes no item. Its grade follows the card's era within her tier, and sets the session's time: a
// card first eligible in the tier's scenario p takes grade 2p − 1, older eras counting as p = 1. Its Dojo room follows
// the card's type. Bondable when era ≤ T; any number; never undone; reset at promotion (T125's).
import type { SupportCardTemplate, SupportCardType } from '../content'
import type { ItemGrade } from '../items/catalogue'
import { LAST_SCENARIO_NUMBER, SCENARIOS_PER_TIER, scenarioRow } from '../tiers/map'
import type { Refusal, ScenarioOfTier, Tier, UmaBuild, UmaState } from '../state/types'
import { trainingRefusal } from './refusals'
import type { DojoRoomId } from './facilities'

/** What a bond reads of a card. */
export type BondCard = Pick<SupportCardTemplate, 'id' | 'type' | 'era'>

/** A card's type by id, from the content's cards: how a bond finds its Dojo room. */
export type CardTypeOf = (cardId: string) => SupportCardType | undefined

/** `CardTypeOf` over the content's cards. */
export const cardTypesIn = (cards: ReadonlyMap<string, Pick<SupportCardTemplate, 'type'>> | undefined): CardTypeOf =>
  (cardId) => cards?.get(cardId)?.type

/** The Dojo room by card type (05 §1): Friend and Group share one. */
export const dojoRoomOf = (type: SupportCardType): DojoRoomId => (type === 'friend' || type === 'group' ? 'friend-group' : type)

/** The scenario of `tier` in which a card of `era` is first eligible: max(1, era − 5(tier − 1)) (06 §2). */
export const bondLayer = (era: number, tier: Tier): number => Math.max(1, era - SCENARIOS_PER_TIER * (tier - 1))

/** The grade a bond with a card of `era` takes in `tier`: 2p − 1, or null when no scenario of the tier allows it. */
export function bondGrade(era: number, tier: Tier): ItemGrade | null {
  if (!Number.isInteger(era) || era < 1) throw new RangeError(`A card's era is a whole number ≥ 1: ${era}`)
  const p = bondLayer(era, tier)
  return p > SCENARIOS_PER_TIER ? null : ((2 * p - 1) as ItemGrade)
}

/** Refused for a card whose era is past the game's scenario T: it names the scenario that opens it (06 §2). */
export function cardEraRefusal(card: BondCard): Refusal {
  const row = scenarioRow(Math.min(card.era, LAST_SCENARIO_NUMBER))
  return trainingRefusal('card-era', { card: card.id, era: card.era, tier: row.tier, scenario: row.scenario, name: row.name })
}

export type BondStatus = { readonly status: 'bonded' | 'pending' | 'available' } | Refusal

/**
 * Whether `card` can be bonded to her at the game's scenario T: bonded already, in her work ahead, available, or
 * refused because its era is past T. `pending` is her work ahead, as unlock refs.
 */
export function bondStatus(
  build: Pick<UmaBuild, 'bonds'>,
  card: BondCard,
  T: number,
  pending: readonly { readonly kind: string; readonly target: string }[] = [],
): BondStatus {
  if (build.bonds.includes(card.id)) return { status: 'bonded' }
  if (pending.some((ref) => ref.kind === 'bond' && ref.target === card.id)) return { status: 'pending' }
  if (card.era > T) return cardEraRefusal(card)
  return { status: 'available' }
}

/** The scenario of the tier as a layer number, or null past the tier. */
export const bondLayerOfTier = (era: number, tier: Tier): ScenarioOfTier | null => {
  const p = bondLayer(era, tier)
  return p > SCENARIOS_PER_TIER ? null : (p as ScenarioOfTier)
}

/**
 * Every card ever bonded, to any Uma in any tier (06 §7, §9): the sorted union of each Uma's current bonds and the
 * bonds of every tier she left, which her tier history keeps. A projection, not a fact of its own, so it survives
 * promotion without a write (T141): the Trainer's Card Partners and the Era and Type Bonded one-offs read it.
 */
export function everBondedCardIds(umas: Iterable<Pick<UmaState, 'build' | 'tierHistory'>>): string[] {
  const ids = new Set<string>()
  for (const uma of umas) {
    for (const id of uma.build.bonds) ids.add(id)
    for (const entry of uma.tierHistory) for (const id of entry.bonds) ids.add(id)
  }
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}
