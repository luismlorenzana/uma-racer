// Bond tracks and their stops, and skills: the library, costs, hint levels, golds and the SP cap (D382), on invented
// cards and skills.
import { describe, expect, it } from 'vitest'
import { bond, flat, stats, testCard, testCareer, testSkill, testUma, unique } from '../__fixtures__/build'
import { isRefusal, type Refusal } from '../save/registry'
import type { CareerRecord } from '../save/records'
import type { SupportCardTemplate } from '../content'
import { bondGain, bondStops, bondToFill, extraBond, pourBond, trackGifts } from './bond'
import { hintRewards, spEarned, type BuildView } from './derive'
import { buySkill, HINT_DISCOUNTS, MAX_SKILLS, skillCost, skillLibrary, skillPoints } from './skills'

const ok = <T extends object>(value: T | Refusal): T => {
  if (isRefusal(value)) throw new Error(`${value.code}: ${value.reason}`)
  return value
}
const mapOf = <T extends { id: string }>(...items: T[]) => new Map(items.map((item) => [item.id, item]))

// H: gauge 20, Hint Frequency 25% (a hint every round(20 / 1.25) = 16), Hint Levels 2 (hints at level 3). Each hint
// pays Speed +3 and 5 SP; a reward gated above the card's level never pays.
const H = testCard('h', 'speed', { 14: 20, 18: 25, 17: 2 }, {
  hintSkillIds: ['h1', 'h2', 'h3'],
  hintOthers: [{ type: 1, value: 3, minLevel: null }, { type: 30, value: 5, minLevel: null }, { type: 2, value: 9, minLevel: 60 }],
  eventSkillIds: ['e-gold'],
})
const cards = mapOf(H)
const career = (extra: Partial<CareerRecord> = {}) =>
  testCareer('uma-1', { deck: ['h'], posts: { h: 'speed' }, wallet: { drills: flat(0), bond: 200, sp: 0 }, ...extra })

describe('bond tracks', () => {
  it('start at the gauge and pay a hint at every multiple of the interval, in list order, at 1 + Hint Levels', () => {
    const first = ok(pourBond(career(), {}, cards, 'h', 30))
    expect(first.receipt).toEqual({ cardId: 'h', spent: 30, value: 50, hints: 2 }) // stops at 32 and 48
    expect(first.track).toEqual({ umaId: 'uma-1', tier: 1, cardId: 'h', value: 50, hints: 2 })
    expect(first.career.wallet.bond).toBe(170)
    expect(trackGifts(first.track, H)).toEqual({
      skills: [{ skillId: 'h1', levels: 3 }, { skillId: 'h2', levels: 3 }],
      stats: stats(6, 0, 0, 0, 0),
      sp: 10,
    })
    const second = ok(pourBond(first.career, { 'uma-1:1:h': first.track }, cards, 'h', 80))
    expect(second.receipt).toEqual({ cardId: 'h', spent: 50, value: 100, hints: 3 }) // 64, 80, 96; only what fills it
    expect(trackGifts(second.track, H).skills.map((gift) => gift.skillId)).toEqual(['h1', 'h2', 'h3', 'h1', 'h2', 'e-gold'])
    expect(pourBond(second.career, { 'uma-1:1:h': second.track }, cards, 'h', 1)).toMatchObject({ code: 'bond-full', reason: '[Card h]\'s bond is full.' })
  })

  it('lists its stops: hints, friendship at 80 and the event skills at 100', () => {
    expect(bondStops(H)).toEqual([
      { at: 16, kind: 'hint' }, { at: 32, kind: 'hint' }, { at: 48, kind: 'hint' }, { at: 64, kind: 'hint' },
      { at: 80, kind: 'hint' }, { at: 80, kind: 'friendship' }, { at: 96, kind: 'hint' }, { at: 100, kind: 'events' },
    ])
  })

  it('skips the stops a track\'s starting gauge already passed', () => {
    const high = testCard('hi', 'speed', { 14: 35, 18: 25 }, { hintSkillIds: ['x'] })
    const poured = ok(pourBond(career({ deck: ['hi'], posts: { hi: 'speed' } }), {}, mapOf(high), 'hi', 5))
    expect(poured.receipt).toMatchObject({ value: 40, hints: 0 })
  })

  it('pours only into deck cards, from the wallet', () => {
    expect(pourBond(career({ deck: [] }), {}, cards, 'h', 5)).toMatchObject({ code: 'not-in-deck' })
    expect(pourBond(career({ wallet: { drills: flat(0), bond: 4, sp: 0 } }), {}, cards, 'h', 5))
      .toMatchObject({ code: 'not-enough-bond', reason: 'She has 4 Bond, not 5.' })
  })

  it('multiplies a pour by the extra-bond unique: (7 + its extra) ÷ 7, a larger extra at its own branch', () => {
    const F = testCard('f', 'friend', {}, { uniqueEffect: unique({ type: 121, value: 2, params: [3] }) })
    const W = testCard('w', 'wit', {})
    const withF = mapOf(H, F, W)
    const deck = career({ deck: ['h', 'f', 'w'], posts: { h: 'speed', f: 'wit', w: 'wit' } })
    expect(extraBond(deck, 'h', withF)).toBe(2)
    expect(extraBond(deck, 'w', withF)).toBe(3)
    expect(extraBond(deck, 'f', withF)).toBe(3)
    expect(extraBond(career(), 'h', cards)).toBe(0)
    expect([bondGain(7, 0), bondGain(7, 2), bondGain(7, 3)]).toEqual([7, 9, 10])
    expect(ok(pourBond(deck, {}, withF, 'w', 7)).receipt).toMatchObject({ spent: 7, value: 10 })
    expect(bondToFill(5, 3)).toBe(4)
    expect(ok(pourBond(deck, { 'uma-1:1:w': bond('w', 95) }, withF, 'w', 10)).receipt).toMatchObject({ spent: 4, value: 100 })
  })

  it('keys a track by Uma, tier and card', () => {
    const other = ok(pourBond(career(), { 'uma-2:1:h': bond('h', 90, 0, 'uma-2') }, cards, 'h', 10))
    expect(other.track).toMatchObject({ umaId: 'uma-1', value: 30 })
  })
})

describe('skills', () => {
  const her = testUma('uma-1', { innateSkillIds: ['innate'], eventSkillIds: [] })
  const white = testSkill('h1', 100)
  const skills = mapOf(
    testSkill('skill-awake-w', 120), testSkill('skill-awake-g', 200, { kind: 'gold', normalSkillId: 'skill-awake-w' }),
    testSkill('innate', 80), testSkill('skill-unique', null, { kind: 'unique' }),
    white, testSkill('h2', 155), testSkill('h3', 90),
    testSkill('e-gold', 300, { kind: 'gold', normalSkillId: 'e-white' }), testSkill('e-white', 110),
    testSkill('mute', 50, { conditions: [{ precondition: null, condition: null, baseTime: 0, cooldown: null, effects: [{ type: 27, value: 100, target: 9 }] }] }),
  )
  const full = { 'uma-1:1:h': { umaId: 'uma-1', tier: 1 as const, cardId: 'h', value: 100, hints: 5 } }
  const view = (bonds: BuildView['bonds'] = full): BuildView => ({ uma: her, cards, bonds })
  const withSp = (sp: number, extra: Partial<CareerRecord> = {}) => career({ wallet: { drills: flat(0), bond: 0, sp }, ...extra })

  it('cost round(costSp × (1 − d)) with d = 0, 10, 20, 30, 35, 40% at hint levels 0–5', () => {
    expect([0, 1, 2, 3, 4, 5].map((level) => skillCost(white, level))).toEqual([100, 90, 80, 70, 65, 60])
    expect(HINT_DISCOUNTS).toEqual([0, 0.1, 0.2, 0.3, 0.35, 0.4])
    expect(skillCost(testSkill('odd', 155), 4)).toBe(101)
    expect(skillCost(white, 9)).toBe(60)
    expect(skillCost(testSkill('free', null), 0)).toBeNull()
  })

  it('make her library: her own skills (not her unique), then every hinted skill, hint levels adding up to 5; a gold brings its white', () => {
    expect(skillLibrary(career(), her, cards, full, skills)).toEqual([
      { skillId: 'skill-awake-w', hintLevel: 0, source: 'own' },
      { skillId: 'skill-awake-g', hintLevel: 0, source: 'own' },
      { skillId: 'innate', hintLevel: 0, source: 'own' },
      { skillId: 'h1', hintLevel: 5, source: 'hint' }, // 3 + 3, capped
      { skillId: 'h2', hintLevel: 5, source: 'hint' },
      { skillId: 'h3', hintLevel: 3, source: 'hint' },
      { skillId: 'e-gold', hintLevel: 3, source: 'hint' },
      { skillId: 'e-white', hintLevel: 0, source: 'hint' },
    ])
    expect(skillLibrary(career(), her, cards, {}, skills).map((entry) => entry.skillId)).toEqual(['skill-awake-w', 'skill-awake-g', 'innate'])
  })

  it('buy at the hinted cost, a gold only after its white, within the SP she has and the scenario\'s cap', () => {
    const bought = ok(buySkill(withSp(1000), view(), her, skills, 'h1'))
    expect(bought).toMatchObject({ cost: 60, career: { skills: ['h1'], spSpent: 60 } })
    expect(buySkill(bought.career, view(), her, skills, 'h1')).toMatchObject({ code: 'already-bought' })
    expect(buySkill(withSp(1000), view(), her, skills, 'e-gold')).toMatchObject({ code: 'needs-lower', reason: 'Buy Skill e-white first: Skill e-gold builds on it.' })
    const whiteFirst = ok(buySkill(withSp(1000), view(), her, skills, 'e-white'))
    expect(whiteFirst.cost).toBe(110)
    expect(ok(buySkill(whiteFirst.career, view(), her, skills, 'e-gold')).cost).toBe(210) // 300 × 0.7
    expect(buySkill(withSp(1000), view(), her, skills, 'skill-unique')).toMatchObject({ code: 'unique' })
    expect(buySkill(withSp(1000), view({}), her, skills, 'h1')).toMatchObject({ code: 'not-in-library' })
    expect(buySkill(withSp(1000), view(), her, skills, 'nope')).toMatchObject({ code: 'unknown-skill' })
    expect(buySkill(withSp(10), view(), her, skills, 'h1')).toMatchObject({ code: 'not-enough-sp' })
    expect(buySkill(withSp(5000, { spSpent: 1950 }), view(), her, skills, 'h1')).toMatchObject({ code: 'over-sp-cap', reason: 'That passes this scenario\'s SP cap of 2,000.' })
    const crowded = withSp(5000, { skills: Array.from({ length: MAX_SKILLS }, (_, i) => `k${i}`) })
    expect(buySkill(crowded, view(), her, skills, 'h1')).toMatchObject({ code: 'too-many-skills' })
  })

  it('refuse a skill that does nothing in this game\'s races', () => {
    const mute = { ...full, 'uma-1:1:m': { umaId: 'uma-1', tier: 1 as const, cardId: 'm', value: 40, hints: 1 } }
    const M = testCard('m', 'speed', {}, { hintSkillIds: ['mute'] })
    expect(buySkill(withSp(1000), { uma: her, cards: mapOf(H, M), bonds: mute }, her, skills, 'mute')).toMatchObject({ code: 'does-nothing' })
  })

  it('earn SP from the wallet, the tree, the deck\'s Initial SP and the hint rewards, and spend up to the cap', () => {
    const rich = testCard('r', 'speed', { 32: 40 })
    const v: BuildView = { uma: her, cards: mapOf(H, rich), bonds: full }
    const c = withSp(100, { deck: ['h', 'r'], posts: { h: 'speed', r: 'speed' }, pips: { ...flat(0), wit: 1 } })
    // Wallet 100 + one Wit pip (⌊5 × 1.2⌋ = 6, no card at Wit) + Initial SP 40 + 5 hints × 5 SP.
    expect(hintRewards(c, v)).toEqual({ stats: stats(15, 0, 0, 0, 0), sp: 25 })
    expect(spEarned(c, v)).toBe(171)
    expect(skillPoints({ ...c, spSpent: 50 }, v)).toEqual({ earned: 171, spent: 50, cap: 2000, available: 121 })
    expect(skillPoints({ ...c, wallet: { ...c.wallet, sp: 5000 } }, v)).toMatchObject({ cap: 2000, available: 2000 })
    expect(skillPoints({ ...c, spSpent: 500 }, v).available).toBe(0)
  })
})

describe('a first pour', () => {
  it('starts the track at the card\'s gauge', () => {
    const lone: SupportCardTemplate = testCard('l', 'speed', { 14: 25 })
    expect(ok(pourBond(career({ deck: ['l'], posts: { l: 'speed' } }), {}, mapOf(lone), 'l', 1)).track.value).toBe(26)
  })
})
