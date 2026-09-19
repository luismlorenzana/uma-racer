// Support-card promotion rules (docs/design/support-cards.md).

import { cardExpToNext, cardLevelCap, MAX_LIMIT_BREAK } from './cards'
import { cardLimitBreakCost, TICKETS_PER_CARD_LEVEL_UP } from './economy'
import type { CardSave } from './save'

export interface CardPromotionResult {
  card: CardSave
  fromLimitBreak: number
  toLimitBreak: number
  cost: number
  levelGained: number
  ticketReward: number
  ticketDelta: number
}

const isNonNegativeInt = (value: number): boolean => Number.isSafeInteger(value) && value >= 0

export function promoteCard(card: CardSave, tickets: number): CardPromotionResult {
  if (!isNonNegativeInt(tickets)) throw new Error('Invalid Training Ticket balance')
  if (!Number.isSafeInteger(card.level) || card.level < 1 || !isNonNegativeInt(card.exp) ||
      !isNonNegativeInt(card.limitBreak) || card.limitBreak > MAX_LIMIT_BREAK) {
    throw new Error('Card progression state is invalid')
  }
  if (card.limitBreak >= MAX_LIMIT_BREAK) throw new Error('This card is already at maximum limit break')
  const cap = cardLevelCap(card.limitBreak)
  if (card.level !== cap || card.exp !== cardExpToNext(card.level)) {
    throw new Error(`Fill the level ${cap} EXP bar before limit breaking`)
  }
  const toLimitBreak = card.limitBreak + 1
  const cost = cardLimitBreakCost(toLimitBreak)
  if (tickets < cost) throw new Error(`You need ${cost} Training Tickets to limit break this card`)
  const levelGained = card.level + 1
  return {
    card: { ...card, level: levelGained, exp: 0, limitBreak: toLimitBreak },
    fromLimitBreak: card.limitBreak,
    toLimitBreak,
    cost,
    levelGained,
    ticketReward: TICKETS_PER_CARD_LEVEL_UP,
    ticketDelta: -cost + TICKETS_PER_CARD_LEVEL_UP,
  }
}
