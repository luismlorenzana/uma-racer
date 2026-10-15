// What a race pays in Prize Money (docs/game/09-racing-rewards-and-exchange.md §2.1, the rework README "Money",
// docs/rework/10-expeditions.md): its grade's win prize times its place's share, at the Expedition rate for a family
// she hasn't won yet on her run. Integers only: one rounding down, after every multiplier. No Race Bonus and no tier
// multiplier touch Prize Money (09 §2.1).
import { RACE_GRADES, type RaceGrade } from '../types'
import type { Refusal } from '../state/types'
import { prizeRefusal } from './refusals'

/** A win's Prize Money by grade (09 §2.1, README "Money"; draft). */
export const WIN_PRIZE: Readonly<Record<RaceGrade, number>> = Object.freeze({
  debut: 60, maiden: 60, 'pre-op': 80, op: 100, g3: 150, g2: 200, g1: 300,
})

/** 1st to 5th place's share of the win prize, in percent: each place below 2nd half the one above. 6th and below: 0. */
export const PLACE_SHARE_PERCENT = Object.freeze([100, 40, 20, 10, 5] as const)

/** An Expedition race pays this percent of the G1 row for a race family not yet won on her run (09 §2.1, 10; draft). */
export const EXPEDITION_RATE_PERCENT = 150
/** Every home race, and an Expedition race of a family already won on her run, pays the table as it stands. */
export const HOME_RATE_PERCENT = 100
/** An Expedition race is paid on this row, whatever its local grade (09 §2.1). */
export const EXPEDITION_PRIZE_GRADE: RaceGrade = 'g1'
/** Rate and share are both percents. */
const PERCENT_OF_PERCENT = 100 * 100

/** An Expedition race: whether her run has already won its race family (10 "Save"). */
export interface ExpeditionPrize {
  readonly familyWon: boolean
}

export interface PrizeQuery {
  readonly grade: RaceGrade
  /** Her finishing place, 1st = 1. */
  readonly place: number
  /** Present only for an Expedition race. */
  readonly expedition?: ExpeditionPrize
}

/** A place's share in percent: 100, 40, 20, 10, 5, then 0. */
export const placeShare = (place: number): number => PLACE_SHARE_PERCENT[place - 1] ?? 0

/** The rate in percent: the Expedition rate for a family not yet won, else the table as it stands. */
export const prizeRate = (expedition?: ExpeditionPrize): number =>
  expedition !== undefined && !expedition.familyWon ? EXPEDITION_RATE_PERCENT : HOME_RATE_PERCENT

/**
 * A race's gross prize, before the Daily Purse: ⌊win × rate × share ÷ 10,000⌋, where `win` is the grade's prize (G1's
 * for an Expedition race). A place that isn't a whole number from 1 up is refused.
 */
export function grossPrize(query: PrizeQuery): number | Refusal {
  if (!Number.isSafeInteger(query.place) || query.place < 1) return prizeRefusal('place', { place: String(query.place) })
  const grade = query.expedition === undefined ? query.grade : EXPEDITION_PRIZE_GRADE
  if (!RACE_GRADES.includes(grade)) throw new RangeError(`Unknown race grade: ${grade}`)
  return Math.floor((WIN_PRIZE[grade] * prizeRate(query.expedition) * placeShare(query.place)) / PERCENT_OF_PERCENT)
}
