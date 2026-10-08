// Synthetic outfit-only tests for docs/design/uma-rpg-classes.md (D267–D270).
import { describe, expect, it } from 'vitest'
import type { Aptitudes, Stats } from '../types'
import { RPG_NODES, rpgNode, rpgTreeNodes } from './catalog'
import {
  canChangeRpgClass, changeRpgClass, enrollRpgOutfit, forgetRpgVariant, grantRpgExp, learnRpgNode, promoteRpgOutfit, projectRpgStats,
  rpgActiveSlots, rpgClassOptions, rpgClassTrees, rpgExpToNext, rpgHand, rpgLearnBlock, rpgLifetimeLevels, rpgTreePointsEarned,
  rpgTreePointsSpent, validRpgTree, validateRpgLoadout, type RpgProfile,
} from './rules'

const base: Stats = { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 }
const growth: Stats = { speed: 0.2, stamina: 0.1, power: 0, guts: 0, wit: 0.3 }
const styles = (front: string, pace: string, late: string, end: string): Aptitudes => ({
  surface: { turf: 'G', dirt: 'A' }, distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'B' },
  strategy: { front, pace, late, end } as Aptitudes['strategy'],
})
const source = (aptitudes = styles('A', 'A', 'B', 'G')) => ({ id: 'invented-outfit', baseStats: { ...base }, growthRates: { ...growth }, aptitudes })
const brawler = () => enrollRpgOutfit({ outfit: source(), contentVersion: 'synthetic-v1', classId: 'brawler', weapons: ['greatsword', 'spear'] })
const learnAll = (p: RpgProfile, ids: string[]) => ids.reduce(learnRpgNode, p)

describe('RPG classes (D267)', () => {
  it('maps A running styles to a class, and leaves outliers a choice', () => {
    expect(rpgClassOptions(styles('A', 'B', 'C', 'G'))).toEqual(['brawler'])
    expect(rpgClassOptions(styles('A', 'A', 'B', 'G'))).toEqual(['brawler'])
    expect(rpgClassOptions(styles('G', 'A', 'B', 'C'))).toEqual(['mage'])
    expect(rpgClassOptions(styles('G', 'A', 'A', 'C'))).toEqual(['mage'])
    expect(rpgClassOptions(styles('G', 'C', 'A', 'C'))).toEqual(['cleric'])
    expect(rpgClassOptions(styles('G', 'C', 'B', 'A'))).toEqual(['summoner'])
    expect(rpgClassOptions(styles('G', 'C', 'A', 'A'))).toEqual(['summoner'])
    expect(rpgClassOptions(styles('A', 'C', 'A', 'C'))).toEqual(['brawler', 'cleric'])
    expect(rpgClassOptions(styles('G', 'A', 'A', 'A'))).toEqual(['mage', 'cleric', 'summoner'])
    expect(rpgClassOptions(styles('B', 'B', 'B', 'B'))).toEqual([])
  })

  it('enrolls with a weapon set of the class, and freezes content inputs', () => {
    const outfit = source()
    const profile = brawler()
    outfit.baseStats.speed = 999
    expect(profile).toMatchObject({ classId: 'brawler', weapons: ['greatsword', 'spear'], tier: 1, level: 1, tree: [], legacy: [] })
    expect(rpgClassTrees('brawler', ['axe', 'bow'])).toEqual(['axe', 'bow'])
    expect(rpgClassTrees('summoner', ['summoner-tome'])).toEqual(['summon-elemental', 'summon-arcane'])
    expect(() => enrollRpgOutfit({ outfit: source(), contentVersion: 'v', classId: 'mage', weapons: ['mage-staff', 'short-sword'] })).toThrow(/not open/)
    expect(() => enrollRpgOutfit({ outfit: source(), contentVersion: 'v', classId: 'brawler', weapons: ['greatsword', 'axe'] })).toThrow(/set/)
    expect(() => enrollRpgOutfit({ outfit: source(styles('B', 'B', 'B', 'B')), contentVersion: 'v', classId: 'brawler', weapons: ['greatsword', 'spear'] })).toThrow(/no A/)
  })

  it('changes class or weapons freely while nothing is learned, at any level', () => {
    const fresh = { ...brawler(), level: 14, exp: 65 }
    const swapped = changeRpgClass(fresh, 'brawler', ['axe', 'bow'])
    expect(swapped).toEqual({ ...fresh, weapons: ['axe', 'bow'] })
    expect(() => changeRpgClass(fresh, 'brawler', ['greatsword', 'spear'])).toThrow(/different/)
    expect(() => changeRpgClass(fresh, 'cleric', ['arcane-staff', 'cleric-staff'])).toThrow(/not open/)
    const learned = learnRpgNode(fresh, 'greatsword.fire.1')
    expect(canChangeRpgClass(learned)).toBe(false)
    expect(() => changeRpgClass(learned, 'brawler', ['axe', 'bow'])).toThrow(/empty/)
  })

  it('gives each build its hand: actions, power and MP shares, and the free action', () => {
    expect(rpgHand({ classId: 'brawler', weapons: ['greatsword', 'spear'] })).toMatchObject({ actions: 1, power: 1, mp: 1 })
    expect(rpgHand({ classId: 'mage', weapons: ['mage-staff', 'arcane-staff'] })).toMatchObject({ actions: 2, power: 0.6, mp: 0.6 })
    expect(rpgHand({ classId: 'mage', weapons: ['mage-staff', 'short-sword'] })).toMatchObject({ actions: 1, power: 0.75, mp: 0.75, free: { kind: 'short-sword' } })
    expect(rpgHand({ classId: 'cleric', weapons: ['arcane-staff', 'cleric-staff'] })).toMatchObject({ actions: 1, power: 0.5, mp: 0.7 })
    expect(rpgHand({ classId: 'summoner', weapons: ['summoner-tome'] })).toMatchObject({ actions: 2, power: 0.5, mp: 0.5, free: { kind: 'familiar' } })
  })
})

describe('RPG levels and stats', () => {
  it('projects deterministic lifetime stats leaned by class', () => {
    const profile = brawler()
    expect(rpgLifetimeLevels(1, 1)).toBe(0)
    expect(projectRpgStats(profile)).toMatchObject({ speed: 20, atk: 22, matk: 18, hp: 276 })
    expect(projectRpgStats({ ...profile, level: 50 }).speed).toBe(108)
  })

  it('crosses each level once, banks at 50, promotes explicitly and settles the bank', () => {
    const initial = brawler()
    const result = grantRpgExp(initial, rpgExpToNext(1) + rpgExpToNext(2) + 5)
    expect(result.levelsCrossed).toEqual([2, 3])
    expect(result.profile).toMatchObject({ level: 3, exp: 5 })
    const atCap = grantRpgExp({ ...initial, level: 49, exp: 0 }, rpgExpToNext(49) + 1000)
    expect(atCap.profile).toMatchObject({ level: 50, exp: 1000 })
    expect(() => promoteRpgOutfit(atCap.profile, [])).toThrow(/Unspent/)
    const promoted = promoteRpgOutfit(atCap.profile, [], true)
    expect(promoted.profile).toMatchObject({ tier: 2, level: 6, exp: 160, tree: [], legacy: [] })
    expect(() => promoteRpgOutfit(initial, [])).toThrow(/Lv50/)
  })
})

describe('RPG class trees (D270)', () => {
  it('authors ten trees of three branches: five core nodes and three forks of two variants each', () => {
    const trees = new Set(RPG_NODES.map((n) => n.tree))
    expect(trees.size).toBe(10)
    for (const tree of trees) {
      const nodes = rpgTreeNodes(tree)
      expect(nodes).toHaveLength(33)
      expect(nodes.filter((n) => n.variant === null).map((n) => n.cost).reduce((a, b) => a + b, 0)).toBe(45)
      expect(new Set(nodes.map((n) => n.name)).size).toBe(33)
      expect(nodes.every((n) => (n.skill === null) !== (n.passive === null))).toBe(true)
    }
    expect(rpgNode('greatsword.fire.1')).toMatchObject({ name: 'Flame Slash', cost: 1, skill: { target: 'one', mp: 10 } })
    expect(rpgNode('mage-staff.fire.4')?.name).toBe('Firaja')
    expect(rpgNode('mage-staff.fire.2a')?.skill?.target).toBe('all')
    expect(rpgNode('cleric-staff.malice.5')?.passive).toBe('shatter')
  })

  it('learns core nodes in order, costs their depth and gates depths by level', () => {
    let p = brawler()
    expect(rpgTreePointsEarned(1)).toBe(7)
    p = learnAll(p, ['greatsword.fire.1', 'greatsword.ice.1', 'greatsword.lightning.1', 'spear.fire.1', 'spear.ice.1', 'spear.lightning.1'])
    expect(rpgTreePointsSpent(p.tree)).toBe(6)
    expect(rpgLearnBlock(p, 'greatsword.fire.2')).toMatch(/Lv10/)
    expect(rpgLearnBlock(p, 'axe.fire.1')).toMatch(/class trees/)
    p = { ...p, level: 10 }
    expect(rpgLearnBlock(p, 'greatsword.fire.3')).toMatch(/Lv20/)
    p = learnRpgNode(p, 'greatsword.fire.2')
    expect(rpgLearnBlock({ ...p, level: 20 }, 'greatsword.ice.3')).toMatch(/core skill above/)
    expect(validRpgTree(p)).toBe(true)
  })

  it('allows one side of each fork, three variants a tree, and swaps them freely', () => {
    let p = { ...brawler(), level: 45 }
    const core = rpgTreeNodes('greatsword').filter((n) => n.variant === null).map((n) => n.id)
    p = learnAll(p, core)
    p = learnRpgNode(p, 'greatsword.fire.2a')
    expect(rpgLearnBlock(p, 'greatsword.fire.2b')).toMatch(/other side/)
    expect(rpgLearnBlock(p, 'spear.fire.2a')).toMatch(/class trees|core skill/)
    p = learnAll(p, ['greatsword.fire.3b', 'greatsword.ice.4a'])
    expect(rpgLearnBlock(p, 'greatsword.lightning.4b')).toMatch(/3 variants/)
    const swapped = forgetRpgVariant(p, 'greatsword.fire.2a')
    expect(rpgTreePointsSpent(swapped.tree)).toBe(rpgTreePointsSpent(p.tree) - 2)
    expect(learnRpgNode(swapped, 'greatsword.fire.2b').tree.some((r) => r.id === 'greatsword.fire.2b')).toBe(true)
    expect(() => forgetRpgVariant(p, 'greatsword.fire.1')).toThrow(/variant/)
    expect(validRpgTree({ ...p, tree: [...p.tree, { tier: 1, id: 'greatsword.lightning.4b' }] })).toBe(false)
  })

  it('fits every core node and three variants per tree in 115 points by Lv45', () => {
    let p = { ...brawler(), level: 45 }
    p = learnAll(p, [...rpgTreeNodes('greatsword'), ...rpgTreeNodes('spear')].filter((n) => n.variant === null).map((n) => n.id))
    expect(rpgTreePointsSpent(p.tree)).toBe(90)
    p = learnAll(p, ['greatsword.fire.4a', 'greatsword.ice.4a', 'greatsword.lightning.4a', 'spear.fire.4b', 'spear.ice.4b', 'spear.lightning.4b'])
    expect(rpgTreePointsSpent(p.tree)).toBe(114)
    expect(validRpgTree(p)).toBe(true)
  })

  it('equips learned skills only, up to the slot count, with at most two legacy skills', () => {
    let p = { ...brawler(), level: 50 }
    p = learnAll(p, rpgTreeNodes('greatsword').filter((n) => n.variant === null).map((n) => n.id))
    const refs = p.tree.slice(0, 10)
    expect(rpgActiveSlots(50)).toBe(10)
    expect(validateRpgLoadout(p, refs)).toBe(true)
    expect(validateRpgLoadout(p, [...refs, refs[0]!])).toBe(false)
    expect(validateRpgLoadout(p, [{ tier: 1, id: 'spear.fire.1' }])).toBe(false)
    const promoted = promoteRpgOutfit(p, refs.slice(0, 2), true).profile
    expect(promoted.legacy).toEqual(refs.slice(0, 2))
    expect(validateRpgLoadout(promoted, refs.slice(0, 2))).toBe(true)
    expect(() => promoteRpgOutfit(p, refs.slice(0, 3), true)).toThrow(/legacy/)
  })
})
