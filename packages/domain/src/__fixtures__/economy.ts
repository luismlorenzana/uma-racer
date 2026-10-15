// A synthetic regular race catalogue for the Exchange's tests (docs/rework/09-racing-rewards-and-exchange.md §4):
// invented ids, every featured grade, every distance category. Nothing from the private packs.
import type { CatalogueRace } from '../economy/featured'
import type { DistanceCategory, RaceGrade } from '../types'

const race = (grade: RaceGrade, distance: DistanceCategory, tag: string): CatalogueRace => ({ id: `${grade}-${distance}-${tag}`, grade, distance })

export const RACES: readonly CatalogueRace[] = Object.freeze([
  race('g1', 'sprint', 'a'), race('g1', 'sprint', 'b'), race('g1', 'mile', 'a'), race('g1', 'mile', 'b'),
  race('g1', 'medium', 'a'), race('g1', 'medium', 'b'), race('g1', 'medium', 'c'), race('g1', 'long', 'a'), race('g1', 'long', 'b'),
  race('g2', 'sprint', 'a'), race('g2', 'mile', 'a'), race('g2', 'medium', 'a'), race('g2', 'medium', 'b'), race('g2', 'long', 'a'),
  race('g3', 'sprint', 'a'), race('g3', 'mile', 'a'), race('g3', 'medium', 'a'), race('g3', 'long', 'a'),
  race('op', 'sprint', 'a'), race('op', 'mile', 'a'), race('op', 'medium', 'a'), race('op', 'medium', 'b'), race('op', 'long', 'a'),
  race('pre-op', 'sprint', 'a'), race('pre-op', 'mile', 'a'), race('pre-op', 'medium', 'a'),
  race('debut', 'mile', 'a'), race('maiden', 'medium', 'a'),
].map((entry) => Object.freeze(entry)))

/** The race engine's seeded generator (mulberry32), copied as opponents.test.ts does: the domain can't import @racer/race. */
export function mulberry32(seed: number): { next(): number } {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = Math.imul(state ^ (state >>> 15), state | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
  }
}

/** `count` local days from `first`, through the UTC calendar (tests may read Date; the rules never do). */
export function days(first: string, count: number): string[] {
  const start = Date.parse(`${first}T00:00:00Z`)
  return Array.from({ length: count }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10))
}
