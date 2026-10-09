import { battleActorSkill, createBattle, enrollRpgOutfit, learnRpgNode, projectRpgStats, rpgFoe, type BattleAlly, type RpgClass,
  type RpgProfile, type RpgWeapon } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { actionFor, allyKinds, blessingChoices, canChip, describeCue, limitMode, limitNow, limitOptions, limitReady } from './battle-view'

// Invented outfits only.
const STYLE = { brawler: { front: 'A', pace: 'C', late: 'C', end: 'C' }, mage: { front: 'C', pace: 'A', late: 'C', end: 'C' },
  spellblade: { front: 'C', pace: 'A', late: 'C', end: 'C' }, cleric: { front: 'C', pace: 'C', late: 'A', end: 'C' }, summoner: { front: 'C', pace: 'C', late: 'C', end: 'A' } } as const
function ally(id: string, classId: RpgClass, weapons: RpgWeapon[], nodes: string[]): BattleAlly {
  const p: RpgProfile = nodes.reduce(learnRpgNode, { ...enrollRpgOutfit({ outfit: { id, baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes: { surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'C', mile: 'A', medium: 'A', long: 'C' }, strategy: STYLE[classId] } },
  contentVersion: 'test', classId, weapons }), level: 10 })
  const stats = projectRpgStats(p)
  return { id, classId, weapons, tier: 1, level: 10, stats, tree: p.tree, legacy: [], familiar: 'bow', mp: stats.mp,
    loadout: p.tree.filter((r) => !r.id.startsWith('cleric-staff')) }
}
const party = [
  ally('a1', 'brawler', ['axe', 'bow'], ['axe.ice.1']),
  ally('a2', 'spellblade', ['short-sword'], ['blade-arcane.dark.1']),
  ally('a3', 'cleric', ['arcane-staff', 'cleric-staff'], ['arcane-staff.light.1', 'cleric-staff.grace.1', 'cleric-staff.grace.2']),
  ally('a4', 'summoner', ['summoner-tome'], ['summon-arcane.angels.1']),
  ally('a5', 'mage', ['mage-staff', 'arcane-staff'], ['mage-staff.fire.1']),
]
const foe = rpgFoe({ id: 'f1', castId: 'c1', element: 'ice', role: 'striker', rank: 'regular', level: 4, shield: 3,
  weaknesses: { weapons: ['short-sword', 'bow'], elements: ['fire', 'light'] } })

describe('fight projections (D278–D281)', () => {
  it('knows which kinds each Uma lands, and so who can break a foe', () => {
    const state = createBattle({ version: 5, seed: 1, allies: party, enemies: [foe] }).state
    expect(allyKinds(party[0]!)).toEqual({ free: ['axe', 'bow'], skills: ['axe', 'ice'] })
    expect(allyKinds(party[1]!)).toEqual({ free: ['short-sword'], skills: ['dark', 'short-sword'] })
    expect(allyKinds(party[3]!)).toEqual({ free: ['bow'], skills: ['light', 'spear'] })
    expect(['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => canChip(state, id, foe))).toEqual([
      { weapon: true, element: false }, { weapon: true, element: false }, { weapon: false, element: true },
      { weapon: true, element: true }, { weapon: false, element: true }])
  })

  it('offers a Cleric the learned blessings of the branch her cast points to', () => {
    const state = createBattle({ version: 5, seed: 1, allies: party, enemies: [foe] }).state
    const light = battleActorSkill(state, 'a3', { tier: 1, id: 'arcane-staff.light.1' })!
    expect(blessingChoices(state, 'a3', light).map((b) => b.name)).toEqual(['Brave', 'Faith'])
    expect(blessingChoices(state, 'a2', battleActorSkill(state, 'a2', { tier: 1, id: 'blade-arcane.dark.1' })!)).toEqual([])
    expect(actionFor({ kind: 'skill', ref: light.ref, blessing: 'cleric-staff.grace.2' }, 'a3', 'f1'))
      .toEqual({ kind: 'skill', actorId: 'a3', targetId: 'f1', skill: light.ref, blessing: 'cleric-staff.grace.2' })
    expect(actionFor({ kind: 'attack', weapon: 'bow' }, 'a1', 'f1')).toEqual({ kind: 'attack', actorId: 'a1', targetId: 'f1', weapon: 'bow' })
  })

  it('offers each class its Limit Break once her bar is full, before she acts (D311)', () => {
    const state = createBattle({ version: 5, seed: 1, allies: party, enemies: [foe] }).state
    expect(limitReady(state, 'a1')).toBe(false)
    for (const u of state.units) if (u.side === 'ally') u.limit = 12
    expect(['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => limitNow(state, id))).toEqual([true, true, true, true, true])
    expect(limitOptions(state, 'a1').options.map((o) => [o.name, o.detail])).toEqual([['Frost Sweep', 'Cast twice in a row']])
    expect(limitOptions(state, 'a2').options.map((o) => [o.name, o.detail])).toEqual([['Shade Cut', 'Twice the hits, arcane and sword']])
    expect(limitOptions(state, 'a3').options.map((o) => o.name)).toEqual(['Divine Patrons'])
    expect(limitOptions(state, 'a4')).toMatchObject({ pick: 2, options: [{ name: 'Cherub' }] })
    expect(limitOptions(state, 'a5').options.map((o) => o.name)).toEqual(['Prismatic Nova'])
    const twin = limitMode(state, 'a4', { skills: [{ tier: 1, id: 'summon-arcane.angels.1' }, { tier: 1, id: 'summon-arcane.angels.1' }] })!
    expect(twin).toMatchObject({ kind: 'limit', name: 'Cherub' })
    expect(actionFor(twin, 'a4', 'f1')).toEqual({ kind: 'limit', actorId: 'a4', targetId: 'f1',
      skills: [{ tier: 1, id: 'summon-arcane.angels.1' }, { tier: 1, id: 'summon-arcane.angels.1' }] })
    expect(limitMode(state, 'a4', { skills: [{ tier: 1, id: 'summon-arcane.angels.1' }] })).toBeNull()
    expect(describeCue({ kind: 'limit', actorId: 'a5', targetId: 'f1', label: 'Prismatic Nova' }, (id) => id)).toBe('a5: LIMIT BREAK · Prismatic Nova!')
    // A Brawler with nothing equipped strikes twice with a weapon of her choice.
    const bare = createBattle({ version: 5, seed: 1, allies: party.map((a) => a.id === 'a1' ? { ...a, loadout: [] } : a), enemies: [foe] }).state
    expect(limitOptions(bare, 'a1').options.map((o) => o.name)).toEqual(['Twin Strike · Axe', 'Twin Strike · Bow'])
  })
})
