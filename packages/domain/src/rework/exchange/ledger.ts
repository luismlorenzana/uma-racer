// Prize Money and item rows (docs/rework/09-racing-rewards-and-exchange.md §9): every movement is a row whose id comes
// from what caused it, so phase 3 can find a retried race or operation and write nothing twice. Prize Money rows are
// T125's `LedgerEntry` (resource `prize-money`); item rows are 13 §6's `itemLedger`, which receipts carry for phase 3
// to write. The audit: the sum of a currency's deltas equals its balance.
import type { ItemId } from '../items/catalogue'
import type { LedgerEntry, LedgerResource } from '../types'

/** A race's prize, written with its result. */
export const racePrizeLedgerId = (resultId: string): string => `race:${resultId}:prize`
/** A race's featured bonus. */
export const featuredBonusLedgerId = (resultId: string): string => `race:${resultId}:featured`
/** `buy { opId }`: the Prize Money paid, and the item got. */
export const buyPayLedgerId = (opId: string): string => `buy:${opId}:pay`
export const buyGetLedgerId = (opId: string): string => `buy:${opId}:get`
/** `sell { opId }`: the item given, and the Prize Money paid for it. */
export const sellGiveLedgerId = (opId: string): string => `sell:${opId}:give`
export const sellPayLedgerId = (opId: string): string => `sell:${opId}:pay`

/** Why an item moved. Other tasks widen it with their own reasons. */
export type ItemLedgerReason = 'buy' | 'sell'

/** One `itemLedger` row (13 §6): an item's count moved by `delta`. */
export interface ItemLedgerEntry {
  readonly id: string
  readonly itemId: ItemId
  readonly delta: number
  readonly reason: ItemLedgerReason
  /** When it was written, milliseconds since the epoch. */
  readonly at: number
}

/** The sum of one resource's deltas: 09 §9's audit compares it with the profile's balance. */
export const ledgerTotal = (ledger: readonly LedgerEntry[], resource: LedgerResource): number =>
  ledger.reduce((sum, row) => (row.resource === resource ? sum + row.delta : sum), 0)

/** The sum of one item's deltas. */
export const itemLedgerTotal = (rows: readonly ItemLedgerEntry[], itemId: ItemId): number =>
  rows.reduce((sum, row) => (row.itemId === itemId ? sum + row.delta : sum), 0)
