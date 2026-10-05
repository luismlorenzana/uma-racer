// Every won fight pays level-relative EXP and the chapter's scenario tokens (docs/design/uma-rpg.md#rewards, D263).
import { rpgExpToNext, RPG_TIER_MAX_LEVEL } from '../rules'
import { rpgTierLevel, type RpgMapNodeKind } from './chapters'

export const RPG_BATTLE_EXP_WEIGHTS = { fight: 0.14, 'sub-boss': 0.45, boss: 0.8 } as const
export const RPG_LEVEL_EXP_STEP = 0.1
export const RPG_LEVEL_EXP_MIN = 0.1
export const RPG_LEVEL_EXP_MAX = 2
export const RPG_BATTLE_TOKENS = { fight: { slot: 1, skill: 2 }, 'sub-boss': { slot: 3, skill: 6 }, boss: { slot: 6, skill: 12 } } as const

type BattleKind = Exclude<RpgMapNodeKind, 'camp'>

/** A fight's EXP before the level gap: a share of one level at the foes' level. */
export function rpgBattleBaseExp(kind: BattleKind, foeLevel: number): number {
  const { level } = rpgTierLevel(foeLevel)
  return Math.round(rpgExpToNext(Math.min(level, RPG_TIER_MAX_LEVEL - 1)) * RPG_BATTLE_EXP_WEIGHTS[kind])
}

/** Lower-level fights pay less, higher-level fights more: ±10% per lifetime level, from 10% to 200%. */
export function rpgLevelExpFactor(memberLevel: number, foeLevel: number): number {
  const factor = 1 - (memberLevel - foeLevel) * RPG_LEVEL_EXP_STEP
  return Math.min(RPG_LEVEL_EXP_MAX, Math.max(RPG_LEVEL_EXP_MIN, Math.round(factor * 100) / 100))
}

/** `memberLevel` is the outfit's lifetime level (Tier 1 Lv1 is 1). */
export function rpgBattleExp(kind: BattleKind, foeLevel: number, memberLevel: number): number {
  return Math.max(1, Math.round(rpgBattleBaseExp(kind, foeLevel) * rpgLevelExpFactor(memberLevel, foeLevel)))
}

export function rpgBattleTokens(kind: BattleKind): { slot: number; skill: number } {
  return { ...RPG_BATTLE_TOKENS[kind] }
}
