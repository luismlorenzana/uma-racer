// Campaign battle vocabulary, engine v4 (docs/design/uma-rpg-classes.md, D278–D281).
import type { RpgClass, RpgCoreStats, RpgDamageKind, RpgElement, RpgNodeRef, RpgStatusKind, RpgWeapon, RpgWeaponKind } from '../rules'

export type BattleSide = 'ally' | 'enemy'
export type BattleChannel = 'physical' | 'magical'
export type EnemyRank = 'regular' | 'sub-boss' | 'boss'
export interface BattleStatus { kind: RpgStatusKind; stacks: number; turns: number }

export interface BattleAlly {
  id: string
  classId: RpgClass
  weapons: RpgWeapon[]
  tier: number
  level: number
  stats: RpgCoreStats
  /** Learned nodes of this tier: skills, Short Sword follow-ups and Cleric blessings. */
  tree: RpgNodeRef[]
  legacy: RpgNodeRef[]
  loadout: RpgNodeRef[]
  /** The Summoner's Familiar form; ignored for other classes. */
  familiar: RpgWeaponKind
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
  status?: 'burn' | 'slow' | 'mark' | 'weaken' | 'ward' | 'power-up'
  label: string
}
/** Weapon and element weaknesses (D279); each weak part of a hit removes one shield point. */
export interface BattleWeaknesses { weapons: RpgWeaponKind[]; elements: RpgElement[] }
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
export interface BattleInput { version: 4; seed: number; allies: BattleAlly[]; enemies: BattleEnemy[] }

export interface BattleUnit {
  id: string
  side: BattleSide
  hp: number
  mp: number
  statuses: BattleStatus[]
  /** Damage a Barrier absorbs before HP. */
  barrier: number
  phase: 1 | 2
  guardingFor: string | null
  /** Remaining break shield (enemies). */
  shield: number
  /** Round the shield broke in: the foe loses that round's and the next round's action. 0 when standing. */
  brokenAt: number
  /** Rebirth works once per Uma per fight. */
  revived: boolean
}
export interface BattleIntent { enemyId: string; moveId: string; targetId: string }
export interface BattleState {
  engineVersion: 4
  input: BattleInput
  round: number
  units: BattleUnit[]
  /** One entry per action spent this round; Guard spends every remaining action. */
  acted: string[]
  /** Summoners who used their Familiar this round. */
  familiars: string[]
  intents: BattleIntent[]
  outcome: 'active' | 'victory' | 'loss'
}
export type BattleAction =
  | { kind: 'attack'; actorId: string; targetId: string; weapon?: RpgWeapon }
  | { kind: 'guard'; actorId: string; targetId: string }
  | { kind: 'skill'; actorId: string; targetId: string; skill: RpgNodeRef; blessing?: string }
export type BattleCue =
  | { kind: 'intent'; actorId: string; targetId: string; label: string }
  | { kind: 'hit'; actorId: string; targetId: string; amount: number; channel: BattleChannel | 'status';
      element: RpgDamageKind | null; weak: boolean; label?: string }
  | { kind: 'shield' | 'break' | 'recover' | 'ko' | 'phase' | 'status' | 'guard' | 'skip' | 'heal' | 'mp' | 'revive';
      actorId: string; targetId: string; amount?: number; label?: string }
  | { kind: 'result'; label: 'victory' | 'loss' }
export type BattleError = 'terminal' | 'invalid-actor' | 'already-acted' | 'invalid-target' |
  'invalid-skill' | 'insufficient-mp' | 'invalid-state'
export interface BattleStep { state: BattleState; cues: BattleCue[]; hash: string; error?: BattleError }
