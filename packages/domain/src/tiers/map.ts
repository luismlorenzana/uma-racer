// The tier map (docs/rework/04-tiers-and-promotion.md §1–§2, D327): three tiers of five scenarios, scenario s of tier t
// is the game's scenario T = 5(t − 1) + s, and Racing Level runs 1–50 a tier, ten a scenario
// (docs/rework/03-uma-progression.md §2–§3). Tier 3 has four scenarios until Japan's 15th is in the catalogue.
import { LEVELS_PER_SCENARIO, MAX_SCENARIO_TIER, SCENARIOS } from '../scenarios'
import type { ScenarioAt, ScenarioOfTier, Tier } from '../state/types'

/** Three tiers (D327, 04 §1). */
export const TIERS = 3
/** Five scenarios a tier (D327, 04 §1). */
export const SCENARIOS_PER_TIER = 5
/** Racing Level 1–50 a tier: ten levels a scenario, as today (03 §2). */
export const RACING_LEVELS_PER_TIER = SCENARIOS_PER_TIER * LEVELS_PER_SCENARIO
/** The game's last scenario number: tier 3's fifth (04 §1). */
export const LAST_SCENARIO_NUMBER = TIERS * SCENARIOS_PER_TIER
/** The 15th row's name until the platform publishes it (04 §1–§2). */
export const FIFTEENTH_NAME = "Japan's next"

/** How many scenarios the game has: 14 until the platform publishes the 15th, then 15 (04 §2). */
export interface ScenarioCatalogue {
  readonly scenarioCount: 14 | 15
}

/** A catalogue of 14 or 15 scenarios. */
export function scenarioCatalogue(scenarioCount: number): ScenarioCatalogue {
  if (scenarioCount !== 14 && scenarioCount !== 15) throw new RangeError(`The catalogue holds 14 or 15 scenarios: ${scenarioCount}`)
  return { scenarioCount }
}

/** Today's catalogue: as many scenarios as today's table knows. */
export const TODAY_CATALOGUE: ScenarioCatalogue = scenarioCatalogue(MAX_SCENARIO_TIER)

const isTier = (tier: number): tier is Tier => tier === 1 || tier === 2 || tier === 3
const isScenarioOfTier = (scenario: number): scenario is ScenarioOfTier => Number.isInteger(scenario) && scenario >= 1 && scenario <= 5

function assertNumber(T: number): void {
  if (!Number.isInteger(T) || T < 1 || T > LAST_SCENARIO_NUMBER) throw new RangeError(`Scenario must be 1–15: ${T}`)
}

/** The game's scenario number T = 5(t − 1) + s. */
export function scenarioNumber(at: ScenarioAt): number {
  if (!isTier(at.tier) || !isScenarioOfTier(at.scenario)) throw new RangeError(`No scenario ${at.scenario} in tier ${at.tier}`)
  return SCENARIOS_PER_TIER * (at.tier - 1) + at.scenario
}

/** The tier of the game's scenario T. */
export function tierOf(T: number): Tier {
  assertNumber(T)
  return Math.ceil(T / SCENARIOS_PER_TIER) as Tier
}

/** Where the game's scenario T sits: its tier and its scenario of the tier. */
export function tierAndScenario(T: number): ScenarioAt {
  const tier = tierOf(T)
  return { tier, scenario: (T - SCENARIOS_PER_TIER * (tier - 1)) as ScenarioOfTier }
}

/** Scenarios in tier t: five, but tier 3 has four while the catalogue has 14 (04 §2). */
export function scenariosInTier(tier: Tier, catalogue: ScenarioCatalogue = TODAY_CATALOGUE): number {
  if (!isTier(tier)) throw new RangeError(`Tier must be 1–3: ${tier}`)
  return Math.min(SCENARIOS_PER_TIER, catalogue.scenarioCount - SCENARIOS_PER_TIER * (tier - 1))
}

/** The Racing Level of scenario s's gate: 10s (03 §2). */
export function gateLevel(scenario: number): number {
  if (!isScenarioOfTier(scenario)) throw new RangeError(`Scenario of a tier must be 1–5: ${scenario}`)
  return LEVELS_PER_SCENARIO * scenario
}

/** The first Racing Level of scenario s: 10(s − 1) + 1. */
export const firstLevel = (scenario: ScenarioOfTier): number => gateLevel(scenario) - LEVELS_PER_SCENARIO + 1

/** The tier's last gate: 50, or 40 in tier 3 while the catalogue has 14 (04 §2). Racing EXP stops there (03 §2). */
export const lastGate = (tier: Tier, catalogue: ScenarioCatalogue = TODAY_CATALOGUE): number =>
  gateLevel(scenariosInTier(tier, catalogue))

/** Whether she is in her tier's last scenario, where the next step is the World Expedition (03 §5). */
export const isLastScenario = (at: ScenarioAt, catalogue: ScenarioCatalogue = TODAY_CATALOGUE): boolean =>
  at.scenario >= scenariosInTier(at.tier, catalogue)

/** Lifetime level = 50(t − 1) + Racing Level, for lists and level badges (03 §2). Equals today's Uma Level at the same T. */
export function lifetimeLevel(tier: Tier, racingLevel: number): number {
  if (!isTier(tier)) throw new RangeError(`Tier must be 1–3: ${tier}`)
  if (!Number.isInteger(racingLevel) || racingLevel < 1 || racingLevel > RACING_LEVELS_PER_TIER) {
    throw new RangeError(`Racing Level must be 1–${RACING_LEVELS_PER_TIER}: ${racingLevel}`)
  }
  return RACING_LEVELS_PER_TIER * (tier - 1) + racingLevel
}

/** Whether today's career planner and cap tables know scenario T. The 15th waits for the catalogue (phase 5). */
export const scenarioPlayable = (T: number): boolean => Number.isInteger(T) && T >= 1 && T <= MAX_SCENARIO_TIER

/** One row of 04 §1's map: the scenario's name and JP release from today's table, or the 15th with no date yet. */
export interface ScenarioRow extends ScenarioAt {
  readonly T: number
  readonly name: string
  /** ISO date, or null for the 15th until it is published. */
  readonly jpRelease: string | null
}

export function scenarioRow(T: number): ScenarioRow {
  const at = tierAndScenario(T)
  const today = SCENARIOS[T - 1]
  return today
    ? { ...at, T, name: today.name, jpRelease: today.jpRelease }
    : { ...at, T, name: FIFTEENTH_NAME, jpRelease: null }
}
