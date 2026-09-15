// Scenarios are 10-level progression tiers in JP release order (docs/design/scenarios.md).

export interface ScenarioDef {
  /** 1-based tier index. */
  tier: number
  id: string
  name: string
  jpName: string
  /** JP release date (ISO). Decides card eras. ⚠️ some dates still need verifying — see the doc. */
  jpRelease: string
  baselineStatCap: number
}

export const SCENARIOS: readonly ScenarioDef[] = [
  { tier: 1, id: 'ura-finale', name: 'URA Finale', jpName: 'URA Finals', jpRelease: '2021-02-24', baselineStatCap: 1200 },
  { tier: 2, id: 'unity-cup', name: 'Unity Cup', jpName: 'Aoharu Cup', jpRelease: '2021-08-30', baselineStatCap: 1280 },
  { tier: 3, id: 'trackblazer', name: 'Trackblazer', jpName: 'Make a New Track', jpRelease: '2022-02-24', baselineStatCap: 1360 },
  { tier: 4, id: 'grand-concert', name: 'Our Grand Concert', jpName: 'Grand Live', jpRelease: '2022-08-24', baselineStatCap: 1440 },
  { tier: 5, id: 'grand-masters', name: 'Grand Masters', jpName: 'Grand Masters', jpRelease: '2023-02-24', baselineStatCap: 1520 },
  { tier: 6, id: 'project-larc', name: "Project L'Arc", jpName: "Project L'Arc", jpRelease: '2023-08-24', baselineStatCap: 1600 },
  { tier: 7, id: 'uaf', name: 'U.A.F. Ready GO!', jpName: 'U.A.F. Ready GO!', jpRelease: '2024-02-24', baselineStatCap: 1680 },
  { tier: 8, id: 'great-food-festival', name: 'Great Food Festival', jpName: 'Daihoushokusai', jpRelease: '2024-06-26', baselineStatCap: 1760 },
  { tier: 9, id: 'mecha-umamusume', name: 'Run! Mecha Umamusume', jpName: 'Mecha Umamusume', jpRelease: '2024-10-29', baselineStatCap: 1840 },
  { tier: 10, id: 'twinkle-legends', name: 'The Twinkle Legends', jpName: 'The Twinkle Legends', jpRelease: '2025-02-24', baselineStatCap: 1920 },
  { tier: 11, id: 'design-your-island', name: 'Design Your Island', jpName: 'Mujintou', jpRelease: '2025-06-26', baselineStatCap: 2000 },
]

export const LEVELS_PER_SCENARIO = 10

export function scenarioForTier(tier: number): ScenarioDef | undefined {
  return SCENARIOS[tier - 1]
}

/**
 * Baseline stat cap (the Training Level 10 cap): the original game's 1200 launch cap at tier 1, rising 80 per scenario
 * to its current 2000 cap at tier 11, and continuing at +80 after that (docs/design/scenarios.md#timeline-and-tiers).
 */
export function baselineStatCap(tier: number): number {
  return scenarioForTier(tier)?.baselineStatCap ?? 1200 + 80 * (tier - 1)
}

/** Above this, stats count about half in races and training gains are halved — as in the original game. */
export const STAT_SOFT_CAP = 1200

/** Baseline SP cap (loadout capacity at Training Level 10). */
export const baselineSpCap = (tier: number): number => 300 + 200 * (tier - 1)

export const tierOfLevel = (umaLevel: number): number => Math.ceil(umaLevel / LEVELS_PER_SCENARIO)

export const isGateLevel = (umaLevel: number): boolean => umaLevel % LEVELS_PER_SCENARIO === 0

/** 0 at levels 1, 11, 21… and 9 at gate levels 10, 20, 30… */
export const levelsIntoScenario = (umaLevel: number): number => (umaLevel - 1) % LEVELS_PER_SCENARIO

/** A card's era is the latest scenario released on or before the card's JP release date. */
export function eraOf(jpReleaseDate: string): number {
  let era = 1
  for (const s of SCENARIOS) if (s.jpRelease <= jpReleaseDate) era = s.tier
  return era
}
