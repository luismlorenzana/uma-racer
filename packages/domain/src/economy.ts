// Training Tickets are the only currency (docs/design/economy.md).

export const DAILY_TICKETS = 50
/** Only limits the daily grant; level-up tickets are always added. */
export const TICKET_STORAGE_CAP = 500
export const TICKETS_PER_UMA_LEVEL_UP = 5
export const TICKETS_PER_CARD_LEVEL_UP = 2
export const TRAINING_TICKET_COST = 1

export const umaPromotionCost = (fromTier: number): number => 25 * fromTier

export const cardLimitBreakCost = (toLimitBreak: number): number => 20 * toLimitBreak

/** Applies `days` of daily grants, stopping at the storage cap without ever removing tickets. */
export function grantDailyTickets(current: number, days: number): number {
  if (days <= 0 || current >= TICKET_STORAGE_CAP) return current
  return Math.min(TICKET_STORAGE_CAP, current + DAILY_TICKETS * days)
}

export const UMA_SHARDS_PER_COUPON = 5
