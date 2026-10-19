// Pins the eight families, the ring and the stat cycle (docs/game/08-item-catalogue-and-recipes.md §2, §4.2, D330,
// D375).
import { describe, expect, it } from 'vitest'
import { FAMILIES, FAMILY_IDS, FAMILY_RING, familyFor, STAT_CYCLE, TONIC_FAMILIES } from './families'

/** 08 §2: family (id), planet dish style, where its dishes went, and what it feeds since D375, in the page's order. */
const SECTION_2 = [
  ['Sweets', 'sweets', 'Cakes', 'speed', 'speed'],
  ['Fruits', 'fruits', 'Tarts', 'stamina', 'stamina'],
  ['Fish', 'fish', 'Grills', 'power', 'power'],
  ['Nuts & Seeds', 'nuts-seeds', 'Cookies', 'guts', 'guts'],
  ['Herbs & Spices', 'herbs-spices', 'Curries', 'wit', 'wit'],
  ['Grains', 'grains', 'Breads', 'skill', 'tonic'],
  ['Vegetables', 'vegetables', 'Salads', 'constellation', 'tonic'],
  ['Mushrooms', 'mushrooms', 'Soups', 'inspiration', 'tonic'],
] as const

describe('families (08 §2)', () => {
  it('are the eight of 08 §2, in its order, with their dish styles, destinations and what they feed', () => {
    expect(FAMILY_IDS).toEqual(SECTION_2.map(([, id]) => id))
    expect(Object.keys(FAMILIES)).toEqual(FAMILY_IDS)
    for (const [name, id, dishStyle, destination, feeds] of SECTION_2) {
      expect(FAMILIES[id]).toEqual({ id, name, destination, feeds, dishStyle })
      expect(familyFor(destination)).toBe(id)
    }
    expect(Object.isFrozen(FAMILIES)).toBe(true)
  })

  it('give a tonic one crafted Vegetables, Mushrooms and Grains item: the three families that feed no stat (D375)', () => {
    expect(TONIC_FAMILIES).toEqual(['vegetables', 'mushrooms', 'grains'])
    expect(FAMILY_IDS.filter((family) => FAMILIES[family].feeds === 'tonic').sort()).toEqual([...TONIC_FAMILIES].sort())
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
