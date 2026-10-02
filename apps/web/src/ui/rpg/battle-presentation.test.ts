import { createEncounter, combatStateHash, replay, type CombatAction } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { proofEncounter } from '../../screens/rpg/proof-host'
import { battleChoices, battleTargets, chosenAction, describeCue, projectBattleChoice, targetRelation } from './battle-presentation'

describe('RPG presentation is an engine projection', () => {
  it('does not mutate the state and projects the exact physical rider/weakness replay', () => {
    const state = createEncounter(proofEncounter('boss')).state
    const before = combatStateHash(state)
    const choice = battleChoices(state, 'ally-0').find((part) => part.kind === 'skill')!
    const preview = projectBattleChoice(state, 'ally-0', 'proof-captain', choice)
    expect(preview.hash).toBe(replay(state.input, [chosenAction('ally-0', 'proof-captain', choice)]).hash)
    expect(combatStateHash(state)).toBe(before)
    expect(choice.channel).toBe('physical')
    expect(choice.rider).toBeGreaterThan(0)
    expect(targetRelation(state, 'proof-captain', choice)).toBe('Weakness')
    expect(preview.cues.some((cue) => cue.kind === 'hit' && cue.label === 'Weakness')).toBe(true)
    expect(describeCue(preview.cues.find((cue) => cue.kind === 'hit')!, state, (id) => id,
      chosenAction('ally-0', 'proof-captain', choice))).toContain('physical damage + Fire rider')
  })
  it('refuses MP, KO, acted, missing-tree and wrong-side targets via the reducer', () => {
    const state = createEncounter(proofEncounter('practice')).state
    const choice = battleChoices(state, 'ally-0').find((part) => part.kind === 'skill')!
    state.units.find((part) => part.id === 'ally-0')!.mp = 0
    expect(battleTargets(state, 'ally-0', choice).every((part) => part.error === 'insufficient-mp')).toBe(true)
    state.units.find((part) => part.id === 'ally-0')!.mp = 100
    const attack = battleChoices(state, 'ally-0')[0]!
    expect(projectBattleChoice(state, 'ally-0', 'ally-1', attack).error).toBe('invalid-target')
    state.acted = ['ally-0']
    expect(projectBattleChoice(state, 'ally-0', 'proof-scout', attack).error).toBe('already-acted')
    state.acted = []
    state.input.allies[0]!.tree = []
    expect(projectBattleChoice(state, 'ally-0', 'proof-scout', choice).error).toBe('invalid-skill')
    state.units.find((part) => part.id === 'ally-0')!.hp = 0
    expect(projectBattleChoice(state, 'ally-0', 'proof-scout', attack).error).toBe('invalid-actor')
  })
  it('projects healing, guard and the automatic enemy round without formula copies', () => {
    const state = createEncounter(proofEncounter('boss')).state
    state.units[0]!.hp = 100
    const heal = battleChoices(state, 'ally-3').find((part) => part.skill?.branch === 'focused')!
    const healed = projectBattleChoice(state, 'ally-3', 'ally-0', heal)
    expect(healed.error).toBeUndefined()
    expect(healed.cues.some((cue) => cue.kind === 'heal' && (cue.amount ?? 0) > 0)).toBe(true)
    expect(battleTargets(state, 'ally-3', heal).map((part) => part.id)).toHaveLength(5)
    const guard = battleChoices(state, 'ally-2').find((part) => part.kind === 'guard')!
    const guarded = projectBattleChoice(state, 'ally-2', 'ally-0', guard)
    expect(guarded.cues[0]?.kind).toBe('guard')
    expect(guarded.state.units.find((part) => part.id === 'ally-2')!.guardingFor).toBe('ally-0')
    const actions: CombatAction[] = state.input.allies.map((ally) => ({ kind: 'attack', actorId: ally.id, targetId: 'proof-captain' }))
    const beforeLast = replay(state.input, actions.slice(0, -1)).state
    const last = projectBattleChoice(beforeLast, 'ally-4', 'proof-captain', battleChoices(beforeLast, 'ally-4')[0]!)
    expect(last.state.round).toBe(2)
    expect(last.cues.some((cue) => 'actorId' in cue && cue.actorId === 'proof-captain' && cue.kind === 'hit')).toBe(true)
  })
})
