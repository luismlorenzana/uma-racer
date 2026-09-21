// Limit breaks, earned by clearing Bond Recall (docs/design/minigames.md).

import { MAX_LIMIT_BREAK, cardLevelCap } from './cards'
import { TICKETS_PER_CARD_LIMIT_BREAK } from './economy'
import type { CardSave } from './save'

export interface CardAdvanceResult {
  card: CardSave
  fromLimitBreak: number
  toLimitBreak: number
  /** Derived, for the result screen. */
  fromLevel: number
  toLevel: number
  ticketReward: number
  /** True on the advance that first reaches LB4. */
  couponGranted: boolean
}

export const isCardMaxed = (card: CardSave): boolean => card.limitBreak >= MAX_LIMIT_BREAK

/**
 * Advance one limit break. The Bond Recall run already charged its tickets, so this costs nothing further:
 * clearing the board *is* the limit break (D120).
 */
export function advanceCardLimitBreak(card: CardSave): CardAdvanceResult {
  if (!Number.isSafeInteger(card.limitBreak) || card.limitBreak < 0 || card.limitBreak > MAX_LIMIT_BREAK) {
    throw new Error('Card progression state is invalid')
  }
  if (isCardMaxed(card)) throw new Error('This card is already at maximum limit break')

  const toLimitBreak = card.limitBreak + 1
  const couponGranted = toLimitBreak === MAX_LIMIT_BREAK && !card.maxCouponGranted
  return {
    card: { ...card, limitBreak: toLimitBreak, maxCouponGranted: card.maxCouponGranted || couponGranted },
    fromLimitBreak: card.limitBreak,
    toLimitBreak,
    fromLevel: cardLevelCap(card.limitBreak),
    toLevel: cardLevelCap(toLimitBreak),
    ticketReward: TICKETS_PER_CARD_LIMIT_BREAK,
    couponGranted,
  }
}

/** A card's level is purely a display of its limit break now. */
export const cardLevel = (card: Pick<CardSave, 'limitBreak'>): number => cardLevelCap(card.limitBreak)
