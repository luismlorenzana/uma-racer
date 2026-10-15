// Pins the four facilities (docs/rework/05-training-hub.md §1): what each unlocks, its dish families, its rooms and
// which room takes which unlock.
import { describe, expect, it } from 'vitest'
import { cardOf } from '../__fixtures__/training'
import { isRefusal } from '../state/types'
import { BUILDINGS, FACILITY_IDS } from '../farm/buildings'
import { FACILITY_DISH_FAMILY, FACILITY_UNLOCKS, roomAccepts, roomsFor } from './facilities'
import { fixedUnlock, bondUnlock, type Unlock } from './unlocks'

const fixed = (kind: Unlock['kind'], target: string): Unlock => fixedUnlock({ kind, target })!
const bond = (id: string): Unlock => {
  const entry = bondUnlock(cardOf(id), 1, 5)
  if (isRefusal(entry)) throw new Error(entry.reason)
  return entry
}

describe('facilities', () => {
  it('unlock nodes, Inspiration, Extra Stats and bonds, with Vegetables, Mushrooms, the stat families and Grains', () => {
    expect(FACILITY_IDS).toEqual(['observatory', 'lineage-hall', 'gym', 'dojo'])
    expect(FACILITY_UNLOCKS).toEqual({ observatory: ['node'], 'lineage-hall': ['slot', 'unique', 'gold'], gym: ['single', 'duo', 'sun'], dojo: ['bond'] })
    expect(FACILITY_DISH_FAMILY).toEqual({
      observatory: 'vegetables',
      'lineage-hall': 'mushrooms',
      gym: { stamina: 'fruits', wit: 'herbs-spices', power: 'fish', speed: 'sweets', guts: 'nuts-seeds' },
      dojo: { speed: 'sweets', stamina: 'fruits', power: 'fish', guts: 'nuts-seeds', wit: 'herbs-spices', 'friend-group': 'grains' },
    })
    // T127's rooms are the ring order at the Gym and the card types at the Dojo, and the dish families follow them.
    expect(Object.fromEntries(FACILITY_IDS.map((facility) => [facility, BUILDINGS[facility].rooms]))).toEqual({
      observatory: [], 'lineage-hall': [], gym: ['stamina', 'wit', 'power', 'speed', 'guts'],
      dojo: ['speed', 'stamina', 'power', 'guts', 'wit', 'friend-group'],
    })
  })
})

describe('roomAccepts', () => {
  it("takes a Gym room's own singles, a Duo with its stat in either room, and a Sun in any", () => {
    expect(roomsFor(fixed('single', 'power-03'))).toEqual(['power'])
    expect(roomsFor(fixed('duo', 'duo-power-speed-3'))).toEqual(['power', 'speed'])
    expect(roomsFor(fixed('sun', 'sun-4'))).toEqual(['stamina', 'wit', 'power', 'speed', 'guts'])
    expect(roomAccepts('power', fixed('single', 'power-03'))).toBe(true)
    expect(roomAccepts('speed', fixed('single', 'power-03'))).toBe(false)
    expect(roomAccepts('speed', fixed('duo', 'duo-power-speed-3'))).toBe(true)
    expect(roomAccepts('guts', fixed('duo', 'duo-power-speed-3'))).toBe(false)
    expect(roomAccepts('guts', fixed('sun', 'sun-10'))).toBe(true)
    expect(roomAccepts(null, fixed('single', 'power-03'))).toBe(false)
  })

  it("takes a Dojo room's own card type, Friend and Group together", () => {
    expect(roomAccepts('speed', bond('speed-e1'))).toBe(true)
    expect(roomAccepts('stamina', bond('speed-e1'))).toBe(false)
    expect(roomAccepts('friend-group', bond('friend-e2'))).toBe(true)
    expect(roomAccepts('friend-group', bond('group-e3'))).toBe(true)
    expect(roomAccepts('wit', bond('group-e3'))).toBe(false)
  })

  it('has no room at the Observatory and the Lineage Hall', () => {
    expect(roomAccepts(null, fixed('node', 'n3'))).toBe(true)
    expect(roomAccepts('speed', fixed('node', 'n3'))).toBe(false)
    expect(roomAccepts(null, fixed('gold', 'parent0:gold1'))).toBe(true)
    expect(roomsFor(fixed('slot', 'parent0'))).toEqual([])
  })
})
