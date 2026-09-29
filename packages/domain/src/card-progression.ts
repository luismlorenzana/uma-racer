// Stars, earned per scenario one clear at a time (docs/design/support-cards.md, D147, D200).

import { MAX_STARS } from './cards'
import { MAX_SCENARIO_TIER } from './scenarios'
import type { CardSave } from './save'

type Bonds = Pick<CardSave, 'bonds'>

export interface CardAdvanceResult {
  card: CardSave
  tier: number
  fromStars: number
  toStars: number
  /** True on the advance that first takes this card to max stars in any scenario. */
  couponGranted: boolean
}

/** A card's stars in one scenario. Absent means 0★ there (D127). */
export const cardStars = (card: Bonds, tier: number): number =>
  card.bonds[String(Math.trunc(tier))] ?? 0

/** The most stars this card holds in any scenario. */
export const bestCardStars = (card: Bonds): number =>
  Object.values(card.bonds).reduce((best, value) => Math.max(best, value), 0)

/** Scenarios where this card holds any stars, in tier order. */
export const brokenTiers = (card: Bonds): number[] =>
  Object.keys(card.bonds).map(Number).sort((left, right) => left - right)

export const isCardMaxedIn = (card: Bonds, tier: number): boolean =>
  cardStars(card, tier) >= MAX_STARS

/**
 * Cards at max stars somewhere whose Card Select Coupon was never paid. Ordinary play pays it on the clear that reaches
 * max; only the v8 migration can raise a card to max without one (D200), so this is where those coupons come from.
 */
export const owedMaxCouponCardIds = (cards: readonly (Bonds & Pick<CardSave, 'templateId' | 'maxCouponGranted'>)[]): string[] =>
  cards.filter((card) => !card.maxCouponGranted && bestCardStars(card) >= MAX_STARS).map((card) => card.templateId).sort()


/**
 * Advance one star in one scenario. The card minigame's run already charged its ticket, so this costs nothing further:
 * the clear *is* the star (D120, D147). Stars are account-wide within that scenario, so every Uma racing there gets them.
 */
export function advanceCardStars(card: CardSave, tier: number): CardAdvanceResult {
  if (!Number.isSafeInteger(tier) || tier < 1 || tier > MAX_SCENARIO_TIER) {
    throw new Error('Card stars belong to a scenario')
  }
  const from = cardStars(card, tier)
  if (!Number.isSafeInteger(from) || from < 0 || from > MAX_STARS) {
    throw new Error('Card progression state is invalid')
  }
  if (from >= MAX_STARS) throw new Error(`This card already has ${MAX_STARS}★ in that scenario`)

  const toStars = from + 1
  const couponGranted = toStars === MAX_STARS && !card.maxCouponGranted
  return {
    card: {
      ...card,
      bonds: { ...card.bonds, [String(tier)]: toStars },
      maxCouponGranted: card.maxCouponGranted || couponGranted,
    },
    tier,
    fromStars: from,
    toStars,
    couponGranted,
  }
}
