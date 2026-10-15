// `finish-race`: a race's commit as one operation (docs/rework/09-racing-rewards-and-exchange.md §8–§9; docs/rework/13-
// removals-and-plan-changes.md §6; docs/rework/01-game-loop.md §2; T134). One tap pays everything a race pays, at once:
// her session's finished unlocks first (she races with every unlock she has earned), then Racing EXP, her goals and the
// gate's Shard on the preset of the race's distance (D254), then Prize Money through the Daily Purse with any featured
// bonus. A Farm job keeps running. The race's id is the operation's, so `runOnce` makes it once-only, and the server
// re-runs it trusting the placement and the board the screen showed, as it trusts the phone's clock (02 §8, 09 §8).
import type { RaceRun } from '../../progression-race'
import type { RaceGrade } from '../../types'
import { settleRacePrize, type RacePrize } from '../exchange/race-prize'
import type { LocalDay } from '../exchange/purse'
import { applyRaceFinish, type RaceFinishReceipt } from '../tiers/racing'
import { assertNow } from '../tiers/ledger'
import { tierRefusal } from '../tiers/refusals'
import { deriveUmaPreset } from '../training/derive'
import { isRefusal, type OpResult } from '../types'
import { collectBeforeRace } from '../work/activity'
import type { CollectReceipt } from '../work/collect'
import type { ItemMovement, WorkState } from '../work/types'
import type { OperationEnv } from './once'

export interface FinishRaceInput {
  readonly umaId: string
  readonly raceId: string
  /** Her place, from the race engine's result. */
  readonly placement: number
  /** The device's local date when the race started (09 §3.3). */
  readonly localDay: LocalDay
  /** The featured board the screen showed (09 §4). */
  readonly board: readonly string[]
  /** The race as it ran, kept on the `raceResults` row; the rules don't read it. */
  readonly run: RaceRun
}

export interface FinishRaceReceipt {
  /** Her session's finished unlocks, collected first (01 §2). */
  readonly collect: CollectReceipt
  /** Racing EXP, goals and the gate's Shard (03 §2, §4; 04 §6). */
  readonly finish: RaceFinishReceipt
  /** What the result screen shows on reload (09 §7, §9). */
  readonly prize: RacePrize
  readonly grade: RaceGrade
  /** The summed card Race Bonus of the preset of the race's distance (D254). */
  readonly raceBonus: number
  /** Every Warehouse movement, the collect's, as every work receipt lists them for phase 3's `itemLedger`. */
  readonly movements: readonly ItemMovement[]
}

/**
 * `finish-race { umaId, raceId, placement, localDay, board, run }` at `now`, under the operation's `id`, which names the
 * race result. A race the content doesn't hold is a caller's bug and throws; an unknown Uma is refused.
 */
export function finishRace<S extends WorkState>(state: S, input: FinishRaceInput, now: number, env: OperationEnv, id: string): OpResult<FinishRaceReceipt, S> {
  assertNow(now)
  if (!state.umas[input.umaId]) return tierRefusal('unknown-uma', { uma: input.umaId })
  const race = env.content.races.find((entry) => entry.id === input.raceId)
  if (race === undefined) throw new RangeError(`No race ${input.raceId}`)

  const collected = collectBeforeRace(state, input.umaId, now, env)
  const raceBonus = deriveUmaPreset(collected.state.umas[input.umaId]!, race.distanceCategory, env.content).raceBonus
  const finished = applyRaceFinish(collected.state, {
    umaId: input.umaId, raceId: race.id, resultId: id, grade: race.grade, placement: input.placement, raceBonus,
  }, now, env)
  if (isRefusal(finished)) return finished
  const settled = settleRacePrize(finished.state.profile, {
    resultId: id, raceId: race.id, grade: race.grade, place: input.placement, localDay: input.localDay, board: input.board,
  }, now)
  if (isRefusal(settled)) return settled
  return {
    state: { ...finished.state, profile: settled.profile, ledger: [...finished.state.ledger, ...settled.ledger] },
    receipt: {
      collect: collected.receipt, finish: finished.receipt, prize: settled.prize, grade: race.grade, raceBonus,
      movements: collected.receipt.movements,
    },
  }
}
