import { describe, expect, it } from 'vitest'
import { enrollRpgOutfit, projectRpgStats, spendRpgTreePoint, type RpgElement, type RpgProfile, type RpgWeapon } from '../rules'
import type { Strategy } from '../../types'
import { rpgFoe } from '../campaign/enemies'
import { applyBattleAction, battleAllOutReady, battleBroken, battleStateHash, createBattle, replayBattle } from './engine'
import { BATTLE_BROKEN_FACTOR, BATTLE_SHIELDED_FACTOR, battleMatchup, battleSkill, battleSkillMp, battleWeakness } from './skills'
import type { BattleAlly, BattleEnemy, BattleInput, BattleState } from './types'

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
const foe = (id: string, element: RpgElement, rank: BattleEnemy['rank'] = 'regular', level = 4) =>
  rpgFoe({ id, castId: `cast-${id}`, element, role: rank === 'regular' ? 'striker' : 'captain', rank, level })
const input = (enemies: BattleEnemy[], mp?: number): BattleInput => ({ version: 2, seed: 1234, allies: party(mp), enemies })
const skillOf = (s: BattleState, id: string) => s.input.allies.find((a) => a.id === id)!.loadout[0]!

describe('battle engine v2 (D261)', () => {
  it('a weakness knocks a regular foe Down and grants One More; a second weak hit on it does not', () => {
    let s = createBattle(input([foe('f1', 'ice'), foe('f2', 'fire')])).state
    const step = applyBattleAction(s, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skillOf(s, 'a1') })
    expect(step.error).toBeUndefined()
    expect(step.cues.map((c) => c.kind)).toEqual(expect.arrayContaining(['down', 'one-more']))
    s = step.state
    expect(s.units.find((u) => u.id === 'f1')!.down).toBe(true)
    expect(s.acted).not.toContain('a1')
    const again = applyBattleAction(s, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skillOf(s, 'a1') })
    expect(again.cues.some((c) => c.kind === 'one-more')).toBe(false)
    expect(again.state.acted).toContain('a1')
  })

  it('with every foe Down the party All-Out Attacks, ending its round; downed foes skip and stand up', () => {
    let s = createBattle(input([foe('f1', 'ice'), foe('f2', 'fire')])).state
    expect(applyBattleAction(s, { kind: 'all-out', actorId: 'a1' }).error).toBe('all-out-unavailable')
    s = applyBattleAction(s, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skillOf(s, 'a1') }).state
    s = applyBattleAction(s, { kind: 'skill', actorId: 'a3', targetId: 'f2', skill: skillOf(s, 'a3') }).state
    expect(battleAllOutReady(s)).toBe(true)
    const before = s.units.filter((u) => u.side === 'enemy').map((u) => u.hp)
    const step = applyBattleAction(s, { kind: 'all-out', actorId: 'a2' })
    expect(step.cues.some((c) => c.kind === 'all-out')).toBe(true)
    const foes = step.state.units.filter((u) => u.side === 'enemy')
    foes.forEach((u, i) => expect(u.hp).toBeLessThan(before[i]!))
    if (step.state.outcome === 'active') {
      expect(step.state.round).toBe(2)
      expect(step.cues.filter((c) => c.kind === 'skip')).toHaveLength(foes.filter((u) => u.hp > 0).length)
      expect(foes.every((u) => !u.down)).toBe(true)
    }
  })

  it('bosses resist damage behind their shield, Break on weakness hits, skip a turn and recover it', () => {
    let s = createBattle(input([foe('boss', 'ice', 'sub-boss')])).state
    const boss = () => s.units.find((u) => u.id === 'boss')!
    const shield = boss().shield
    expect(shield).toBeGreaterThan(0)
    const plain = applyBattleAction(s, { kind: 'attack', actorId: 'a2', targetId: 'boss' }).cues.find((c) => c.kind === 'hit')!
    for (let i = 0; i < shield; i += 1) {
      const actor = ['a1', 'a5'][i % 2]!
      s = applyBattleAction(s, { kind: 'skill', actorId: actor, targetId: 'boss', skill: skillOf(s, actor) }).state
    }
    expect(boss().shield).toBe(0)
    expect(battleBroken(boss())).toBe(true)
    const broken = applyBattleAction(s, { kind: 'attack', actorId: 'a2', targetId: 'boss' }).cues.find((c) => c.kind === 'hit')!
    if (plain.kind === 'hit' && broken.kind === 'hit') {
      expect(broken.amount / plain.amount).toBeCloseTo(BATTLE_BROKEN_FACTOR / BATTLE_SHIELDED_FACTOR, 0)
    }
    for (const id of ['a2', 'a3', 'a4']) s = applyBattleAction(s, { kind: 'attack', actorId: id, targetId: 'boss' }).state
    expect(s.round).toBe(2)
    expect(battleBroken(boss())).toBe(true)
    for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) if (s.outcome === 'active') s = applyBattleAction(s, { kind: 'attack', actorId: id, targetId: 'boss' }).state
    if (s.outcome === 'active') {
      expect(battleBroken(boss())).toBe(false)
      expect(boss().shield).toBe(shield)
    }
  })

  it('spends carried MP and refuses a skill it cannot pay for', () => {
    const cost = battleSkillMp({ tier: 1, depth: 1, branch: 'foundation' })
    let s = createBattle(input([foe('f1', 'ice')], cost)).state
    s = applyBattleAction(s, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skillOf(s, 'a1') }).state
    expect(s.units.find((u) => u.id === 'a1')!.mp).toBe(0)
    expect(applyBattleAction(s, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skillOf(s, 'a1') }).error).toBe('insufficient-mp')
    expect(() => createBattle({ ...input([foe('f1', 'ice')]), allies: party().map((a) => ({ ...a, mp: a.stats.mp + 1 })) })).toThrow(/ally/)
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

  it('pins the element wheel, skill shapes and tier-scaled costs', () => {
    expect([battleMatchup('fire', 'ice'), battleMatchup('ice', 'fire'), battleMatchup('light', 'dark'), battleMatchup('fire', 'dark')])
      .toEqual(['weak', 'resist', 'weak', 'neutral'])
    expect((['fire', 'ice', 'lightning', 'light', 'dark'] as const).map(battleWeakness)).toEqual(['lightning', 'fire', 'ice', 'dark', 'light'])
    expect([1, 2, 3, 4, 5].map((depth) => battleSkillMp({ tier: 1, depth, branch: depth === 1 ? 'foundation' : 'focused' }))).toEqual([10, 14, 18, 22, 26])
    expect(battleSkillMp({ tier: 2, depth: 2, branch: 'area' })).toBe(36)
    const multi = battleSkill({ tier: 1, weapon: 'spear', element: 'ice', depth: 3, branch: 'multi' })
    expect([multi.hits, multi.area, multi.support]).toEqual([2, false, null])
    expect(battleSkill({ tier: 1, weapon: 'cleric-staff', element: 'light', depth: 1, branch: 'foundation' }).support).toBe('power-up')
  })
})
