// Frozen RPG battle vocabulary (docs/design/uma-rpg.md, D229).
import type { RpgAffinities, RpgCoreStats, RpgElement, RpgSkill, RpgSkillRef, RpgWeapon } from '../rules'
import type { Strategy } from '../../types'

export type CombatSide = 'ally' | 'enemy'
export type CombatChannel = 'physical' | 'magical'
export type CombatStatusKind = 'burn' | 'slow' | 'mark' | 'ward' | 'weaken' | 'regen' | 'power-up'
export type CombatTarget = 'enemy' | 'all-enemies' | 'ally' | 'all-allies' | 'self'
export interface CombatStatus { kind: CombatStatusKind; stacks: number; turns: number }
export interface FrozenAlly {
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
}
export interface EnemyMove {
  id: string
  kind: 'damage' | 'heal' | 'guard' | 'buff'
  channel: CombatChannel
  element: RpgElement | null
  power: number
  target: 'front' | 'lowest-hp' | 'seeded' | 'self' | 'lowest-hp-ally'
  status?: CombatStatusKind
  intentText: string
}
export interface FrozenEnemy {
  id: string
  element: RpgElement
  stats: RpgCoreStats
  moves: EnemyMove[]
  /** At or below this HP percentage, phase-two moves become visible before resolution. */
  phaseTwo?: { thresholdPercent: number; moves: EnemyMove[] }
}
export interface EncounterInput {
  version: 1
  contentVersion: string
  seed: number
  allies: FrozenAlly[]
  enemies: FrozenEnemy[]
  /** The no-follow-up variant is retained for fixed-seed comparison, not chosen by the renderer. */
  weaknessFollowUp: 'none' | 'bounded'
}
export interface CombatUnit {
  id: string
  side: CombatSide
  hp: number
  mp: number
  statuses: CombatStatus[]
  phase: 1 | 2
  guardingFor: string | null
}
export interface EnemyIntent { enemyId: string; moveId: string; targetId: string }
export interface CombatState {
  engineVersion: 1
  input: EncounterInput
  round: number
  units: CombatUnit[]
  acted: string[]
  intents: EnemyIntent[]
  followUpsUsed: number
  outcome: 'active' | 'victory' | 'loss'
}
export type CombatAction =
  | { kind: 'attack'; actorId: string; targetId: string }
  | { kind: 'guard'; actorId: string; targetId: string }
  | { kind: 'skill'; actorId: string; targetId: string; skill: RpgSkillRef }
  | { kind: 'item'; actorId: string; targetId: string; itemId: string }
export type CombatCue =
  | { kind: 'intent'; actorId: string; targetId: string; label: string }
  | { kind: 'hit' | 'heal' | 'guard' | 'ko' | 'phase' | 'status' | 'follow-up'; actorId: string; targetId: string; amount?: number; label?: string }
  | { kind: 'result'; label: 'victory' | 'loss' }
export type CombatError = 'terminal' | 'invalid-actor' | 'already-acted' | 'invalid-target' |
  'invalid-skill' | 'insufficient-mp' | 'item-disabled' | 'invalid-state'
export interface CombatStep { state: CombatState; cues: CombatCue[]; hash: string; error?: CombatError }
