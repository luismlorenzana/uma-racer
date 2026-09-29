// Training Tickets are the only currency (docs/design/economy.md). One ticket is one minigame run (D148).

/** A day's grant: enough to max one card in one scenario, with Spark Match runs to spare. */
export const DAILY_TICKETS = 15
/** Four days of grants. Only limits the daily grant; level-up tickets are always added. */
export const TICKET_STORAGE_CAP = 60
/** One run of either minigame: Spark Match raises a Training Level, Friendship Training earns a card's star. */
export const SPARK_MATCH_TICKET_COST = 1
export const FRIENDSHIP_TRAINING_TICKET_COST = 1

/**
 * Unlocking a card with tickets (M016). Newer cards pay more per node in later scenarios (D126), so they cost more.
 * Card Select Coupons remain a free unlock.
 */
export const CARD_UNLOCK_BASE_TICKETS = 5
export const CARD_UNLOCK_TICKETS_PER_ERA = 1
export const cardUnlockCost = (era: number): number =>
  CARD_UNLOCK_BASE_TICKETS + CARD_UNLOCK_TICKETS_PER_ERA * Math.max(1, Math.trunc(era))

/** Unlocking the next scenario. */
export const umaPromotionCost = (fromTier: number): number => 5 * fromTier

/**
 * Save v7 re-denominated tickets: every price but the card run became a fifth of what it was, so a balance does too,
 * rounding up so the conversion never costs a player a run (D148).
 */
export const redenominateTickets = (tickets: number): number => Math.ceil(Math.max(0, tickets) / 5)

/** Applies `days` of daily grants, stopping at the storage cap without ever removing tickets. */
export function grantDailyTickets(current: number, days: number): number {
  if (days <= 0 || current >= TICKET_STORAGE_CAP) return current
  return Math.min(TICKET_STORAGE_CAP, current + DAILY_TICKETS * days)
}

export const UMA_SHARDS_PER_COUPON = 5
