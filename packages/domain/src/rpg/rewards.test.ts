import { describe, expect, it } from 'vitest'
import { grantRpgExp, promoteRpgOutfit, rpgActiveSlots, rpgSkillKey, spendRpgTreePoint, validateRpgLoadout } from './rules'
import { rpgEncounterBaseExp, rpgEncounterExp, rpgLevelReveal, rpgRewardProjection, validRpgRewardInput } from './rewards'
import { syntheticChapterProfiles } from './chapter.synthetic'
const profile = () => syntheticChapterProfiles()[0]!
describe('accepted RPG reward rules', () => {
  it('uses frozen tier-relative levels with positive replay floor, catch-up cap and one rounding', () => {
    const reward = { baseExp: 1619, recommendedTier: 1, recommendedLevel: 11 }
    expect([1, 5, 11, 30, 50].map((level) => rpgEncounterExp(reward, { tier: 1, level }))).toEqual([2024, 1862, 1619, 850, 405])
    expect(rpgEncounterExp(reward, { tier: 2, level: 11 })).toBe(405)
    expect(rpgEncounterExp({ ...reward, recommendedTier: 2 }, { tier: 1, level: 1 })).toBe(2429)
    expect(rpgEncounterExp({ ...reward, baseExp: 1 }, { tier: 99, level: 50 })).toBe(1)
    expect(rpgEncounterExp({ ...reward, baseExp: 0 }, { tier: 1, level: 1 })).toBe(0)
  })
  it('rejects unsafe or unsupported reward inputs', () => {
    const reward = { baseExp: 100, recommendedTier: 1, recommendedLevel: 1 }
    for (const invalid of [{ ...reward, extra: true }, { ...reward, baseExp: -1 }, { ...reward, baseExp: 1_000_001 },
      { ...reward, recommendedLevel: 51 }, { ...reward, recommendedTier: NaN }]) {
      expect(validRpgRewardInput(invalid)).toBe(false)
      expect(() => rpgEncounterExp(invalid, profile())).toThrow()
    }
  })
  it('reveals every crossed level, five exact stats, points, slots and bank from immutable enrollment inputs', () => {
    const p = { ...profile(), level: 9 }
    const grant = rpgRewardProjection(p, 5000)
    const reveal = rpgLevelReveal({ ...grant.profile, level: 50 }, grant.member)
    expect(reveal.levels).toEqual(Array.from({ length: grant.profile.level - 9 }, (_, i) => i + 10))
    expect(Object.keys(reveal.deltas)).toEqual(['speed', 'stamina', 'power', 'guts', 'wit'])
    expect(Object.values(reveal.deltas).every((n) => n > 0)).toBe(true)
    expect(reveal.beforeSlots).toBe(3)
    expect(reveal.afterSlots).toBe(rpgActiveSlots(grant.profile.level))
    expect(reveal.points).toBe(2 * (Math.min(grant.profile.level, 45) - 9))
  })
  it('banks overflow and applies it across two explicit promotions without changing class or losing mastery', () => {
    let p = { ...profile(), level: 49, exp: 850 }
    p = grantRpgExp(p, 2134).profile
    expect(p.level).toBe(50); expect(p.exp).toBe(2080)
    const first = promoteRpgOutfit(p, p.tree, true)
    expect(first.profile).toMatchObject({ tier: 2, level: 11, exp: 0, tree: [] })
    expect(first.archivedTier.tree).toEqual(p.tree)
    expect(validateRpgLoadout(first.profile, 'fire', p.tree)).toBe(true)
    const second = promoteRpgOutfit({ ...first.profile, level: 50, exp: 2080 }, first.profile.legacy, true)
    expect(second.profile).toMatchObject({ tier: 3, level: 11, exp: 0, style: p.style, weapon: p.weapon })
    expect(second.profile.legacy.map(rpgSkillKey)).toEqual(p.tree.map(rpgSkillKey))
  })
  it('retains B-side usefulness while refusing capstones, slot overflow, unlearned or duplicate skills', () => {
    const p = { ...profile(), level: 50, affinities: { fire: 'B' as const } }
    const ref = { tier: 1, weapon: p.weapon, element: 'fire' as const, depth: 1, branch: 'foundation' as const }
    expect(() => spendRpgTreePoint(p, { ...ref, depth: 4, branch: 'role' })).toThrow(/Element/)
    expect(validateRpgLoadout(p, 'fire', [ref, ref])).toBe(false)
    expect(validateRpgLoadout(p, 'fire', [{ ...ref, depth: 2, branch: 'area' }])).toBe(false)
    expect(rpgEncounterBaseExp(50, 'boss')).toBeGreaterThan(0)
  })
})
