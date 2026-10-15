// A stand-in World Expedition (docs/rework/04-tiers-and-promotion.md §3, §10, D332), enough for promotion to have a
// trigger: a run counts its races and wins, and its eighth win completes it. Phase 9 replaces it with the real rules
// (docs/rework/10-expeditions.md): distinct race families, pools, fields and difficulty.
import { isRefusal, type ExpeditionRun, type OpResult, type ReworkState } from '../state/types'
import { assertNow, withUma } from './ledger'
import { TODAY_CATALOGUE, isLastScenario, lastGate, type ScenarioCatalogue } from './map'
import { HALL_OF_FAME_TIER, canStartExpedition, induct, type TierAward } from './promotion'
import { tierRefusal } from './refusals'

/** Eight wins complete a run (D332). Phase 9 makes them eight distinct races from the Expedition's pool. */
export const EXPEDITION_WINS = 8

export interface ExpeditionRaceInput {
  readonly umaId: string
  readonly expeditionId: string
  readonly won: boolean
}

export interface ExpeditionRaceReceipt {
  readonly umaId: string
  readonly run: ExpeditionRun
  /** This race was the run's eighth win. */
  readonly completedNow: boolean
  /** Tiers 1 and 2: she is now Ready for promotion, which the owner confirms (04 §3). */
  readonly readyForPromotion: boolean
  /** Tier 3: this race inducted her into the Hall of Fame, in the same commit (04 §10). */
  readonly inducted: boolean
  readonly ticketsPaid: number
  readonly awards: readonly TierAward[]
}

/**
 * Count one Expedition race on her run of `expeditionId`. A new run needs `canStartExpedition`; a run already open
 * keeps counting, so one opened at scenario 14 can be finished there after the 15th lands (04 §2). A completed run
 * refuses more races. In tier 3 the eighth win inducts her in the same call.
 */
export function recordExpeditionRace<S extends ReworkState>(
  state: S,
  input: ExpeditionRaceInput,
  now: number,
  env: { readonly catalogue?: ScenarioCatalogue } = {},
): OpResult<ExpeditionRaceReceipt, S> {
  assertNow(now)
  if (typeof input.expeditionId !== 'string' || input.expeditionId.length === 0) throw new RangeError('An Expedition race needs its Expedition')
  const catalogue = env.catalogue ?? TODAY_CATALOGUE
  const uma = state.umas[input.umaId]
  if (!uma) return tierRefusal('unknown-uma', { uma: input.umaId })
  const index = uma.expedition.runs.findIndex((run) => run.expeditionId === input.expeditionId)
  const open = uma.expedition.runs[index]
  if (open?.completed) return tierRefusal('run-complete', { uma: uma.outfitId })
  if (!open && !canStartExpedition(uma, catalogue)) {
    const gate = lastGate(uma.tier, catalogue)
    return !isLastScenario(uma, catalogue) || uma.racing.level < gate
      ? tierRefusal('not-at-gate', { uma: uma.outfitId, level: gate })
      : tierRefusal('career-open', { uma: uma.outfitId })
  }

  const before = open ?? { expeditionId: input.expeditionId, races: 0, wins: 0, completed: false }
  const wins = before.wins + (input.won ? 1 : 0)
  const run: ExpeditionRun = { ...before, races: before.races + 1, wins, completed: wins >= EXPEDITION_WINS }
  const runs = open ? uma.expedition.runs.map((entry, at) => (at === index ? run : entry)) : [...uma.expedition.runs, run]
  const raced = withUma(state, { ...uma, expedition: { ...uma.expedition, runs } })
  const completedNow = run.completed
  const receipt = {
    umaId: uma.outfitId, run, completedNow, readyForPromotion: completedNow && uma.tier !== HALL_OF_FAME_TIER,
    inducted: false, ticketsPaid: 0, awards: [] as readonly TierAward[],
  }
  if (!completedNow || uma.tier !== HALL_OF_FAME_TIER || uma.hallOfFame) return { state: raced, receipt }

  const inducted = induct(raced, { umaId: uma.outfitId }, now)
  if (isRefusal(inducted)) throw new Error(`Induction refused after a completed run: ${inducted.code}`)
  return { state: inducted.state, receipt: { ...receipt, inducted: true, ticketsPaid: inducted.receipt.ticketsPaid, awards: inducted.receipt.awards } }
}
