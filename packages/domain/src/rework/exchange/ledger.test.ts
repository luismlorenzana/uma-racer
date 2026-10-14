// Ledger ids and the audit (docs/rework/09-racing-rewards-and-exchange.md §9): every row's id comes from its cause, and
// over a synthetic month of races, buys and sells the Prize Money deltas sum to the balance and the item deltas to the
// Warehouse.
import { describe, expect, it } from 'vitest'
import { RACES, days, mulberry32 } from '../../__fixtures__/rework-races'
import { rawItem, SPEED_TICKET_ID } from '../items/catalogue'
import { newAccount } from '../tiers/roster'
import { isRefusal, type ReworkState } from '../types'
import { buy, buyPrice } from './exchange'
import { featuredBoard, featuredSeed } from './featured'
import {
  buyGetLedgerId, buyPayLedgerId, featuredBonusLedgerId, itemLedgerTotal, ledgerTotal, racePrizeLedgerId, sellGiveLedgerId, sellPayLedgerId,
  type ItemLedgerEntry,
} from './ledger'
import { boardDay } from './purse'
import { settleRacePrize } from './race-prize'
import { sell, sellPrice } from './selling'

describe('ids (09 §9)', () => {
  it('name their cause', () => {
    expect([racePrizeLedgerId('r9'), featuredBonusLedgerId('r9')]).toEqual(['race:r9:prize', 'race:r9:featured'])
    expect([buyPayLedgerId('o1'), buyGetLedgerId('o1')]).toEqual(['buy:o1:pay', 'buy:o1:get'])
    expect([sellGiveLedgerId('o2'), sellPayLedgerId('o2')]).toEqual(['sell:o2:give', 'sell:o2:pay'])
  })
})

describe('the audit (09 §9)', () => {
  it('sums a synthetic month of races, buys and sells to the balances', () => {
    const rng = mulberry32(20_261_014)
    const pick = <T>(list: readonly T[]): T => list[Math.floor(rng.next() * list.length)]!
    const carrot = rawItem('vegetables', 1).id
    let state: ReworkState = newAccount(0)
    const itemRows: ItemLedgerEntry[] = []
    let now = 1_000
    let n = 0
    let refusals = 0
    for (const day of days('2026-10-01', 31)) {
      const board = featuredBoard(boardDay(state.profile.purse, day), RACES, mulberry32(featuredSeed(boardDay(state.profile.purse, day))))
      const races = 8 + Math.floor(rng.next() * 60)
      for (let i = 0; i < races; i += 1) {
        const featured = pick(board)
        const race = rng.next() < 0.3 ? RACES.find((entry) => entry.id === featured)! : pick(RACES)
        const expedition = rng.next() < 0.05 ? { familyWon: rng.next() < 0.5 } : undefined
        const result = settleRacePrize(state.profile, {
          resultId: `r${(n += 1)}`, raceId: race.id, grade: race.grade, place: 1 + Math.floor(rng.next() * 9), localDay: day, board,
          ...(expedition ? { expedition } : {}),
        }, (now += 60_000))
        if (isRefusal(result)) throw new Error(result.reason)
        state = { ...state, profile: result.profile, ledger: [...state.ledger, ...result.ledger] }
      }
      for (const [sku, qty] of [[SPEED_TICKET_ID, 1 + Math.floor(rng.next() * 40)], [carrot, 1 + Math.floor(rng.next() * 30)]] as const) {
        const bought = buy(state, { opId: `b${(n += 1)}`, sku, qty, unitPrice: buyPrice(sku)! }, (now += 1_000))
        if (isRefusal(bought)) { refusals += 1; continue }
        state = bought.state
        itemRows.push(...bought.receipt.itemLedger)
      }
      const held = state.items?.[carrot] ?? 0
      if (held > 0) {
        const sold = sell(state, { opId: `s${(n += 1)}`, itemId: carrot, qty: 1 + Math.floor(rng.next() * held), unitPrice: sellPrice(carrot)! }, (now += 1_000))
        if (isRefusal(sold)) throw new Error(sold.reason)
        state = sold.state
        itemRows.push(...sold.receipt.itemLedger)
      }
    }
    const money = state.ledger.filter((row) => row.resource === 'prize-money')
    expect(money.length).toBeGreaterThan(500)
    expect(new Set(money.map((row) => row.reason))).toEqual(new Set(['race-prize', 'featured-bonus', 'buy', 'sell']))
    expect(ledgerTotal(state.ledger, 'prize-money')).toBe(state.profile.prizeMoney)
    expect(state.profile.prizeMoney).toBeGreaterThanOrEqual(0)
    expect(ledgerTotal(state.ledger, 'uma-tickets')).toBe(state.profile.umaTickets)
    for (const [itemId, count] of Object.entries(state.items ?? {})) expect(itemLedgerTotal(itemRows, itemId), itemId).toBe(count)
    const ids = [...state.ledger, ...itemRows].map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^(initial-uma-tickets|race:r\d+:(prize|featured)|buy:b\d+:(pay|get)|sell:s\d+:(give|pay))$/)
    expect(refusals).toBeLessThan(10)
  })
})
