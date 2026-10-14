// The Exchange (docs/rework/09-racing-rewards-and-exchange.md §5, §5.3–§5.5, §8, §9; D331, D336, D338): it sells
// Speed Tickets at 30 and raw ingredients at their real gathering minutes, never Uma Tickets, crafted items or dishes.
// Raw grades are stocked up to the highest any Uma has ever opened, a mark that never drops. Prices follow T126's work
// values, which already hold the time factor, so nothing here multiplies by it. `buy` is 13 §6's operation.
import { gradeOpensAtFarmLevel, highestOpenGrade } from '../items/grades'
import { itemById, SPEED_TICKET_ID, type ItemGrade, type ItemId } from '../items/catalogue'
import { workValueSeconds } from '../items/work'
import { SECONDS_PER_MINUTE } from '../time'
import { assertNow, writeLedger } from '../tiers/ledger'
import type { AccountProfile, LedgerEntry, OpResult, ReworkState } from '../types'
import { buyGetLedgerId, buyPayLedgerId, type ItemLedgerEntry } from './ledger'
import { buyRefusal } from './refusals'

/** A Speed Ticket's price: 30 minutes off one running job or session for 30 Prize Money (09 §5, §5.1; draft). */
export const SPEED_TICKET_PRICE = 30
/** Raw ingredients sell up to 99 at a purchase; Speed Tickets have no limit (09 §5, §5.5). */
export const RAW_PER_PURCHASE = 99
/** A purchase or sale worth this much or more asks once (09 §5.5, §6.1). */
export const CONFIRM_FROM = 1_000
/** Grade 1 is stocked before the first Uma exists (D323, 09 §5.3): a new account's `exchangeGrade`. */
export const FIRST_EXCHANGE_GRADE: ItemGrade = 1

/**
 * Today's price of `sku`: 30 for a Speed Ticket, a raw item's work value in whole real minutes (108 … 162). Undefined
 * for anything the Exchange doesn't sell.
 */
export function buyPrice(sku: ItemId): number | undefined {
  if (sku === SPEED_TICKET_ID) return SPEED_TICKET_PRICE
  if (itemById(sku)?.kind !== 'raw') return undefined
  const minutes = workValueSeconds(sku)! / SECONDS_PER_MINUTE
  if (!Number.isInteger(minutes)) throw new RangeError(`${sku}'s work value is not whole minutes: ${minutes}`)
  return minutes
}

/** The highest raw grade the Exchange stocks: the stored mark, or any current Uma's open grade if higher (09 §5.3). */
export function stockedGrade(profile: Pick<AccountProfile, 'exchangeGrade'>, farmLevels: readonly number[]): ItemGrade {
  return farmLevels.reduce<ItemGrade>((best, level) => {
    const open = highestOpenGrade(level)
    return open > best ? open : best
  }, profile.exchangeGrade)
}

/** The profile with its stock mark raised to `farmLevel`'s open grade, if higher. Called after a collect (T132, phase 3). */
export function raiseExchangeGrade(profile: AccountProfile, farmLevel: number): AccountProfile {
  const grade = stockedGrade(profile, [farmLevel])
  return grade === profile.exchangeGrade ? profile : { ...profile, exchangeGrade: grade }
}

/** A purchase worth 1,000 or more asks once (09 §5.5). */
export const buyNeedsConfirm = (total: number): boolean => total >= CONFIRM_FROM

/** Every current Uma's Farm Level. */
export const farmLevelsOf = (state: Pick<ReworkState, 'umas'>): number[] => Object.values(state.umas).map((uma) => uma.farm.level)

export interface BuyInput {
  readonly opId: string
  /** `speed-ticket` or a raw item's id. */
  readonly sku: ItemId
  readonly qty: number
  /** The price the screen showed. */
  readonly unitPrice: number
}

export interface BuyReceipt {
  readonly sku: ItemId
  readonly qty: number
  readonly unitPrice: number
  readonly total: number
  /** `buy:<opId>:pay`, also appended to the state's ledger. */
  readonly ledger: readonly LedgerEntry[]
  /** `buy:<opId>:get`, for phase 3's `itemLedger`. */
  readonly itemLedger: readonly ItemLedgerEntry[]
}

/**
 * `buy { opId, sku, qty, unitPrice }` (13 §6): takes qty × price from Prize Money, adds qty to the Warehouse and stores
 * the stock mark. Checks run in 09's order: sold here, stocked, quantity, price, money.
 */
export function buy<S extends ReworkState>(state: S, input: BuyInput, now: number): OpResult<BuyReceipt, S> {
  assertNow(now)
  const price = buyPrice(input.sku)
  if (price === undefined) return buyRefusal('not-sold')
  const item = itemById(input.sku)!
  const stocked = stockedGrade(state.profile, farmLevelsOf(state))
  if (item.kind === 'raw' && item.grade > stocked) return buyRefusal('not-stocked', { level: gradeOpensAtFarmLevel(item.grade) })
  const whole = Number.isSafeInteger(input.qty) && input.qty >= 1
  if (!whole || (item.kind === 'raw' && input.qty > RAW_PER_PURCHASE)) return buyRefusal('quantity')
  if (input.unitPrice !== price) return buyRefusal('price-changed')
  const total = input.qty * price
  if (total > state.profile.prizeMoney) return buyRefusal('prize-money', { n: total - state.profile.prizeMoney })

  const pay = { id: buyPayLedgerId(input.opId), resource: 'prize-money', delta: -total, reason: 'buy' } as const
  const paid = writeLedger(state, pay, now)
  const items = paid.items ?? {}
  const next: S = {
    ...paid,
    profile: stocked === paid.profile.exchangeGrade ? paid.profile : { ...paid.profile, exchangeGrade: stocked },
    items: { ...items, [input.sku]: (items[input.sku] ?? 0) + input.qty },
  }
  return {
    state: next,
    receipt: {
      sku: input.sku,
      qty: input.qty,
      unitPrice: price,
      total,
      ledger: [{ ...pay, at: now }],
      itemLedger: [{ id: buyGetLedgerId(input.opId), itemId: input.sku, delta: input.qty, reason: 'buy', at: now }],
    },
  }
}
