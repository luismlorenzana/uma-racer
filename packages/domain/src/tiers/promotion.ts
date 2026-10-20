// Promotion and the Hall of Fame (docs/game/04-tiers-and-promotion.md §3–§5, §10, D327): an Uma whose tier's World
// Expedition run is complete may be promoted, once she is free. Everything on her resets (§4's left column), her
// records and race defaults stay (the middle), the account carries untouched (the right), and she starts the next tier
// at scenario 1 with a fresh career. Tier 3 doesn't promote: its completed run inducts her into the Hall of Fame,
// which resets nothing. Each pays one Uma Ticket, once, under `promotion-uma-ticket:{umaId}:{tier}`.
import { careerComplete, closeScenarioJourney } from '../scenario-goals'
import { DISTANCE_CATEGORIES, STATS, type DistanceCategory, type Stats } from '../types'
import { emptyBuild, isRefusal, type OpResult, type Refusal, type ReworkState, type Tier, type TierHistoryEntry, type UmaState } from '../state/types'
import { freezeCareer, umaTemplate, type TierContent } from './career'
import { assertNow, payOnce, withUma } from './ledger'
import { TODAY_CATALOGUE, isLastScenario, lastGate, scenarioNumber, type ScenarioCatalogue } from './map'
import { isFree } from '../work/index'
import { tierRefusal } from './refusals'

/** A promotion pays one Uma Ticket, and so does entering the Hall of Fame (04 §3, §6, §10). */
export const PROMOTION_UMA_TICKETS = 1
/** The tier whose Expedition inducts instead of promoting (04 §10). */
export const HALL_OF_FAME_TIER: Tier = 3

/** The once-only ticket for leaving `tier`: 1 or 2 for a promotion, 3 for the Hall of Fame (04 §6). */
export const promotionTicketLedgerId = (umaId: string, tier: Tier): string => `promotion-uma-ticket:${umaId}:${tier}`

/** The awards a receipt names, for phase 3's flair events (04 §9). */
export type TierAward = 'promoted-tier-2' | 'promoted-tier-3' | 'hall-of-fame'

/** She may race the World Expedition once her tier's last career is complete at its last gate (04 §3). */
export const canStartExpedition = (uma: UmaState, catalogue: ScenarioCatalogue = TODAY_CATALOGUE): boolean =>
  isLastScenario(uma, catalogue) && uma.racing.level >= lastGate(uma.tier, catalogue) && careerComplete(uma.career)

const hasCompletedRun = (uma: UmaState): boolean => uma.expedition.runs.some((run) => run.completed)

/**
 * Whether she can be promoted now (04 §3, §5): tiers 1 and 2 only, a completed Expedition run, and Free by T127's
 * activity rule (01 §2): no running entry, no queue, nothing waiting for Collect.
 */
export function promotionReadiness(state: ReworkState, umaId: string): { readonly ready: true; readonly uma: UmaState } | Refusal {
  const uma = state.umas[umaId]
  if (!uma) return tierRefusal('unknown-uma', { uma: umaId })
  if (uma.tier === HALL_OF_FAME_TIER) return tierRefusal('use-hall-of-fame', { uma: umaId })
  if (!hasCompletedRun(uma)) return tierRefusal('no-expedition', { uma: umaId })
  if (!isFree(state, umaId)) return tierRefusal('busy', { uma: umaId })
  return { ready: true, uma }
}

/** Each preset's derived stats and SP at the moment she leaves: T128's derivation, which T125 cannot run. */
export type PromotionPresetStats = Readonly<Record<DistanceCategory, { readonly stats: Stats; readonly skillPoints: number }>>

export interface PromoteReceipt {
  readonly umaId: string
  readonly from: Tier
  readonly to: Tier
  readonly history: TierHistoryEntry
  /** Uma Tickets paid: 1, or 0 when the id has paid before. */
  readonly ticketsPaid: number
  readonly awards: readonly TierAward[]
}

function assertPresetStats(presets: PromotionPresetStats): void {
  for (const distance of DISTANCE_CATEGORIES) {
    const preset = presets[distance]
    if (!preset || STATS.some((stat) => !Number.isFinite(preset.stats[stat])) || !Number.isFinite(preset.skillPoints)) {
      throw new RangeError(`Promotion needs the ${distance} preset's stats and skill points`)
    }
  }
}

/**
 * `promote` (04 §3): closes her tier into a history entry, resets her into tier t + 1, scenario 1, Racing Lv 1, Farm
 * Lv 1 with an empty build and a fresh career, clears her Expedition into the entry, and pays one Uma Ticket once.
 * Her idle work row (her last work and any dropped queue) goes too, so Repeat never restarts a promoted Uma's last
 * job at a grade her new Farm Level can't start (02 §5). Every other part of the state stays as it is.
 */
export function promote<S extends ReworkState>(
  state: S,
  input: { readonly umaId: string; readonly presets: PromotionPresetStats },
  now: number,
  env: { readonly content: TierContent },
): OpResult<PromoteReceipt, S> {
  assertNow(now)
  const readiness = promotionReadiness(state, input.umaId)
  if (isRefusal(readiness)) return readiness
  const { uma } = readiness
  assertPresetStats(input.presets)
  const template = umaTemplate(env.content, uma.outfitId)

  const history: TierHistoryEntry = {
    tier: uma.tier,
    promotedAt: now,
    finalRacingLevel: uma.racing.level,
    presets: Object.fromEntries(DISTANCE_CATEGORIES.map((distance) => [distance, {
      stats: { ...input.presets[distance].stats },
      skillPoints: input.presets[distance].skillPoints,
      cardSetIds: uma.build.presets[distance].cardSetIds,
    }])) as TierHistoryEntry['presets'],
    bonds: uma.build.bonds,
    runs: uma.expedition.runs,
  }
  const to = (uma.tier + 1) as Tier
  const reset = {
    ...uma,
    tier: to,
    scenario: 1 as const,
    racing: { level: 1, exp: 0 },
    farm: { level: 1, exp: 0 },
    build: emptyBuild(template.uniqueSkillId),
    expedition: { runs: [] },
    closedCareers: [...uma.closedCareers, closeScenarioJourney(uma.career, now)],
    tierHistory: [...uma.tierHistory, history],
  }
  const promoted: UmaState = { ...reset, career: freezeCareer(reset, scenarioNumber({ tier: to, scenario: 1 }), env.content) }
  const paid = payOnce(withUma(withoutWorkRow(state, uma.outfitId), promoted), {
    id: promotionTicketLedgerId(uma.outfitId, uma.tier), resource: 'uma-tickets', delta: PROMOTION_UMA_TICKETS, reason: 'promotion-uma-ticket',
  }, now)
  return {
    state: paid.state,
    receipt: { umaId: uma.outfitId, from: uma.tier, to, history, ticketsPaid: paid.paid, awards: [to === 2 ? 'promoted-tier-2' : 'promoted-tier-3'] },
  }
}

/** The state without her (idle) work row; the same state when she has none. */
function withoutWorkRow<S extends ReworkState>(state: S, umaId: string): S {
  if (state.work[umaId] === undefined) return state
  const work = { ...state.work }
  delete work[umaId]
  return { ...state, work }
}

export interface InductReceipt {
  readonly umaId: string
  readonly ticketsPaid: number
  readonly awards: readonly TierAward[]
}

/**
 * Enter the Hall of Fame (04 §10): tier 3 with a completed run, which 04 §2 lets her finish from scenario 14. Nothing
 * resets and she needn't be free; her Expedition runs stay. Pays one ticket under the promotion id with tier 3.
 */
export function induct<S extends ReworkState>(state: S, input: { readonly umaId: string }, now: number): OpResult<InductReceipt, S> {
  assertNow(now)
  const uma = state.umas[input.umaId]
  if (!uma) return tierRefusal('unknown-uma', { uma: input.umaId })
  if (uma.tier !== HALL_OF_FAME_TIER) return tierRefusal('use-promotion', { uma: input.umaId, tier: uma.tier })
  if (uma.hallOfFame) return tierRefusal('inducted', { uma: input.umaId })
  if (!hasCompletedRun(uma)) return tierRefusal('no-expedition', { uma: input.umaId })
  const paid = payOnce(withUma(state, { ...uma, hallOfFame: { inductedAt: now } }), {
    id: promotionTicketLedgerId(uma.outfitId, HALL_OF_FAME_TIER), resource: 'uma-tickets', delta: PROMOTION_UMA_TICKETS, reason: 'promotion-uma-ticket',
  }, now)
  return { state: paid.state, receipt: { umaId: uma.outfitId, ticketsPaid: paid.paid, awards: ['hall-of-fame'] } }
}
