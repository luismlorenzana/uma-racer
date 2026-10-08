// Read-only projections of the engine for the fight screen: legal choices, previews and cue text (D278–D281).
import { applyBattleAction, battleActorSkill, battleBlessings, battleBroken, battleSkillFor, isRpgElement, isRpgWeaponKind, rpgHand,
  type BattleAction, type BattleAlly, type BattleCue, type BattleEnemy, type BattleSkill, type BattleState,
  type RpgDamageKind, type RpgNodeRef, type RpgWeapon, type RpgWeaponKind } from '@racer/domain'

export type BattleMode = { kind: 'attack'; weapon?: RpgWeapon } | { kind: 'guard' } | { kind: 'skill'; ref: RpgNodeRef; blessing?: string }

export interface SkillChoice { ref: RpgNodeRef; skill: BattleSkill; affordable: boolean }
export function skillChoices(state: BattleState, actorId: string): SkillChoice[] {
  const ally = state.input.allies.find((a) => a.id === actorId)
  const unit = state.units.find((u) => u.id === actorId)
  if (!ally || !unit) return []
  return ally.loadout.flatMap((ref) => {
    const skill = battleActorSkill(state, actorId, ref)
    return skill ? [{ ref, skill, affordable: unit.mp >= skill.mp }] : []
  })
}

/** The Cleric's blessings for this skill, if she has any (D281). */
export const blessingChoices = (state: BattleState, actorId: string, skill: BattleSkill) => {
  const ally = state.input.allies.find((a) => a.id === actorId)
  return ally ? battleBlessings(ally, skill.def.primary) : []
}

export function actionFor(mode: BattleMode, actorId: string, targetId: string): BattleAction {
  if (mode.kind === 'skill') return { kind: 'skill', actorId, targetId, skill: mode.ref, ...(mode.blessing ? { blessing: mode.blessing } : {}) }
  if (mode.kind === 'attack') return { kind: 'attack', actorId, targetId, ...(mode.weapon ? { weapon: mode.weapon } : {}) }
  return { kind: 'guard', actorId, targetId }
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

/** Kinds an Uma can land: her free action's weapon and every part of her equipped skills. */
export function allyKinds(ally: Pick<BattleAlly, 'classId' | 'weapons' | 'tier' | 'tree' | 'legacy' | 'loadout' | 'familiar'>): { free: RpgWeaponKind[]; skills: RpgDamageKind[] } {
  const hand = rpgHand(ally)
  const free = hand.free.kind === 'weapon' ? ally.weapons.filter(isRpgWeaponKind) : hand.free.kind === 'short-sword' ? ['short-sword' as const]
    : hand.free.kind === 'familiar' ? [ally.familiar] : []
  const skills = new Set<RpgDamageKind>()
  for (const ref of ally.loadout) {
    const skill = battleSkillFor(ally, ref)
    if (!skill) continue
    for (const hit of [...skill.def.hits, ...skill.def.focus ?? [], ...(skill.def.splash ? [skill.def.splash] : []), ...(skill.def.sweep ? [skill.def.sweep] : [])]) {
      for (const part of hit.parts) skills.add(part.kind)
    }
  }
  if (ally.weapons.includes('short-sword')) skills.add('short-sword')
  return { free: free as RpgWeaponKind[], skills: [...skills] }
}

/** Whether this Uma can chip the foe: by a weapon kind (free action or skill) or by an equipped skill's element. */
export function canChip(state: BattleState, allyId: string, enemy: BattleEnemy): { weapon: boolean; element: boolean } {
  const ally = state.input.allies.find((a) => a.id === allyId)
  if (!ally) return { weapon: false, element: false }
  const { free, skills } = allyKinds(ally)
  return { weapon: [...free, ...skills].some((k) => isRpgWeaponKind(k) && enemy.weaknesses.weapons.includes(k)),
    element: skills.some((k) => isRpgElement(k) && enemy.weaknesses.elements.includes(k)) }
}

export function describeCue(cue: BattleCue, name: (id: string) => string): string {
  switch (cue.kind) {
    case 'hit': return cue.label === 'Burn' ? `${name(cue.targetId)} burns for ${cue.amount}`
      : `${name(cue.actorId)} → ${name(cue.targetId)}: ${cue.amount}${cue.weak ? ' · WEAK' : ''}${cue.label === 'Intercepted' ? ' · guarded' : cue.label?.startsWith('Barrier') ? ` · ${cue.label}` : ''}`
    case 'shield': return `${name(cue.targetId)} shield ${cue.amount}`
    case 'break': return `${name(cue.targetId)} BREAK!`
    case 'recover': return `${name(cue.targetId)} recovers its shield`
    case 'ko': return `${name(cue.targetId)} is knocked out`
    case 'phase': return `${name(cue.targetId)} changes tactics`
    case 'status': return `${name(cue.targetId)}: ${cue.label}`
    case 'guard': return `${name(cue.actorId)} guards ${name(cue.targetId)}`
    case 'skip': return `${name(cue.actorId)} is ${cue.label?.toLowerCase()} and loses its turn`
    case 'heal': return `${name(cue.targetId)} recovers ${cue.amount} HP`
    case 'mp': return `${name(cue.targetId)} +${cue.amount} MP`
    case 'revive': return `${name(cue.targetId)} gets back up!`
    case 'intent': return `${name(cue.actorId)}: ${cue.label}`
    case 'result': return cue.label === 'victory' ? 'Victory!' : 'Defeated'
  }
}
