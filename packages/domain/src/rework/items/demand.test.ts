// Checks the recipes against 08 §7 (docs/rework/08-item-catalogue-and-recipes.md): the representative deck's dish
// table, expanded through the recipes, gives §7's crafted table cell for cell. §7's numbers belong to the layers and the
// deck: T132 rewrote them from `tierDemand` (D348, bonds at their era's odd grade) and renders them live. This test only
// checks the expansion, with both tables copied as T132 wrote them.
import { describe, expect, it } from 'vitest'
import { DUOS, FEASTS, planetDish, type ItemGrade } from './catalogue'
import { craftedDemand } from './demand'
import { FAMILY_IDS, type FamilyId } from './families'

const cells = (row: string) => row.split('|').slice(1, -1).map((cell) => cell.trim())
const number = (cell: string) => (cell === '' ? 0 : Number(cell.replace(/\*/g, '')))
const FAMILY_BY_NAME: Readonly<Record<string, FamilyId>> = {
  Vegetables: 'vegetables', Mushrooms: 'mushrooms', Sweets: 'sweets', Fruits: 'fruits', Fish: 'fish', 'Nuts & Seeds': 'nuts-seeds',
  'Herbs & Spices': 'herbs-spices', Grains: 'grains',
}

/** 08 §7 "Planet dishes, per Uma per tier": family, grades 1–10, total. */
const DISHES = [
  '| Vegetables | 6 | 6 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | **28** |',
  '| Mushrooms | 2 | 2 | 4 | 2 | 2 | 2 | 3 | 3 | 2 | 2 | **24** |',
  '| Sweets | 2 | 0 | 2 | 0 | 1 | 0 | 2 | 0 | 1 | 0 | **8** |',
  '| Fruits | 2 | 0 | 2 | 0 | 1 | 0 | 2 | 0 | 1 | 0 | **8** |',
  '| Fish | 2 | 0 | 2 | 0 | 1 | 0 | 2 | 0 | 1 | 0 | **8** |',
  '| Nuts & Seeds | 2 | 0 | 1 | 0 | 2 | 0 | 1 | 0 | 2 | 0 | **8** |',
  '| Herbs & Spices | 2 | 0 | 1 | 0 | 2 | 0 | 1 | 0 | 2 | 0 | **8** |',
  '| Grains | 1 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 0 | **3** |',
  '| Duos | | | 4 | | 4 | | | | | | **8** |',
  '| Feasts | | | | 1 | | 1 | | 1 | | 1 | **4** |',
  '| **All** | | | | | | | | | | | **107** |',
]

/** 08 §7 "Crafted items, per Uma per tier": family, grades 1–10, total, own dishes/Duos/Feasts, sides. */
const CRAFTED = [
  '| Vegetables | 24 | 24 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | **112** | 112 | 0 |',
  '| Herbs & Spices | 12 | 0 | 8 | 1 | 13 | 1 | 5 | 1 | 8 | 1 | **50** | 44 | 6 |',
  '| Sweets | 12 | 0 | 12 | 1 | 9 | 1 | 11 | 1 | 4 | 1 | **52** | 44 | 8 |',
  '| Fruits | 15 | 0 | 12 | 1 | 8 | 1 | 10 | 1 | 4 | 1 | **53** | 40 | 13 |',
  '| Fish | 11 | 0 | 12 | 1 | 10 | 1 | 9 | 1 | 4 | 1 | **50** | 44 | 6 |',
  '| Nuts & Seeds | 13 | 0 | 9 | 1 | 12 | 1 | 5 | 1 | 8 | 1 | **51** | 40 | 11 |',
  '| Grains | 26 | 5 | 11 | 5 | 9 | 6 | 4 | 5 | 4 | 0 | **75** | 12 | 63 |',
  '| Mushrooms | 8 | 8 | 16 | 8 | 8 | 8 | 12 | 12 | 8 | 8 | **96** | 96 | 0 |',
  '| **All** | | | | | | | | | | | **539** | 432 | 107 |',
]

/** The representative deck's dish counts, from §7's dish table: one of each Duo per Duo grade, one Feast per grade. */
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
      } else {
        counts[planetDish(FAMILY_BY_NAME[label!]!, g).id] = n
      }
    })
  }
  return counts
}

describe('crafted demand (08 §7)', () => {
  it('turns the representative deck\'s 107 dishes into §7\'s 539 crafted items, cell for cell', () => {
    const dishes = representativeDishes()
    expect(Object.values(dishes).reduce((a, b) => a + b, 0)).toBe(107)
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
    expect(demand.total).toBe(539)
    expect([demand.families.grains.own, demand.families.grains.sides]).toEqual([12, 63])
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

  it('takes no dish as nothing, and refuses ids that aren\'t dishes or counts that aren\'t whole', () => {
    expect(craftedDemand({}).total).toBe(0)
    expect(craftedDemand({ 'dish-fish-1': 0 }).items).toEqual({})
    expect(() => craftedDemand({ honey: 1 })).toThrow(RangeError)
    expect(() => craftedDemand({ nope: 1 })).toThrow(RangeError)
    expect(() => craftedDemand({ 'dish-fish-1': 1.5 })).toThrow(RangeError)
    expect(() => craftedDemand({ 'dish-fish-1': -1 })).toThrow(RangeError)
  })
})
