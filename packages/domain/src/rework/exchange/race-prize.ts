// A race's prize (docs/rework/09-racing-rewards-and-exchange.md §2.1, §3.3, §4, §7, §9): the prize half of a race's
// commit, written with its result. The day moves the purse forward, the gross fills it, the purse decides what is paid,
// and a first win of a featured race pays its win prize again, outside the purse. It reads and writes the profile only,
// so it never touches Racing EXP (09 §1, §3.3). Not one of 13 §6's operations: phase 3 commits it with the result row.
import type { RaceGrade } from '../../types'
import { assertNow } from '../tiers/ledger'
import { isRefusal, type AccountProfile, type LedgerEntry, type Refusal } from '../types'
import { featuredBonusLedgerId, racePrizeLedgerId } from './ledger'
import { EXPEDITION_RATE_PERCENT, WIN_PRIZE, grossPrize, prizeRate, type ExpeditionPrize } from './prizes'
import { assertLocalDay, payFromPurse, type LocalDay, type PurseBand } from './purse'

export interface RacePrizeInput {
  /** The race result's id: the ledger rows are named after it. */
  readonly resultId: string
  readonly raceId: string
  readonly grade: RaceGrade
  /** Her finishing place, 1st = 1. */
  readonly place: number
  /** Present only for an Expedition race (phase 9 decides which those are). */
  readonly expedition?: ExpeditionPrize
  /** The device's local date when the race started. */
  readonly localDay: LocalDay
  /** The featured board of `boardDay(profile.purse, localDay)`. */
  readonly board: readonly string[]
}

/** What the result screen shows on reload: the `raceResults` row's `prize` (09 §9). */
export interface RacePrize {
  /** The gross prize that filled the purse. */
  readonly gross: number
  /** What the purse paid of it. */
  readonly paid: number
  /** The band the purse ends in. */
  readonly band: PurseBand
  /**
   * The day's gross after this race, the purse it filled (T141): the result's "Tired purse: paid a quarter (6,420 of
   * 12,000)" reads it from the stored row, so a reload shows the day as it stood.
   */
  readonly dayGross: number
  /** Whether the Expedition rate applied (a family not yet won on her run): the result's "Expedition rate" line. */
  readonly expedition: boolean
  /** The featured bonus paid, outside the purse; 0 when none. */
  readonly featuredBonus: number
}

export interface RacePrizeResult {
  readonly profile: AccountProfile
  readonly prize: RacePrize
  /** The new Prize Money rows, for amounts above 0 only, to append to the ledger. */
  readonly ledger: readonly LedgerEntry[]
}

/**
 * Settle a race's Prize Money at `now`: the day, the gross, the purse, the featured bonus, then the pay. A place that
 * isn't a whole number from 1 up is refused.
 */
export function settleRacePrize(profile: AccountProfile, input: RacePrizeInput, now: number): RacePrizeResult | Refusal {
  assertNow(now)
  assertLocalDay(input.localDay)
  const gross = grossPrize(input)
  if (isRefusal(gross)) return gross

  const payment = payFromPurse(profile.purse, input.localDay, gross)
  const featured = input.place === 1 && input.expedition === undefined && input.board.includes(input.raceId) &&
    !payment.purse.featuredPaid.includes(input.raceId)
  const featuredBonus = featured ? WIN_PRIZE[input.grade] : 0
  const purse = featured ? { ...payment.purse, featuredPaid: [...payment.purse.featuredPaid, input.raceId] } : payment.purse

  const ledger: LedgerEntry[] = []
  if (payment.paid > 0) {
    ledger.push({ id: racePrizeLedgerId(input.resultId), resource: 'prize-money', delta: payment.paid, reason: 'race-prize', at: now })
  }
  if (featuredBonus > 0) {
    ledger.push({ id: featuredBonusLedgerId(input.resultId), resource: 'prize-money', delta: featuredBonus, reason: 'featured-bonus', at: now })
  }
  return {
    profile: { ...profile, prizeMoney: profile.prizeMoney + payment.paid + featuredBonus, purse },
    prize: {
      gross,
      paid: payment.paid,
      band: payment.band,
      dayGross: payment.purse.gross,
      expedition: prizeRate(input.expedition) === EXPEDITION_RATE_PERCENT,
      featuredBonus,
    },
    ledger,
  }
}
