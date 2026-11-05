// The fifteen scenarios in JP release order (docs/game/scenarios.md): the game's scenario T is the T-th row, three
// tiers of five (docs/game/04-tiers-and-scenarios.md).

export interface ScenarioDef {
  /** The game's scenario number T, 1–15 (named `tier` since generation 1). */
  tier: number
  id: string
  name: string
  jpName: string
  /** Verified JP release date (ISO). Decides card eras. */
  jpRelease: string
}

export const SCENARIOS: readonly ScenarioDef[] = [
  { tier: 1, id: 'ura-finale', name: 'URA Finale', jpName: 'URA Finals', jpRelease: '2021-02-24' },
  { tier: 2, id: 'unity-cup', name: 'Unity Cup', jpName: 'Aoharu Cup', jpRelease: '2021-08-30' },
  { tier: 3, id: 'trackblazer', name: 'Trackblazer', jpName: 'Make a New Track', jpRelease: '2022-02-24' },
  { tier: 4, id: 'grand-concert', name: 'Our Grand Concert', jpName: 'Grand Live', jpRelease: '2022-08-24' },
  { tier: 5, id: 'grand-masters', name: 'Grand Masters', jpName: 'Grand Masters', jpRelease: '2023-02-24' },
  { tier: 6, id: 'project-larc', name: "Project L'Arc", jpName: "Project L'Arc", jpRelease: '2023-08-24' },
  { tier: 7, id: 'uaf', name: 'U.A.F. Ready GO!', jpName: 'U.A.F. Ready GO!', jpRelease: '2024-02-24' },
  { tier: 8, id: 'great-food-festival', name: 'Great Food Festival', jpName: 'Daihoushokusai', jpRelease: '2024-06-26' },
  { tier: 9, id: 'mecha-umamusume', name: 'Run! Mecha Umamusume', jpName: 'Mecha Umamusume', jpRelease: '2024-10-29' },
  { tier: 10, id: 'twinkle-legends', name: 'The Twinkle Legends', jpName: 'The Twinkle Legends', jpRelease: '2025-02-24' },
  { tier: 11, id: 'design-your-island', name: 'Design Your Island', jpName: 'Mujintou', jpRelease: '2025-06-27' },
  { tier: 12, id: 'yukoma-hot-springs', name: 'Yukoma Hot Springs', jpName: 'ごくらく♪ゆこま温泉郷', jpRelease: '2025-10-29' },
  { tier: 13, id: 'beyond-dreams', name: 'Beyond Dreams', jpName: 'Beyond Dreams 共に前へ、共に光を', jpRelease: '2026-02-24' },
  { tier: 14, id: 'tracen-diner', name: 'Tracen Diner', jpName: 'らっしゃい！トレセン軒！', jpRelease: '2026-06-29' },
  { tier: 15, id: 'goshiki-shuntaisai', name: 'Goshiki Shuntaisai', jpName: '午式駿大祭', jpRelease: '2026-10-26' },
]

export const MAX_SCENARIO_TIER = SCENARIOS.length

export function scenarioForTier(tier: number): ScenarioDef | undefined {
  return SCENARIOS[tier - 1]
}

/** Above this, stats count about half in races and training gains are halved — as in the original game. */
export const STAT_SOFT_CAP = 1200

/**
 * Skill points a fully trained career can hold, per scenario (D133). Grounded where the original game is measured —
 * Unity Cup careers finish around 2,000–2,500 SP and Trackblazer around 2,800 (Game8) — and a draft elsewhere: URA
 * Finale is set just below Unity Cup, and tiers 4–15 climb 200 a scenario. A typical gold skill with its white
 * prerequisite costs about 340 SP in our content, so tier 1 buys five or six.
 */
export const SKILL_POINT_CAPS = [2000, 2400, 2800, 3000, 3200, 3400, 3600, 3800, 4000, 4200, 4400, 4600, 4800, 5000, 5200] as const

export const skillPointCap = (tier: number): number =>
  SKILL_POINT_CAPS[Math.min(SKILL_POINT_CAPS.length, Math.max(1, Math.trunc(tier))) - 1]!

/** A card's era is the latest scenario released on or before the card's JP release date. */
export function eraOf(jpReleaseDate: string): number {
  let era = 1
  for (const s of SCENARIOS) if (s.jpRelease <= jpReleaseDate) era = s.tier
  return era
}
