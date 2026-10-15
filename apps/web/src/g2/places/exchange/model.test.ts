// The Exchange's view model (09 §5, §5.3, §5.5): raw rows stop at `stockedGrade` with `buyPrice`'s prices and the next
// grade's lock, the planner's badge, "Need N more", the one question at 1,000 or more, and the Peek's top shortage.
import { buyPrice, SPEED_TICKET_PRICE } from '@racer/domain/rework/exchange'
import { hasBannedWord } from '@racer/domain/rework/check-in'
import { describe, expect, it } from 'vitest'
import { account, umaIds } from '../../testing-ops'
import { buyCheck, buyQuestion, exchangeView, rawFamily, speedTicketPrice, topShortage, typedQty } from './model'

describe('raw ingredients (09 §5.3)', () => {
  it('stocks grade 1 on a new account, at buyPrice, with grade 2 locked in not-stocked\'s words', () => {
    const acc = account('fresh')
    const family = rawFamily(acc.state, null, 'vegetables')
    expect(family.rows.map((row) => [row.item.id, row.price, row.held])).toEqual([['carrot', 108, 0]])
    expect(family.rows[0]!.price).toBe(buyPrice('carrot'))
    expect(family.next).toMatchObject({ item: { id: 'potato' }, words: 'In stock once an Uma reaches Farm Lv 6.' })
  })

  it('stocks up to the highest grade any Uma has opened, and badges what the planner is short of', () => {
    const acc = account('fresh')
    for (const id of umaIds(2)) acc.run('unlock-uma', { outfitId: id })
    acc.run('set-targets', { outfitIds: ['sim-uma-02'] })
    // Farm Lv 11 opens grade 3 (5g − 4).
    const raised = { ...acc.state.umas['sim-uma-01']!, farm: { level: 11, exp: 0 } }
    acc.state = { ...acc.state, umas: { ...acc.state.umas, 'sim-uma-01': raised } }
    const view = exchangeView(acc.state, acc.at, acc.env)
    const family = rawFamily(view.current, view.plan, 'vegetables')
    expect(family.rows.map((row) => [row.grade, row.price])).toEqual([[1, 108], [2, 114], [3, 120]])
    expect(family.next?.words).toBe('In stock once an Uma reaches Farm Lv 16.')
    const carrot = family.rows[0]!
    const short = view.plan.raw.find((line) => line.item === 'carrot')!.short
    expect(short).toBeGreaterThan(0)
    expect(carrot.badge).toBe(`Vegetables G1 · short ${short}`)
    expect(rawFamily(view.current, view.plan, 'sweets').rows[2]!.badge).toBeNull()
  })
})

describe('Buy (09 §5.5)', () => {
  it('is off with "Need N more" when Prize Money is short, and asks once at 1,000 or more', () => {
    expect(speedTicketPrice()).toBe(SPEED_TICKET_PRICE)
    expect(buyCheck(200, 30, 10)).toEqual({ total: 300, short: 'Need 100 more.', asks: false })
    expect(buyCheck(5_000, 30, 10)).toEqual({ total: 300, short: null, asks: false })
    expect(buyCheck(5_000, 108, 10)).toEqual({ total: 1_080, short: null, asks: true })
    expect(buyCheck(500, 108, 99).short).toBe('Need 10,192 more.')
    expect(buyQuestion(10, 'Carrot', 1_080)).toBe('Buy 10 Carrot for 1,080?')
  })

  it('reads a typed amount from 1', () => {
    expect([typedQty('12'), typedQty(' 3 '), typedQty('0'), typedQty('two'), typedQty('1.5'), typedQty('')]).toEqual([12, 3, null, null, null, null])
  })

  it("prices the planner's top raw shortage the Exchange can fill (buyFor)", () => {
    const acc = account('fresh')
    for (const id of umaIds(2)) acc.run('unlock-uma', { outfitId: id })
    acc.run('set-targets', { outfitIds: ['sim-uma-02'] })
    const view = exchangeView(acc.state, acc.at, acc.env)
    const top = topShortage(view.current, view.plan)
    expect(top).not.toBeNull()
    expect(top!.total).toBe(top!.line.short * buyPrice(top!.line.item)!)
    for (const text of [buyCheck(10, 30, 1).short!, buyQuestion(1, 'Carrot', 36)]) expect(hasBannedWord(text), text).toBe(false)
  })
})
