// Synthetic outfit-only tests for docs/design/uma-rpg.md (T089).
import { describe, expect, it } from 'vitest'
import type { Aptitudes, Stats } from '../types'
import {
  eligibleRpgCells, enrollRpgOutfit, grantRpgExp, promoteRpgOutfit, projectRpgStats, rpgActiveSlots,
  rpgAffinities, rpgExpToNext, rpgLifetimeLevels, rpgSignatureMagnitude,
  rpgTreePointsEarned, spendRpgTreePoint, validateRpgLoadout, type RpgSkillRef,
} from './rules'

const base: Stats = { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 }
const growth: Stats = { speed: 0.2, stamina: 0.1, power: 0, guts: 0, wit: 0.3 }
const aptitude = (): Aptitudes => ({
  surface: { turf: 'G', dirt: 'A' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'B' },
  strategy: { front: 'A', pace: 'A', late: 'B', end: 'G' },
})
const source = () => ({ id: 'invented-outfit', baseStats: { ...base }, growthRates: { ...growth }, aptitudes: aptitude() })
const enroll = () => enrollRpgOutfit({
  outfit: source(), contentVersion: 'synthetic-v1', style: 'pace', weapon: 'spear', defaultSignature: 'fire',
})
const ref = (tier: number, element: RpgSkillRef['element'], depth: number, branch: RpgSkillRef['branch']): RpgSkillRef =>
  ({ tier, weapon: 'spear', element, depth, branch })

describe('RPG enrollment and frozen projections', () => {
  it('locks one chosen A style/weapon and freezes content inputs', () => {
    const outfit = source()
    const profile = enrollRpgOutfit({ outfit, contentVersion: 'synthetic-v1', style: 'front',
      weapon: 'greatsword', defaultSignature: 'light' })
    outfit.baseStats.speed = 999
    outfit.growthRates.speed = 1
    outfit.aptitudes.strategy.front = 'G'
    expect(profile.style).toBe('front')
    expect(profile.weapon).toBe('greatsword')
    expect(profile.baseStats.speed).toBe(100)
    expect(profile.growthRates.speed).toBe(0.2)
    expect(profile.sourceAptitudes.strategy.front).toBe('A')
    expect(profile.sourceContentVersion).toBe('synthetic-v1')
    expect(projectRpgStats(profile).atk).toBe(20)
    expect(projectRpgStats(profile).matk).toBe(20)
  })

  it('rejects no-A style, wrong weapon, missing growth, malformed aptitude and ineligible signature', () => {
    const noA = source()
    noA.aptitudes.strategy.front = 'B'
    noA.aptitudes.strategy.pace = 'B'
    expect(() => enrollRpgOutfit({ outfit: noA, contentVersion: 'v', style: 'pace',
      weapon: 'spear', defaultSignature: 'fire' })).toThrow(/no A/)
    expect(() => enrollRpgOutfit({ outfit: source(), contentVersion: 'v', style: 'pace',
      weapon: 'tome', defaultSignature: 'fire' })).toThrow(/Weapon/)
    expect(() => enrollRpgOutfit({ outfit: source(), contentVersion: 'v', style: 'late',
      weapon: 'wizard-staff', defaultSignature: 'fire' })).toThrow(/Style/)
    expect(() => enrollRpgOutfit({ outfit: source(), contentVersion: 'v', style: 'pace',
      weapon: 'spear', defaultSignature: 'lightning' })).not.toThrow() // B Long supplies Lightning.
    const noDistance = source()
    noDistance.aptitudes.distance = { sprint: 'C', mile: 'C', medium: 'C', long: 'C' }
    expect(() => enrollRpgOutfit({ outfit: noDistance, contentVersion: 'v', style: 'pace',
      weapon: 'spear', defaultSignature: 'fire' })).toThrow(/Signature/)
    const missingGrowth = source()
    delete (missingGrowth.growthRates as Partial<Stats>).speed
    expect(() => enrollRpgOutfit({ outfit: missingGrowth, contentVersion: 'v', style: 'pace',
      weapon: 'spear', defaultSignature: 'fire' })).toThrow(/growth/)
    const malformed = source()
    malformed.aptitudes.distance.mile = 'Z' as Aptitudes['distance']['mile']
    expect(() => enrollRpgOutfit({ outfit: malformed, contentVersion: 'v', style: 'pace',
      weapon: 'spear', defaultSignature: 'fire' })).toThrow(/aptitude/)
  })

  it('gives A precedence over B where distances overlap, independent of surface', () => {
    const affinities = rpgAffinities(aptitude())
    expect(affinities).toEqual({ fire: 'A', ice: 'A', lightning: 'B', light: 'A', dark: 'A' })
    const changed = aptitude()
    changed.surface = { turf: 'A', dirt: 'G' }
    expect(rpgAffinities(changed)).toEqual(affinities)
    expect(eligibleRpgCells(enroll()).map(({ weapon, element, maxDepth }) => [weapon, element, maxDepth]))
      .toEqual([['spear', 'fire', 5], ['spear', 'ice', 5], ['spear', 'lightning', 3],
        ['spear', 'light', 5], ['spear', 'dark', 5]])
  })

  it('projects deterministic lifetime stats without consulting scenarios and grows at promotion', () => {
    const profile = enroll()
    expect(projectRpgStats(profile)).toMatchObject({ speed: 20, atk: 20, matk: 20,
      stamina: 18, power: 16, guts: 14, wit: 12, hp: 240, mp: 56, mdef: 14 })
    const max = { ...profile, level: 50 }
    const after = { ...profile, tier: 2, level: 1 }
    expect(projectRpgStats(max).speed).toBe(108)
    expect(projectRpgStats(after).speed).toBe(110)
    for (const key of ['speed', 'stamina', 'power', 'guts', 'wit', 'hp', 'mp'] as const) {
      expect(projectRpgStats(after)[key]).toBeGreaterThanOrEqual(projectRpgStats(max)[key])
    }
    expect(projectRpgStats(after)).toEqual(projectRpgStats({ ...after }))
    expect(rpgLifetimeLevels(2, 1)).toBe(50)
  })
})

describe('RPG tier EXP and skill choices', () => {
  it('crosses each level once, banks at 50, promotes explicitly and settles the bank', () => {
    const initial = enroll()
    const one = grantRpgExp(initial, rpgExpToNext(1))
    expect(one.levelsCrossed).toEqual([2])
    expect(one.profile).toMatchObject({ tier: 1, level: 2, exp: 0 })
    expect(initial.level).toBe(1)
    const tierCost = Array.from({ length: 49 }, (_, index) => rpgExpToNext(index + 1))
      .reduce((sum, value) => sum + value, 0)
    const atCap = grantRpgExp(initial, tierCost + rpgExpToNext(1) + rpgExpToNext(2) + 7)
    expect(atCap.profile).toMatchObject({ tier: 1, level: 50,
      exp: rpgExpToNext(1) + rpgExpToNext(2) + 7 })
    expect(atCap.levelsCrossed).toHaveLength(49)
    expect(() => promoteRpgOutfit(atCap.profile, [])).toThrow(/Unspent/)
    const promoted = promoteRpgOutfit(atCap.profile, [], true)
    expect(promoted.profile).toMatchObject({ tier: 2, level: 3, exp: 7 })
    expect(promoted.levelsCrossed).toEqual([2, 3])
    expect(promoted.archivedTier).toEqual({ tier: 1, tree: [] })
    expect(() => promoteRpgOutfit(initial, [])).toThrow(/Lv50/)
    expect(() => grantRpgExp({ ...initial, exp: Number.MAX_SAFE_INTEGER }, 1)).toThrow(/overflow/)
  })

  it('earns one point per even local level and rejects illegal spend without mutation', () => {
    let profile = { ...enroll(), level: 50 }
    expect(rpgTreePointsEarned(1)).toBe(0)
    expect(rpgTreePointsEarned(2)).toBe(1)
    expect(rpgTreePointsEarned(3)).toBe(1)
    expect(rpgTreePointsEarned(50)).toBe(25)
    const first = ref(1, 'fire', 1, 'foundation')
    const before = profile
    profile = spendRpgTreePoint(profile, first)
    expect(before.tree).toEqual([])
    expect(profile.tree).toEqual([{ ...first, level: 1 }])
    expect(() => spendRpgTreePoint(profile, ref(1, 'fire', 3, 'multi'))).toThrow(/Previous/)
    expect(() => spendRpgTreePoint(profile, ref(1, 'fire', 2, 'area'))).not.toThrow()
    expect(() => spendRpgTreePoint(profile, ref(1, 'lightning', 4, 'role'))).toThrow(/depth/)
    expect(() => spendRpgTreePoint(profile, { ...first, weapon: 'greatsword' })).toThrow(/Invalid/)
    let levelled = profile
    for (let index = 0; index < 4; index += 1) levelled = spendRpgTreePoint(levelled, first)
    expect(levelled.tree[0]?.level).toBe(5)
    expect(() => spendRpgTreePoint(levelled, first)).toThrow(/mastered/)
    const early = { ...enroll(), level: 9, tree: [{ ...first, level: 1 }] }
    expect(() => spendRpgTreePoint(early, ref(1, 'fire', 2, 'focused'))).toThrow(/gate/)
  })

  it('allows a different preset signature, bounds current and legacy loadouts, and never opens another weapon', () => {
    let profile = { ...enroll(), level: 50 }
    const foundation = ref(1, 'fire', 1, 'foundation')
    const focused = ref(1, 'fire', 2, 'focused')
    profile = spendRpgTreePoint(profile, foundation)
    profile = spendRpgTreePoint(profile, focused)
    expect(validateRpgLoadout(profile, 'ice', [foundation, focused])).toBe(true)
    expect(validateRpgLoadout(profile, 'ice', [foundation, foundation])).toBe(false)
    expect(validateRpgLoadout(profile, 'ice', [{ ...foundation, weapon: 'tome' }])).toBe(false)
    const promoted = promoteRpgOutfit(profile, [foundation, focused], true).profile
    expect(promoted.tree).toEqual([])
    expect(promoted.legacy).toHaveLength(2)
    expect(validateRpgLoadout(promoted, 'ice', [foundation, focused])).toBe(true)
    expect(rpgActiveSlots(1)).toBe(3)
    expect(rpgActiveSlots(50)).toBe(7)
    expect(() => promoteRpgOutfit(profile, [foundation, focused, foundation], true)).toThrow(/legacy/)
    expect(rpgSignatureMagnitude(101, profile, { kind: 'damage', weapon: 'spear', element: 'fire' }, 'fire')).toBe(111)
    expect(rpgSignatureMagnitude(101, profile, { kind: 'healing', weapon: 'spear', element: 'ice' }, 'fire')).toBe(101)
  })
})
