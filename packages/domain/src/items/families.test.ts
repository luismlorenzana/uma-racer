// Pins the eight families, the ring and the stat cycle (docs/game/08-item-catalogue-and-recipes.md §2, §4.2, D330).
import { describe, expect, it } from 'vitest'
import { FAMILIES, FAMILY_IDS, FAMILY_RING, familyFor, STAT_CYCLE } from './families'

/** 08 §2: family (id), planet dish style and where its dishes go, in the page's order. */
const SECTION_2 = [
  ['Sweets', 'sweets', 'Cakes', 'speed'],
  ['Fruits', 'fruits', 'Tarts', 'stamina'],
  ['Fish', 'fish', 'Grills', 'power'],
  ['Nuts & Seeds', 'nuts-seeds', 'Cookies', 'guts'],
  ['Herbs & Spices', 'herbs-spices', 'Curries', 'wit'],
  ['Grains', 'grains', 'Breads', 'skill'],
  ['Vegetables', 'vegetables', 'Salads', 'constellation'],
  ['Mushrooms', 'mushrooms', 'Soups', 'inspiration'],
] as const

describe('families (08 §2)', () => {
  it('are the eight of 08 §2, in its order, with their dish styles and destinations', () => {
    expect(FAMILY_IDS).toEqual(SECTION_2.map(([, id]) => id))
    expect(Object.keys(FAMILIES)).toEqual(FAMILY_IDS)
    for (const [name, id, dishStyle, destination] of SECTION_2) {
      expect(FAMILIES[id]).toEqual({ id, name, destination, dishStyle })
      expect(familyFor(destination)).toBe(id)
    }
    expect(Object.isFrozen(FAMILIES)).toBe(true)
  })

  it('sit on uma-art\'s ring: Grains – Vegetables – Mushrooms – Fruits – Herbs & Spices – Fish – Sweets – Nuts & Seeds', () => {
    expect(FAMILY_RING).toEqual(['grains', 'vegetables', 'mushrooms', 'fruits', 'herbs-spices', 'fish', 'sweets', 'nuts-seeds'])
    expect([...FAMILY_RING].sort()).toEqual([...FAMILY_IDS].sort())
  })

  it('cycle the stats Fruits → Herbs & Spices → Fish → Sweets → Nuts & Seeds, the stat row Stamina – Wit – Power – Speed – Guts', () => {
    expect(STAT_CYCLE).toEqual(['fruits', 'herbs-spices', 'fish', 'sweets', 'nuts-seeds'])
    expect(STAT_CYCLE.map((family) => FAMILIES[family].destination)).toEqual(['stamina', 'wit', 'power', 'speed', 'guts'])
  })

  it('refuses a destination no family feeds', () => {
    expect(() => familyFor('sun' as never)).toThrow(RangeError)
  })
})
