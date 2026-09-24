// Unlocking the next scenario (docs/design/uma-progression.md#gate-levels-and-unlocking-the-next-scenario).

import { umaPromotionCost } from './economy'
import type { RaceTemplate, UmaTemplate } from './content'
import { createScenarioTraining, type LedgerEntry, type PlayerProfile, type ScenarioTraining, type UmaSave } from './save'
import { CAREER_STAGE_LABELS, careerStage, closeScenarioJourney, generateScenarioJourney } from './scenario-goals'
import { MAX_SCENARIO_TIER, isGateLevel, tierOfLevel } from './scenarios'
import type { Aptitudes } from './types'

export interface ScenarioLedgerDescriptor {
  id: string
  data: LedgerEntry
}

export interface ScenarioAdvanceReadiness {
  ready: boolean
  /** True at the highest modelled tier, where there is nothing further to unlock. */
  final: boolean
  fromTier: number
  toTier: number | null
  cost: number | null
  reason: string | null
}

export interface ScenarioAdvanceInput {
  profile: PlayerProfile
  uma: UmaSave
  umaTemplate: UmaTemplate
  /** Aptitudes the new scenario's goals are frozen against; derived from the fresh constellation. */
  aptitudes: Aptitudes
  races: readonly RaceTemplate[]
  now: number
}

export interface ScenarioAdvanceResult {
  profile: PlayerProfile
  uma: UmaSave
  fromTier: number
  toTier: number
  cost: number
  overflowLevel: number | null
  ledger: ScenarioLedgerDescriptor[]
}

export interface StartScenarioInput {
  uma: UmaSave
  umaTemplate: UmaTemplate
  aptitudes: Aptitudes
  races: readonly RaceTemplate[]
}

export function scenarioAdvanceReadiness(profile: PlayerProfile, uma: UmaSave): ScenarioAdvanceReadiness {
  const fromTier = uma.unlockedTier
  const atGate = isGateLevel(uma.level) && tierOfLevel(uma.level) === fromTier
  if (fromTier >= MAX_SCENARIO_TIER) {
    return { ready: false, final: true, fromTier, toTier: null, cost: null, reason: 'This is the latest scenario' }
  }
  const cost = umaPromotionCost(fromTier)
  if (!atGate) {
    return {
      ready: false,
      final: false,
      fromTier,
      toTier: fromTier + 1,
      cost,
      reason: `Reach level ${fromTier * 10} to unlock the next scenario`,
    }
  }
  // A career gates the advance on its goals (D137). Legacy v1–v2 journeys stay optional.
  const stage = careerStage(uma.scenarios.find((entry) => entry.tier === fromTier)?.journey)
  if (stage) {
    return {
      ready: false,
      final: false,
      fromTier,
      toTier: fromTier + 1,
      cost,
      reason: stage === 'main' ? 'Win her main goals to unlock the next scenario' : `Win her ${CAREER_STAGE_LABELS[stage]} goal to unlock the next scenario`,
    }
  }
  if (profile.tickets < cost) {
    return { ready: false, final: false, fromTier, toTier: fromTier + 1, cost, reason: `You need ${cost} Training Tickets` }
  }
  return { ready: true, final: false, fromTier, toTier: fromTier + 1, cost, reason: null }
}

/** Confirm a scenario's start: freeze its goals and open it for racing. */
export function startScenario(input: StartScenarioInput): UmaSave {
  const run = input.uma.scenarios.find((entry) => entry.tier === input.uma.unlockedTier)
  if (!run) throw new Error('This Uma has no scenario to start')
  if (run.started) return input.uma
  const journey = generateScenarioJourney({
    uma: input.uma,
    umaTemplate: input.umaTemplate,
    aptitudes: input.aptitudes,
    races: input.races,
  })
  return {
    ...input.uma,
    scenarios: input.uma.scenarios.map((entry) =>
      entry.tier === run.tier ? { ...entry, started: true, journey } : entry),
  }
}

/**
 * Unlock the next scenario. The new run starts at Training Level 1 with an empty constellation and an empty
 * card set, so the Uma is temporarily weaker and rebuilds — a scenario is a career run, not a continuation
 * (D121). There is no promotion stat bonus and no Initial Stats grant: stats are derived from the new tree.
 */
export function advanceScenario(input: ScenarioAdvanceInput): ScenarioAdvanceResult {
  const readiness = scenarioAdvanceReadiness(input.profile, input.uma)
  if (!readiness.ready || readiness.toTier === null || readiness.cost === null) {
    throw new Error(readiness.reason ?? 'This Uma cannot advance yet')
  }
  if (input.uma.templateId !== input.umaTemplate.id) throw new Error('Scenario advance Uma is malformed')

  const fromTier = readiness.fromTier
  const toTier = readiness.toTier
  const cost = readiness.cost

  const closed: ScenarioTraining[] = input.uma.scenarios.map((entry) =>
    entry.tier === fromTier && entry.journey
      ? { ...entry, journey: closeScenarioJourney(entry.journey, input.now) }
      : entry)

  const advanced: UmaSave = {
    ...input.uma,
    level: input.uma.level + 1,
    exp: 0,
    unlockedTier: toTier,
    scenarios: [...closed, createScenarioTraining(toTier)].sort((a, b) => a.tier - b.tier),
  }

  // Goals for the new tier are frozen against the fresh, empty constellation's aptitudes.
  const journey = generateScenarioJourney({
    uma: advanced,
    umaTemplate: input.umaTemplate,
    aptitudes: input.aptitudes,
    races: input.races,
  })

  return {
    profile: { ...input.profile, tickets: input.profile.tickets - cost },
    uma: {
      ...advanced,
      scenarios: advanced.scenarios.map((entry) =>
        entry.tier === toTier ? { ...entry, started: true, journey } : entry),
    },
    fromTier,
    toTier,
    cost,
    overflowLevel: null,
    ledger: [{
      id: `advance:${input.uma.templateId}:${fromTier}`,
      data: { resource: 'tickets', delta: -cost, reason: 'uma-promotion', localDay: null, createdAt: input.now },
    }],
  }
}

/** At the highest tier there is nothing to unlock; the run's journey simply closes. */
export function closeFinalScenario(uma: UmaSave, now: number): UmaSave {
  return {
    ...uma,
    scenarios: uma.scenarios.map((entry) =>
      entry.tier === uma.unlockedTier && entry.journey
        ? { ...entry, journey: closeScenarioJourney(entry.journey, now) }
        : entry),
  }
}
