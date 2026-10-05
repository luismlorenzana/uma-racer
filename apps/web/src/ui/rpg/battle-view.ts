// Read-only projections of the engine for the fight screen: legal choices, previews and cue text (D261).
import { applyBattleAction, battleActorSkill, battleAllOutReady, battleBroken, battleSkill, battleWeakness,
  type BattleAction, type BattleCue, type BattleSkill, type BattleState, type RpgElement, type RpgSkillRef } from '@racer/domain'
import { RPG_ELEMENT_LABELS } from './RpgPortrait'

export type BattleMode = { kind: 'attack' } | { kind: 'guard' } | { kind: 'skill'; ref: RpgSkillRef }

export interface SkillChoice { ref: RpgSkillRef; skill: BattleSkill; level: number; affordable: boolean }
export function skillChoices(state: BattleState, actorId: string): SkillChoice[] {
  const ally = state.input.allies.find((a) => a.id === actorId)
  const unit = state.units.find((u) => u.id === actorId)
  if (!ally || !unit) return []
  return ally.loadout.flatMap((ref) => {
    const legal = battleActorSkill(state, actorId, ref)
    return legal ? [{ ref, skill: legal.skill, level: legal.level, affordable: unit.mp >= legal.skill.mp }] : []
  })
}

export function actionFor(mode: BattleMode, actorId: string, targetId: string): BattleAction {
  return mode.kind === 'skill' ? { kind: 'skill', actorId, targetId, skill: mode.ref } : { kind: mode.kind, actorId, targetId }
}

export interface TargetPreview { amount: number; matchup: 'weak' | 'resist' | 'neutral'; down: boolean; shieldHit: boolean; error?: string }
/** Runs the action on a copy; only this action's first hit on the target is read. */
export function previewTarget(state: BattleState, actorId: string, mode: BattleMode, targetId: string): TargetPreview | null {
  const step = applyBattleAction(state, actionFor(mode, actorId, targetId))
  if (step.error) return { amount: 0, matchup: 'neutral', down: false, shieldHit: false, error: step.error }
  const hits = step.cues.flatMap((c) => c.kind === 'hit' && c.actorId === actorId ? [c] : [])
  const hit = hits.find((c) => c.targetId === targetId) ?? hits[0]
  if (!hit) return mode.kind === 'guard' ? { amount: 0, matchup: 'neutral', down: false, shieldHit: false } : null
  const total = hits.filter((c) => c.targetId === hit.targetId).reduce((sum, c) => sum + c.amount, 0)
  return { amount: total, matchup: hit.matchup, down: step.cues.some((c) => c.kind === 'down' && c.targetId === targetId),
    shieldHit: step.cues.some((c) => c.kind === 'shield' && c.targetId === targetId) }
}

export const allOutReady = battleAllOutReady
export const isBroken = battleBroken
export const weaknessLabel = (element: RpgElement): string => RPG_ELEMENT_LABELS[battleWeakness(element)]

/** Elements in this party's loadouts that break a foe of `element`. */
export function partyBreaks(state: BattleState, element: RpgElement): boolean {
  const weak = battleWeakness(element)
  return state.input.allies.some((a) => a.loadout.some((ref) => battleSkill(ref).element === weak))
}

export function describeCue(cue: BattleCue, name: (id: string) => string): string {
  switch (cue.kind) {
    case 'hit': return cue.label === 'Burn' ? `${name(cue.targetId)} burns for ${cue.amount}`
      : `${name(cue.actorId)} → ${name(cue.targetId)}: ${cue.amount}${cue.matchup === 'weak' ? ' · WEAK!' : cue.matchup === 'resist' ? ' · resisted' : ''}${cue.label === 'All-Out' ? ' · ALL-OUT' : cue.label === 'Intercepted' ? ' · guarded' : ''}`
    case 'down': return `${name(cue.targetId)} is DOWN!`
    case 'one-more': return `ONE MORE! ${name(cue.actorId)} acts again`
    case 'shield': return `${name(cue.targetId)} shield ${cue.amount}`
    case 'break': return `${name(cue.targetId)} is BROKEN!`
    case 'recover': return `${name(cue.targetId)} recovers its shield`
    case 'ko': return `${name(cue.targetId)} is knocked out`
    case 'phase': return `${name(cue.targetId)} changes tactics`
    case 'status': return `${name(cue.targetId)}: ${cue.label}`
    case 'guard': return `${name(cue.actorId)} guards ${name(cue.targetId)}`
    case 'skip': return `${name(cue.actorId)} is ${cue.label?.toLowerCase()} and loses its turn`
    case 'all-out': return 'ALL-OUT ATTACK!'
    case 'intent': return `${name(cue.actorId)}: ${cue.label}`
    case 'result': return cue.label === 'victory' ? 'Victory!' : 'Defeated'
  }
}
