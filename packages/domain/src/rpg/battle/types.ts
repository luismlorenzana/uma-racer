// Campaign battle vocabulary, engine v2 (docs/design/uma-rpg.md#battles, D261).
import type { RpgAffinities, RpgCoreStats, RpgElement, RpgSkill, RpgSkillRef, RpgWeapon } from '../rules'
import type { Strategy } from '../../types'

export type BattleSide = 'ally' | 'enemy'
export type BattleChannel = 'physical' | 'magical'
export type BattleStatusKind = 'burn' | 'slow' | 'mark' | 'ward' | 'weaken' | 'power-up'
/** Regular foes are knocked Down by a weakness; bosses carry a break shield instead. */
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
export interface BattleEnemy {
  id: string
  /** Cast member shown for this foe; presentation only. */
  castId: string
  element: RpgElement
  rank: EnemyRank
  /** Lifetime level (Tier 1 Lv1 is 1, Tier 2 Lv1 is 51). */
  level: number
  stats: BattleEnemyStats
  shield: number
  moves: BattleEnemyMove[]
  phaseTwo?: { thresholdPercent: number; moves: BattleEnemyMove[] }
}
export interface BattleInput { version: 2; seed: number; allies: BattleAlly[]; enemies: BattleEnemy[] }

export interface BattleUnit {
  id: string
  side: BattleSide
  hp: number
  mp: number
  statuses: BattleStatus[]
  phase: 1 | 2
  guardingFor: string | null
  /** Knocked Down by a weakness: skips this round's action, stands up after the enemy phase. */
  down: boolean
  /** Remaining break shield (bosses only). */
  shield: number
  /** Round the shield broke in; the boss stays Broken through the next player phase. 0 when standing. */
  brokenAt: number
}
export interface BattleIntent { enemyId: string; moveId: string; targetId: string }
export interface BattleState {
  engineVersion: 2
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
  | { kind: 'all-out'; actorId: string }
export type BattleCue =
  | { kind: 'intent'; actorId: string; targetId: string; label: string }
  | { kind: 'hit'; actorId: string; targetId: string; amount: number; channel: BattleChannel | 'status';
      element: RpgElement | null; matchup: 'weak' | 'resist' | 'neutral'; label?: string }
  | { kind: 'down' | 'one-more' | 'shield' | 'break' | 'recover' | 'ko' | 'phase' | 'status' | 'guard' | 'skip' | 'all-out';
      actorId: string; targetId: string; amount?: number; label?: string }
  | { kind: 'result'; label: 'victory' | 'loss' }
export type BattleError = 'terminal' | 'invalid-actor' | 'already-acted' | 'invalid-target' |
  'invalid-skill' | 'insufficient-mp' | 'all-out-unavailable' | 'invalid-state'
export interface BattleStep { state: BattleState; cues: BattleCue[]; hash: string; error?: BattleError }
