import { describe, expect, it } from 'vitest'
import { enrollRpgOutfit, projectRpgStats, spendRpgTreePoint, type RpgElement, type RpgProfile, type RpgWeapon } from '../rules'
import type { Strategy } from '../../types'
import { rpgFoe } from '../campaign/enemies'
import { applyBattleAction, battleBroken, battleStateHash, createBattle, replayBattle } from './engine'
import { BATTLE_UNBROKEN_FACTOR, BATTLE_WEAK, battleSkill, battleSkillMp, battleWeakness, battleWeaponKind } from './skills'
import type { BattleAlly, BattleEnemy, BattleInput, BattleState, BattleWeaponKind } from './types'

// Invented outfits only; no private Uma or cast content.
function profile(id: string, style: Strategy, weapon: RpgWeapon, element: RpgElement, level = 4): RpgProfile {
  const medium = element === 'fire' || element === 'dark'
  let p = enrollRpgOutfit({ outfit: { id, baseStats: { speed: 110, stamina: 110, power: 110, guts: 110, wit: 110 },
    growthRates: { speed: 0.05, stamina: 0.05, power: 0.05, guts: 0.05, wit: 0.05 },
    aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'G', mile: element === 'ice' ? 'A' : 'G', medium: medium ? 'A' : 'G', long: element === 'lightning' ? 'A' : 'G' },
      strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } } }, contentVersion: 'test', style, weapon, defaultSignature: element })
  p = { ...p, level }
  return spendRpgTreePoint(p, { tier: 1, weapon, element, depth: 1, branch: 'foundation' })
}
function ally(p: RpgProfile, mp?: number): BattleAlly {
  const stats = projectRpgStats(p)
  return { id: p.outfitId, style: p.style, weapon: p.weapon, tier: p.tier, level: p.level, stats, affinities: p.affinities,
    signature: p.defaultSignature, tree: p.tree, legacy: p.legacy, loadout: p.tree.map(({ level: _l, ...ref }) => ref), mp: mp ?? stats.mp }
}
const party = (mp?: number) => [
  profile('a1', 'front', 'greatsword', 'fire'), profile('a2', 'pace', 'spear', 'ice'), profile('a3', 'late', 'wizard-staff', 'lightning'),
  profile('a4', 'end', 'tome', 'dark'), profile('a5', 'pace', 'sword-shield', 'fire'),
].map((p) => ally(p, mp))
const foe = (id: string, element: RpgElement, rank: BattleEnemy['rank'] = 'regular', weapons: BattleWeaponKind[] = ['spear', 'tome'], shield = 2) =>
  rpgFoe({ id, castId: `cast-${id}`, element, role: rank === 'regular' ? 'striker' : 'captain', rank, level: 4, shield, weapons })
const input = (enemies: BattleEnemy[], mp?: number): BattleInput => ({ version: 3, seed: 1234, allies: party(mp), enemies })
const hits = (step: ReturnType<typeof applyBattleAction>, target: string) => step.cues.filter((c) => c.kind === 'hit' && c.targetId === target)
const skillOf = (s: BattleState, id: string) => s.input.allies.find((a) => a.id === id)!.loadout[0]!

describe('battle engine v3: Octopath breaks (D265)', () => {
  it('weapon Attacks and elemental skills chip the shield; other hits do not', () => {
    let s = createBattle(input([foe('f1', 'ice')])).state
    const shield = () => s.units.find((u) => u.id === 'f1')!.shield
    s = applyBattleAction(s, { kind: 'attack', actorId: 'a1', targetId: 'f1' }).state // greatsword: not on the list
    expect(shield()).toBe(2)
    s = applyBattleAction(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' }).state // spear: weak
    expect(shield()).toBe(1)
    expect(battleWeaponKind('cleric-staff')).toBe('staff')
    const step = applyBattleAction(s, { kind: 'skill', actorId: 'a5', targetId: 'f1', skill: skillOf(s, 'a5') }) // fire vs ice
    expect(step.cues.map((c) => c.kind)).toEqual(expect.arrayContaining(['shield', 'break']))
    expect(battleBroken(step.state.units.find((u) => u.id === 'f1')!)).toBe(true)
    expect(step.cues.some((c) => c.kind === 'hit' && c.weak)).toBe(true)
  })

  it('unbroken foes take half damage; a Break doubles it back to full and weak hits add 30%', () => {
    const s = createBattle(input([foe('f1', 'ice', 'regular', ['spear', 'tome'], 1)])).state
    const before = hits(applyBattleAction(s, { kind: 'attack', actorId: 'a1', targetId: 'f1' }), 'f1')[0]!
    const broken = applyBattleAction(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' }).state
    const after = hits(applyBattleAction(broken, { kind: 'attack', actorId: 'a1', targetId: 'f1' }), 'f1')[0]!
    if (before.kind === 'hit' && after.kind === 'hit') expect(after.amount / before.amount).toBeCloseTo(1 / BATTLE_UNBROKEN_FACTOR, 0)
    expect([BATTLE_UNBROKEN_FACTOR, BATTLE_WEAK]).toEqual([0.5, 1.3])
  })

  it('a Broken foe loses this round and the next, then raises its full shield', () => {
    let s = createBattle(input([foe('f1', 'ice', 'sub-boss', ['spear', 'tome'], 1)])).state
    s = applyBattleAction(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' }).state
    expect(s.units.find((u) => u.id === 'f1')!.brokenAt).toBe(1)
    const round = (state: BattleState) => {
      let next = state
      for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) if (next.outcome === 'active' && !next.acted.includes(id)) next = applyBattleAction(next, { kind: 'guard', actorId: id, targetId: id === 'a1' ? 'a2' : 'a1' }).state
      return next
    }
    const one = applyBattleAction(s, { kind: 'guard', actorId: 'a1', targetId: 'a2' })
    s = round(one.state)
    expect(s.round).toBe(2)
    expect(battleBroken(s.units.find((u) => u.id === 'f1')!)).toBe(true)
    const second = round(s)
    expect(second.round).toBe(3)
    const f1 = second.units.find((u) => u.id === 'f1')!
    expect([battleBroken(f1), f1.shield]).toEqual([false, 1])
  })

  it('multi-hit skills chip once per hit and Barrage lands six seeded random hits', () => {
    const p = profile('a3', 'late', 'wizard-staff', 'lightning', 40)
    let tree = p
    for (const [depth, branch] of [[2, 'double'], [3, 'multi'], [4, 'quad'], [5, 'barrage']] as const) {
      tree = spendRpgTreePoint(tree, { tier: 1, weapon: 'wizard-staff', element: 'lightning', depth, branch })
    }
    const caster = ally(tree)
    const base = input([foe('f1', 'fire', 'boss', ['spear', 'tome'], 6), foe('f2', 'fire', 'regular', ['spear', 'tome'], 2)])
    const start = createBattle({ ...base, allies: base.allies.map((a) => a.id === 'a3' ? caster : a) }).state
    const quad = caster.loadout.find((r) => r.branch === 'quad')!
    const quadStep = applyBattleAction(start, { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: quad })
    expect(hits(quadStep, 'f1')).toHaveLength(4)
    expect(quadStep.state.units.find((u) => u.id === 'f1')!.shield).toBe(2)
    const barrage = caster.loadout.find((r) => r.branch === 'barrage')!
    const step = applyBattleAction(start, { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: barrage })
    expect(step.cues.filter((c) => c.kind === 'hit')).toHaveLength(6)
    expect(applyBattleAction(start, { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: barrage }).hash).toBe(step.hash)
    expect([battleSkill(barrage).hits, battleSkill(barrage).target, battleSkill(quad).hits]).toEqual([6, 'random', 4])
  })

  it('spends carried MP and refuses a skill it cannot pay for', () => {
    const cost = battleSkillMp({ tier: 1, depth: 1, branch: 'foundation' })
    let s = createBattle(input([foe('f1', 'ice')], cost)).state
    s = applyBattleAction(s, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skillOf(s, 'a1') }).state
    expect(s.units.find((u) => u.id === 'a1')!.mp).toBe(0)
    expect(() => createBattle({ ...input([foe('f1', 'ice')]), allies: party().map((a) => ({ ...a, mp: a.stats.mp + 1 })) })).toThrow(/ally/)
    expect(() => createBattle({ ...input([foe('f1', 'ice')]), version: 2 } as unknown as BattleInput)).toThrow(/header/)
  })

  it('replays identically from the frozen input and refuses unlearned skills', () => {
    const start = input([foe('f1', 'ice'), foe('f2', 'dark'), foe('f3', 'light')])
    let s = createBattle(start).state
    const actions = [
      { kind: 'skill' as const, actorId: 'a1', targetId: 'f1', skill: skillOf(s, 'a1') },
      { kind: 'attack' as const, actorId: 'a2', targetId: 'f2' },
      { kind: 'guard' as const, actorId: 'a5', targetId: 'a3' },
    ]
    for (const action of actions) s = applyBattleAction(s, action).state
    expect(replayBattle(start, actions).hash).toBe(battleStateHash(s))
    expect(replayBattle(JSON.parse(JSON.stringify(start)) as BattleInput, actions).state).toEqual(s)
    expect(applyBattleAction(s, { kind: 'skill', actorId: 'a4', targetId: 'f1', skill: { ...skillOf(s, 'a4'), element: 'ice' } }).error).toBe('invalid-skill')
  })

  it('pins the element wheel, the multi-hit line and tier-scaled costs', () => {
    expect((['fire', 'ice', 'lightning', 'light', 'dark'] as const).map(battleWeakness)).toEqual(['lightning', 'fire', 'ice', 'dark', 'light'])
    expect([1, 2, 3, 4, 5].map((depth) => battleSkillMp({ tier: 1, depth, branch: depth === 1 ? 'foundation' : 'focused' }))).toEqual([10, 14, 18, 22, 26])
    expect(battleSkillMp({ tier: 2, depth: 2, branch: 'area' })).toBe(36)
    const shape = (depth: number, branch: Parameters<typeof battleSkill>[0]['branch']) => battleSkill({ tier: 1, weapon: 'spear', element: 'ice', depth, branch }).hits
    expect([shape(2, 'double'), shape(3, 'multi'), shape(4, 'quad'), shape(5, 'barrage')]).toEqual([2, 3, 4, 6])
    expect(battleSkill({ tier: 1, weapon: 'cleric-staff', element: 'light', depth: 1, branch: 'foundation' }).support).toBe('power-up')
  })
})
