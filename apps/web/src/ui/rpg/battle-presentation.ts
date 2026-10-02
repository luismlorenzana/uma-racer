// Read-only action/cue projection; all combat math stays in the reducer (docs/design/uma-rpg.md).
import { applyAction, combatSkill, elementMatchup, RPG_BASIC_ACTION_CATALOG, rpgSkillKey,
  type CombatAction, type CombatCue, type CombatState, type RpgSkillRef } from '@racer/domain'

export interface BattleChoice {
  id: string
  kind: 'attack' | 'guard' | 'skill'
  label: string
  mp: number
  channel: string
  base: number
  rider: number
  element: RpgSkillRef['element'] | null
  target: string
  skill?: RpgSkillRef
}
export const humanize = (value: string) => value.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' ')

export function battleChoices(state: CombatState, actorId: string): BattleChoice[] {
  const actor = state.input.allies.find((ally) => ally.id === actorId)
  if (!actor) return []
  const basics: BattleChoice[] = RPG_BASIC_ACTION_CATALOG.filter((part) => part.weapon === actor.weapon).map((part) => ({
    ...part, kind: part.kind, label: part.kind === 'guard' ? 'Guard' : 'Attack',
  }))
  return [...basics, ...actor.loadout.flatMap((ref) => {
    const definition = combatSkill(ref)
    return definition ? [{ id: rpgSkillKey(ref), kind: 'skill' as const,
      label: `${humanize(ref.element)} · ${humanize(ref.branch)}`, mp: definition.mp,
      channel: definition.channel, base: definition.base, rider: definition.rider,
      element: definition.element, target: definition.target, skill: ref }] : []
  })]
}

export function chosenAction(actorId: string, targetId: string, choice: BattleChoice): CombatAction {
  return choice.kind === 'skill' && choice.skill
    ? { kind: 'skill', actorId, targetId, skill: choice.skill }
    : { kind: choice.kind === 'guard' ? 'guard' : 'attack', actorId, targetId }
}

export function projectBattleChoice(state: CombatState, actorId: string, targetId: string, choice: BattleChoice) {
  return applyAction(state, chosenAction(actorId, targetId, choice))
}

export function battleTargets(state: CombatState, actorId: string, choice: BattleChoice) {
  const allyTarget = choice.target.includes('ally') || choice.target.includes('allies') || choice.target === 'self'
  return state.units.filter((unit) => unit.side === (allyTarget ? 'ally' : 'enemy')).map((unit) => ({
    id: unit.id, error: projectBattleChoice(state, actorId, unit.id, choice).error ?? null,
  }))
}

export function targetRelation(state: CombatState, targetId: string, choice: BattleChoice): string {
  const element = state.input.enemies.find((enemy) => enemy.id === targetId)?.element ??
    state.input.allies.find((ally) => ally.id === targetId)?.signature
  const relation = element ? elementMatchup(choice.element, element) : 'neutral'
  return relation === 'weak' ? 'Weakness' : relation === 'resist' ? 'Resistance' : 'Neutral'
}

export function describeCue(cue: CombatCue, state: CombatState, name: (id: string) => string, action?: CombatAction): string {
  if (cue.kind === 'result') return cue.label === 'victory' ? 'Victory' : 'Party defeated'
  const actor = name(cue.actorId), target = name(cue.targetId)
  if (cue.kind === 'intent') return `${actor}: ${cue.label} → ${target}`
  if (cue.kind === 'ko') return `${target} is KO`
  if (cue.kind === 'phase') return `${actor} enters phase 2 · new intent revealed`
  if (cue.kind === 'guard') return `${actor} guards ${target}`
  if (cue.kind === 'heal') return `${actor} heals ${target} +${cue.amount ?? 0} HP`
  if (cue.kind === 'status') return `${target}: ${humanize(cue.label ?? 'status')}`
  if (cue.kind === 'follow-up') return `${actor} follows up on ${target} · ${cue.amount ?? 0} damage`
  const ally = state.input.allies.find((part) => part.id === cue.actorId)
  const definition = ally && action?.actorId === ally.id && action.kind === 'skill' ? combatSkill(action.skill) : null
  const basic = ally && RPG_BASIC_ACTION_CATALOG.find((part) => part.weapon === ally.weapon && part.kind === 'attack')
  const enemy = state.input.enemies.find((part) => part.id === cue.actorId)
  const intent = state.intents.find((part) => part.enemyId === cue.actorId)
  const move = enemy && [...enemy.moves, ...enemy.phaseTwo?.moves ?? []].find((part) => part.id === intent?.moveId)
  const channel = cue.channel ?? (cue.label === 'Burn' ? 'status' : definition?.channel ?? basic?.channel ?? move?.channel)
  const riderElement = cue.rider ? cue.element : definition && definition.rider > 0 ? definition.element : null
  const rider = riderElement ? ` + ${humanize(riderElement)} rider` : ''
  return `${actor} → ${target}: ${cue.amount ?? 0} ${channel ?? 'status'} damage${rider}${cue.label ? ` · ${humanize(cue.label)}` : ''}`
}
