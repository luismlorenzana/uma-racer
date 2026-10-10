// Every won fight pays level-relative EXP and the chapter's scenario tokens (docs/design/uma-rpg.md#rewards, D263).
import { rpgExpToNext, RPG_TIER_MAX_LEVEL } from '../rules'
import { RPG_FIGHT_STAGES, rpgTierLevel, type RpgMapNode } from './chapters'

/**
 * D266: fights carry most leveling (the Finals opens around Lv9); clearing every node ends near the chapter's last level
 * (Lv12, 24, 36, 48 …). D286: six fights a stage pay what ten did, so a fight is 10/6 of D266's 0.25. D312: three Finals
 * routes pay what five did: a vanguard 0.47 (5/3 of a sub-boss's 0.28) and a champion 0.53 (5/3 of 0.32).
 */
export const RPG_BATTLE_EXP_WEIGHTS = { fight: 0.42, 'sub-boss': 0.28, vanguard: 0.47, boss: 0.53 } as const
export const RPG_LEVEL_EXP_STEP = 0.1
export const RPG_LEVEL_EXP_MIN = 0.1
export const RPG_LEVEL_EXP_MAX = 2
/**
 * D286: ten fights' 10 + 20 a stage cannot split evenly over six, so a fight rounds up to 2 + 4. D312: the Finals' 50 + 100
 * over five routes cannot split evenly over three, so a vanguard pays 7 + 14 and a champion 10 + 20: a full clear (18
 * fights, 3 stage sub-bosses, 3 vanguards, 3 champions) pays 99 Slot + 198 Skill tokens, one Slot and two Skill more.
 */
export const RPG_BATTLE_TOKENS = { fight: { slot: 2, skill: 4 }, 'sub-boss': { slot: 4, skill: 8 }, vanguard: { slot: 7, skill: 14 },
  boss: { slot: 10, skill: 20 } } as const

/** What a fight pays as: a Finals sub-boss is a vanguard (D312). */
export type RpgRewardKind = keyof typeof RPG_BATTLE_TOKENS
type BattleKind = RpgRewardKind
export const rpgRewardKind = (node: Pick<RpgMapNode, 'kind' | 'stage'>): RpgRewardKind =>
  node.kind === 'camp' ? 'fight' : node.kind === 'sub-boss' && node.stage >= RPG_FIGHT_STAGES ? 'vanguard' : node.kind

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
