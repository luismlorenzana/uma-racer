// Furlong Hand's effect hooks (D385) on invented cards: Training Effectiveness and Stat Bonus lift their colour's
// yields, Specialty Priority deals a Partner into the first spread, bond 80 makes a rainbow, Hint Frequency peeks at
// the next spread, SP Bonus pays SP, Race Bonus adds Drive at the spurt, Initial stats and Stamina and distance
// aptitude set Breath, Wit deals Skill cards, skills fire on their ground, and each unique effect maps to one ability.
import { describe, expect, it } from 'vitest'
import { cardOf, furlongAt, furlongConfig, FURLONG_DECK } from '../../__fixtures__/furlong'
import {
  ABILITIES, abilityOf, BREATH_BASE, BREATH_MAX, dealSpread, deckBonuses, DISTANCE_BREATH, HINT_PER_PEEK, initFurlong, LINE, KINDRED_BOND,
  RACE_BONUS_PER_DRIVE, RAINBOW_BOND, RAINBOW_CARDS, reportFurlong, runYield, SKILL_CARDS, SKILL_POINTS, STAT_BONUS_PERCENT, stepFurlong, type Ability,
  type FurlongState,
} from './rules'

const run = (state: FurlongState, x: number) => stepFurlong(state, { tick: state.moves, code: 0, x })!
const bank = (state: FurlongState, x: number) => stepFurlong(state, { tick: state.moves, code: 1, x })!
const PILE_OF = ['t1', 't1', 't1']
/** A unique of one plain term. */
const plain = (type: number, value = 1) => ({ uniqueEffect: { level: 30, description: null, effects: [{ type, value, params: [] }] } })

describe('Training Effectiveness and Stat Bonus', () => {
  it('lift their colour\'s yields: its Training Effectiveness and its Stat Bonus × 4 in percent; a Friend card\'s half to every colour', () => {
    const speed = { ...cardOf('sim-speed-2'), effects: { 8: 20, 3: 2 } }
    const friend = { ...cardOf('sim-friend-2'), effects: { 8: 10 } }
    const { effectiveness, bonus } = deckBonuses([speed, friend].map((card) => ({ id: card.id, type: card.type, effects: card.effects })))
    expect(bonus).toEqual([2, 0, 0, 0, 0])
    expect(effectiveness).toEqual([20 + 2 * STAT_BONUS_PERCENT + 5, 5, 5, 5, 5])
  })

  it('so a deck of Speed cards runs Speed cards further', () => {
    const plainDeck = furlongAt({ columns: ['s1', 'g6', 'g6', 'g6'], lead: 's6', pile: PILE_OF }, {}, { deck: ['sim-wit-0'] })
    const speedDeck = furlongAt({ columns: ['s1', 'g6', 'g6', 'g6'], lead: 's6', pile: PILE_OF }, {}, { deck: ['sim-speed-4', 'sim-speed-3'] })
    const card = plainDeck.columns[0]![0]!
    expect(runYield(speedDeck, card).ground).toBeGreaterThan(runYield(plainDeck, card).ground)
  })
})

describe('Specialty Priority', () => {
  it('deals a Partner into the first spread at its percent: always at 100, the deal\'s luck at 0', () => {
    const inFirst = (priority: number) => Array.from({ length: 40 }, (_, seed) => {
      const state = initFurlong(furlongConfig({ seed, deck: ['sim-speed-2'], cards: { 'sim-speed-2': { effects: { 19: priority } } } }))
      return state.columns.flat().some((card) => state.cards[card]!.kind === 'partner')
    }).filter(Boolean).length
    expect(inFirst(100)).toBe(40)
    expect(inFirst(0)).toBeLessThan(30)
  })

  it('leaves later spreads to deal a Partner she hasn\'t played yet', () => {
    const state = initFurlong(furlongConfig({ deck: ['sim-speed-2'] }))
    for (let spread = 1; spread <= state.legs.length; spread += 1) {
      const deal = dealSpread({ ...state, played: 0 }, spread)
      expect(deal.columns.flat().some((card) => state.cards[card]!.kind === 'partner')).toBe(true)
    }
  })
})

describe('Friendship: the rainbow', () => {
  it('lights the next two cards of the chain at bond 80, which yield double run, once a spread', () => {
    // Quality 0 has no unique, so no kindred.
    const table = { columns: ['s1 s2 s6 P0', 'g6', 'g6', 'g6'], lead: 's3', pile: PILE_OF }
    const bonded = furlongAt(table, {}, { deck: ['sim-speed-0'], bonds: { 'sim-speed-0': RAINBOW_BOND } })
    const plainBond = furlongAt(table, {}, { deck: ['sim-speed-0'], bonds: { 'sim-speed-0': RAINBOW_BOND - 1 } })
    expect(bonded.partners[0]!.rainbow).toBe(true)
    expect(plainBond.partners[0]!.rainbow).toBe(false)
    let lit = run(bonded, 0)
    expect(lit.events).toContainEqual({ kind: 'rainbow' })
    expect(lit.rainbow).toBe(RAINBOW_CARDS)
    const next = lit.columns[0]!.at(-1)!
    const single = runYield({ ...lit, rainbow: 0 }, next).ground
    expect(runYield(lit, next).ground).toBe(2 * single)
    lit = run(lit, 0)
    lit = run(lit, 0)
    expect(lit.rainbow).toBe(0)
    expect(lit.rainbowLit).toBe(true)
  })

  it('goes out on a flip, and a kindred Partner lights from bond 60', () => {
    const table = { columns: ['s1 P0', 'g6', 'g6', 'g6'], lead: 's3', pile: PILE_OF }
    const lit = run(furlongAt(table, {}, { bonds: { 'sim-speed-2': 90 } }), 0)
    expect(stepFurlong(lit, { tick: lit.moves, code: 2 })!.rainbow).toBe(0)
    // The invented stat cards' unique is Friendship at bond 80: kindred.
    expect(furlongAt(table, {}, { bonds: { 'sim-speed-2': KINDRED_BOND } }).partners[0]).toMatchObject({ ability: 'kindred', rainbow: true })
  })
})

describe('Hint Frequency, SP Bonus, Race Bonus and Initial stats', () => {
  it('peeks at the next spread\'s front cards: one per 60 of the deck\'s Hint Frequency, and one more at Wit +1', () => {
    expect(initFurlong(furlongConfig()).peek).toBe(Math.floor((6 * 35) / HINT_PER_PEEK))
    expect(initFurlong(furlongConfig({ deck: ['sim-speed-0'] })).peek).toBe(0)
    expect(initFurlong(furlongConfig({ deck: ['sim-speed-0'], her: { stats: [100, 100, 100, 100, 120] } })).peek).toBe(1)
  })

  it('marks a Partner played, and pays no SP of its own: a Skill Point Bonus pays through the tree (D391)', () => {
    const state = furlongAt({ columns: ['s1 P0 s2 P0', 'g6', 'g6', 'g6'], lead: 's3', pile: PILE_OF }, {}, { cards: { 'sim-speed-2': { effects: { 30: 3 } } } })
    const once = bank(state, 0)
    expect(once.played).toBe(1)
    expect(once).not.toHaveProperty('bonusSp')
    expect(reportFurlong({ ...once, phase: 'finished', finish: { place: 1, margin: 0 } })).not.toHaveProperty('bonusSp')
  })

  it('adds the deck\'s Race Bonus as Drive at the spurt, one per 10', () => {
    expect(initFurlong(furlongConfig()).spurtDrive).toBe(Math.floor((6 * 5) / RACE_BONUS_PER_DRIVE))
    expect(initFurlong(furlongConfig({ deck: [] })).spurtDrive).toBe(0)
  })

  it('starts her Breath from Stamina, distance aptitude and the deck\'s Initial stats, within its ceiling', () => {
    const base = (options: Parameters<typeof furlongConfig>[0]) => initFurlong(furlongConfig({ deck: [], ...options })).breath
    // The invented Uma 0 runs a medium race at A: +1.
    expect(base({})).toBe(BREATH_BASE + DISTANCE_BREATH[1]!)
    expect(base({ her: { stats: [100, 120, 100, 100, 100] } })).toBe(BREATH_BASE + DISTANCE_BREATH[1]! + 1)
    expect(base({ her: { distance: 'D' } })).toBe(BREATH_BASE + DISTANCE_BREATH[4]!)
    expect(base({ deck: ['sim-stamina-4'] })).toBe(Math.min(BREATH_MAX, BREATH_BASE + DISTANCE_BREATH[1]! + 0))
    expect(base({ deck: ['sim-stamina-4', 'sim-speed-4', 'sim-power-4'] })).toBe(BREATH_MAX)
  })
})

describe('Wit and her skills', () => {
  it('deals her skills as Skill cards, as many as her Wit class allows', () => {
    const bought = ['sim-skill-speed-1', 'sim-skill-speed-2', 'sim-skill-speed-3', 'sim-event-speed', 'sim-skill-wit-1']
    const count = (wit: number) => initFurlong(furlongConfig({ bought, her: { stats: [100, 100, 100, 100, wit] } })).cards.filter((card) => card.kind === 'skill').length
    expect([count(80), count(100), count(120), count(140)]).toEqual([...SKILL_CARDS])
  })

  it('fires a Skill card on its own ground for more yield: a recovery skill restores Breath', () => {
    // The invented unique fires late in the race: the spurt.
    const leg = furlongAt({ columns: ['K0', 'g6', 'g6', 'g6'], lead: 's6', pile: PILE_OF })
    const spurt = furlongAt({ columns: ['K0', 'g6', 'g6', 'g6'], lead: 's6', pile: PILE_OF }, { spread: 5, drive: 0 })
    const card = leg.columns[0]![0]!
    expect(leg.skills[0]).toMatchObject({ trigger: 'spurt', gold: true })
    expect(runYield(leg, card).fired).toBe(false)
    expect(runYield(spurt, card).fired).toBe(true)
    expect(run(spurt, 0).events[0]).toMatchObject({ kind: 'run', fired: true })
    const recovery = furlongAt({ columns: ['K0', 'g6', 'g6', 'g6'], lead: 't3', pile: PILE_OF }, {
      skills: [{ id: 'x', colour: 1, trigger: 'any', gold: false }], breath: 4,
    })
    const after = run({ ...recovery, cards: recovery.cards.map((c) => (c.kind === 'skill' ? { ...c, colour: 1 } : c)) }, 0)
    expect(after.breath).toBe(6)
    expect(SKILL_POINTS.gold).toBeGreaterThan(SKILL_POINTS.white)
  })
})

describe('abilities: each unique effect, mapped', () => {
  it('maps a unique by the first term that maps: a plain effect by its id, a conditional by what it boosts', () => {
    const one = (type: number, value = 0, params: number[] = []) => abilityOf({ effects: [{ type, value, params }] })
    expect([one(1), one(2), one(3), one(8), one(9), one(14), one(15), one(17), one(19), one(30), one(32), one(27)]).toEqual([
      'kindred', 'second-wind', 'long-stride', 'rhythm', 'fresh-legs', 'team-play', 'kick', 'scout', 'quick-start', 'scout', 'scout', 'inside-line',
    ])
    expect([one(101, 80, [15, 5]), one(102, 60, [10]), one(106, 5, [1, 2]), one(110, 30, [2]), one(121, 5, [3])]).toEqual([
      'kick', 'rhythm', 'kindred', 'scout', 'team-play',
    ])
    expect([one(103, 3, [5]), one(105, 1, [1]), one(120, 1, [80, 1, 2])]).toEqual(['team-play', 'team-play', 'team-play'])
    expect([one(104, 1), one(22), abilityOf(null), abilityOf({ effects: [] })]).toEqual([null, null, null, null])
    expect(abilityOf({ effects: [{ type: 104, value: 1, params: [] }, { type: 15, value: 5, params: [] }] })).toBe('kick')
    expect(ABILITIES.length).toBeLessThanOrEqual(12)
  })

  const withAbility = (ability: Ability, table = { columns: ['s1 P0', 'g6', 'g6', 'g6'], lead: 's3', pile: PILE_OF }, change: Partial<FurlongState> = {}) => {
    const state = furlongAt(table, change)
    return { ...state, partners: state.partners.map((partner, i) => (i === 0 ? { ...partner, ability, rainbow: false } : partner)) }
  }

  it('second wind and kick: played, +1 Breath, +2 Drive', () => {
    expect(bank(withAbility('second-wind', undefined, { breath: 5 }), 0).breath).toBe(6)
    expect(bank(withAbility('kick', undefined, { drive: 0 }), 0).drive).toBe(1 + 2)
  })

  it('long stride: run, two points more', () => {
    const plainPartner = withAbility('rhythm')
    const long = withAbility('long-stride')
    const card = long.columns[0]!.at(-1)!
    expect(runYield(long, card).ground).toBeGreaterThan(runYield(plainPartner, card).ground)
  })

  it('rhythm: a chain it joins counts two more toward its Drive', () => {
    const state = withAbility('rhythm', { columns: ['s1 P0', 'g6', 'g6', 'g6'], lead: 's3', pile: PILE_OF }, { chain: 1, drive: 0, chainPaid: false })
    const after = run(state, 0)
    expect([after.chain, after.drive]).toEqual([4, 1])
  })

  it('inside line: played, it opens a blocked column', () => {
    const state = withAbility('inside-line', { columns: ['t2', 's1 P0', 'g6', 'g6'], lead: 's3', pile: PILE_OF }, { blocked: 0 })
    expect(run(state, 1).blocked).toBe(-1)
  })

  it('scout: played, the next line choice shows every front card of the next spread', () => {
    const state = withAbility('scout', { columns: ['P0', '', '', ''], lead: 's3', pile: PILE_OF }, { peek: 0 })
    const after = run(state, 0)
    expect([after.phase, after.peeked]).toEqual(['line', 4])
  })

  it('fresh legs, quick start and team play: +2 Breath, the first spread\'s front row, a wild card', () => {
    const config = furlongConfig({ deck: ['sim-wit-0'], cards: { 'sim-wit-0': { ...plain(9), effects: { 19: 0 } } } })
    expect(initFurlong(config).breath).toBe(Math.min(BREATH_MAX, initFurlong(furlongConfig({ deck: ['sim-wit-0'] })).breath + 2))
    for (let seed = 0; seed < 20; seed += 1) {
      const quick = initFurlong(furlongConfig({ seed, deck: ['sim-wit-0'], cards: { 'sim-wit-0': { ...plain(19), effects: {} } } }))
      expect(quick.columns.some((column) => quick.cards[column.at(-1)!]!.kind === 'partner')).toBe(true)
    }
    const team = initFurlong(furlongConfig({ deck: ['sim-wit-0'], cards: { 'sim-wit-0': plain(14) } }))
    expect(team.cards.find((card) => card.kind === 'partner')!.colour).toBe(-1)
  })
})

describe('the deck', () => {
  it('holds 15 base stride cards, three a deck card (wild for Friend and Group), her Partners and her Skill cards', () => {
    const state = initFurlong(furlongConfig())
    const stride = state.cards.filter((card) => card.kind === 'stride')
    expect(stride).toHaveLength(15 + 3 * FURLONG_DECK.length)
    expect(stride.filter((card) => card.colour === -1)).toHaveLength(3)
    expect(state.cards.filter((card) => card.kind === 'partner')).toHaveLength(FURLONG_DECK.length)
    expect(state.cards.every((card) => card.value >= 1 && card.value <= 6)).toBe(true)
    expect(state.cards.length).toBeGreaterThanOrEqual(39)
    // Practice without a deck deals stand-in stride cards in its six slots.
    expect(initFurlong(furlongConfig({ deck: [] })).cards.filter((card) => card.kind === 'stride')).toHaveLength(33)
  })

  it('lines up only through the rail\'s middle and outside', () => {
    expect(LINE).toEqual({ rail: 0, middle: 1, outside: 2 })
  })
})
