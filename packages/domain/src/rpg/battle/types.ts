// Campaign battle vocabulary, engine v3 (docs/design/uma-rpg.md#battles, D265).
import type { RpgAffinities, RpgCoreStats, RpgElement, RpgSkill, RpgSkillRef, RpgWeapon } from '../rules'
import type { Strategy } from '../../types'

export type BattleSide = 'ally' | 'enemy'
export type BattleChannel = 'physical' | 'magical'
export type BattleStatusKind = 'burn' | 'slow' | 'mark' | 'ward' | 'weaken' | 'power-up'
/** Weapon weaknesses read by kind: both staves count as a staff. */
export type BattleWeaponKind = 'greatsword' | 'spear' | 'sword' | 'staff' | 'tome'
export type EnemyRank = 'regular' | 'sub-boss' | 'boss'
export interface BattleStatus { kind: BattleStatusKind; stacks: number; turns: number }

export interface BattleAlly {
  id: string
  style: Strategy
  weapon: RpgWeapon
  tier: number
  level: number
  stats: RpgCoreStats
  affinities: RpgAffinities
  signature: RpgElement
  tree: RpgSkill[]
  legacy: RpgSkill[]
  loadout: RpgSkillRef[]
  /** MP carried into this fight from the run; HP always starts full. */
  mp: number
}
export interface BattleEnemyStats { hp: number; atk: number; matk: number; pdef: number; mdef: number; initiative: number }
export interface BattleEnemyMove {
  id: string
  kind: 'damage' | 'guard' | 'buff' | 'debuff'
  channel: BattleChannel
  element: RpgElement | null
  /** Percent of the enemy's offense; area moves hit every ally at this power. */
  power: number
  target: 'front' | 'lowest-hp' | 'seeded' | 'all' | 'self' | 'ally'
  status?: BattleStatusKind
  label: string
}
/** Hits of any listed kind chip the break shield (Octopath Traveler, D265). */
export interface BattleWeaknesses { element: RpgElement; weapons: BattleWeaponKind[] }
export interface BattleEnemy {
  id: string
  /** Cast member shown for this foe; presentation only. */
  castId: string
  element: RpgElement
  rank: EnemyRank
  /** Lifetime level (Tier 1 Lv1 is 1, Tier 2 Lv1 is 51). */
  level: number
  stats: BattleEnemyStats
  /** Break shield points; every enemy has one. */
  shield: number
  weaknesses: BattleWeaknesses
  moves: BattleEnemyMove[]
  phaseTwo?: { thresholdPercent: number; moves: BattleEnemyMove[] }
}
export interface BattleInput { version: 3; seed: number; allies: BattleAlly[]; enemies: BattleEnemy[] }

export interface BattleUnit {
  id: string
  side: BattleSide
  hp: number
  mp: number
  statuses: BattleStatus[]
  phase: 1 | 2
  guardingFor: string | null
  /** Remaining break shield (enemies). */
  shield: number
  /** Round the shield broke in: the foe loses that round's and the next round's action. 0 when standing. */
  brokenAt: number
}
export interface BattleIntent { enemyId: string; moveId: string; targetId: string }
export interface BattleState {
  engineVersion: 3
  input: BattleInput
  round: number
  units: BattleUnit[]
  acted: string[]
  intents: BattleIntent[]
  outcome: 'active' | 'victory' | 'loss'
}
export type BattleAction =
  | { kind: 'attack'; actorId: string; targetId: string }
  | { kind: 'guard'; actorId: string; targetId: string }
  | { kind: 'skill'; actorId: string; targetId: string; skill: RpgSkillRef }
export type BattleCue =
  | { kind: 'intent'; actorId: string; targetId: string; label: string }
  | { kind: 'hit'; actorId: string; targetId: string; amount: number; channel: BattleChannel | 'status';
      element: RpgElement | null; weak: boolean; label?: string }
  | { kind: 'shield' | 'break' | 'recover' | 'ko' | 'phase' | 'status' | 'guard' | 'skip';
      actorId: string; targetId: string; amount?: number; label?: string }
  | { kind: 'result'; label: 'victory' | 'loss' }
export type BattleError = 'terminal' | 'invalid-actor' | 'already-acted' | 'invalid-target' |
  'invalid-skill' | 'insufficient-mp' | 'invalid-state'
export interface BattleStep { state: BattleState; cues: BattleCue[]; hash: string; error?: BattleError }
