// Accepted encounter progression and presentation (docs/design/uma-rpg.md, T096).
import { STATS, type Stats } from '../types'
import { grantRpgExp, projectRpgStats, rpgActiveSlots, rpgExpToNext, rpgLifetimeLevels,
  rpgTreePointsEarned, type RpgProfile } from './rules'
import type { RpgResultEvidenceV1 } from './save'

export const RPG_EXP_RELATIVE_STEP = 0.025
export const RPG_EXP_FACTOR_MIN = 0.25
export const RPG_EXP_FACTOR_MAX = 1.5
export const RPG_CHAPTER_EXP_MARGIN = 1.1
export const RPG_ENCOUNTER_EXP_WEIGHTS = { encounter: 0.4, elite: 0.25, boss: 0.6 } as const
export const RPG_MAX_ENCOUNTER_EXP = 1_000_000

/** Authored EXP is frozen at entry, separate from the combat reducer and its replay hashes. */
export interface RpgRewardInput { baseExp: number; recommendedTier: number; recommendedLevel: number }
export function validRpgRewardInput(value: unknown): value is RpgRewardInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return Object.keys(v).length === 3 && Number.isSafeInteger(v.baseExp) && (v.baseExp as number) >= 0 &&
    (v.baseExp as number) <= RPG_MAX_ENCOUNTER_EXP && Number.isSafeInteger(v.recommendedTier) &&
    (v.recommendedTier as number) >= 1 && (v.recommendedTier as number) <= 10_000 &&
    Number.isSafeInteger(v.recommendedLevel) && (v.recommendedLevel as number) >= 1 && (v.recommendedLevel as number) <= 50
}

/** Starter authoring schedule; production nodes carry explicit baseExp, never infer it in a screen. */
export function rpgEncounterBaseExp(level: number, kind: keyof typeof RPG_ENCOUNTER_EXP_WEIGHTS): number {
  rpgLifetimeLevels(1, level)
  let budget = 0
  // A Lv50 recommendation still has a positive replay reward; use the final nine-level stretch.
  const first = level === 50 ? 41 : level
  for (let current = first; current < Math.min(50, first + 10); current++) budget += rpgExpToNext(current)
  return Math.round(budget * RPG_CHAPTER_EXP_MARGIN * RPG_ENCOUNTER_EXP_WEIGHTS[kind])
}

/** Factor uses the FROZEN entrant level. Concurrent progress changes the recipient, not the earned reward. */
export function rpgEncounterExp(input: RpgRewardInput, entrant: Pick<RpgProfile, 'tier' | 'level'>): number {
  if (!validRpgRewardInput(input)) throw new RangeError('Invalid RPG reward input')
  const difference = rpgLifetimeLevels(entrant.tier, entrant.level) - rpgLifetimeLevels(input.recommendedTier, input.recommendedLevel)
  const factor = Math.max(RPG_EXP_FACTOR_MIN, Math.min(RPG_EXP_FACTOR_MAX, 1 - difference * RPG_EXP_RELATIVE_STEP))
  return input.baseExp === 0 ? 0 : Math.max(1, Math.round(input.baseExp * factor))
}

export function rpgRewardProjection(profile: RpgProfile, delta: number): {
  profile: RpgProfile; member: RpgResultEvidenceV1['memberExp'][number]
} {
  const after = grantRpgExp(profile, delta).profile
  return { profile: after, member: { outfitId: profile.outfitId, delta,
    beforeTier: profile.tier, beforeLevel: profile.level, beforeExp: profile.exp,
    afterTier: after.tier, afterLevel: after.level, afterExp: after.exp } }
}

/** Receipt-based reveal still works after later fights; only enrollment inputs are read from the live profile. */
export function rpgLevelReveal(profile: RpgProfile, member: RpgResultEvidenceV1['memberExp'][number]): {
  before: Stats; after: Stats; deltas: Stats; levels: number[]; points: number; beforeSlots: number; afterSlots: number
} {
  const before = projectRpgStats({ ...profile, tier: member.beforeTier, level: member.beforeLevel })
  const after = projectRpgStats({ ...profile, tier: member.afterTier, level: member.afterLevel })
  return { before, after, deltas: Object.fromEntries(STATS.map((s) => [s, after[s] - before[s]])) as Stats,
    levels: Array.from({ length: member.afterLevel - member.beforeLevel }, (_, i) => member.beforeLevel + i + 1),
    points: rpgTreePointsEarned(member.afterLevel) - rpgTreePointsEarned(member.beforeLevel),
    beforeSlots: rpgActiveSlots(member.beforeLevel), afterSlots: rpgActiveSlots(member.afterLevel) }
}
