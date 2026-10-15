// Selling surplus (docs/game/09-racing-rewards-and-exchange.md §6, §6.1, §9, §11): every cell of 09 §6, the Duos and
// Feasts, the floor of 1, `sell` with its refusals, the sheet's queries, and no loop that mints time.
import { describe, expect, it } from 'vitest'
import {
  DUOS, FEASTS, ITEM_GRADE_LIST, ITEMS, SPEED_TICKET_ID, craftedItem, planetDish, rawItem, type ItemGrade,
} from '../items/catalogue'
import { FAMILY_IDS } from '../items/families'
import { workValueSeconds } from '../items/work'
import { newAccount } from '../tiers/roster'
import { isRefusal, type OpResult, type ReworkState } from '../state/types'
import { buyPrice } from './exchange'
import { MIN_SELL_PRICE, SELL_DIVISOR, sell, sellConfirmations, sellPrice, sellValue, stackCounts, type SellReceipt } from './selling'

/** 09 §6, as written: grade, then work and sale for raw, crafted and planet dish. */
const SECTION_6 = [
  '| 1 | 108 | 36 | 135 | 45 | 963 | 321 |',
  '| 2 | 114 | 38 | 142.5 | 47 | 1,005 | 335 |',
  '| 3 | 120 | 40 | 150 | 50 | 1,047 | 349 |',
  '| 4 | 126 | 42 | 157.5 | 52 | 1,096.5 | 365 |',
  '| 5 | 132 | 44 | 165 | 55 | 1,146 | 382 |',
  '| 6 | 138 | 46 | 172.5 | 57 | 1,195.5 | 398 |',
  '| 7 | 144 | 48 | 180 | 60 | 1,245 | 415 |',
  '| 8 | 150 | 50 | 187.5 | 62 | 1,294.5 | 431 |',
  '| 9 | 156 | 52 | 195 | 65 | 1,344 | 448 |',
  '| 10 | 162 | 54 | 202.5 | 67 | 1,393.5 | 464 |',
]
const cells = (row: string) => row.split('|').slice(1, -1).map((cell) => Number(cell.trim().replace(/,/g, '')))
const minutes = (id: string) => workValueSeconds(id)! / 60

const ok = <R>(result: OpResult<R>): { state: ReworkState; receipt: R } => {
  if (isRefusal(result)) throw new Error(result.reason)
  return result
}
const stocked = (items: Record<string, number>, prizeMoney = 0): ReworkState => {
  const state = newAccount(0)
  return { ...state, profile: { ...state.profile, prizeMoney }, items }
}
const carrot = rawItem('vegetables', 1).id
const salad = planetDish('vegetables', 3).id

describe('the numbers', () => {
  it('are a third, at least 1', () => {
    expect([SELL_DIVISOR, MIN_SELL_PRICE]).toEqual([3, 1])
  })
})

describe('sellPrice (09 §6)', () => {
  it('pays every cell of 09 §6 in every family: raw 36 … 54, crafted 45 … 67, planet 321 … 464', () => {
    for (const row of SECTION_6) {
      const [g, rawWork, rawSale, craftedWork, craftedSale, dishWork, dishSale] = cells(row) as [ItemGrade, ...number[]]
      for (const family of FAMILY_IDS) {
        const raw = rawItem(family, g).id, crafted = craftedItem(family, g).id, dish = planetDish(family, g).id
        expect([minutes(raw), minutes(crafted), minutes(dish)], `${family} ${g}`).toEqual([rawWork, craftedWork, dishWork])
        expect([sellPrice(raw), sellPrice(crafted), sellPrice(dish)], `${family} ${g}`).toEqual([rawSale, craftedSale, dishSale])
      }
    }
    expect(sellPrice(craftedItem('fish', 5).id)).toBe(55)
  })

  it('sells a Duo as a planet dish of its grade, and the Feasts for 418, 456, 494 and 532', () => {
    for (const duo of DUOS) expect(sellPrice(duo.id), duo.id).toBe(sellPrice(planetDish('vegetables', duo.grade).id))
    expect(FEASTS.map((feast) => sellPrice(feast.id))).toEqual([418, 456, 494, 532])
  })

  it('rounds down and pays at least 1: a synthetic work value under 3 minutes sells for 1', () => {
    expect([0, 1, 59, 179, 180, 359, 360, 8_550].map(sellValue)).toEqual([1, 1, 1, 1, 1, 1, 2, 47])
  })

  it("can't sell the Speed Ticket or an unknown id", () => {
    expect([sellPrice(SPEED_TICKET_ID), sellPrice('nothing')]).toEqual([undefined, undefined])
  })
})

describe('no loop mints time (09 §6, 12 §2)', () => {
  it('sells every raw for less than it costs, at every grade', () => {
    for (const family of FAMILY_IDS) {
      for (const g of ITEM_GRADE_LIST) {
        const id = rawItem(family, g).id
        expect(sellPrice(id)!).toBeLessThan(buyPrice(id)!)
      }
    }
  })

  it("never pays an item's sale × 3 above its work value in minutes", () => {
    for (const item of ITEMS) {
      if (item.kind === 'ticket') continue
      expect(sellPrice(item.id)! * SELL_DIVISOR, item.id).toBeLessThanOrEqual(minutes(item.id))
    }
  })

  it('so buying raw, crafting and selling pays less than the money and minutes put in', () => {
    for (const g of ITEM_GRADE_LIST) {
      const raw = rawItem('grains', g).id, crafted = craftedItem('grains', g).id
      const craftMinutes = minutes(crafted) - minutes(raw)
      expect(sellPrice(crafted)!).toBeLessThan(buyPrice(raw)! + craftMinutes)
    }
  })
})

describe('sell (13 §6)', () => {
  it('takes qty from the Warehouse and pays qty × the price, leaving the purse alone (09 §3.3)', () => {
    const before = stocked({ [carrot]: 5, [salad]: 2 }, 10)
    const { state, receipt } = ok(sell(before, { opId: 's1', itemId: carrot, qty: 4, unitPrice: 36 }, 9))
    expect(state.items).toEqual({ [carrot]: 1, [salad]: 2 })
    expect(state.profile.prizeMoney).toBe(10 + 144)
    expect(state.profile.purse).toBe(before.profile.purse)
    expect(state.ledger.at(-1)).toEqual({ id: 'sell:s1:pay', resource: 'prize-money', delta: 144, reason: 'sell', at: 9 })
    expect(receipt).toEqual<SellReceipt>({
      itemId: carrot, qty: 4, unitPrice: 36, total: 144,
      ledger: [{ id: 'sell:s1:pay', resource: 'prize-money', delta: 144, reason: 'sell', at: 9 }],
      itemLedger: [{ id: 'sell:s1:give', itemId: carrot, delta: -4, reason: 'sell', at: 9 }],
    })
    expect(ok(sell(state, { opId: 's2', itemId: carrot, qty: 1, unitPrice: 36 }, 10)).state.items![carrot]).toBe(0)
  })

  it("refuses the Speed Ticket and an unknown id: Speed Tickets can't be sold", () => {
    for (const itemId of [SPEED_TICKET_ID, 'nothing']) {
      expect(sell(stocked({ [itemId]: 9 }), { opId: 's', itemId, qty: 1, unitPrice: 1 }, 1)).toEqual({
        refused: true, code: 'not-sellable', reason: "Speed Tickets can't be sold.",
      })
    }
  })

  it('refuses a quantity below 1 or not whole', () => {
    for (const qty of [0, -2, 1.5, Number.NaN]) {
      expect(sell(stocked({ [carrot]: 5 }), { opId: 's', itemId: carrot, qty, unitPrice: 36 }, 1)).toEqual({
        refused: true, code: 'quantity', reason: 'Sell at least one.',
      })
    }
  })

  it('refuses a quantity above the Warehouse count, saying how many can be sold', () => {
    expect(sell(stocked({ [carrot]: 3 }), { opId: 's', itemId: carrot, qty: 4, unitPrice: 36 }, 1)).toEqual({
      refused: true, code: 'sell-short', reason: 'Only {n} can be sold now.', data: { n: 3 },
    })
    expect(sell(newAccount(0), { opId: 's', itemId: carrot, qty: 1, unitPrice: 36 }, 1)).toMatchObject({ code: 'sell-short', data: { n: 0 } })
  })

  it('refuses a price that is not the sell price', () => {
    expect(sell(stocked({ [carrot]: 3 }), { opId: 's', itemId: carrot, qty: 1, unitPrice: 108 }, 1)).toEqual({
      refused: true, code: 'price-changed', reason: 'Price changed.',
    })
  })

  it('checks in order: sellable, quantity, count, price', () => {
    expect(sell(stocked({}), { opId: 's', itemId: SPEED_TICKET_ID, qty: 0, unitPrice: 0 }, 1)).toMatchObject({ code: 'not-sellable' })
    expect(sell(stocked({}), { opId: 's', itemId: carrot, qty: 0, unitPrice: 0 }, 1)).toMatchObject({ code: 'quantity' })
    expect(sell(stocked({}), { opId: 's', itemId: carrot, qty: 1, unitPrice: 0 }, 1)).toMatchObject({ code: 'sell-short' })
    expect(sell(stocked({ [carrot]: 1 }), { opId: 's', itemId: carrot, qty: 1, unitPrice: 0 }, 1)).toMatchObject({ code: 'price-changed' })
  })
})

describe('the stock sheet (09 §6.1)', () => {
  it('shows reserved, needed capped at held, and free = held − needed', () => {
    expect(stackCounts({ held: 12, reserved: 4, needed: 5 })).toEqual({
      reserved: 4, needed: 5, free: 7, sizes: { one: 1, ten: 10, surplus: 7, allFree: 12 },
    })
    expect(stackCounts({ held: 3, reserved: 0, needed: 8 })).toEqual({
      reserved: 0, needed: 3, free: 0, sizes: { one: 1, ten: 3, surplus: 0, allFree: 3 },
    })
    expect(stackCounts({ held: 0, reserved: 6, needed: 0 })).toEqual({
      reserved: 6, needed: 0, free: 0, sizes: { one: 0, ten: 0, surplus: 0, allFree: 0 },
    })
    expect(() => stackCounts({ held: -1, reserved: 0, needed: 0 })).toThrow(RangeError)
    expect(() => stackCounts({ held: 1, reserved: 0.5, needed: 0 })).toThrow(RangeError)
  })

  it('asks for a dish, for needed stock with how short it leaves the planner, and for 1,000 or more', () => {
    expect(sellConfirmations({ itemId: carrot, qty: 5, held: 12, needed: 5 })).toEqual([])
    expect(sellConfirmations({ itemId: carrot, qty: 7, held: 12, needed: 5 })).toEqual([])
    expect(sellConfirmations({ itemId: carrot, qty: 11, held: 12, needed: 5 })).toEqual([{ kind: 'needed', short: 4 }])
    expect(sellConfirmations({ itemId: carrot, qty: 2, held: 6, needed: 10 })).toEqual([{ kind: 'needed', short: 6 }])
    expect(sellConfirmations({ itemId: salad, qty: 1, held: 4, needed: 0 })).toEqual([{ kind: 'dish' }])
    expect(sellConfirmations({ itemId: carrot, qty: 28, held: 30, needed: 0 })).toEqual([{ kind: 'large', total: 1_008 }])
    expect(sellConfirmations({ itemId: carrot, qty: 27, held: 30, needed: 0 })).toEqual([])
    expect(sellConfirmations({ itemId: salad, qty: 4, held: 4, needed: 2 })).toEqual([
      { kind: 'dish' }, { kind: 'needed', short: 2 }, { kind: 'large', total: 1_396 },
    ])
  })

  it('makes "All free" ask whenever needed stock exists, and "Surplus" never for that', () => {
    const counts = stackCounts({ held: 9, reserved: 2, needed: 3 })
    expect(sellConfirmations({ itemId: carrot, qty: counts.sizes.surplus, held: 9, needed: 3 })).toEqual([])
    expect(sellConfirmations({ itemId: carrot, qty: counts.sizes.allFree, held: 9, needed: 3 })).toEqual([{ kind: 'needed', short: 3 }])
  })

  it("throws for what can't be sold", () => {
    expect(() => sellConfirmations({ itemId: SPEED_TICKET_ID, qty: 1, held: 1, needed: 0 })).toThrow(RangeError)
  })
})
