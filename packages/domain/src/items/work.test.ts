// Pins step times and work values (docs/game/08-item-catalogue-and-recipes.md §3, §8; 12 §4; D338). Expected values
// are 08's tables copied as written.
import { describe, expect, it } from 'vitest'
import { DUOS, FEASTS, ITEM_GRADE_LIST, ITEMS, craftedItem, planetDish, rawItem, SPEED_TICKET_ID, type ItemGrade } from './catalogue'
import { FAMILY_IDS } from './families'
import {
  cookBaseMinutes, cookSeconds, craftBaseMinutes, craftSeconds, gatherBaseMinutes, gatherSeconds, workValueBaseMinutes,
  workValueSeconds,
} from './work'

const cells = (row: string) => row.split('|').slice(1, -1).map((cell) => cell.trim())
const number = (cell: string) => (cell === '' ? null : Number(cell.replace(/,/g, '')))

/** 08 §3's grade ladder in base minutes, rows as written. */
const SECTION_3_LADDER = [
  '| 1 | 1 | 90 | 22.5 | 112.5 | 240 | 802.5 | |',
  '| 2 | 6 | 95 | 23.75 | 118.75 | 250 | 837.5 | |',
  '| 3 | 11 | 100 | 25 | 125 | 260 | 872.5 | |',
  '| 4 | 16 | 105 | 26.25 | 131.25 | 270 | 913.75 | 1,045 |',
  '| 5 | 21 | 110 | 27.5 | 137.5 | 280 | 955 | |',
  '| 6 | 26 | 115 | 28.75 | 143.75 | 290 | 996.25 | 1,140 |',
  '| 7 | 31 | 120 | 30 | 150 | 300 | 1,037.5 | |',
  '| 8 | 36 | 125 | 31.25 | 156.25 | 310 | 1,078.75 | 1,235 |',
  '| 9 | 41 | 130 | 32.5 | 162.5 | 320 | 1,120 | |',
  '| 10 | 46 | 135 | 33.75 | 168.75 | 330 | 1,161.25 | 1,330 |',
]

/** 08 §8's work values in real minutes, rows as written. */
const SECTION_8 = [
  '| 1 | 108 | 135 | 963 | | 36 / 45 / 321 |',
  '| 2 | 114 | 142.5 | 1,005 | | 38 / 47.5 / 335 |',
  '| 3 | 120 | 150 | 1,047 | | 40 / 50 / 349 |',
  '| 4 | 126 | 157.5 | 1,096.5 | 1,254 | 42 / 52.5 / 365.5 (Feast 418) |',
  '| 5 | 132 | 165 | 1,146 | | 44 / 55 / 382 |',
  '| 6 | 138 | 172.5 | 1,195.5 | 1,368 | 46 / 57.5 / 398.5 (Feast 456) |',
  '| 7 | 144 | 180 | 1,245 | | 48 / 60 / 415 |',
  '| 8 | 150 | 187.5 | 1,294.5 | 1,482 | 50 / 62.5 / 431.5 (Feast 494) |',
  '| 9 | 156 | 195 | 1,344 | | 52 / 65 / 448 |',
  '| 10 | 162 | 202.5 | 1,393.5 | 1,596 | 54 / 67.5 / 464.5 (Feast 532) |',
]

const feastAt = (g: number) => FEASTS.find((feast) => feast.grade === g)

describe('step times (08 §3, 12 §4)', () => {
  it('match 08 §3\'s ladder in base minutes: gather 90 … 135, craft a quarter, cook 240 … 330', () => {
    SECTION_3_LADDER.forEach((row, i) => {
      const g = (i + 1) as ItemGrade
      const [grade, , gather, craft, , cook] = cells(row).map(number)
      expect(grade).toBe(g)
      expect([gatherBaseMinutes(g), craftBaseMinutes(g), cookBaseMinutes(g)]).toEqual([gather, craft, cook])
    })
  })

  it('are whole seconds at the time factor: 6,480 s, 1,620 s and 17,280 s at grade 1', () => {
    expect([gatherSeconds(1), craftSeconds(1), cookSeconds(1)]).toEqual([6_480, 1_620, 17_280])
    expect([gatherSeconds(10), craftSeconds(10), cookSeconds(10)]).toEqual([9_720, 2_430, 23_760])
    for (const g of ITEM_GRADE_LIST) {
      for (const seconds of [gatherSeconds(g), craftSeconds(g), cookSeconds(g)]) expect(Number.isInteger(seconds)).toBe(true)
    }
    expect(() => gatherSeconds(0 as never)).toThrow(RangeError)
  })
})

describe('work values in base minutes (08 §3)', () => {
  it('give one crafted item 112.5 … 168.75, a planet or Duo chain 802.5 … 1,161.25 and Feasts 1,045 … 1,330', () => {
    SECTION_3_LADDER.forEach((row, i) => {
      const g = (i + 1) as ItemGrade
      const [, , gather, , oneCrafted, , chain, feast] = cells(row).map(number)
      for (const family of FAMILY_IDS) {
        expect(workValueBaseMinutes(rawItem(family, g).id)).toBe(gather)
        expect(workValueBaseMinutes(craftedItem(family, g).id)).toBe(oneCrafted)
        expect(workValueBaseMinutes(planetDish(family, g).id)).toBe(chain)
      }
      for (const duo of DUOS.filter((d) => d.grade === g)) expect(workValueBaseMinutes(duo.id)).toBe(chain)
      expect(feastAt(g) ? workValueBaseMinutes(feastAt(g)!.id) : null).toBe(feast)
    })
  })
})

describe('work values in real minutes (08 §8)', () => {
  it('give raw 108 … 162, crafted 135 … 202.5, planet or Duo 963 … 1,393.5 and Feasts 1,254 … 1,596', () => {
    SECTION_8.forEach((row, i) => {
      const g = (i + 1) as ItemGrade
      const [grade, raw, crafted, dish, feast] = cells(row).map(number)
      expect(grade).toBe(g)
      for (const family of FAMILY_IDS) {
        expect(workValueSeconds(rawItem(family, g).id)! / 60).toBe(raw)
        expect(workValueSeconds(craftedItem(family, g).id)! / 60).toBe(crafted)
        expect(workValueSeconds(planetDish(family, g).id)! / 60).toBe(dish)
      }
      for (const duo of DUOS.filter((d) => d.grade === g)) expect(workValueSeconds(duo.id)! / 60).toBe(dish)
      expect(feastAt(g) ? workValueSeconds(feastAt(g)!.id)! / 60 : null).toBe(feast)
    })
  })

  it('are whole seconds, the same for every family at a grade, and a Duo costs a planet dish of its grade', () => {
    for (const item of ITEMS) {
      const seconds = workValueSeconds(item.id)
      if (item.kind === 'ticket') { expect(seconds).toBeNull(); continue }
      expect(Number.isInteger(seconds), item.id).toBe(true)
    }
    for (const g of ITEM_GRADE_LIST) {
      for (const make of [rawItem, craftedItem, planetDish]) {
        expect(new Set(FAMILY_IDS.map((family) => workValueSeconds(make(family, g).id))).size).toBe(1)
      }
    }
    for (const duo of DUOS) expect(workValueSeconds(duo.id)).toBe(workValueSeconds(planetDish('fish', duo.grade).id))
  })

  it('walk the recipe: a crafted item is its raw plus its craft, a dish its inputs plus its cook', () => {
    expect(workValueSeconds('honey')).toBe(workValueSeconds('honeycomb')! + craftSeconds(1))
    expect(workValueSeconds('feast-4')).toBe(
      ['maple-syrup', 'plum-preserve', 'mackerel-fillet', 'walnut-paste', 'dried-thyme', 'rolled-oats']
        .reduce((n, id) => n + workValueSeconds(id)!, 0) + cookSeconds(4),
    )
    expect(workValueBaseMinutes(SPEED_TICKET_ID)).toBeNull()
    expect(workValueSeconds(SPEED_TICKET_ID)).toBeNull()
    expect(workValueSeconds('nope')).toBeUndefined()
    expect(workValueBaseMinutes('nope')).toBeUndefined()
  })
})
