// The Exchange (docs/game/09-racing-rewards-and-exchange.md §5, §5.3–§5.5, §8, §9): prices, the stock rule and `buy`
// with each refusal in its order and words.
import { describe, expect, it } from 'vitest'
import { CONTENT, COLT, SPRINTER } from '../__fixtures__/tiers'
import { ITEM_GRADE_LIST, ITEMS, rawItem, SPEED_TICKET_ID, craftedItem, planetDish, DUOS, FEASTS } from '../items/catalogue'
import { FAMILY_IDS } from '../items/families'
import { workValueSeconds } from '../items/work'
import { newAccount, unlockUma } from '../tiers/roster'
import { isRefusal, type OpResult, type ReworkState } from '../state/types'
import {
  CONFIRM_FROM, FIRST_EXCHANGE_GRADE, RAW_PER_PURCHASE, SPEED_TICKET_PRICE, buy, buyNeedsConfirm, buyPrice, raiseExchangeGrade, stockedGrade,
  type BuyReceipt,
} from './exchange'
import { EXCHANGE_REFUSALS } from './refusals'

/** 09 §5.3's raw prices by grade, as written. */
const SECTION_5_3 = '| Price | 108 | 114 | 120 | 126 | 132 | 138 | 144 | 150 | 156 | 162 |'
const PRICES = SECTION_5_3.split('|').slice(2, -1).map((cell) => Number(cell.trim()))

const ok = <R>(result: OpResult<R>): { state: ReworkState; receipt: R } => {
  if (isRefusal(result)) throw new Error(result.reason)
  return result
}
const rich = (prizeMoney = 10_000, state: ReworkState = newAccount(0)): ReworkState => ({ ...state, profile: { ...state.profile, prizeMoney } })
/** An account with Colt and the Sprinter, at the given Farm Levels. */
function withUmas(levels: readonly [number, number], prizeMoney = 10_000): ReworkState {
  let state = ok(unlockUma(newAccount(0), { outfitId: COLT.id }, 1, { content: CONTENT })).state
  state = ok(unlockUma(state, { outfitId: SPRINTER.id }, 2, { content: CONTENT })).state
  const farm = (id: string, level: number) => ({ ...state.umas[id]!, farm: { level, exp: 0 } })
  return rich(prizeMoney, { ...state, umas: { [COLT.id]: farm(COLT.id, levels[0]), [SPRINTER.id]: farm(SPRINTER.id, levels[1]) } })
}
const carrot = rawItem('vegetables', 1).id
const potato = rawItem('vegetables', 2).id

describe('the numbers', () => {
  it('are a 30 ticket, 99 raw a purchase, a 1,000 confirmation and grade 1 to start', () => {
    expect([SPEED_TICKET_PRICE, RAW_PER_PURCHASE, CONFIRM_FROM, FIRST_EXCHANGE_GRADE]).toEqual([30, 99, 1_000, 1])
    expect(EXCHANGE_REFUSALS.buy.quantity).toBe(`Buy 1 to ${RAW_PER_PURCHASE} at a time.`)
  })
})

describe('buyPrice (09 §5, §5.3)', () => {
  it('sells raw at its real gathering minutes, 108 … 162, equal to T126\'s work value ÷ 60 in every family', () => {
    expect(PRICES).toEqual([108, 114, 120, 126, 132, 138, 144, 150, 156, 162])
    for (const family of FAMILY_IDS) {
      for (const g of ITEM_GRADE_LIST) {
        const id = rawItem(family, g).id
        expect(buyPrice(id)).toBe(PRICES[g - 1])
        expect(buyPrice(id)).toBe(workValueSeconds(id)! / 60)
      }
    }
  })

  it('sells the Speed Ticket for 30, and nothing else: no crafted items, dishes or Uma Tickets', () => {
    expect(buyPrice(SPEED_TICKET_ID)).toBe(30)
    const notSold = [craftedItem('fish', 1).id, planetDish('fish', 1).id, DUOS[0]!.id, FEASTS[0]!.id, 'uma-ticket', 'nothing']
    for (const id of notSold) expect(buyPrice(id), id).toBeUndefined()
    expect(ITEMS.filter((item) => buyPrice(item.id) !== undefined)).toHaveLength(81)
  })
})

describe('the stock rule (09 §5.3)', () => {
  it('stocks grade 1 with no Umas, and grade 2 once an Uma reaches Farm Lv 6', () => {
    expect(stockedGrade(newAccount(0).profile, [])).toBe(1)
    expect(stockedGrade(newAccount(0).profile, [1, 5])).toBe(1)
    expect(stockedGrade(newAccount(0).profile, [1, 6])).toBe(2)
    expect(stockedGrade(newAccount(0).profile, [50])).toBe(10)
  })

  it('never drops when Farm Levels reset', () => {
    const raised = raiseExchangeGrade(newAccount(0).profile, 11)
    expect(raised.exchangeGrade).toBe(3)
    expect(stockedGrade(raised, [1, 1])).toBe(3)
    expect(raiseExchangeGrade(raised, 1)).toBe(raised)
    expect(raiseExchangeGrade(raised, 16).exchangeGrade).toBe(4)
  })

  it("stores a buy's stock as the mark, so a promotion can't lower it", () => {
    const { state } = ok(buy(withUmas([6, 1]), { opId: 'o1', sku: potato, qty: 1, unitPrice: 114 }, 5))
    expect(state.profile.exchangeGrade).toBe(2)
    const reset = { ...state, umas: Object.fromEntries(Object.entries(state.umas).map(([id, uma]) => [id, { ...uma, farm: { level: 1, exp: 0 } }])) }
    expect(ok(buy(reset, { opId: 'o2', sku: potato, qty: 1, unitPrice: 114 }, 6)).state.items![potato]).toBe(2)
  })
})

describe('buy (13 §6)', () => {
  it('takes qty × price from Prize Money, adds qty to the Warehouse and writes both rows', () => {
    const { state, receipt } = ok(buy(rich(500), { opId: 'o1', sku: carrot, qty: 3, unitPrice: 108 }, 7))
    expect(state.profile.prizeMoney).toBe(500 - 324)
    expect(state.items).toEqual({ [carrot]: 3 })
    expect(state.ledger.at(-1)).toEqual({ id: 'buy:o1:pay', resource: 'prize-money', delta: -324, reason: 'buy', at: 7 })
    expect(receipt).toEqual<BuyReceipt>({
      sku: carrot, qty: 3, unitPrice: 108, total: 324,
      ledger: [{ id: 'buy:o1:pay', resource: 'prize-money', delta: -324, reason: 'buy', at: 7 }],
      itemLedger: [{ id: 'buy:o1:get', itemId: carrot, delta: 3, reason: 'buy', at: 7 }],
    })
    const more = ok(buy(state, { opId: 'o2', sku: SPEED_TICKET_ID, qty: 5, unitPrice: 30 }, 8)).state
    expect(more.items).toEqual({ [carrot]: 3, [SPEED_TICKET_ID]: 5 })
    expect(more.profile.prizeMoney).toBe(26)
  })

  it('sells tickets without a limit, and up to 99 raw at a time', () => {
    expect(ok(buy(rich(30_000), { opId: 'o', sku: SPEED_TICKET_ID, qty: 500, unitPrice: 30 }, 1)).state.items![SPEED_TICKET_ID]).toBe(500)
    expect(ok(buy(rich(30_000), { opId: 'o', sku: carrot, qty: 99, unitPrice: 108 }, 1)).receipt.total).toBe(10_692)
  })

  it('spends exactly to zero', () => {
    expect(ok(buy(rich(108), { opId: 'o', sku: carrot, qty: 1, unitPrice: 108 }, 1)).state.profile.prizeMoney).toBe(0)
  })

  it('refuses what it does not sell', () => {
    for (const sku of [craftedItem('fish', 1).id, planetDish('vegetables', 1).id, 'uma-ticket']) {
      expect(buy(rich(), { opId: 'o', sku, qty: 1, unitPrice: 1 }, 1)).toEqual({
        refused: true, code: 'not-sold', reason: 'The Exchange sells raw ingredients and Speed Tickets.',
      })
    }
  })

  it('refuses a grade above the stock, naming the Farm Level that opens it', () => {
    expect(buy(rich(), { opId: 'o', sku: potato, qty: 1, unitPrice: 114 }, 1)).toEqual({
      refused: true, code: 'not-stocked', reason: 'In stock once an Uma reaches Farm Lv {level}.', data: { level: 6 },
    })
    expect(buy(withUmas([1, 10]), { opId: 'o', sku: rawItem('fish', 3).id, qty: 0, unitPrice: 0 }, 1)).toMatchObject({ code: 'not-stocked', data: { level: 11 } })
  })

  it('refuses a raw quantity outside 1–99 and a ticket count below 1 or not whole', () => {
    const quantity = { refused: true, code: 'quantity', reason: 'Buy 1 to 99 at a time.' }
    for (const qty of [0, -1, 100, 1.5, Number.NaN]) expect(buy(rich(), { opId: 'o', sku: carrot, qty, unitPrice: 108 }, 1), `${qty}`).toEqual(quantity)
    for (const qty of [0, -3, 2.5]) expect(buy(rich(), { opId: 'o', sku: SPEED_TICKET_ID, qty, unitPrice: 30 }, 1), `${qty}`).toEqual(quantity)
  })

  it("refuses a price that isn't today's, charging nothing (09 §8)", () => {
    expect(buy(rich(), { opId: 'o', sku: carrot, qty: 1, unitPrice: 100 }, 1)).toEqual({ refused: true, code: 'price-changed', reason: 'Price changed.' })
    expect(buy(rich(), { opId: 'o', sku: SPEED_TICKET_ID, qty: 1, unitPrice: 25 }, 1)).toMatchObject({ code: 'price-changed' })
  })

  it('refuses a total above Prize Money, naming how much more is needed (09 §5.5)', () => {
    expect(buy(rich(204), { opId: 'o', sku: carrot, qty: 3, unitPrice: 108 }, 1)).toEqual({
      refused: true, code: 'prize-money', reason: 'Need {n} more.', data: { n: 120 },
    })
  })

  it('checks in order: sold, stocked, quantity, price, money', () => {
    expect(buy(rich(0), { opId: 'o', sku: 'nothing', qty: 0, unitPrice: 0 }, 1)).toMatchObject({ code: 'not-sold' })
    expect(buy(rich(0), { opId: 'o', sku: potato, qty: 0, unitPrice: 0 }, 1)).toMatchObject({ code: 'not-stocked' })
    expect(buy(rich(0), { opId: 'o', sku: carrot, qty: 0, unitPrice: 0 }, 1)).toMatchObject({ code: 'quantity' })
    expect(buy(rich(0), { opId: 'o', sku: carrot, qty: 1, unitPrice: 0 }, 1)).toMatchObject({ code: 'price-changed' })
    expect(buy(rich(0), { opId: 'o', sku: carrot, qty: 1, unitPrice: 108 }, 1)).toMatchObject({ code: 'prize-money' })
  })

  it('throws on a clock that is not integer milliseconds', () => {
    expect(() => buy(rich(), { opId: 'o', sku: carrot, qty: 1, unitPrice: 108 }, -1)).toThrow(RangeError)
  })
})

describe('confirmations (09 §5.5)', () => {
  it('ask once for a purchase of 1,000 or more', () => {
    expect([buyNeedsConfirm(999), buyNeedsConfirm(1_000), buyNeedsConfirm(10_692)]).toEqual([false, true, true])
  })
})
