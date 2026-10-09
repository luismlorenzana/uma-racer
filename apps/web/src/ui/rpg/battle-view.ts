// Read-only projections of the engine for the fight screen: legal choices, previews and cue text (D278–D281, D311).
import { BATTLE_LIMIT_MAX, BATTLE_LIMIT_NAMES, applyBattleAction, battleActionsLeft, battleActorSkill, battleBlessings, battleBroken,
  battleLimitPlan, battleSkillFor, isRpgElement, isRpgWeaponKind, rpgHand,
  type BattleAction, type BattleAlly, type BattleCue, type BattleEnemy, type BattleLimitChoice, type BattleSkill, type BattleState,
  type RpgDamageKind, type RpgNodeRef, type RpgWeapon, type RpgWeaponKind } from '@racer/domain'

import { WEAPON_KIND_LABEL } from './rpg-ui'

export type BattleMode = { kind: 'attack'; weapon?: RpgWeapon } | { kind: 'guard' } | { kind: 'skill'; ref: RpgNodeRef; blessing?: string }
  | ({ kind: 'limit'; name: string } & BattleLimitChoice)

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
  if (mode.kind === 'limit') return { kind: 'limit', actorId, targetId, ...(mode.skill ? { skill: mode.skill } : {}),
    ...(mode.skills ? { skills: mode.skills } : {}), ...(mode.weapon ? { weapon: mode.weapon } : {}) }
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

/** Her bar is full (D311). */
export const limitReady = (state: BattleState, id: string): boolean => (state.units.find((u) => u.id === id)?.limit ?? 0) >= BATTLE_LIMIT_MAX
/** A Limit Break takes her whole turn, so she can use it only before her first action of a round. */
export const limitNow = (state: BattleState, id: string): boolean => {
  const ally = state.input.allies.find((a) => a.id === id), unit = state.units.find((u) => u.id === id)
  return !!ally && !!unit && unit.hp > 0 && limitReady(state, id) && battleActionsLeft(state, id) === rpgHand(ally).actions
}
export interface LimitOption { key: string; name: string; detail: string; choice: BattleLimitChoice }
/** The Limit Break menu: her class's fixed one, or one per equipped skill. A Summoner picks two summons (`pick: 2`). */
export function limitOptions(state: BattleState, actorId: string): { pick: 1 | 2; options: LimitOption[] } {
  const ally = state.input.allies.find((a) => a.id === actorId)
  if (!ally) return { pick: 1, options: [] }
  const skills = ally.loadout.flatMap((ref) => { const skill = battleActorSkill(state, actorId, ref); return skill ? [skill] : [] })
  const key = (ref: RpgNodeRef) => `${ref.tier}:${ref.id}`
  if (ally.classId === 'mage') return { pick: 1, options: [{ key: 'nova', name: BATTLE_LIMIT_NAMES.mage, choice: {},
    detail: 'One foe: Fire, Ice, Lightning, Light, Dark and Ultima, a hit each · about four of her casts' }] }
  if (ally.classId === 'cleric') return { pick: 1, options: [{ key: 'patrons', name: BATTLE_LIMIT_NAMES.cleric, choice: {},
    detail: 'One foe: her patrons of Light and Dark strike twice, both elements in each hit' }] }
  if (ally.classId === 'summoner') return { pick: 2, options: skills.map((s) => ({ key: key(s.ref), name: s.label, choice: { skills: [s.ref, s.ref] },
    detail: 'Each pick is summoned twice' })) }
  if (ally.classId === 'brawler') return { pick: 1, options: skills.length
    ? skills.map((s) => ({ key: key(s.ref), name: s.label, choice: { skill: s.ref }, detail: 'Cast twice in a row' }))
    : ally.weapons.map((w) => ({ key: w, name: `${BATTLE_LIMIT_NAMES.twin} · ${WEAPON_KIND_LABEL[w as RpgWeaponKind]}`, choice: { weapon: w },
      detail: 'Two full Attacks in a row' })) }
  return { pick: 1, options: skills.length
    ? skills.map((s) => ({ key: key(s.ref), name: s.label, choice: { skill: s.ref },
      detail: s.node.tree === 'blade-elemental' ? 'Three great hits of sword and element' : 'Twice the hits, arcane and sword' }))
    : [{ key: 'triad', name: BATTLE_LIMIT_NAMES.triad, choice: {}, detail: 'One foe: three great hits of sword with Fire, Ice and Lightning' }] }
}
/** The mode a menu pick (or a Summoner's two picks) sets, or null if the engine would refuse it. */
export function limitMode(state: BattleState, actorId: string, choice: BattleLimitChoice): BattleMode | null {
  const ally = state.input.allies.find((a) => a.id === actorId)
  const plan = ally ? battleLimitPlan(ally, choice) : null
  return plan ? { kind: 'limit', name: plan.name, ...choice } : null
}

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
    case 'limit': return `${name(cue.actorId)}: LIMIT BREAK · ${cue.label}!`
    case 'intent': return `${name(cue.actorId)}: ${cue.label}`
    case 'result': return cue.label === 'victory' ? 'Victory!' : 'Defeated'
  }
}
