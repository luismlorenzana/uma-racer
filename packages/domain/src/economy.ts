// Training Tickets are the only currency (docs/design/economy.md).

export const DAILY_TICKETS = 50
/** Only limits the daily grant; level-up tickets are always added. */
export const TICKET_STORAGE_CAP = 500
export const TICKETS_PER_UMA_LEVEL_UP = 5
/** Each limit break earned from Bond Recall (docs/design/economy.md). */
export const TICKETS_PER_CARD_LIMIT_BREAK = 5
/** One Spark Match run raises a Training Level; one Bond Recall run limit breaks a card. */
export const SPARK_MATCH_TICKET_COST = 5
export const BOND_RECALL_TICKET_COST = 10

/**
 * Unlocking a card with tickets (M016). Newer cards pay more per node in later scenarios (D126), so they cost more.
 * Card Select Coupons remain a free unlock.
 */
export const CARD_UNLOCK_BASE_TICKETS = 25
export const CARD_UNLOCK_TICKETS_PER_ERA = 5
export const cardUnlockCost = (era: number): number =>
  CARD_UNLOCK_BASE_TICKETS + CARD_UNLOCK_TICKETS_PER_ERA * Math.max(1, Math.trunc(era))

/** Unlocking the next scenario. */
export const umaPromotionCost = (fromTier: number): number => 25 * fromTier

/** Applies `days` of daily grants, stopping at the storage cap without ever removing tickets. */
export function grantDailyTickets(current: number, days: number): number {
  if (days <= 0 || current >= TICKET_STORAGE_CAP) return current
  return Math.min(TICKET_STORAGE_CAP, current + DAILY_TICKETS * days)
}

export const UMA_SHARDS_PER_COUPON = 5
