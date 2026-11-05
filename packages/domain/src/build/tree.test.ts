// The deck, posting, the tree (order, camps, previews, derived on read) and the racing build (D382), on invented cards.
import { describe, expect, it } from 'vitest'
import { bond, flat, stats, testCard, testCareer, testUma, unique } from '../__fixtures__/build'
import { isRefusal, type Refusal } from '../save/registry'
import type { BondRecord, CareerRecord } from '../save/records'
import type { SupportCardTemplate } from '../content'
import { pourBond } from './bond'
import { BRANCH_SEATS, deckRefusal, postCard, withDeck } from './deck'
import { readDeck, statParts, treeGain, type BuildView } from './derive'
import { careerStats, deriveRacingBuild } from './racing-build'
import { buyCamp, buyPips, campsOpen, previewCamp, previewPip } from './tree'

const ok = <T extends object>(value: T | Refusal): T => {
  if (isRefusal(value)) throw new Error(`${value.code}: ${value.reason}`)
  return value
}
const mapOf = (...cards: SupportCardTemplate[]) => new Map(cards.map((card) => [card.id, card]))

// S: a Speed card with Speed Bonus 1, Training Effectiveness 10%, Friendship 20%, Initial Speed 20, gauge 30, and a
// Speed +3 hint reward. At a Speed pip, unbonded: × 1.2 × 1.1 × 1.05 = 1.386.
const S = testCard('s', 'speed', { 1: 20, 3: 1, 8: 10, 9: 20, 14: 30 }, { hintSkillIds: ['h1', 'h2'], hintOthers: [{ type: 1, value: 3, minLevel: null }] })
const uma = testUma()
const cards = mapOf(S)
const view = (bonds: Readonly<Record<string, BondRecord>> = {}, u = uma): BuildView => ({ uma: u, cards, bonds })
const career = (extra: Partial<CareerRecord> = {}): CareerRecord =>
  testCareer('uma-1', { deck: ['s'], posts: { s: 'speed' }, wallet: { drills: flat(500), bond: 200, sp: 0 }, ...extra })

describe('the deck', () => {
  const owned = { a: {}, b: {}, late: {} }
  const deckCards = mapOf(testCard('a', 'speed', {}), testCard('b', 'friend', {}), testCard('late', 'wit', {}, { era: 2 }))

  it('holds six owned cards whose era allows the career, in plain words', () => {
    expect(deckRefusal(['a', 'b'], 1, deckCards, owned)).toBeNull()
    expect(deckRefusal(['a', 'a'], 1, deckCards, owned)).toMatchObject({ code: 'duplicate-card' })
    expect(deckRefusal(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 1, deckCards, owned)).toMatchObject({ code: 'deck-too-big', reason: 'A deck holds 6 cards.' })
    expect(deckRefusal(['zz'], 1, deckCards, owned)).toMatchObject({ code: 'unknown-card' })
    expect(deckRefusal(['a'], 1, deckCards, {})).toMatchObject({ code: 'card-locked', reason: '[Card a] isn\'t in your Card Library yet.' })
    expect(deckRefusal(['late'], 1, deckCards, owned)).toMatchObject({ code: 'card-era', reason: '[Card late] arrived after URA Finale, so it can\'t join this career.' })
    expect(deckRefusal(['late'], 2, deckCards, owned)).toBeNull()
  })

  it('posts each card to its own type\'s branch, Friend and Group to Wit, and keeps posts across a change', () => {
    const many = mapOf(testCard('sp', 'speed', {}), testCard('fr', 'friend', {}), testCard('gr', 'group', {}), testCard('po', 'power', {}))
    const first = withDeck(testCareer(), ['sp', 'fr', 'gr'], many)
    expect(first.posts).toEqual({ sp: 'speed', fr: 'wit', gr: 'wit' })
    const moved = ok(postCard(first, 'sp', 'guts', many))
    expect(withDeck(moved, ['sp', 'po'], many).posts).toEqual({ sp: 'guts', po: 'power' })
  })

  it('seats five a branch: a sixth defaults to the next branch with room, and no card moves into a full one', () => {
    const six = Array.from({ length: 6 }, (_, i) => testCard(`s${i}`, 'speed', {}))
    const sixCards = mapOf(...six)
    const full = withDeck(testCareer(), six.map((card) => card.id), sixCards)
    expect(Object.values(full.posts).filter((branch) => branch === 'speed')).toHaveLength(BRANCH_SEATS)
    expect(full.posts.s5).toBe('stamina')
    expect(postCard(full, 's5', 'speed', sixCards)).toMatchObject({ code: 'branch-full', reason: 'Speed already seats 5 cards.' })
    expect(postCard(full, 's0', 'speed', sixCards)).toMatchObject({ code: 'already-posted' })
    expect(postCard(full, 'nope', 'wit', sixCards)).toMatchObject({ code: 'not-in-deck' })
  })
})

describe('the tree', () => {
  it('opens pips in order: four a level, each level dearer', () => {
    const first = previewPip(career(), view(), 'speed')!
    expect(first).toMatchObject({ level: 1, cost: 20, gain: { stats: stats(16, 0, 8, 0, 0), sp: 5 } })
    const four = ok(buyPips(career(), view(), 'speed', 4))
    expect(four.spent).toBe(80)
    expect(four.career.pips.speed).toBe(4)
    expect(four.career.wallet.drills.speed).toBe(420)
    expect(previewPip(four.career, view(), 'speed')).toMatchObject({ level: 2, cost: 22, gain: { stats: stats(18, 0, 8, 0, 0), sp: 5 } })
    expect(ok(buyPips(career(), view(), 'speed', 5)).spent).toBe(102)
  })

  it('previews exactly what buying pays', () => {
    let current = career()
    for (let n = 0; n < 9; n++) {
      const preview = previewPip(current, view(), 'speed')!
      const before = treeGain(current, view())
      current = ok(buyPips(current, view(), 'speed', 1)).career
      const after = treeGain(current, view())
      expect(after.stats.speed - before.stats.speed).toBe(preview.gain.stats.speed)
      expect(after.sp - before.sp).toBe(preview.gain.sp)
    }
  })

  it('shows the gain its caps throw away', () => {
    const near = testUma('uma-1', { baseStats: stats(1170, 100, 100, 100, 100) })
    // 1170 + 20 Initial Speed = 1190: a 16-Speed pip keeps 10.
    expect(previewPip(career(), view({}, near), 'speed')!.overflow).toEqual(stats(6, 0, 0, 0, 0))
    expect(previewPip(career(), view(), 'speed')!.overflow).toEqual(flat(0))
  })

  it('refuses in plain words: a full branch, too many pips, too few drills', () => {
    const full = career({ pips: { ...flat(0), speed: 20 } })
    expect(buyPips(full, view(), 'speed', 1)).toMatchObject({ code: 'branch-complete', reason: 'Speed\'s branch is complete.' })
    expect(previewPip(full, view(), 'speed')).toBeNull()
    expect(buyPips(career({ pips: { ...flat(0), speed: 18 } }), view(), 'speed', 3)).toMatchObject({ code: 'too-many-pips', reason: 'Speed has 2 pips left.' })
    const poor = career({ wallet: { drills: flat(30), bond: 0, sp: 0 } })
    expect(buyPips(poor, view(), 'speed', 2)).toMatchObject({ code: 'not-enough-drills', reason: 'That takes 40 Speed drills; she has 30.' })
  })

  it('cuts a branch\'s pips by its cards\' Energy Cost Reduction', () => {
    const cheap = testCard('cheap', 'speed', { 28: 20 })
    const v: BuildView = { uma, cards: mapOf(cheap), bonds: {} }
    expect(ok(buyPips(career({ deck: ['cheap'], posts: { cheap: 'speed' } }), v, 'speed', 4)).spent).toBe(64)
    expect(ok(buyPips(career({ deck: ['cheap'], posts: { cheap: 'wit' } }), v, 'speed', 4)).spent).toBe(80)
  })

  it('opens two Camps once a branch reaches level 3, each four level-5 sessions where the owner picks', () => {
    const seven = career({ pips: { ...flat(0), speed: 7 } })
    expect(campsOpen(seven)).toBe(false)
    expect(buyCamp(seven, view(), 'stamina')).toMatchObject({ code: 'camps-closed' })
    expect(previewCamp(seven, view(), 'stamina')).toBeNull()
    const eight = career({ pips: { ...flat(0), speed: 8 } })
    expect(campsOpen(eight)).toBe(true)
    expect(previewCamp(eight, view(), 'stamina')).toMatchObject({ level: 5, cost: 112, gain: { stats: stats(0, 64, 0, 36, 0), sp: 16 } })
    const one = ok(buyCamp(eight, view(), 'stamina'))
    expect(one.career.camps).toEqual(['stamina', null])
    expect(one.spent).toBe(112)
    expect(treeGain(one.career, view()).stats.stamina).toBe(64) // 4 × ⌊14 × 1.2⌋
    const two = ok(buyCamp(one.career, view(), 'speed'))
    expect(two.career.camps).toEqual(['stamina', 'speed'])
    expect(buyCamp(two.career, view(), 'wit')).toMatchObject({ code: 'camps-full', reason: 'Both Camps are bought.' })
  })

  it('is derived when read: moving or swapping a card, or reaching bond 80, changes every bought and open pip', () => {
    const bought = ok(buyPips(career(), view(), 'speed', 4)).career
    expect(treeGain(bought, view()).stats).toEqual(stats(64, 0, 32, 0, 0))
    const moved = ok(postCard(bought, 's', 'stamina', cards))
    expect(treeGain(moved, view()).stats).toEqual(stats(52, 0, 28, 0, 0)) // 4 × ⌊11 × 1.2⌋, 4 × ⌊6 × 1.2⌋
    expect(previewPip(moved, view(), 'speed')!.gain.stats).toEqual(stats(14, 0, 7, 0, 0))
    expect(treeGain(withDeck(bought, [], cards), view()).stats).toEqual(stats(52, 0, 28, 0, 0))
    expect(treeGain(bought, view({ 'uma-1:1:s': bond('s', 80) })).stats).toEqual(stats(76, 0, 36, 0, 0)) // × 1.6632
  })

  it('never depends on purchase order', () => {
    const facility = testCard('lvl', 'speed', { 8: 5 }, { uniqueEffect: unique({ type: 117, value: 8, params: [25, 16] }) })
    const v: BuildView = { uma, cards: mapOf(facility), bonds: {} }
    const start = career({ deck: ['lvl'], posts: { lvl: 'speed' } })
    const ab = ok(buyPips(ok(buyPips(start, v, 'speed', 8)).career, v, 'wit', 8)).career
    const ba = ok(buyPips(ok(buyPips(start, v, 'wit', 8)).career, v, 'speed', 8)).career
    expect(ab.pips).toEqual(ba.pips)
    expect(statParts(ab, v)).toEqual(statParts(ba, v))
  })
})

describe('the racing build', () => {
  it('reproduces 05 §3.5 on the real table: Speed level 2 pays 36 / 16 / 11 with A, B and C', () => {
    // Level 2 of URA's Speed facility is the worked example's base (12 Speed, 6 Power, 4 SP).
    const A = testCard('a', 'speed', { 1: 25, 2: 30, 3: 1, 8: 10, 30: 1 })
    const B = testCard('b', 'speed', { 1: 30, 5: 1, 8: 5 })
    const C = testCard('c', 'wit', { 8: 15, 1: 35, 28: 15 })
    const her = testUma('uma-1', { growthRates: stats(0.2, 0, 0, 0, 0) })
    const abc = mapOf(A, B, C)
    const bonds = { 'uma-1:1:a': bond('a', 85), 'uma-1:1:b': bond('b', 60) }
    const v: BuildView = { uma: her, cards: abc, bonds }
    const posted = ok(postCard(withDeck(career({ deck: [], posts: {} }), ['a', 'b', 'c'], abc), 'c', 'speed', abc))
    const bought = ok(buyPips(posted, v, 'speed', 8))
    expect(bought.spent).toBe(4 * 17 + 4 * 19) // ⌈20 × 0.85⌉, ⌈22 × 0.85⌉
    // Level 1: ⌊12 × 2.3546 × 1.2⌋ = 33, ⌊7 × 2.3546⌋ = 16, ⌊5 × 2.3546⌋ = 11; level 2: 36, 16, 11.
    expect(treeGain(bought.career, v)).toEqual({ stats: stats(4 * 33 + 4 * 36, 0, 4 * 16 + 4 * 16, 0, 0), sp: 4 * 11 + 4 * 11 })
    expect(deriveRacingBuild(bought.career, her, abc, bonds)).toEqual({
      stats: stats(100 + 276, 100, 100 + 128, 100, 100),
      aptitudes: her.aptitudes,
      skills: [],
    })
    // Once B reaches bond 80: level 1 pays 44 / 21 / 15, level 2 47 / 21 / 15.
    const bonded = { ...bonds, 'uma-1:1:b': bond('b', 80) }
    expect(deriveRacingBuild(bought.career, her, abc, bonded).stats).toEqual(stats(100 + 4 * 44 + 4 * 47, 100, 100 + 8 * 21, 100, 100))
    // With C posted to Wit instead, level 2 pays 31 / 13 / 9.
    const witC = ok(postCard(bought.career, 'c', 'wit', abc))
    expect(treeGain(witC, v).stats.speed - treeGain({ ...witC, pips: { ...witC.pips, speed: 4 } }, v).stats.speed).toBe(4 * 31)
  })

  it('is min(cap, star-5 base + deck Initial stats + bought pips + hint rewards), her template aptitudes and her bought skills', () => {
    const start = career({ skills: ['skill-x'] })
    const poured = ok(pourBond(start, {}, cards, 's', 50)) // 30 → 80: hints at 40, 60, 80
    expect(poured.track).toEqual({ umaId: 'uma-1', tier: 1, cardId: 's', value: 80, hints: 3 })
    const bonds = { 'uma-1:1:s': poured.track }
    const bought = ok(buyPips(poured.career, view(bonds), 'speed', 4)).career
    // Speed: 100 base + 20 Initial + 4 × ⌊12 × 1.6632⌋ (76) + 3 hints × 3 = 205; Power 100 + 4 × ⌊6 × 1.6632⌋ (36).
    expect(deriveRacingBuild(bought, uma, cards, bonds)).toEqual({ stats: stats(205, 100, 136, 100, 100), aptitudes: uma.aptitudes, skills: ['skill-x'] })
    const capped = testUma('uma-1', { baseStats: stats(1195, 100, 100, 100, 100) })
    expect(careerStats(bought, view(bonds, capped)).speed).toBe(1200)
    expect(statParts(bought, view(bonds, capped)).total.speed).toBe(1300)
  })

  it('reads the deck once: cards missing from the content drop out', () => {
    const read = readDeck(career({ deck: ['s', 'gone'], posts: { s: 'speed', gone: 'wit' } }), view())
    expect(read.posted.map((entry) => entry.id)).toEqual(['s'])
    expect(read.facts).toMatchObject({ types: ['speed'], bondTotal: 30, combinedLevel: 5 })
  })
})
