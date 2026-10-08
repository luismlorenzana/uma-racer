// Level-up presentation for a settled fight (docs/design/uma-rpg.md#rewards).
import { STATS, type Stats } from '../types'
import { projectRpgStats, rpgActiveSlots, rpgTreePointsEarned, type RpgProfile } from './rules'

export interface RpgMemberLevels { beforeTier: number; beforeLevel: number; afterTier: number; afterLevel: number }

/** Result-based reveal still works after later fights; only enrollment inputs are read from the live profile. */
export function rpgLevelReveal(profile: RpgProfile, member: RpgMemberLevels): {
  before: Stats; after: Stats; deltas: Stats; levels: number[]; points: number; beforeSlots: number; afterSlots: number
} {
  const before = projectRpgStats({ ...profile, tier: member.beforeTier, level: member.beforeLevel })
  const after = projectRpgStats({ ...profile, tier: member.afterTier, level: member.afterLevel })
  return { before, after, deltas: Object.fromEntries(STATS.map((s) => [s, after[s] - before[s]])) as Stats,
    levels: Array.from({ length: member.afterLevel - member.beforeLevel }, (_, i) => member.beforeLevel + i + 1),
    points: rpgTreePointsEarned(member.afterLevel) - rpgTreePointsEarned(member.beforeLevel),
    beforeSlots: rpgActiveSlots(member.beforeLevel), afterSlots: rpgActiveSlots(member.afterLevel) }
}
