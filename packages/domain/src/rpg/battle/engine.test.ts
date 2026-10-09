import { describe, expect, it } from 'vitest'
import { enrollRpgOutfit, learnRpgNode, projectRpgStats, type RpgClass, type RpgElement, type RpgProfile, type RpgWeapon, type RpgWeaponKind } from '../rules'
import { rpgFoe } from '../campaign/enemies'
import { BATTLE_LIMIT_MAX, applyBattleAction, battleActionsLeft, battleBroken, battleLimitGain, battleStateHash, createBattle, replayBattle,
  type BattleAction } from './index'
import { BATTLE_UNBROKEN_FACTOR, BATTLE_WEAK, battleWeakness } from './skills'
import type { BattleAlly, BattleEnemy, BattleInput, BattleState, BattleStep } from './types'

// Invented outfits only; no private Uma or cast content.
const STYLE: Record<RpgClass, { front: string; pace: string; late: string; end: string }> = {
  brawler: { front: 'A', pace: 'C', late: 'C', end: 'C' }, mage: { front: 'C', pace: 'A', late: 'C', end: 'C' },
  spellblade: { front: 'C', pace: 'A', late: 'C', end: 'C' }, cleric: { front: 'C', pace: 'C', late: 'A', end: 'C' }, summoner: { front: 'C', pace: 'C', late: 'C', end: 'A' },
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
  const loadout = p.tree.filter((r) => !r.id.startsWith('cleric-staff'))
  return { id: p.outfitId, classId: p.classId, weapons: p.weapons, tier: p.tier, level: p.level, stats, tree: p.tree, legacy: p.legacy,
    loadout, familiar, mp: mp ?? stats.mp }
}
const party = (mp?: number) => [
  profile('a1', 'brawler', ['greatsword', 'spear'], ['greatsword.fire.1', 'spear.ice.1']),
  profile('a2', 'mage', ['mage-staff', 'arcane-staff'], ['mage-staff.fire.1', 'mage-staff.lightning.1', 'arcane-staff.ultima.1']),
  profile('a3', 'spellblade', ['short-sword'], ['blade-elemental.fire.1', 'blade-arcane.light.1', 'blade-arcane.ultima.1']),
  profile('a4', 'cleric', ['arcane-staff', 'cleric-staff'], ['arcane-staff.light.1', 'arcane-staff.dark.1', 'arcane-staff.ultima.1',
    'cleric-staff.grace.1', 'cleric-staff.malice.1', 'cleric-staff.sanctuary.1']),
  profile('a5', 'summoner', ['summoner-tome'], ['summon-elemental.fire.1', 'summon-arcane.demons.1']),
].map((p) => ally(p, mp))
const foe = (id: string, element: RpgElement, weapons: RpgWeaponKind[] = ['greatsword', 'axe'], elements: RpgElement[] = ['fire'], shield = 3,
  rank: BattleEnemy['rank'] = 'regular') =>
  rpgFoe({ id, castId: `cast-${id}`, element, role: rank === 'regular' ? 'striker' : 'captain', rank, level: 4, shield, weaknesses: { weapons, elements } })
const input = (enemies: BattleEnemy[], mp?: number): BattleInput => ({ version: 5, seed: 1234, allies: party(mp), enemies })
const hits = (step: BattleStep, target: string) => step.cues.filter((c) => c.kind === 'hit' && c.targetId === target)
const shieldOf = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!.shield
const skill = (id: string) => ({ tier: 1, id })
const act = (s: BattleState, action: BattleAction): BattleState => {
  const step = applyBattleAction(s, action)
  if (step.error) throw new Error(step.error)
  return step.state
}

describe('battle engine v5: classes and multi-part hits (D278, D279, D310)', () => {
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

  it('Mages, Spell Blades and Summoners act twice; Guard spends what is left; foes wait for every action', () => {
    let s = createBattle(input([foe('f1', 'ice', ['bow'], ['light'], 9)])).state
    expect([1, 2, 3, 4, 5].map((i) => battleActionsLeft(s, `a${i}`))).toEqual([1, 2, 2, 1, 2])
    s = act(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' })
    s = act(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' })
    expect(applyBattleAction(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' }).error).toBe('already-acted')
    s = act(s, { kind: 'attack', actorId: 'a5', targetId: 'f1' })
    expect(applyBattleAction(s, { kind: 'attack', actorId: 'a5', targetId: 'f1' }).error).toBe('already-acted') // one Familiar a round
    s = act(s, { kind: 'guard', actorId: 'a5', targetId: 'a1' })
    for (const id of ['a1', 'a3', 'a3', 'a4']) s = act(s, { kind: 'attack', actorId: id, targetId: 'f1' })
    expect(s.round).toBe(2)
    expect(battleActionsLeft(s, 'a2')).toBe(2)
  })

  it('a Spell Blade acts twice: blade skills cut with sword and element in one hit, arcane skills weave them (D310)', () => {
    const s = createBattle(input([foe('f1', 'ice', ['short-sword'], ['fire'], 9)])).state
    const fire = applyBattleAction(s, { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: skill('blade-elemental.fire.1') })
    expect(hits(fire, 'f1').map((c) => c.kind === 'hit' && c.element)).toEqual(['short-sword', 'fire'])
    expect(shieldOf(fire.state, 'f1')).toBe(7) // both halves of the hit are weak
    expect(battleActionsLeft(fire.state, 'a3')).toBe(1)
    const light = applyBattleAction(fire.state, { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: skill('blade-arcane.light.1') })
    expect(hits(light, 'f1').map((c) => c.kind === 'hit' && c.element)).toEqual(['light', 'short-sword'])
    expect(shieldOf(light.state, 'f1')).toBe(6)
    // Slash is a Short Sword hit at half a Brawler's Attack, once per action.
    const slash = act(act(s, { kind: 'attack', actorId: 'a3', targetId: 'f1' }), { kind: 'attack', actorId: 'a3', targetId: 'f1' })
    expect(shieldOf(slash, 'f1')).toBe(7)
    expect(battleActionsLeft(slash, 'a3')).toBe(0)
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
    expect([cost('a1', 'greatsword.fire.1'), cost('a2', 'mage-staff.fire.1'), cost('a3', 'blade-elemental.fire.1'),
      cost('a4', 'arcane-staff.light.1'), cost('a5', 'summon-elemental.fire.1')]).toEqual([10, 6, 5, 10, 7])
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
    expect(battleStateHash(a.state)).toMatch(/^rpg-battle-v5:/)
    expect(applyBattleAction(start.state, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skill('greatsword.ice.1') }).error).toBe('invalid-skill')
    expect(battleWeakness('fire')).toBe('lightning')
  })
})

describe('Limit Break (D311)', () => {
  const ready = (s: BattleState, ...ids: string[]) => { for (const id of ids) s.units.find((u) => u.id === id)!.limit = BATTLE_LIMIT_MAX; return s }
  const limitOf = (s: BattleState, id: string) => s.units.find((u) => u.id === id)!.limit
  const kinds = (step: BattleStep, target: string) => hits(step, target).map((c) => c.kind === 'hit' && c.element)
  const dealt = (step: BattleStep) => step.cues.reduce((sum, c) => sum + (c.kind === 'hit' && c.actorId !== c.targetId ? c.amount : 0), 0)

  it('charges 1 an attack and 2 a skill, doubled for one-action hands, and stays full until used', () => {
    let s = createBattle(input([foe('f1', 'ice', ['bow'], ['light'], 9)])).state
    s = act(s, { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skill('greatsword.fire.1') })
    s = act(s, { kind: 'attack', actorId: 'a2', targetId: 'f1' })
    s = act(s, { kind: 'skill', actorId: 'a2', targetId: 'f1', skill: skill('mage-staff.fire.1') })
    s = act(s, { kind: 'attack', actorId: 'a4', targetId: 'f1' })
    s = act(s, { kind: 'guard', actorId: 'a5', targetId: 'a1' })
    expect(['a1', 'a2', 'a4', 'a5'].map((id) => limitOf(s, id))).toEqual([4, 3, 2, 0])
    expect([battleLimitGain({ actions: 1 }, 'skill'), battleLimitGain({ actions: 2 }, 'attack')]).toEqual([4, 1])
    s.units.find((u) => u.id === 'a3')!.limit = BATTLE_LIMIT_MAX - 1
    s = act(act(s, { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: skill('blade-elemental.fire.1') }), { kind: 'attack', actorId: 'a3', targetId: 'f1' })
    expect(limitOf(s, 'a3')).toBe(BATTLE_LIMIT_MAX)
  })

  it('needs a full bar and a fresh turn, takes the whole turn at 0 MP and empties the bar', () => {
    const s = createBattle(input([foe('f1', 'ice', ['bow'], ['light'], 9)])).state
    expect(applyBattleAction(s, { kind: 'limit', actorId: 'a2', targetId: 'f1' }).error).toBe('limit-not-ready')
    const half = act(ready(s, 'a2'), { kind: 'attack', actorId: 'a2', targetId: 'f1' })
    expect(applyBattleAction(half, { kind: 'limit', actorId: 'a2', targetId: 'f1' }).error).toBe('limit-not-ready')
    const nova = applyBattleAction(ready(createBattle(input([foe('f1', 'ice', ['bow'], ['light'], 9)])).state, 'a2'), { kind: 'limit', actorId: 'a2', targetId: 'f1' })
    expect(nova.cues[0]).toMatchObject({ kind: 'limit', actorId: 'a2', label: 'Prismatic Nova' })
    expect(kinds(nova, 'f1')).toEqual(['fire', 'ice', 'lightning', 'light', 'dark', 'ultima'])
    expect([battleActionsLeft(nova.state, 'a2'), limitOf(nova.state, 'a2')]).toEqual([0, 0])
    expect(nova.state.units.find((u) => u.id === 'a2')!.mp).toBe(nova.state.input.allies[1]!.mp)
    expect(applyBattleAction(ready(s, 'a1'), { kind: 'limit', actorId: 'a1', targetId: 'a2' }).error).toBe('invalid-target')
  })

  it('casts a Brawler’s skill twice, a Summoner’s two summons twice each and a Cleric’s patrons', () => {
    const big = () => ready(createBattle(input([foe('f1', 'ice', ['bow'], ['ice'], 9)])).state, 'a1', 'a4', 'a5')
    const once = dealt(applyBattleAction(big(), { kind: 'skill', actorId: 'a1', targetId: 'f1', skill: skill('greatsword.fire.1') }))
    const twice = applyBattleAction(big(), { kind: 'limit', actorId: 'a1', targetId: 'f1', skill: skill('greatsword.fire.1') })
    expect(kinds(twice, 'f1')).toEqual(['greatsword', 'fire', 'greatsword', 'fire'])
    expect(dealt(twice)).toBe(2 * once)
    expect(applyBattleAction(big(), { kind: 'limit', actorId: 'a1', targetId: 'f1', skill: skill('axe.fire.1') }).error).toBe('invalid-skill')
    expect(kinds(applyBattleAction(big(), { kind: 'limit', actorId: 'a1', targetId: 'f1', weapon: 'spear' }), 'f1')).toEqual(['spear', 'spear'])
    const summons = applyBattleAction(big(), { kind: 'limit', actorId: 'a5', targetId: 'f1',
      skills: [skill('summon-elemental.fire.1'), skill('summon-arcane.demons.1')] })
    expect(kinds(summons, 'f1')).toEqual(['fire', 'fire', 'dark', 'greatsword', 'dark', 'greatsword'])
    expect(applyBattleAction(big(), { kind: 'limit', actorId: 'a5', targetId: 'f1', skills: [skill('summon-elemental.fire.1')] }).error).toBe('invalid-skill')
    const patrons = applyBattleAction(big(), { kind: 'limit', actorId: 'a4', targetId: 'f1' })
    expect(patrons.cues[0]).toMatchObject({ label: 'Divine Patrons' })
    expect(kinds(patrons, 'f1')).toEqual(['light', 'dark', 'light', 'dark'])
  })

  it('makes a Spell Blade’s skill big: three sword-and-element hits, or twice the arcane weave, or Triad Blade', () => {
    const big = () => ready(createBattle(input([foe('f1', 'ice', ['bow'], ['ice'], 9)])).state, 'a3')
    const turn = (id: string) => { const one = applyBattleAction(big(), { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: skill(id) })
      return dealt(one) + dealt(applyBattleAction(one.state, { kind: 'skill', actorId: 'a3', targetId: 'f1', skill: skill(id) })) }
    const fire = applyBattleAction(big(), { kind: 'limit', actorId: 'a3', targetId: 'f1', skill: skill('blade-elemental.fire.1') })
    expect(kinds(fire, 'f1')).toEqual(['short-sword', 'fire', 'short-sword', 'fire', 'short-sword', 'fire'])
    expect(Math.abs(dealt(fire) / turn('blade-elemental.fire.1') - 2)).toBeLessThan(0.2) // whole-number damage rounds at Lv4
    const light = applyBattleAction(big(), { kind: 'limit', actorId: 'a3', targetId: 'f1', skill: skill('blade-arcane.light.1') })
    expect(kinds(light, 'f1')).toEqual(['light', 'short-sword', 'light', 'short-sword'])
    expect(Math.abs(dealt(light) / turn('blade-arcane.light.1') - 2)).toBeLessThan(0.2) // whole-number damage rounds at Lv4
    expect(kinds(applyBattleAction(big(), { kind: 'limit', actorId: 'a3', targetId: 'f1' }), 'f1'))
      .toEqual(['short-sword', 'fire', 'short-sword', 'ice', 'short-sword', 'lightning'])
  })
})
