// Pins bonds (docs/game/06-cards-and-bonds.md §2, D375): the Dojo room by card type, 06 §2's era-to-grade table in all
// three tiers, and a bond's status. A bond takes no item.
import { describe, expect, it } from 'vitest'
import { cardOf } from '../__fixtures__/training'
import { emptyBuild } from '../state/types'
import { bondGrade, bondStatus, cardTypesIn, dojoRoomOf } from './bonds'

describe('the Dojo room by card type', () => {
  it('is each stat type\'s own room, and one room for Friend and Group', () => {
    expect((['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group'] as const).map(dojoRoomOf))
      .toEqual(['speed', 'stamina', 'power', 'guts', 'wit', 'friend-group', 'friend-group'])
  })

  it('reads a card\'s type from the content, or none for a card it lacks', () => {
    const typeOf = cardTypesIn(new Map([['wit-e3', cardOf('wit-e3')]]))
    expect([typeOf('wit-e3'), typeOf('nope')]).toEqual(['wit', undefined])
    expect(cardTypesIn(undefined)('wit-e3')).toBeUndefined()
  })
})

describe('the grade by era (06 §2)', () => {
  it('is 2p − 1 with p = max(1, era − 5(tier − 1)), and none past the tier', () => {
    const table = Array.from({ length: 15 }, (_, i) => [1, 2, 3].map((tier) => bondGrade(i + 1, tier as 1)))
    expect(table).toEqual([
      [1, 1, 1], [3, 1, 1], [5, 1, 1], [7, 1, 1], [9, 1, 1],
      [null, 1, 1], [null, 3, 1], [null, 5, 1], [null, 7, 1], [null, 9, 1],
      [null, null, 1], [null, null, 3], [null, null, 5], [null, null, 7], [null, null, 9],
    ])
    expect(() => bondGrade(0, 1)).toThrow(RangeError)
  })

  it('sets the session\'s grade: Speed era 1 grade 1, Friend era 2 grade 3, Wit era 3 grade 5, all grade 1 in tier 2', () => {
    expect(['speed-e1', 'friend-e2', 'wit-e3'].map((id) => bondGrade(cardOf(id).era, 1))).toEqual([1, 3, 5])
    expect(['speed-e1', 'friend-e2', 'wit-e3'].map((id) => bondGrade(cardOf(id).era, 2))).toEqual([1, 1, 1])
    expect(bondGrade(cardOf('speed-e6').era, 1)).toBeNull()
  })
})

describe('bondStatus', () => {
  const build = { ...emptyBuild(null), bonds: ['speed-e1'] }
  it('is bonded, pending, available, or refused past the era', () => {
    expect(bondStatus(build, cardOf('speed-e1'), 1)).toEqual({ status: 'bonded' })
    expect(bondStatus(build, cardOf('wit-e1'), 1, [{ kind: 'bond', target: 'wit-e1' }])).toEqual({ status: 'pending' })
    expect(bondStatus(build, cardOf('wit-e1'), 1, [{ kind: 'node', target: 'wit-e1' }])).toEqual({ status: 'available' })
    expect(bondStatus(build, cardOf('wit-e2'), 2)).toEqual({ status: 'available' })
    expect(bondStatus(build, cardOf('wit-e3'), 2)).toMatchObject({ refused: true, code: 'card-era', data: { scenario: 3, name: 'Trackblazer' } })
  })
})
