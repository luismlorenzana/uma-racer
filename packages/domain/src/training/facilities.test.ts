// Pins the four facilities (docs/game/05-training-hub.md §1, D374): what each unlocks, the Gym rooms' meal families,
// its rooms and which room takes which unlock.
import { describe, expect, it } from 'vitest'
import { cardOf } from '../__fixtures__/training'
import { isRefusal } from '../state/types'
import { BUILDINGS, FACILITY_IDS } from '../farm/buildings'
import { cardTypesIn } from './bonds'
import { FACILITY_UNLOCKS, GYM_ROOM_FAMILY, roomAccepts, roomsFor } from './facilities'
import { fixedUnlock, bondUnlock, type Unlock } from './unlocks'

const fixed = (kind: Unlock['kind'], target: string): Unlock => fixedUnlock({ kind, target })!
const bond = (id: string): Unlock => {
  const entry = bondUnlock(cardOf(id), 1, 5)
  if (isRefusal(entry)) throw new Error(entry.reason)
  return entry
}

describe('facilities', () => {
  it('unlock nodes, Inspiration, Extra Stats and bonds; each Gym room takes its stat family\'s meals', () => {
    expect(FACILITY_IDS).toEqual(['observatory', 'lineage-hall', 'gym', 'dojo'])
    expect(FACILITY_UNLOCKS).toEqual({ observatory: ['node'], 'lineage-hall': ['slot', 'unique', 'gold'], gym: ['single', 'duo', 'sun'], dojo: ['bond'] })
    expect(GYM_ROOM_FAMILY).toEqual({ stamina: 'fruits', wit: 'herbs-spices', power: 'fish', speed: 'sweets', guts: 'nuts-seeds' })
    // T127's rooms are the ring order at the Gym and the card types at the Dojo.
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

  it("takes a Dojo room's own card type, Friend and Group together, read from the content (D374)", () => {
    const typeOf = cardTypesIn(new Map(['speed-e1', 'friend-e2', 'group-e3'].map((id) => [id, cardOf(id)])))
    expect(roomAccepts('speed', bond('speed-e1'), typeOf)).toBe(true)
    expect(roomAccepts('stamina', bond('speed-e1'), typeOf)).toBe(false)
    expect(roomAccepts('friend-group', bond('friend-e2'), typeOf)).toBe(true)
    expect(roomAccepts('friend-group', bond('group-e3'), typeOf)).toBe(true)
    expect(roomAccepts('wit', bond('group-e3'), typeOf)).toBe(false)
    // Without the content's card, a bond has no room.
    expect(roomsFor(bond('speed-e1'))).toEqual([])
  })

  it('has no room at the Observatory and the Lineage Hall', () => {
    expect(roomAccepts(null, fixed('node', 'n3'))).toBe(true)
    expect(roomAccepts('speed', fixed('node', 'n3'))).toBe(false)
    expect(roomAccepts(null, fixed('gold', 'parent0:gold1'))).toBe(true)
    expect(roomsFor(fixed('slot', 'parent0'))).toEqual([])
  })
})
