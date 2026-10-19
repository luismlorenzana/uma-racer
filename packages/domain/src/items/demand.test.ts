// Checks the recipes against 08 §7 (docs/game/08-item-catalogue-and-recipes.md): the representative deck's dish
// table, expanded through the recipes, gives §7's crafted table cell for cell. §7's numbers belong to the layers and the
// deck: T132 rewrote them from `tierDemand` (D348, bonds at their era's odd grade) and renders them live. This test only
// checks the expansion, with both tables copied as T132 wrote them.
import { describe, expect, it } from 'vitest'
import { DUOS, FEASTS, planetDish, tonicItem, type ItemGrade } from './catalogue'
import { craftedDemand } from './demand'
import { FAMILY_IDS, type FamilyId } from './families'

const cells = (row: string) => row.split('|').slice(1, -1).map((cell) => cell.trim())
const number = (cell: string) => (cell === '' ? 0 : Number(cell.replace(/\*/g, '')))
const FAMILY_BY_NAME: Readonly<Record<string, FamilyId>> = {
  Vegetables: 'vegetables', Mushrooms: 'mushrooms', Sweets: 'sweets', Fruits: 'fruits', Fish: 'fish', 'Nuts & Seeds': 'nuts-seeds',
  'Herbs & Spices': 'herbs-spices', Grains: 'grains',
}

/** 08 §7 "Meals and tonics, per Uma per tier" (D375): row, grades 1–10, total. */
const DISHES = [
  '| Sweets meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |',
  '| Fruits meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |',
  '| Fish meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |',
  '| Nuts & Seeds meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |',
  '| Herbs & Spices meals | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 1 | 0 | **5** |',
  '| Duos | | | 4 | | 4 | | | | | | **8** |',
  '| Feasts | | | | 1 | | 1 | | 1 | | 1 | **4** |',
  '| Tonics | 8 | 6 | 2 | 4 | 4 | 2 | 2 | 2 | 2 | 2 | **34** |',
  '| **All** | | | | | | | | | | | **71** |',
]

/** 08 §7 "Crafted items, per Uma per tier": family, grades 1–10, total, own meals and tonics, sides. */
const CRAFTED = [
  '| Grains | 8 | 7 | 2 | 5 | 4 | 3 | 2 | 3 | 2 | 2 | **38** | 34 | 4 |',
  '| Sweets | 6 | 0 | 9 | 1 | 9 | 1 | 5 | 1 | 4 | 1 | **37** | 32 | 5 |',
  '| Fruits | 8 | 0 | 9 | 1 | 7 | 1 | 5 | 1 | 4 | 1 | **37** | 28 | 9 |',
  '| Fish | 6 | 0 | 9 | 1 | 9 | 1 | 5 | 1 | 4 | 1 | **37** | 32 | 5 |',
  '| Nuts & Seeds | 8 | 0 | 9 | 1 | 7 | 1 | 5 | 1 | 4 | 1 | **37** | 28 | 9 |',
  '| Herbs & Spices | 6 | 0 | 9 | 1 | 9 | 1 | 5 | 1 | 4 | 1 | **37** | 32 | 5 |',
  '| Vegetables | 8 | 6 | 2 | 4 | 4 | 2 | 2 | 2 | 2 | 2 | **34** | 34 | 0 |',
  '| Mushrooms | 8 | 6 | 2 | 4 | 4 | 2 | 2 | 2 | 2 | 2 | **34** | 34 | 0 |',
  '| **All** | | | | | | | | | | | **291** | 254 | 37 |',
]

/** The representative deck's meal and tonic counts, from §7's table: one of each Duo per Duo grade, one Feast per grade. */
function representativeDishes(): Record<string, number> {
  const counts: Record<string, number> = {}
  let total = 0
  for (const row of DISHES) {
    const [label, ...rest] = cells(row)
    const byGrade = rest.slice(0, 10).map(number), rowTotal = number(rest[10]!)
    if (label === '**All**') { expect(total).toBe(rowTotal); continue }
    expect(byGrade.reduce((a, b) => a + b, 0), label).toBe(rowTotal)
    total += rowTotal
    byGrade.forEach((n, i) => {
      if (n === 0) return
      const g = (i + 1) as ItemGrade
      if (label === 'Duos') {
        const duos = DUOS.filter((duo) => duo.grade === g)
        expect(duos).toHaveLength(n)
        for (const duo of duos) counts[duo.id] = 1
      } else if (label === 'Feasts') {
        counts[FEASTS.find((feast) => feast.grade === g)!.id] = n
      } else if (label === 'Tonics') {
        counts[tonicItem(g).id] = n
      } else {
        counts[planetDish(FAMILY_BY_NAME[label!.replace(/ meals$/, '')]!, g).id] = n
      }
    })
  }
  return counts
}

describe('crafted demand (08 §7)', () => {
  it('turns the representative deck\'s 37 meals and 34 tonics into §7\'s 291 crafted items, cell for cell (D375)', () => {
    const dishes = representativeDishes()
    expect(Object.values(dishes).reduce((a, b) => a + b, 0)).toBe(71)
    const demand = craftedDemand(dishes)
    for (const row of CRAFTED) {
      const [label, ...rest] = cells(row)
      const [total, own, sides] = rest.slice(10).map(number)
      if (label === '**All**') {
        expect([demand.total, demand.own, demand.sides]).toEqual([total, own, sides])
        continue
      }
      const family = demand.families[FAMILY_BY_NAME[label!]!]
      expect({ byGrade: family.byGrade, total: family.total, own: family.own, sides: family.sides }, label)
        .toEqual({ byGrade: rest.slice(0, 10).map(number), total, own, sides })
    }
    expect(demand.total).toBe(291)
    expect([demand.families.grains.own, demand.families.grains.sides]).toEqual([34, 4])
  })

  it('lists each crafted item needed, and sums to the family totals', () => {
    const demand = craftedDemand({ 'dish-vegetables-1': 3, 'feast-4': 1 })
    expect(demand.items).toEqual({
      'maple-syrup': 1, 'plum-preserve': 1, 'mackerel-fillet': 1, 'walnut-paste': 1, 'dried-thyme': 1,
      'wheat-flour': 3, 'rolled-oats': 1, 'chopped-carrot': 12,
    })
    expect(Object.keys(demand.items)).toEqual([
      'maple-syrup', 'plum-preserve', 'mackerel-fillet', 'walnut-paste', 'dried-thyme', 'wheat-flour', 'rolled-oats', 'chopped-carrot',
    ])
    expect(FAMILY_IDS.map((family) => demand.families[family].total)).toEqual([1, 1, 1, 1, 1, 4, 12, 0])
    expect([demand.total, demand.own, demand.sides]).toEqual([21, 17, 4])
  })

  it('takes no dish as nothing, and refuses ids that aren\'t dishes or tonics, or counts that aren\'t whole', () => {
    expect(craftedDemand({}).total).toBe(0)
    expect(craftedDemand({ 'tonic-2': 2 }).items).toEqual({ 'diced-potato': 2, 'dried-shiitake': 2, 'rolled-oats': 2 })
    expect(craftedDemand({ 'dish-fish-1': 0 }).items).toEqual({})
    expect(() => craftedDemand({ honey: 1 })).toThrow(RangeError)
    expect(() => craftedDemand({ nope: 1 })).toThrow(RangeError)
    expect(() => craftedDemand({ 'dish-fish-1': 1.5 })).toThrow(RangeError)
    expect(() => craftedDemand({ 'dish-fish-1': -1 })).toThrow(RangeError)
  })
})
