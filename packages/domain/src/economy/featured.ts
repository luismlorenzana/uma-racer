// The daily featured board (docs/game/09-racing-rewards-and-exchange.md §4): three races a day from the regular
// catalogue, one G1, one G2 or G3 and one OP or Pre-OP, drawn from the local date's seed, so every device shows the same
// board. Each slot's pool keeps only the races at indices of the day number's parity, so no race is featured two days
// running; a slot prefers a distance category not yet on the board. The bonus itself is paid by `race-prize.ts`.
// The caller passes `createRng(featuredSeed(day))` from @racer/race, which the domain can't import (as opponents.ts).
import type { RivalRng } from '../opponents'
import { stableHash } from '../scenario-goals'
import type { DistanceCategory, RaceGrade } from '../types'
import { assertLocalDay, dayNumber, type LocalDay } from './purse'

/** The board's slots in order, by the grades each draws from (09 §4; draft). */
export const FEATURED_SLOTS: readonly (readonly RaceGrade[])[] = Object.freeze([
  Object.freeze(['g1'] as const),
  Object.freeze(['g2', 'g3'] as const),
  Object.freeze(['op', 'pre-op'] as const),
])

/** The seed's prefix: the draw is seeded by `featured:YYYY-MM-DD` (09 §4). */
export const FEATURED_SEED_PREFIX = 'featured:'

/** One race of the regular catalogue (never an Expedition pool), as the draw needs it. */
export interface CatalogueRace {
  readonly id: string
  readonly grade: RaceGrade
  readonly distance: DistanceCategory
}

/** Uniform in [0, 1): the race engine's seeded RNG. */
export type FeaturedRng = RivalRng

/** The day's seed, today's `stableHash` of `featured:YYYY-MM-DD`. */
export function featuredSeed(day: LocalDay): number {
  assertLocalDay(day)
  return stableHash(`${FEATURED_SEED_PREFIX}${day}`)
}

const byId = (a: CatalogueRace, b: CatalogueRace): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * The featured race ids for `day`, in slot order: up to three, since an empty pool leaves its slot empty. Each slot
 * draws once, whether or not its pool is empty, so a slot's pick never depends on an earlier slot's pool.
 */
export function featuredBoard(day: LocalDay, races: readonly CatalogueRace[], rng: FeaturedRng): readonly string[] {
  const parity = ((dayNumber(day) % 2) + 2) % 2
  const ids = new Set<string>()
  for (const race of races) {
    if (ids.has(race.id)) throw new RangeError(`Race ${race.id} is in the catalogue twice`)
    ids.add(race.id)
  }
  const board: CatalogueRace[] = []
  for (const grades of FEATURED_SLOTS) {
    const draw = rng.next()
    if (!(draw >= 0 && draw < 1)) throw new RangeError(`The draw must be in [0, 1): ${draw}`)
    const pool = races.filter((race) => grades.includes(race.grade)).sort(byId).filter((_, index) => index % 2 === parity)
    if (pool.length === 0) continue
    const onBoard = new Set(board.map((race) => race.distance))
    const fresh = pool.filter((race) => !onBoard.has(race.distance))
    const choices = fresh.length > 0 ? fresh : pool
    board.push(choices[Math.floor(draw * choices.length)]!)
  }
  return board.map((race) => race.id)
}
