// The featured board (docs/rework/09-racing-rewards-and-exchange.md §4, §11) on a synthetic catalogue, drawn with the
// race engine's mulberry32 copied in as opponents.test.ts does.
import { describe, expect, it } from 'vitest'
import { RACES, days, mulberry32 } from '../../__fixtures__/rework-races'
import { stableHash } from '../../scenario-goals'
import { FEATURED_SLOTS, featuredBoard, featuredSeed, type CatalogueRace } from './featured'
import { dayNumber } from './purse'

const board = (day: string, races: readonly CatalogueRace[] = RACES) => featuredBoard(day, races, mulberry32(featuredSeed(day)))
const byId = new Map(RACES.map((race) => [race.id, race]))
const YEAR = days('2026-01-01', 366)

describe('the seed', () => {
  it("is today's stableHash of featured:YYYY-MM-DD", () => {
    expect(featuredSeed('2026-10-13')).toBe(stableHash('featured:2026-10-13'))
    expect(featuredSeed('2026-10-13')).toBe(PINNED_SEED)
    expect(() => featuredSeed('13/10/2026')).toThrow(RangeError)
  })
})

describe('featuredBoard', () => {
  it("pins the fixture's 2026-10-13 board, the same on every run", () => {
    expect(board('2026-10-13')).toEqual(PINNED_BOARD)
    expect(board('2026-10-13')).toEqual(board('2026-10-13'))
  })

  it('draws one G1, one G2 or G3 and one OP or Pre-OP, in that order, never a Debut or Maiden', () => {
    expect(FEATURED_SLOTS).toEqual([['g1'], ['g2', 'g3'], ['op', 'pre-op']])
    for (const day of YEAR) {
      const ids = board(day)
      expect(ids).toHaveLength(3)
      ids.forEach((id, slot) => expect(FEATURED_SLOTS[slot]).toContain(byId.get(id)!.grade))
    }
  })

  it('never features a race two days running across 366 days, and uses most of the catalogue', () => {
    const boards = YEAR.map((day) => board(day))
    for (let i = 1; i < boards.length; i += 1) {
      expect(boards[i]!.filter((id) => boards[i - 1]!.includes(id)), YEAR[i]).toEqual([])
    }
    const featured = new Set(boards.flat())
    expect(featured.size).toBeGreaterThan(20)
  })

  it('differs in distance category whenever the day\'s pools allow', () => {
    for (const day of YEAR) {
      const parity = dayNumber(day) % 2
      const picked = board(day).map((id) => byId.get(id)!)
      picked.forEach((race, slot) => {
        const before = new Set(picked.slice(0, slot).map((other) => other.distance))
        if (!before.has(race.distance)) return
        const half = RACES.filter((other) => FEATURED_SLOTS[slot]!.includes(other.grade))
          .sort((a, b) => (a.id < b.id ? -1 : 1)).filter((_, index) => index % 2 === parity)
        expect(half.every((other) => before.has(other.distance)), `${day} slot ${slot + 1}`).toBe(true)
      })
    }
    const distinct = YEAR.filter((day) => new Set(board(day).map((id) => byId.get(id)!.distance)).size === 3)
    expect(distinct.length).toBe(YEAR.length)
  })

  it('shows a one-race pool every other day, and leaves an empty slot empty', () => {
    const lone = [{ id: 'g1-only', grade: 'g1', distance: 'long' }] as const
    const shown = YEAR.map((day) => board(day, lone))
    expect(shown.filter((ids) => ids.length === 1)).toHaveLength(183)
    for (let i = 1; i < shown.length; i += 1) expect(shown[i]!.length + shown[i - 1]!.length).toBe(1)
    expect(board('2026-10-13', [])).toEqual([])
  })

  it("draws once a slot, empty or not, so a slot's draw never depends on an earlier slot's pool", () => {
    const withoutG1 = RACES.filter((race) => race.grade !== 'g1')
    for (const day of YEAR.slice(0, 60)) {
      const rng = mulberry32(featuredSeed(day))
      const [, second] = [rng.next(), rng.next()]
      const half = withoutG1.filter((race) => race.grade === 'g2' || race.grade === 'g3')
        .sort((a, b) => (a.id < b.id ? -1 : 1)).filter((_, index) => index % 2 === dayNumber(day) % 2)
      expect(board(day, withoutG1)[0]).toBe(half[Math.floor(second! * half.length)]!.id)
    }
  })

  it('refuses a catalogue with an id twice, and a draw outside [0, 1)', () => {
    expect(() => board('2026-10-13', [...RACES, RACES[0]!])).toThrow(RangeError)
    expect(() => featuredBoard('2026-10-13', RACES, { next: () => 1 })).toThrow(RangeError)
    expect(() => featuredBoard('2026-10-13', RACES, { next: () => Number.NaN })).toThrow(RangeError)
  })

  it('does not depend on the catalogue\'s order', () => {
    const reversed = [...RACES].reverse()
    for (const day of YEAR.slice(0, 30)) expect(board(day, reversed)).toEqual(board(day))
  })
})

/** stableHash('featured:2026-10-13'). */
const PINNED_SEED = 1_062_808_724
/** Day 20,739 is odd: each slot draws from its pool's odd indices, and the third slot's only fresh distance is a Mile. */
const PINNED_BOARD: readonly string[] = ['g1-sprint-a', 'g2-medium-a', 'op-mile-a']
