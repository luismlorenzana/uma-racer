// The session formula and every card effect kind it reads (D382; 05 §3.3, §3.5), on invented cards.
import { describe, expect, it } from 'vitest'
import { flat, stats, testCard, unique } from '../__fixtures__/build'
import { cardRaceBonus } from '../cards'
import { hintInterval, hintLevel, initialBond } from './bond'
import { deckWideTerms, DROPPED_UNIQUES, LONE_DECK, resolveEffects, staticEffects, type CardSituation, type DeckFacts } from './effects'
import { cutCost, facilityRow, pipCost, URA_FACILITIES } from './facilities'
import { sessionCard, sessionCuts, sessionGain, sessionScaleAt, type SessionCard } from './session'
import type { SupportCardTemplate } from '../content'

const at = (over: Partial<CardSituation> = {}): CardSituation =>
  ({ branch: 'speed', bond: 0, level: 1, present: 1, friendshipPip: false, sessions: 0, deck: LONE_DECK, ...over })
const SPEED_1 = facilityRow('speed', 1) // Speed 11, Power 6, 4 SP
const gain = (cards: readonly SessionCard[], over: { growth?: ReturnType<typeof flat>; scale?: number; base?: typeof SPEED_1 } = {}) =>
  sessionGain({ base: over.base ?? SPEED_1, cards, growth: over.growth ?? flat(0), scale: over.scale ?? 1 })
const card = (effects: Record<number, number>, extra: Partial<SupportCardTemplate> = {}) => testCard('x', 'speed', effects, extra)
const one = (effects: Record<number, number>, situation: Partial<CardSituation> = {}, extra: Partial<SupportCardTemplate> = {}) =>
  sessionCard(card(effects, extra), at(situation))

describe("05 §3.5's worked example (made-up numbers)", () => {
  // A Speed pip at level 3 with a made-up URA-like base: Speed 12, Power 6, 4 SP, 23 drills. Growth Speed +20%.
  const base = { stats: stats(12, 0, 6, 0, 0), sp: 4 }
  const growth = stats(0.2, 0, 0, 0, 0)
  const A = testCard('a', 'speed', { 1: 25, 2: 30, 3: 1, 8: 10, 30: 1 })
  const B = testCard('b', 'speed', { 1: 30, 5: 1, 8: 5 })
  const C = testCard('c', 'wit', { 8: 15, 1: 35, 28: 15 })
  const run = (cards: [SupportCardTemplate, number][]) => {
    const placed = cards.map(([c, bond]) => ({ card: c, at: at({ bond, level: 3, present: cards.length }) }))
    return {
      gain: sessionGain({ base, cards: placed.map((p) => sessionCard(p.card, p.at)), growth, scale: 1 }),
      drills: cutCost(23, sessionCuts(placed, 'speed').energyCut),
    }
  }

  it('pays 17 Speed, 7 Power and 4 SP with no cards (mood ×1.2 only)', () => {
    expect(run([])).toEqual({ gain: { stats: stats(17, 0, 7, 0, 0), sp: 4 }, drills: 23 })
  })

  it('pays 36 / 16 / 11 for 20 drills with A, B and C: friendship from A only, × 2.3546', () => {
    expect(run([[A, 85], [B, 60], [C, 90]])).toEqual({ gain: { stats: stats(36, 0, 16, 0, 0), sp: 11 }, drills: 20 })
  })

  it('pays 47 / 21 / 15 once B reaches bond 80', () => {
    expect(run([[A, 85], [B, 80], [C, 90]]).gain).toEqual({ stats: stats(47, 0, 21, 0, 0), sp: 15 })
  })

  it('pays 31 / 13 / 9 for 23 drills with C posted to Wit instead', () => {
    expect(run([[A, 85], [B, 60]])).toEqual({ gain: { stats: stats(31, 0, 13, 0, 0), sp: 9 }, drills: 23 })
  })
})

describe('the formula, one effect kind at a time (Speed level 1: 11 Speed, 6 Power, 4 SP)', () => {
  it('fixes mood at Great: +20% with no cards', () => {
    expect(gain([])).toEqual({ stats: stats(13, 0, 7, 0, 0), sp: 4 })
  })

  it('adds 5% a card present (headcount)', () => {
    expect(gain([one({})]).stats.speed).toBe(13) // 11 × 1.26 = 13.86
    expect(gain([one({}), one({})]).stats.speed).toBe(14) // 11 × 1.32 = 14.52
    expect(gain([one({}), one({}), one({})]).stats.speed).toBe(15) // 11 × 1.38 = 15.18
  })

  it('multiplies Friendship for an own-type card at bond 80 or more, never off type or for a Friend card', () => {
    expect(gain([one({ 1: 20 }, { bond: 80 })])).toEqual({ stats: stats(16, 0, 9, 0, 0), sp: 6 }) // × 1.512
    expect(gain([one({ 1: 20 }, { bond: 79 })])).toEqual({ stats: stats(13, 0, 7, 0, 0), sp: 5 })
    expect(one({ 1: 20 }, { bond: 100, branch: 'power' }).inFriendship).toBe(false)
    expect(sessionCard(testCard('f', 'friend', { 1: 20 }), at({ bond: 100, branch: 'wit' })).inFriendship).toBe(false)
  })

  it('multiplies a unique Friendship Bonus on its own, not added to the card\'s', () => {
    const both = one({ 1: 50 }, { bond: 80 }, { uniqueEffect: unique({ type: 1, value: 50 }) })
    expect(both).toMatchObject({ friendship: 0.5, uniqueFriendship: 0.5 })
    expect(gain([both]).stats.speed).toBe(31) // 11 × 1.26 × 1.5 × 1.5 = 31.19 (added, it would be 27)
    expect(gain([one({}, { bond: 80 }, { uniqueEffect: unique({ type: 1, value: 50 }) })]).stats.speed).toBe(20) // 11 × 1.26 × 1.5
  })

  it('scales the Great mood by Mood Effect', () => {
    expect(gain([one({ 2: 50 })])).toEqual({ stats: stats(15, 0, 8, 0, 0), sp: 5 }) // × 1.3 × 1.05 = 1.365
  })

  it('adds Stat Bonus flat, only to the stats the facility trains', () => {
    expect(gain([one({ 3: 2, 7: 3 })]).stats).toEqual(stats(16, 0, 7, 0, 0)) // (11 + 2) × 1.26; no Wit at Speed
    const atWit = sessionGain({ base: facilityRow('wit', 1), cards: [one({ 3: 2, 7: 3 }, { branch: 'wit' })], growth: flat(0), scale: 1 })
    expect(atWit.stats).toEqual(stats(5, 0, 0, 0, 16)) // (2 + 2) × 1.26, (10 + 3) × 1.26
  })

  it('sums Training Effectiveness', () => {
    expect(gain([one({ 8: 20 })]).stats.speed).toBe(16) // 11 × 1.2 × 1.2 × 1.05 = 16.63
    expect(gain([one({ 8: 10 }), one({ 8: 10 })]).stats.speed).toBe(17) // 11 × 1.2 × 1.2 × 1.1 = 17.42
  })

  it('applies growth to stats and not to SP', () => {
    expect(gain([], { growth: stats(0.2, 0, 0.1, 0, 0) })).toEqual({ stats: stats(15, 0, 7, 0, 0), sp: 4 }) // 15.84, 7.92
  })

  it('adds Skill Point Bonus to the base SP', () => {
    expect(gain([one({ 30: 2 })]).sp).toBe(7) // (4 + 2) × 1.26 = 7.56
  })

  it('scales everything by s(T), which is 1 at URA Finale and unset elsewhere', () => {
    expect(sessionScaleAt(1)).toBe(1)
    expect(() => sessionScaleAt(2)).toThrow(/isn't set yet/)
    expect(gain([], { scale: 2 }).stats.speed).toBe(26)
  })

  it('floors each stat as the original does, whole products included', () => {
    expect(gain([], { base: { stats: stats(15, 0, 0, 0, 0), sp: 5 } })).toEqual({ stats: stats(18, 0, 0, 0, 0), sp: 6 })
  })

  it('cuts drills by Energy Cost Reduction (rounded up) and by Wit Friendship Recovery at Wit in friendship', () => {
    expect(pipCost(1)).toBe(20)
    expect(sessionCuts([{ card: card({ 28: 15 }), at: at() }], 'speed')).toEqual({ energyCut: 0.15, recovery: 0 })
    expect(pipCost(3, 0.15)).toBe(21) // ⌈24 × 0.85⌉ = ⌈20.4⌉
    const wit = testCard('w', 'wit', { 31: 4 })
    expect(sessionCuts([{ card: wit, at: at({ branch: 'wit', bond: 80 }) }], 'wit').recovery).toBe(4)
    expect(sessionCuts([{ card: wit, at: at({ branch: 'wit', bond: 79 }) }], 'wit').recovery).toBe(0)
    expect(pipCost(1, 0, 4)).toBe(16)
    expect(pipCost(1, 2, 50)).toBe(1)
  })

  it('reads Initial stats, Initial SP, the gauge, Hint Levels, Hint Frequency and Race Bonus outside sessions', () => {
    const c = card({ 9: 20, 13: 10, 32: 30, 14: 25, 17: 2, 18: 25, 15: 5 })
    expect(staticEffects(c).totals).toMatchObject({ 9: 20, 13: 10, 32: 30 })
    expect(initialBond(c)).toBe(25)
    expect(hintLevel(c)).toBe(3)
    expect(hintInterval(c)).toBe(16) // round(20 / 1.25)
    expect(hintInterval(card({}))).toBe(20)
    expect(cardRaceBonus(c)).toBe(0.05)
  })

  it('drops Specialty Priority, Fan Bonus, Event Recovery and Effectiveness and Failure Protection', () => {
    expect(one({ 16: 30, 19: 100, 25: 50, 26: 40, 27: 30 })).toEqual(one({}))
  })
})

describe('unique effects, translated (05 §3.3)', () => {
  const withUnique = (type: number, value: number, params: number[], over: Partial<CardSituation> = {}, effects: Record<number, number> = {}) =>
    resolveEffects(card(effects, { uniqueEffect: unique({ type, value, params }) }), at(over))
  const deck = (over: Partial<DeckFacts>): DeckFacts => ({ ...LONE_DECK, ...over })

  it('101: its effects switch on at its bond, one pair or two; Friendship there multiplies apart; 41 is every stat', () => {
    expect(withUnique(101, 70, [4, 3, 30, 2], { bond: 69 }).totals).toEqual({})
    expect(withUnique(101, 70, [4, 3, 30, 2], { bond: 70 }).totals).toEqual({ 4: 3, 30: 2 })
    expect(withUnique(101, 90, [1, 12], { bond: 95 }).uniqueFriendship).toBe(12)
    expect(withUnique(101, 95, [30, 3, 41, 2], { bond: 95 }).totals).toEqual({ 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 30: 3 })
  })

  it('102: Training Effectiveness at its bond, only posted off its own type', () => {
    expect(withUnique(102, 70, [12], { bond: 70, branch: 'power' }).totals).toEqual({ 8: 12 })
    expect(withUnique(102, 70, [12], { bond: 70, branch: 'speed' }).totals).toEqual({})
    expect(withUnique(102, 70, [12], { bond: 69, branch: 'power' }).totals).toEqual({})
  })

  it('103: Training Effectiveness with enough card types in the deck', () => {
    expect(withUnique(103, 4, [7], { deck: deck({ types: ['speed', 'stamina', 'power', 'friend'] }) }).totals).toEqual({ 8: 7 })
    expect(withUnique(103, 4, [7], { deck: deck({ types: ['speed', 'speed', 'power', 'friend'] }) }).totals).toEqual({})
  })

  it('105: Initial stats for every deck card of each type; Friend and Group cards give some to every stat', () => {
    const c = card({}, { uniqueEffect: unique({ type: 105, value: 7, params: [3] }) })
    expect(staticEffects(c, deck({ types: ['speed', 'speed', 'stamina', 'friend'] })).totals).toEqual({ 9: 17, 10: 10, 11: 3, 12: 3, 13: 3 })
  })

  it('106: Friendship per session in its branch while in friendship, up to its count', () => {
    expect(withUnique(106, 4, [1, 2], { bond: 80, sessions: 3 }).uniqueFriendship).toBe(6)
    expect(withUnique(106, 4, [1, 2], { bond: 80, sessions: 8 }).uniqueFriendship).toBe(8)
    expect(withUnique(106, 4, [1, 2], { bond: 79, sessions: 8 }).uniqueFriendship).toBe(0)
  })

  it('109: one per so much bond across the deck, up to six full tracks', () => {
    expect(withUnique(109, 8, [40], { deck: deck({ bondTotal: 200 }) }).totals).toEqual({ 8: 5 })
    expect(withUnique(109, 8, [40], { deck: deck({ bondTotal: 650 }) }).totals).toEqual({ 8: 15 })
  })

  it('110: per other card posted alongside', () => {
    expect(withUnique(110, 8, [4], { present: 3 }).totals).toEqual({ 8: 8 })
    expect(withUnique(110, 8, [4], { present: 1 }).totals).toEqual({})
  })

  it('111: per level of the pip', () => {
    expect(withUnique(111, 8, [3], { level: 4 }).totals).toEqual({ 8: 12 })
  })

  it('113: on a friendship pip, whoever is in friendship there', () => {
    expect(withUnique(113, 2, [45], { friendshipPip: true }).totals).toEqual({ 2: 45 })
    expect(withUnique(113, 2, [45], { friendshipPip: false }).totals).toEqual({})
  })

  it('115: a deck-wide term every deck card gets, such as a higher starting gauge', () => {
    const giver = card({}, { uniqueEffect: unique({ type: 115, value: 14, params: [6] }) })
    expect(deckWideTerms([giver, card({})])).toEqual({ 14: 6 })
    expect(initialBond(card({ 14: 30 }), deck({ deckWide: { 14: 6 } }))).toBe(36)
    expect(initialBond(card({ 14: 98 }), deck({ deckWide: { 14: 6 } }))).toBe(100)
  })

  it('117: scales with the tree\'s combined facility level, up to its top', () => {
    expect(withUnique(117, 8, [25, 16], { deck: deck({ combinedLevel: 15 }) }).totals).toEqual({ 8: 9 })
    expect(withUnique(117, 8, [25, 16], { deck: deck({ combinedLevel: 25 }) }).totals).toEqual({ 8: 16 })
  })

  it('120: at its bond, Stat Bonus per deck card of each type (up to its cap); Friend and Group cards give SP', () => {
    const types = deck({ types: ['speed', 'speed', 'speed', 'power', 'friend', 'group'] })
    expect(withUnique(120, 2, [70, 1, 3], { bond: 70, deck: types }).totals).toEqual({ 3: 6, 5: 2, 30: 2 })
    expect(withUnique(120, 2, [70, 1, 3], { bond: 69, deck: types }).totals).toEqual({})
  })

  it('a plain unique effect is always on; a unique above the card\'s level is off', () => {
    expect(withUnique(8, 10, []).totals).toEqual({ 8: 10 })
    const late = card({}, { uniqueEffect: { level: 55, description: null, effects: [{ type: 8, value: 10, params: [] }] } })
    expect(resolveEffects(late, at()).totals).toEqual({})
  })

  it.each(DROPPED_UNIQUES.map((type) => [type]))('%s is dropped: it changes nothing', (type) => {
    const resolved = withUnique(type, 8, [5, 5, 5, 5], { bond: 100, friendshipPip: true, sessions: 20, level: 5, present: 5 })
    expect(resolved).toEqual({ totals: {}, uniqueFriendship: 0 })
  })
})

describe('the facility table', () => {
  it('is URA Finale\'s, levels 1–5, as cited in D382', () => {
    expect(facilityRow('speed', 1)).toEqual({ stats: stats(11, 0, 6, 0, 0), sp: 4 })
    expect(facilityRow('stamina', 1)).toEqual({ stats: stats(0, 10, 0, 6, 0), sp: 4 })
    expect(facilityRow('power', 1)).toEqual({ stats: stats(0, 6, 9, 0, 0), sp: 4 })
    expect(facilityRow('guts', 1)).toEqual({ stats: stats(5, 0, 5, 8, 0), sp: 4 })
    expect(facilityRow('wit', 1)).toEqual({ stats: stats(2, 0, 0, 0, 10), sp: 5 })
    expect(facilityRow('speed', 5)).toEqual({ stats: stats(15, 0, 8, 0, 0), sp: 4 })
    expect(facilityRow('stamina', 5)).toEqual({ stats: stats(0, 14, 0, 8, 0), sp: 4 })
    expect(facilityRow('power', 5)).toEqual({ stats: stats(0, 8, 13, 0, 0), sp: 4 })
    expect(facilityRow('guts', 5)).toEqual({ stats: stats(6, 0, 5, 13, 0), sp: 4 })
    expect(facilityRow('wit', 5)).toEqual({ stats: stats(4, 0, 0, 0, 14), sp: 5 })
    for (const rows of Object.values(URA_FACILITIES)) expect(rows).toHaveLength(5)
    expect(() => facilityRow('speed', 6)).toThrow(RangeError)
  })

  it('prices pips 20, 22, 24, 26, 28 by level', () => {
    expect([1, 2, 3, 4, 5].map((level) => pipCost(level))).toEqual([20, 22, 24, 26, 28])
  })
})
