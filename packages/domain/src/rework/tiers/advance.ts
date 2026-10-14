// Advancing to the next scenario (docs/rework/03-uma-progression.md §5): at the scenario's gate, with every goal of her
// career won, and not in the tier's last scenario. Free and explicit. She moves to the gate + 1 and the EXP her gate
// banked applies there, under the new career's holds. Her build, Farm, work and Expedition stay as they are; T128's
// `advanceScenario` adds the preset carry (03 §6) on top of this one.
import { careerComplete, closeScenarioJourney } from '../../scenario-goals'
import { isRefusal, type OpResult, type Refusal, type ReworkState, type ScenarioAt, type ScenarioOfTier, type UmaState } from '../types'
import { freezeCareer, type TierContent } from './career'
import { assertNow, withUma } from './ledger'
import { TODAY_CATALOGUE, gateLevel, isLastScenario, scenarioNumber, scenarioPlayable, scenarioRow, type ScenarioCatalogue } from './map'
import { addRacingExp } from './racing'
import { tierRefusal } from './refusals'

export interface AdvanceReady {
  readonly ready: true
  readonly from: ScenarioAt
  readonly to: ScenarioAt
}

/** Whether she can advance now (03 §5), each condition with its own reason. Nothing about her work matters (D328). */
export function advanceReadiness(uma: UmaState, catalogue: ScenarioCatalogue = TODAY_CATALOGUE): AdvanceReady | Refusal {
  if (isLastScenario(uma, catalogue)) return tierRefusal('last-scenario', { uma: uma.outfitId })
  const gate = gateLevel(uma.scenario)
  if (uma.racing.level < gate) return tierRefusal('not-at-gate', { uma: uma.outfitId, level: gate })
  if (!careerComplete(uma.career)) return tierRefusal('career-open', { uma: uma.outfitId })
  return { ready: true, from: { tier: uma.tier, scenario: uma.scenario }, to: { tier: uma.tier, scenario: (uma.scenario + 1) as ScenarioOfTier } }
}

export interface AdvanceReceipt {
  readonly umaId: string
  readonly from: ScenarioAt
  readonly to: ScenarioAt
  /** The banked EXP that applied on arrival. */
  readonly bankApplied: number
  readonly racingLevel: number
}

/**
 * `advance-scenario` (13 §6): scenario + 1; Racing Lv 10s + 1 at EXP 0, then her bank through the new career's holds;
 * the old career closed into her history; a new one frozen now. Nothing is spent. The 15th refuses until today's
 * planner knows it.
 */
export function advanceScenario<S extends ReworkState>(
  state: S,
  input: { readonly umaId: string },
  now: number,
  env: { readonly content: TierContent; readonly catalogue?: ScenarioCatalogue },
): OpResult<AdvanceReceipt, S> {
  assertNow(now)
  const uma = state.umas[input.umaId]
  if (!uma) return tierRefusal('unknown-uma', { uma: input.umaId })
  const readiness = advanceReadiness(uma, env.catalogue)
  if (isRefusal(readiness)) return readiness
  const T = scenarioNumber(readiness.to)
  if (!scenarioPlayable(T)) return tierRefusal('scenario-not-playable', { scenario: scenarioRow(T).name })

  const bank = uma.racing.exp
  const moved = {
    ...uma,
    scenario: readiness.to.scenario,
    racing: { level: gateLevel(uma.scenario) + 1, exp: 0 },
    closedCareers: [...uma.closedCareers, closeScenarioJourney(uma.career, now)],
  }
  const arrived: UmaState = { ...moved, career: freezeCareer(moved, T, env.content) }
  const banked = addRacingExp(arrived, bank, env.catalogue).uma
  return {
    state: withUma(state, banked),
    receipt: { umaId: uma.outfitId, from: readiness.from, to: readiness.to, bankApplied: bank, racingLevel: banked.racing.level },
  }
}
