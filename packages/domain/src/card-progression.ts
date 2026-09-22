// Limit breaks, earned per scenario by clearing Bond Recall (docs/design/minigames.md).

import { MAX_LIMIT_BREAK, cardLevelCap } from './cards'
import { TICKETS_PER_CARD_LIMIT_BREAK } from './economy'
import { MAX_SCENARIO_TIER } from './scenarios'
import type { CardSave } from './save'

export interface CardAdvanceResult {
  card: CardSave
  tier: number
  fromLimitBreak: number
  toLimitBreak: number
  /** Derived, for the result screen. */
  fromLevel: number
  toLevel: number
  ticketReward: number
  /** True on the advance that first takes this card to LB4 in any scenario. */
  couponGranted: boolean
}

/** A card's limit break in one scenario. Absent means it has never been broken there (D127). */
export const cardLimitBreak = (card: Pick<CardSave, 'limitBreaks'>, tier: number): number =>
  card.limitBreaks[String(Math.trunc(tier))] ?? 0

/** The best break this card holds in any scenario — what the album sorts and filters on. */
export const bestCardLimitBreak = (card: Pick<CardSave, 'limitBreaks'>): number =>
  Object.values(card.limitBreaks).reduce((best, value) => Math.max(best, value), 0)

/** Scenarios where this card is broken at all, in tier order. */
export const brokenTiers = (card: Pick<CardSave, 'limitBreaks'>): number[] =>
  Object.keys(card.limitBreaks).map(Number).sort((left, right) => left - right)

export const isCardMaxedIn = (card: Pick<CardSave, 'limitBreaks'>, tier: number): boolean =>
  cardLimitBreak(card, tier) >= MAX_LIMIT_BREAK


/**
 * Advance one limit break in one scenario. The Bond Recall run already charged its tickets, so this costs
 * nothing further: clearing the board *is* the limit break (D120). The break is account-wide within that
 * scenario, so every Uma racing there gets it.
 */
export function advanceCardLimitBreak(card: CardSave, tier: number): CardAdvanceResult {
  if (!Number.isSafeInteger(tier) || tier < 1 || tier > MAX_SCENARIO_TIER) {
    throw new Error('Card limit breaks belong to a scenario')
  }
  const from = cardLimitBreak(card, tier)
  if (!Number.isSafeInteger(from) || from < 0 || from > MAX_LIMIT_BREAK) {
    throw new Error('Card progression state is invalid')
  }
  if (from >= MAX_LIMIT_BREAK) throw new Error('This card already has max bond in that scenario')

  const toLimitBreak = from + 1
  const couponGranted = toLimitBreak === MAX_LIMIT_BREAK && !card.maxCouponGranted
  return {
    card: {
      ...card,
      limitBreaks: { ...card.limitBreaks, [String(tier)]: toLimitBreak },
      maxCouponGranted: card.maxCouponGranted || couponGranted,
    },
    tier,
    fromLimitBreak: from,
    toLimitBreak,
    fromLevel: cardLevelCap(from),
    toLevel: cardLevelCap(toLimitBreak),
    ticketReward: TICKETS_PER_CARD_LIMIT_BREAK,
    couponGranted,
  }
}
