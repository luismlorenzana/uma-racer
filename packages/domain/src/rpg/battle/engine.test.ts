import { describe, expect, it } from 'vitest'
import { enrollRpgOutfit, learnRpgNode, projectRpgStats, type RpgClass, type RpgElement, type RpgProfile, type RpgWeapon, type RpgWeaponKind } from '../rules'
import { rpgFoe } from '../campaign/enemies'
import { applyBattleAction, battleActionsLeft, battleBroken, battleStateHash, createBattle, replayBattle, type BattleAction } from './index'
import { BATTLE_UNBROKEN_FACTOR, BATTLE_WEAK, battleWeakness } from './skills'
import type { BattleAlly, BattleEnemy, BattleInput, BattleState, BattleStep } from './types'

// Invented outfits only; no private Uma or cast content.
const STYLE: Record<RpgClass, { front: string; pace: string; late: string; end: string }> = {
  brawler: { front: 'A', pace: 'C', late: 'C', end: 'C' }, mage: { front: 'C', pace: 'A', late: 'C', end: 'C' },
  cleric: { front: 'C', pace: 'C', late: 'A', end: 'C' }, summoner: { front: 'C', pace: 'C', late: 'C', end: 'A' },
}
function profile(id: string, classId: RpgClass, weapons: RpgWeapon[], nodes: string[], level = 4): RpgProfile {
  const p = enrollRpgOutfit({ outfit: { id, baseStats: { speed: 110, stamina: 110, power: 110, guts: 110, wit: 110 },
    growthRates: { speed: 0.05, stamina: 0.05, power: 0.05, guts: 0.05, wit: 0.05 },
    aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'G', mile: 'A', medium: 'A', long: 'G' },
      strategy: STYLE[classId] as never } }, contentVersion: 'test', classId, weapons })
  return nodes.reduce(learnRpgNode, { ...p, level })
}
function ally(p: RpgProfile, mp?: number, familiar: RpgWeaponKind = 'axe'): BattleAlly {
  const stats = projectRpgStats(p)
  const loadout = p.tree.filter((r) => !r.id.startsWith('short-sword') && !r.id.startsWith('cleric-staff'))
  return { id: p.outfitId, classId: p.classId, weapons: p.weapons, tier: p.tier, level: p.level, stats, tree: p.tree, legacy: p.legacy,
    loadout, familiar, mp: mp ?? stats.mp }
}
const party = (mp?: number) => [
  profile('a1', 'brawler', ['greatsword', 'spear'], ['greatsword.fire.1', 'spear.ice.1']),
  profile('a2', 'mage', ['mage-staff', 'arcane-staff'], ['mage-staff.fire.1', 'mage-staff.lightning.1', 'arcane-staff.ultima.1']),
  profile('a3', 'mage', ['mage-staff', 'short-sword'], ['mage-staff.fire.1', 'mage-staff.ice.1', 'short-sword.duel.1', 'short-sword.melee.1']),
  profile('a4', 'cleric', ['arcane-staff', 'cleric-staff'], ['arcane-staff.light.1', 'arcane-staff.dark.1', 'arcane-staff.ultima.1',
    'cleric-staff.grace.1', 'cleric-staff.malice.1', 'cleric-staff.sanctuary.1']),
  profile('a5', 'summoner', ['summoner-tome'], ['summon-elemental.fire.1', 'summon-arcane.demons.1']),
].map((p) => ally(p, mp))
const foe = (id: string, element: RpgElement, weapons: RpgWeaponKind[] = ['greatsword', 'axe'], elements: RpgElement[] = ['fire'], shield = 3,
  rank: BattleEnemy['rank'] = 'regular') =>
  rpgFoe({ id, castId: `cast-${id}`, element, role: rank === 'regular' ? 'striker' : 'captain', rank, level: 4, shield, weaknesses: { weapons, elements } })
const input = (enemies: BattleEnemy[], mp?: number): BattleInput => ({ version: 4, seed: 1234, allies: party(mp), enemies })
const hits = (step: BattleStep, target: string) => step.cues.filter((c) => c.kind === 'hit' && c.targetId === target)
const shieldOf = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!.shield
const skill = (id: string) => ({ tier: 1, id })
const act = (s: BattleState, action: BattleAction): BattleState => {
  const step = applyBattleAction(s, action)
  if (step.error) throw new Error(step.error)
  return step.state
}

describe('battle engine v4: classes and multi-part hits (D278, D279)', () => {
  it('a weak part removes a shield point; a two-part hit can remove two', () => {
    let s = createBattle(input([foe('f1', 'ice')])).state
    s = act(s, { kind: 'attack', actorId: 'a1', targetId: 'f1', weapon: 'spear' }) // spear: not on the list
    expect(shieldOf(s, 'f1')).toBe(3)
    s = createBattle(input([foe('f1', 'ice')])).state
    s = act(s, { kind: 'attack', actorId: 'a1', targetId: 'f1' }) // greatsword: weak
    expect(shieldOf(s, 'f1')).toBe(2)
    const step = applyBattleAction(createBattle(input([foe('f1', 'ice')])).state,
      { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skill('greatsword.fire.1') }) // 75% greatsword + 25% fire, both weak
    expect(hits(step, 'f1').map((c) => c.kind === 'hit' && c.element)).toEqual(['greatsword', 'fire'])
    expect(shieldOf(step.state, 'f1')).toBe(1)
  })

  it('unbroken foes take half damage; a Break doubles it back to full', () => {
    const s = createBattle(input([foe('f1', 'ice', ['greatsword'], ['fire'], 1)])).state
    const before = hits(applyBattleAction(s, { kind: 'attack', actorId: 'a1', targetId: 'f1', weapon: 'spear' }), 'f1')[0]!
    const broken = act(s, { kind: 'attack', actorId: 'a5', targetId: 'f1' }) // Familiar axe: not weak
    const shattered = act(broken, { kind: 'skill', actorId: 'a2', targetId: 'f1', skill: skill('mage-staff.fire.1') })
    expect(battleBroken(shattered.units.find((u) => u.id === 'f1')!)).toBe(true)
    const after = hits(applyBattleAction(shattered, { kind: 'attack', actorId: 'a1', targetId: 'f1', weapon: 'spear' }), 'f1')[0]!
    if (before.kind === 'hit' && after.kind === 'hit') expect(after.amount / before.amount).toBeCloseTo(1 / BATTLE_UNBROKEN_FACTOR, 0)
    expect([BATTLE_UNBROKEN_FACTOR, BATTLE_WEAK]).toEqual([0.5, 1.3])
  })

  it('two-staff Mages and Summoners act twice; Guard spends what is left; foes wait for every action', () => {
    let s = createBattle(input([foe('f1', 'ice', ['bow'], ['light'], 9)])).state
    expect([1, 2, 1, 1, 2].map((_, i) => battleActionsLeft(s, `a${i + 1}`))).toEqual([1, 2, 1, 1, 2])
    s = act(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' })
    s = act(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' })
    expect(applyBattleAction(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' }).error).toBe('already-acted')
    s = act(s, { kind: 'attack', actorId: 'a5', targetId: 'f1' })
    expect(applyBattleAction(s, { kind: 'attack', actorId: 'a5', targetId: 'f1' }).error).toBe('already-acted') // one Familiar a round
    s = act(s, { kind: 'guard', actorId: 'a5', targetId: 'a1' })
    for (const id of ['a1', 'a3', 'a4']) s = act(s, { kind: 'attack', actorId: id, targetId: 'f1' })
    expect(s.round).toBe(2)
    expect(battleActionsLeft(s, 'a2')).toBe(2)
  })

  it('the Short Sword follows a Mage Staff spell: Flurry after one-foe spells, Arc after every-foe spells', () => {
    const s = createBattle(input([foe('f1', 'ice', ['short-sword'], ['fire'], 9), foe('f2', 'fire', ['bow'], ['ice'], 9)])).state
    const fire = applyBattleAction(s, { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: skill('mage-staff.fire.1') })
    const kinds = fire.cues.filter((c) => c.kind === 'hit').map((c) => c.kind === 'hit' && `${c.targetId}:${c.element}`)
    expect(kinds).toEqual(['f1:fire', 'f1:short-sword', 'f1:short-sword'])
    expect(shieldOf(fire.state, 'f1')).toBe(6)
    const ice = applyBattleAction(s, { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: skill('mage-staff.ice.1') })
    expect(ice.cues.filter((c) => c.kind === 'hit').map((c) => c.kind === 'hit' && `${c.targetId}:${c.element}`))
      .toEqual(['f1:ice', 'f2:ice', 'f1:short-sword', 'f2:short-sword'])
  })

  it("a Cleric's cast carries a blessing from the branch its element points to, shaped by the cast", () => {
    const s = createBattle(input([foe('f1', 'ice'), foe('f2', 'fire')])).state
    const light = act(s, { kind: 'skill', actorId: 'a4', targetId: 'f1', skill: skill('arcane-staff.light.1'), blessing: 'cleric-staff.grace.1' })
    expect(light.units.filter((u) => u.side === 'ally').every((u) => u.statuses.some((x) => x.kind === 'brave' && x.stacks === 1))).toBe(true)
    const dark = act(s, { kind: 'skill', actorId: 'a4', targetId: 'f1', skill: skill('arcane-staff.dark.1'), blessing: 'cleric-staff.malice.1' })
    expect(dark.units.filter((u) => u.side === 'enemy').every((u) => u.statuses.some((x) => x.kind === 'armor-break'))).toBe(true)
    const ultima = act(s, { kind: 'skill', actorId: 'a4', targetId: 'f1', skill: skill('arcane-staff.ultima.1'), blessing: 'cleric-staff.sanctuary.1' })
    expect(ultima.units.filter((u) => u.side === 'ally').reduce((sum, u) => sum + u.barrier, 0)).toBeGreaterThan(0)
    expect(applyBattleAction(s, { kind: 'skill', actorId: 'a4', targetId: 'f1', skill: skill('arcane-staff.light.1'), blessing: 'cleric-staff.malice.1' }).error)
      .toBe('invalid-skill')
  })

  it('Ultima never removes shield points; Brave lifts weapon damage', () => {
    const s = createBattle(input([foe('f1', 'ice', ['greatsword'], ['light', 'dark', 'fire'], 5)])).state
    expect(shieldOf(act(s, { kind: 'skill', actorId: 'a2', targetId: 'f1', skill: skill('arcane-staff.ultima.1') }), 'f1')).toBe(5)
    const plain = hits(applyBattleAction(s, { kind: 'attack', actorId: 'a1', targetId: 'f1', weapon: 'spear' }), 'f1')[0]!
    const blessed = act(s, { kind: 'skill', actorId: 'a4', targetId: 'f1', skill: skill('arcane-staff.light.1'), blessing: 'cleric-staff.grace.1' })
    const brave = hits(applyBattleAction(blessed, { kind: 'attack', actorId: 'a1', targetId: 'f1', weapon: 'spear' }), 'f1')[0]!
    if (plain.kind === 'hit' && brave.kind === 'hit') expect(brave.amount).toBeGreaterThan(plain.amount)
  })

  it('scales MP by the hand and refuses a skill it cannot pay for', () => {
    const s = createBattle(input([foe('f1', 'ice')])).state
    const cost = (actorId: string, id: string) => s.units.find((u) => u.id === actorId)!.mp -
      act(s, { kind: 'skill', actorId, targetId: 'f1', skill: skill(id) }).units.find((u) => u.id === actorId)!.mp
    expect([cost('a1', 'greatsword.fire.1'), cost('a2', 'mage-staff.fire.1'), cost('a3', 'mage-staff.fire.1'),
      cost('a4', 'arcane-staff.light.1'), cost('a5', 'summon-elemental.fire.1')]).toEqual([10, 6, 8, 10, 7])
    const dry = createBattle(input([foe('f1', 'ice')], 5)).state
    expect(applyBattleAction(dry, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skill('greatsword.fire.1') }).error).toBe('insufficient-mp')
  })

  it('a Broken foe loses this round and the next, then raises its shield', () => {
    let s = createBattle(input([foe('f1', 'ice', ['greatsword'], ['fire'], 1, 'sub-boss')])).state
    s = act(s, { kind: 'attack', actorId: 'a1', targetId: 'f1' })
    expect(battleBroken(s.units.find((u) => u.id === 'f1')!)).toBe(true)
    const round = (state: BattleState): BattleStep => {
      let step: BattleStep = { state, cues: [], hash: '' }
      for (const id of ['a1', 'a2', 'a3', 'a4', 'a5']) {
        if (battleActionsLeft(step.state, id) <= 0) continue
        const next = applyBattleAction(step.state, { kind: 'guard', actorId: id, targetId: id === 'a1' ? 'a2' : 'a1' })
        step = { ...next, cues: [...step.cues, ...next.cues] }
      }
      return step
    }
    const first = round(s)
    expect(first.cues.some((c) => c.kind === 'skip')).toBe(true)
    const second = round(first.state)
    expect(second.cues.some((c) => c.kind === 'skip')).toBe(true)
    expect(second.cues.some((c) => c.kind === 'recover')).toBe(true)
    expect(shieldOf(second.state, 'f1')).toBe(1)
  })

  it('replays identically from the frozen input and refuses unlearned skills', () => {
    const start = createBattle(input([foe('f1', 'ice'), foe('f2', 'dark')]))
    const actions: BattleAction[] = [
      { kind: 'skill', actorId: 'a2', targetId: 'f1', skill: skill('mage-staff.lightning.1') },
      { kind: 'skill', actorId: 'a5', targetId: 'f2', skill: skill('summon-arcane.demons.1') },
    ]
    const a = replayBattle(start.state.input, actions)
    const b = replayBattle(start.state.input, actions)
    expect(a.hash).toBe(b.hash)
    expect(battleStateHash(a.state)).toMatch(/^rpg-battle-v4:/)
    expect(applyBattleAction(start.state, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skill('greatsword.ice.1') }).error).toBe('invalid-skill')
    expect(battleWeakness('fire')).toBe('lightning')
  })
})
