// The Warehouse's view model (07 §10; 09 §6, §6.1, §8; 08 §10): a running three-dish Kitchen job and one target give
// each row's held, reserved, coming and needed; the sell sizes, each confirmation's words, the Surplus total, the empty
// line and the shelves.
import { hasBannedWord } from '@racer/domain/check-in'
import { sellPrice, stackCounts } from '@racer/domain/economy'
import { neededFromStock, plan, targetsOf } from '@racer/domain/planner'
import { describe, expect, it } from 'vitest'
import { account, umaIds } from '../../__fixtures__/testing-ops'
import {
  biggestStacks, EMPTY_WORDS, filterRows, itemLine, largestShortfalls, recipesUsing, sellLabel, sellQuestion, sellSheet, sizeOffWords, surplusWorth,
  warehouse,
} from './model'
import { itemById } from '@racer/domain/items'

function kitchen() {
  const acc = account('fresh')
  for (const id of umaIds(2)) acc.run('unlock-uma', { outfitId: id })
  acc.run('dev-grant', { items: { 'chopped-carrot': 12, 'wheat-flour': 3, 'dish-vegetables-1': 4, carrot: 6, wheat: 5, 'dish-sweets-3': 1 } })
  acc.run('start', { outfitId: 'sim-uma-01', slot: { building: 'kitchen', slot: 0 }, request: { kind: 'cook', item: 'dish-vegetables-1', count: 3 } })
  acc.run('set-targets', { outfitIds: ['sim-uma-02'] })
  return acc
}

describe("a stack's counts", () => {
  it('holds what a running Kitchen job reserves and makes, and what the target needs, from one projection', () => {
    const acc = kitchen()
    const house = warehouse(acc.state, acc.at, acc.env)
    const row = (id: string) => house.counts(id)!
    // The job reserved twelve Chopped Carrot and three Wheat Flour: they left the Warehouse count.
    expect(row('chopped-carrot')).toMatchObject({ held: 0, reserved: 12, coming: 0 })
    expect(row('wheat-flour')).toMatchObject({ held: 0, reserved: 3, coming: 0 })
    expect(row('dish-vegetables-1')).toMatchObject({ held: 4, reserved: 0, coming: 3 })
    const planned = plan(acc.state, targetsOf(acc.state), acc.at, {}, acc.env)
    expect(targetsOf(acc.state)).toEqual(['sim-uma-02'])
    for (const id of ['dish-vegetables-1', 'carrot', 'dish-sweets-3']) expect(row(id).needed).toBe(neededFromStock(planned, id))
    // Her Observatory layer needs more Carrot Salads than the Warehouse holds, so all four are held back.
    expect(row('dish-vegetables-1').needed).toBe(4)
    expect(row('dish-sweets-3').needed).toBe(0)
    expect(itemLine(itemById('dish-vegetables-1')!)).toBe('Carrot Salad · Constellation · grade 1')
    expect(itemLine(itemById('carrot')!)).toBe('Carrot · Vegetables · grade 1')
    // Stacks with nothing held, reserved, coming or needed are hidden.
    expect(house.counts('honey')).toBeUndefined()
    expect(filterRows(house.rows, { shelf: 'dishes', family: null, grade: null }).map((r) => r.item.id)).toEqual(['dish-sweets-3', 'dish-vegetables-1'])
    expect(filterRows(house.rows, { shelf: 'raw', family: 'vegetables', grade: 1 }).map((r) => r.item.id)).toEqual(['carrot'])
  })

  it("reads 09 §8's line when the Warehouse is empty", () => {
    const acc = account('fresh')
    expect(warehouse(acc.state, acc.at, acc.env).rows).toEqual([])
    expect(EMPTY_WORDS).toBe("Nothing to sell yet: the Farm's first harvest lands here")
  })
})

describe('the stock sheet (09 §6.1)', () => {
  it('labels each size with what it sells: ×10 reads "Sell ×9" when 9 are held', () => {
    expect(sellLabel({ size: 'one', qty: 1 })).toBe('Sell ×1')
    expect(sellLabel({ size: 'ten', qty: 10 })).toBe('Sell ×10')
    expect(sellLabel({ size: 'ten', qty: 9 })).toBe('Sell ×9')
    expect(sellLabel({ size: 'ten', qty: 0 })).toBe('Sell ×10')
    expect(sellLabel({ size: 'surplus', qty: 4 })).toBe('Surplus ×4')
    expect(sellLabel({ size: 'allFree', qty: 9 })).toBe('All free ×9')
  })

  it('offers ×1, ×10, Surplus and All free from stackCounts at sellPrice, a size of 0 off, and no Sell for Speed Tickets', () => {
    const acc = kitchen()
    acc.run('dev-grant', { items: { 'speed-ticket': 2 } })
    const house = warehouse(acc.state, acc.at, acc.env)
    const salad = sellSheet(house.counts('dish-vegetables-1')!)
    expect(salad.unitPrice).toBe(sellPrice('dish-vegetables-1'))
    expect(salad.options.map((option) => [option.size, option.qty, option.total])).toEqual([
      ['one', 1, 321], ['ten', 4, 1_284], ['surplus', 0, 0], ['allFree', 4, 1_284],
    ])
    expect(salad.counts).toEqual(stackCounts({ held: 4, reserved: 0, needed: 4 }))
    expect(sizeOffWords('surplus')).toBe('No surplus: the planner needs all of it.')
    const tickets = sellSheet(house.counts('speed-ticket')!)
    expect(tickets).toMatchObject({ unitPrice: null, options: [], noSale: "Speed Tickets can't be sold." })
    // Reserved items are never offered: All free is what the Warehouse holds.
    expect(sellSheet(house.counts('chopped-carrot')!).options.every((option) => option.qty === 0)).toBe(true)
  })

  it("asks the one question: a dish's work at live prices, what needed stock leaves short and for whom, or 1,000 or more", () => {
    const acc = kitchen()
    const house = warehouse(acc.state, acc.at, acc.env)
    const uma = (id: string) => acc.env.content.umas.get(id)!.name
    const option = (id: string, size: 'one' | 'ten' | 'allFree') => sellSheet(house.counts(id)!).options.find((o) => o.size === size)!
    expect(sellQuestion(house.counts('dish-sweets-3')!, option('dish-sweets-3', 'one'), house.plan, uma))
      .toBe('Sell 1 Sugar Beet Cake (grade 3) for 349? Each took about 17 hours of work.')
    expect(sellQuestion(house.counts('dish-vegetables-1')!, option('dish-vegetables-1', 'allFree'), house.plan, uma))
      .toBe(`Sell 4 Carrot Salad (grade 1) for 1,284? Each took about 16 hours of work. This leaves the planner 4 short for ${uma('sim-uma-02')}'s Observatory layer.`)
    const wheat = house.counts('wheat')!
    expect(wheat.needed).toBeGreaterThan(0)
    const wheatOne = option('wheat', 'one')
    expect(sellQuestion(wheat, wheatOne, house.plan, uma)).toBe(`Sell 1 Wheat (grade 1) for 36? This leaves the planner 1 short for ${uma('sim-uma-02')}'s Observatory layer.`)
    // Free stock under 1,000 sells without a word.
    acc.run('dev-grant', { items: { honey: 30 } })
    const honey = warehouse(acc.state, acc.at, acc.env).counts('honey')!
    expect(sellQuestion(honey, sellSheet(honey).options.find((o) => o.size === 'ten')!, house.plan, uma)).toBeNull()
    expect(sellQuestion(honey, sellSheet(honey).options.find((o) => o.size === 'allFree')!, house.plan, uma)).toBe(`Sell 30 Honey (grade 1) for 1,350? This leaves the planner 5 short for ${uma('sim-uma-02')}'s Gym layer.`)
  })

  it('names the recipes that take a stack', () => {
    expect(recipesUsing('chopped-carrot').map(({ item, qty }) => [item.id, qty])).toContainEqual(['dish-vegetables-1', 4])
    expect(recipesUsing('carrot').map(({ item }) => item.id)).toEqual(['chopped-carrot'])
  })
})

describe('the Peek (11 §3.1)', () => {
  it('lists the biggest stacks, the largest shortfalls and the surplus worth at sale prices', () => {
    const acc = kitchen()
    acc.run('dev-grant', { items: { honey: 30 } })
    const house = warehouse(acc.state, acc.at, acc.env)
    expect(biggestStacks(house.rows).map((row) => row.item.id)).toEqual(['honey', 'carrot', 'wheat'])
    const short = largestShortfalls(house.plan)
    expect(short.length).toBeGreaterThan(0)
    expect(short.every((line, i) => i === 0 || line.short <= short[i - 1]!.short)).toBe(true)
    const expected = house.rows.reduce((sum, row) => sum + stackCounts(row).sizes.surplus * (sellPrice(row.item.id) ?? 0), 0)
    expect(surplusWorth(house.rows)).toBe(expected)
    expect(surplusWorth(house.rows)).toBeGreaterThan(0)
  })

  it('says nothing banned', () => {
    for (const text of [EMPTY_WORDS, sizeOffWords('one'), sizeOffWords('surplus')]) expect(hasBannedWord(text), text).toBe(false)
  })
})
