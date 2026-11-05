// The tier map (docs/game/04-tiers-and-scenarios.md, D327, D380): three tiers of five scenarios; scenario s of tier t
// is the game's scenario T = 5(t − 1) + s. Japan's 15th, Goshiki Shuntaisai, completes tier 3 (D381).
import { MAX_SCENARIO_TIER, SCENARIOS } from '../scenarios'

export type Tier = 1 | 2 | 3
export type ScenarioOfTier = 1 | 2 | 3 | 4 | 5
export interface ScenarioAt {
  readonly tier: Tier
  readonly scenario: ScenarioOfTier
}

/** Three tiers (D327). */
export const TIERS = 3
/** Five scenarios a tier (D327). */
export const SCENARIOS_PER_TIER = 5
/** The game's last scenario number: tier 3's fifth. */
export const LAST_SCENARIO_NUMBER = TIERS * SCENARIOS_PER_TIER

/** How many scenarios the game knows: all fifteen since D381. */
export interface ScenarioCatalogue {
  readonly scenarioCount: number
}

/** Today's catalogue: every scenario in the table. */
export const TODAY_CATALOGUE: ScenarioCatalogue = Object.freeze({ scenarioCount: MAX_SCENARIO_TIER })

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

/** One row of the tier map: the scenario's name and JP release. */
export interface ScenarioRow extends ScenarioAt {
  readonly T: number
  readonly name: string
  readonly jpRelease: string
}

export function scenarioRow(T: number): ScenarioRow {
  const at = tierAndScenario(T)
  const def = SCENARIOS[T - 1]
  if (!def) throw new RangeError(`Scenario ${T} is not in the table`)
  return { ...at, T, name: def.name, jpRelease: def.jpRelease }
}
