// Selling surplus (docs/rework/09-racing-rewards-and-exchange.md §6, §6.1, §8, §9; D331, D338): any Warehouse item
// sells for a third of its work value, rounded down, at least 1. The Exchange sells raw at its full work value, so a
// buy and a sale lose two thirds and no loop mints time. Speed Tickets can't be sold, and reserved inputs have left the
// Warehouse count. `sell` is 13 §6's operation; `stackCounts` and `sellConfirmations` are the sheet's queries: the
// screen asks before it sends, so the operation takes no "confirmed" flag. Sales never touch the Daily Purse (§3.3).
import { itemById, SPEED_TICKET_ID, type ItemId } from '../items/catalogue'
import { workValueSeconds } from '../items/work'
import { SECONDS_PER_MINUTE } from '../time'
import { assertNow, writeLedger } from '../tiers/ledger'
import type { LedgerEntry, OpResult, ReworkState } from '../types'
import { CONFIRM_FROM } from './exchange'
import { sellGiveLedgerId, sellPayLedgerId, type ItemLedgerEntry } from './ledger'
import { sellRefusal } from './refusals'

/** Selling pays a third of the work value (09 §6, D331; draft). */
export const SELL_DIVISOR = 3
/** Every item that can be sold sells for at least this (09 §6). */
export const MIN_SELL_PRICE = 1
/** The stock sheet's fixed sizes (09 §6.1): Sell ×1 and ×10. */
export const SELL_STEPS = Object.freeze([1, 10] as const)

/** What `workSeconds` of work sells for: ⌊seconds ÷ (60 × 3)⌋, at least 1. */
export const sellValue = (workSeconds: number): number =>
  Math.max(MIN_SELL_PRICE, Math.floor(workSeconds / (SECONDS_PER_MINUTE * SELL_DIVISOR)))

/** `itemId`'s sale price; undefined for the Speed Ticket and for an id the catalogue doesn't hold. */
export function sellPrice(itemId: ItemId): number | undefined {
  if (itemId === SPEED_TICKET_ID) return undefined
  const seconds = workValueSeconds(itemId)
  return seconds === null || seconds === undefined ? undefined : sellValue(seconds)
}

const assertCount = (what: string, n: number): void => {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${what} must be a whole number ≥ 0: ${n}`)
}

export interface StackCounts {
  /** Inputs held by running work; never offered (07 §2: they have left the Warehouse count). */
  readonly reserved: number
  /** What the planner still needs from the stack, capped at what is held. */
  readonly needed: number
  /** Held minus needed. */
  readonly free: number
  /** The sheet's sizes, each capped at what can be sold, so 0 means the button is off. */
  readonly sizes: {
    readonly one: number
    readonly ten: number
    /** Free minus needed in 09 §6.1's words: the Free count. */
    readonly surplus: number
    /** Every unreserved item, which dips into needed and so asks first. */
    readonly allFree: number
  }
}

/**
 * A Warehouse stack's three counts and its sell sizes (09 §6.1). `held` is the Warehouse count, `reserved` running
 * work's inputs (T127) and `needed` the planner's count (T131).
 */
export function stackCounts(input: { readonly held: number; readonly reserved: number; readonly needed: number }): StackCounts {
  assertCount('Held', input.held)
  assertCount('Reserved', input.reserved)
  assertCount('Needed', input.needed)
  const needed = Math.min(input.needed, input.held)
  const free = input.held - needed
  const [one, ten] = SELL_STEPS
  return {
    reserved: input.reserved,
    needed,
    free,
    sizes: { one: Math.min(one, input.held), ten: Math.min(ten, input.held), surplus: free, allFree: input.held },
  }
}

/** Why a sale asks once (09 §6.1): a dish; needed stock, with how many the planner is left short; or 1,000 or more. */
export type SellConfirmation =
  | { readonly kind: 'dish' }
  | { readonly kind: 'needed'; readonly short: number }
  | { readonly kind: 'large'; readonly total: number }

/** Every reason selling `qty` of `itemId` asks first, in 09 §6.1's order; empty when it doesn't. */
export function sellConfirmations(input: {
  readonly itemId: ItemId
  readonly qty: number
  readonly held: number
  readonly needed: number
}): readonly SellConfirmation[] {
  const price = sellPrice(input.itemId)
  if (price === undefined) throw new RangeError(`${input.itemId} can't be sold`)
  assertCount('A quantity', input.qty)
  const { free } = stackCounts({ held: input.held, reserved: 0, needed: input.needed })
  const asks: SellConfirmation[] = []
  if (itemById(input.itemId)!.kind === 'dish') asks.push({ kind: 'dish' })
  if (input.qty > free) asks.push({ kind: 'needed', short: input.needed - Math.max(0, input.held - input.qty) })
  const total = input.qty * price
  if (total >= CONFIRM_FROM) asks.push({ kind: 'large', total })
  return asks
}

export interface SellInput {
  readonly opId: string
  readonly itemId: ItemId
  readonly qty: number
  /** The price the screen showed. */
  readonly unitPrice: number
}

export interface SellReceipt {
  readonly itemId: ItemId
  readonly qty: number
  readonly unitPrice: number
  readonly total: number
  /** `sell:<opId>:pay`, also appended to the state's ledger. */
  readonly ledger: readonly LedgerEntry[]
  /** `sell:<opId>:give`, for phase 3's `itemLedger`. */
  readonly itemLedger: readonly ItemLedgerEntry[]
}

/**
 * `sell { opId, itemId, qty, unitPrice }` (13 §6): takes qty from the Warehouse and pays qty × `sellPrice`. Checks run
 * in 09's order: sellable, quantity, count, price.
 */
export function sell<S extends ReworkState>(state: S, input: SellInput, now: number): OpResult<SellReceipt, S> {
  assertNow(now)
  const price = sellPrice(input.itemId)
  if (price === undefined) return sellRefusal('not-sellable')
  if (!Number.isSafeInteger(input.qty) || input.qty < 1) return sellRefusal('quantity')
  const items = state.items ?? {}
  const held = items[input.itemId] ?? 0
  if (input.qty > held) return sellRefusal('sell-short', { n: held })
  if (input.unitPrice !== price) return sellRefusal('price-changed')

  const total = input.qty * price
  const pay = { id: sellPayLedgerId(input.opId), resource: 'prize-money', delta: total, reason: 'sell' } as const
  const paid = writeLedger(state, pay, now)
  const next: S = { ...paid, items: { ...items, [input.itemId]: held - input.qty } }
  return {
    state: next,
    receipt: {
      itemId: input.itemId,
      qty: input.qty,
      unitPrice: price,
      total,
      ledger: [{ ...pay, at: now }],
      itemLedger: [{ id: sellGiveLedgerId(input.opId), itemId: input.itemId, delta: -input.qty, reason: 'sell', at: now }],
    },
  }
}
