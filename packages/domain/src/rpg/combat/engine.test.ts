import { describe, expect, it } from 'vitest'
import { RPG_BASIC_ACTION_CATALOG, RPG_SKILL_CATALOG, RPG_WEAK_FOLLOW_UP_LIMIT, elementMatchup } from './catalog'
import { applyAction, combatStateHash, createEncounter, replay } from './engine'
import { syntheticAlly, syntheticEncounter, syntheticEnemy } from './synthetic'
import type { CombatAction, CombatCue } from './types'

const attack = (actorId: string, targetId: string): CombatAction => ({ kind: 'attack', actorId, targetId })
const skill = (actorId: string, targetId: string, input = syntheticEncounter()): CombatAction =>
  ({ kind: 'skill', actorId, targetId, skill: input.allies[0]!.loadout[0]! })
const amountOf = (cues: CombatCue[], kind: 'hit' | 'heal'): number =>
  cues.find((cue): cue is Extract<CombatCue, { kind: 'hit' | 'heal' | 'guard' | 'ko' | 'phase' | 'status' | 'follow-up' }> =>
    cue.kind === kind)?.amount ?? 0

describe('pure RPG combat', () => {
  it('publishes every weapon/element branch with one channel, gate and declared effect', () => {
    expect(RPG_SKILL_CATALOG).toHaveLength(6 * 5 * 8)
    expect(RPG_BASIC_ACTION_CATALOG).toHaveLength(6 * 2)
    expect(new Set(RPG_SKILL_CATALOG.map((entry) => entry.id)).size).toBe(RPG_SKILL_CATALOG.length)
    expect(RPG_SKILL_CATALOG.every((entry) => entry.mp > 0 && entry.intentText && entry.duration > 0)).toBe(true)
    expect(RPG_SKILL_CATALOG.filter((entry) => ['greatsword', 'spear', 'sword-shield'].includes(entry.weapon))
      .every((entry) => entry.channel === 'physical')).toBe(true)
    expect(RPG_SKILL_CATALOG.filter((entry) => ['wizard-staff', 'cleric-staff', 'tome'].includes(entry.weapon))
      .every((entry) => entry.channel === 'magical')).toBe(true)
    expect(elementMatchup('fire', 'ice')).toBe('weak')
    expect(elementMatchup('ice', 'fire')).toBe('resist')
    expect(elementMatchup('dark', 'light')).toBe('weak')
    expect(elementMatchup('fire', 'light')).toBe('neutral')
  })

  it('freezes input, reveals the same seeded intents and phase after JSON reload', () => {
    const input = syntheticEncounter('spear', 'fire', 'ice', 711, true)
    const created = createEncounter(input)
    input.enemies[0]!.stats.hp = 1
    expect(created.state.units.find((entry) => entry.id === 'boss')!.hp).toBe(2_800)
    expect(createEncounter(created.state.input).hash).toBe(created.hash)
    const restored = JSON.parse(JSON.stringify(created.state)) as typeof created.state
    expect(combatStateHash(restored)).toBe(created.hash)
    expect(created.cues.some((cue) => cue.kind === 'intent')).toBe(true)
  })

  it('rejects actor, target, grade, slot, MP and Item without touching state', () => {
    const input = syntheticEncounter()
    const original = createEncounter(input).state
    const invalid: CombatAction[] = [
      attack('missing', 'foe-a'), attack('ally-0', 'ally-1'),
      { kind: 'item', actorId: 'ally-0', targetId: 'ally-0', itemId: 'potion' },
      { kind: 'skill', actorId: 'ally-0', targetId: 'foe-a', skill: { ...input.allies[0]!.loadout[0]!, depth: 5, branch: 'signature' } },
      { kind: 'skill', actorId: 'ally-0', targetId: 'foe-a', skill: { ...input.allies[0]!.loadout[0]!, weapon: 'tome' } },
    ]
    for (const action of invalid) {
      const result = applyAction(original, action)
      expect(result.error).toBeTruthy()
      expect(result.state).toBe(original)
      expect(result.hash).toBe(combatStateHash(original))
    }
    const spent = JSON.parse(JSON.stringify(original)) as typeof original
    spent.units[0]!.mp = 0
    const out = applyAction(spent, skill('ally-0', 'foe-a', input))
    expect(out.error).toBe('insufficient-mp')
    expect(out.state).toBe(spent)
    const first = applyAction(original, attack('ally-0', 'foe-a')).state
    expect(applyAction(first, attack('ally-0', 'foe-a')).error).toBe('already-acted')
  })

  it('uses ATK/PDEF for physical Fire rider and MATK/MDEF for Tome; bounded follow-up is one per round', () => {
    const physical = syntheticEncounter('greatsword', 'fire', 'ice')
    physical.allies[0]!.stats.atk = 100
    physical.allies[0]!.stats.matk = 1
    const before = createEncounter(physical)
    const after = applyAction(before.state, skill('ally-0', 'foe-a', physical))
    expect(after.cues.filter((cue) => cue.kind === 'follow-up')).toHaveLength(RPG_WEAK_FOLLOW_UP_LIMIT)
    const damage = amountOf(after.cues, 'hit')
    expect(damage).toBeGreaterThan(100)
    const reversed = syntheticEncounter('greatsword', 'fire', 'ice')
    reversed.allies[0]!.stats.atk = 1
    reversed.allies[0]!.stats.matk = 100
    const weak = applyAction(createEncounter(reversed).state, skill('ally-0', 'foe-a', reversed))
    expect(amountOf(weak.cues, 'hit')).toBeLessThan(damage)
    const tome = syntheticEncounter('tome', 'fire', 'ice')
    tome.allies[0]!.stats.matk = 100
    tome.allies[0]!.stats.atk = 1
    const magic = applyAction(createEncounter(tome).state, skill('ally-0', 'foe-a', tome))
    expect(amountOf(magic.cues, 'hit')).toBeGreaterThan(100)
    const second = applyAction(after.state, skill('ally-1', 'foe-b', physical))
    expect(second.cues.filter((cue) => cue.kind === 'follow-up')).toHaveLength(0)
    const frontMagic = { kind: 'skill' as const, actorId: 'ally-0', targetId: 'foe-a',
      skill: { ...physical.allies[0]!.loadout[0]!, weapon: 'tome' as const } }
    expect(applyAction(before.state, frontMagic).error).toBe('invalid-skill')
    const endPhysical = { kind: 'skill' as const, actorId: 'ally-0', targetId: 'foe-a',
      skill: { ...tome.allies[0]!.loadout[0]!, weapon: 'greatsword' as const } }
    expect(applyAction(createEncounter(tome).state, endPhysical).error).toBe('invalid-skill')
  })

  it('permits five Pace allies, guards the intended target, caps healing and changes boss phase', () => {
    const input = syntheticEncounter('spear', 'fire', 'ice', 17, true)
    expect(input.allies.every((part) => part.style === 'pace')).toBe(true)
    const created = createEncounter(input)
    const guarding = applyAction(created.state, { kind: 'guard', actorId: 'ally-0', targetId: 'ally-1' })
    expect(guarding.state.units[0]!.guardingFor).toBe('ally-1')
    expect(guarding.state.input.allies).toHaveLength(5)
    const supportInput = syntheticEncounter('cleric-staff', 'light', 'dark')
    const healingState = createEncounter(supportInput).state
    healingState.units[0]!.hp -= 1
    const healed = applyAction(healingState, skill('ally-1', 'ally-0', supportInput))
    expect(healed.state.units[0]!.hp).toBe(supportInput.allies[0]!.stats.hp)
    expect(amountOf(healed.cues, 'heal')).toBe(1)
    const boss = JSON.parse(JSON.stringify(created.state)) as typeof created.state
    boss.units.find((entry) => entry.id === 'boss')!.hp = 1_450
    const phase = applyAction(boss, skill('ally-0', 'boss', input))
    expect(phase.state.units.find((entry) => entry.id === 'boss')!.phase).toBe(2)
    expect(phase.cues.some((cue) => cue.kind === 'phase')).toBe(true)
    expect(phase.cues.some((cue) => cue.kind === 'intent' &&
      (cue.label?.includes('Surge') || cue.label?.includes('Mend')))).toBe(true)
    const reloaded = JSON.parse(JSON.stringify(phase.state)) as typeof phase.state
    expect(combatStateHash(reloaded)).toBe(phase.hash)
    expect(reloaded.intents).toEqual(phase.state.intents)
  })

  it('keeps an enemy guard through the next player phase, but never intercepts area hits', () => {
    const input = syntheticEncounter('spear', 'fire', 'ice')
    input.enemies = [syntheticEnemy('foe-a', 'ice'), syntheticEnemy('foe-b', 'ice')]
    input.enemies[0]!.moves = [{ id: 'protect', kind: 'guard', channel: 'physical', element: null,
      power: 0, target: 'lowest-hp-ally', intentText: 'Protect ally' }]
    input.enemies[1]!.moves = [{ id: 'rest', kind: 'buff', channel: 'physical', element: null,
      power: 0, target: 'self', status: 'ward', intentText: 'Prepare ward' }]
    let state = createEncounter(input).state
    for (let i = 0; i < 5; i += 1) state = applyAction(state, attack(`ally-${i}`, 'foe-b')).state
    const protector = state.units.find((part) => part.id === 'foe-a')!
    expect(protector.guardingFor).toBe('foe-a')
    const area = input.allies[0]!.loadout.find((ref) => ref.branch === 'area')!
    const result = applyAction(state, { kind: 'skill', actorId: 'ally-0', targetId: 'foe-b', skill: area })
    expect(result.error).toBeUndefined()
    expect(result.cues.some((cue) => cue.kind === 'hit' && cue.targetId === 'foe-b')).toBe(true)
  })

  it('intercepts a revealed attack, caps status stacks and expires them after enemy phases', () => {
    const input = syntheticEncounter('spear', 'fire', 'ice')
    input.enemies = [syntheticEnemy('foe-a', 'ice')]
    input.enemies[0]!.moves = [{ id: 'front-hit', kind: 'damage', channel: 'physical',
      element: null, power: 100, target: 'front', intentText: 'Hit the front ally' }]
    let state = createEncounter(input).state
    for (const actorId of ['ally-0', 'ally-2', 'ally-3', 'ally-4']) {
      state = applyAction(state, skill(actorId, 'foe-a', input)).state
    }
    const step = applyAction(state, { kind: 'guard', actorId: 'ally-1', targetId: 'ally-0' })
    expect(step.cues.some((cue) => cue.kind === 'hit' && cue.targetId === 'ally-1')).toBe(true)
    expect(step.state.units[0]!.hp).toBe(input.allies[0]!.stats.hp)
    expect(step.state.units[1]!.hp).toBeLessThan(input.allies[1]!.stats.hp)
    const foe = step.state.units.find((part) => part.id === 'foe-a')!
    expect(foe.statuses.find((entry) => entry.kind === 'burn')?.stacks).toBe(3)
    expect(foe.statuses.find((entry) => entry.kind === 'burn')?.turns).toBe(1)
    let next = step.state
    for (let index = 0; index < 5 && next.outcome === 'active'; index += 1) {
      next = applyAction(next, { kind: 'guard', actorId: `ally-${index}`, targetId: `ally-${index}` }).state
    }
    expect(next.units.find((part) => part.id === 'foe-a')?.statuses.some((entry) => entry.kind === 'burn')).toBe(false)
  })

  it('ends in a real loss when all five synthetic allies are KO, without an EXP claim', () => {
    const input = syntheticEncounter('spear', 'fire', 'ice')
    input.enemies = [syntheticEnemy('foe-a', 'ice')]
    input.enemies[0]!.stats.hp = 10_000
    input.enemies[0]!.moves = [{ id: 'crush', kind: 'damage', channel: 'physical',
      element: null, power: 500, target: 'front', intentText: 'Crush the front ally' }]
    for (const member of input.allies) { member.stats.atk = 0; member.stats.matk = 0; member.stats.hp = 1 }
    let state = createEncounter(input).state
    for (let round = 0; round < 6 && state.outcome === 'active'; round += 1) {
      for (const member of input.allies) {
        if (state.outcome !== 'active') break
        const active = state.units.find((part) => part.id === member.id)
        if (active?.hp && !state.acted.includes(member.id)) state = applyAction(state, attack(member.id, 'foe-a')).state
      }
    }
    expect(state.outcome).toBe('loss')
    expect(state.units.filter((part) => part.side === 'ally' && part.hp > 0)).toHaveLength(0)
  })

  it('replay exactly matches stepping, including cues, after a JSON round trip', () => {
    const input = syntheticEncounter('spear', 'fire', 'ice', 2026)
    const actions: CombatAction[] = []
    let step = createEncounter(input)
    const cues = [...step.cues]
    for (let i = 0; i < 5; i += 1) {
      const targetId = step.state.units.find((part) => part.side === 'enemy' && part.hp > 0)?.id
      if (!targetId) break
      const action = attack(`ally-${i}`, targetId)
      actions.push(action)
      step = applyAction(step.state, action)
      cues.push(...step.cues)
      expect(replay(input, actions).hash).toBe(step.hash)
    }
    const replayed = replay(JSON.parse(JSON.stringify(input)) as typeof input, actions)
    expect(replayed.hash).toBe(step.hash)
    expect(replayed.hash).toBe('rpg-combat-v1:8ea7b06f')
    expect(replayed.cues).toEqual(cues)
    expect(combatStateHash(JSON.parse(JSON.stringify(replayed.state)))).toBe(replayed.hash)
  })

  it('rejects impossible frozen kits rather than normalizing or rerolling them', () => {
    const input = syntheticEncounter()
    input.allies[4] = syntheticAlly(0, 'spear', 'fire')
    expect(() => createEncounter(input)).toThrow()
    const other = syntheticEncounter()
    other.enemies[0] = syntheticEnemy('ally-0', 'ice')
    expect(() => createEncounter(other)).toThrow()
  })
})
