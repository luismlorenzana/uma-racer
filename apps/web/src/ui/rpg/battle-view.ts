// Read-only projections of the engine for the fight screen: legal choices, previews and cue text (D265).
import { applyBattleAction, battleActorSkill, battleBroken, battleWeaponKind,
  type BattleAction, type BattleCue, type BattleEnemy, type BattleSkill, type BattleState, type RpgSkillRef } from '@racer/domain'

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

export interface TargetPreview { amount: number; weak: boolean; chips: number; breaks: boolean; error?: string }
/** Runs the action on a copy and totals this action's hits on the target. */
export function previewTarget(state: BattleState, actorId: string, mode: BattleMode, targetId: string): TargetPreview | null {
  const step = applyBattleAction(state, actionFor(mode, actorId, targetId))
  if (step.error) return { amount: 0, weak: false, chips: 0, breaks: false, error: step.error }
  const own = step.cues.filter((c) => c.kind !== 'intent' && 'actorId' in c && c.actorId === actorId && 'targetId' in c && c.targetId === targetId)
  const hits = own.flatMap((c) => c.kind === 'hit' ? [c] : [])
  if (!hits.length) return mode.kind === 'guard' ? { amount: 0, weak: false, chips: 0, breaks: false } : null
  return { amount: hits.reduce((sum, c) => sum + c.amount, 0), weak: hits.some((c) => c.weak),
    chips: own.filter((c) => c.kind === 'shield').length, breaks: own.some((c) => c.kind === 'break') }
}

export const isBroken = battleBroken

/** Whether this Uma can chip the foe: by her weapon (Attack) or by an equipped skill's element. */
export function canChip(state: BattleState, allyId: string, enemy: BattleEnemy): { weapon: boolean; element: boolean } {
  const ally = state.input.allies.find((a) => a.id === allyId)
  if (!ally) return { weapon: false, element: false }
  return { weapon: enemy.weaknesses.weapons.includes(battleWeaponKind(ally.weapon)),
    element: ally.loadout.some((ref) => ref.element === enemy.weaknesses.element) }
}

export function describeCue(cue: BattleCue, name: (id: string) => string): string {
  switch (cue.kind) {
    case 'hit': return cue.label === 'Burn' ? `${name(cue.targetId)} burns for ${cue.amount}`
      : `${name(cue.actorId)} → ${name(cue.targetId)}: ${cue.amount}${cue.weak ? ' · WEAK' : ''}${cue.label === 'Intercepted' ? ' · guarded' : ''}`
    case 'shield': return `${name(cue.targetId)} shield ${cue.amount}`
    case 'break': return `${name(cue.targetId)} BREAK!`
    case 'recover': return `${name(cue.targetId)} recovers its shield`
    case 'ko': return `${name(cue.targetId)} is knocked out`
    case 'phase': return `${name(cue.targetId)} changes tactics`
    case 'status': return `${name(cue.targetId)}: ${cue.label}`
    case 'guard': return `${name(cue.actorId)} guards ${name(cue.targetId)}`
    case 'skip': return `${name(cue.actorId)} is ${cue.label?.toLowerCase()} and loses its turn`
    case 'intent': return `${name(cue.actorId)}: ${cue.label}`
    case 'result': return cue.label === 'victory' ? 'Victory!' : 'Defeated'
  }
}
