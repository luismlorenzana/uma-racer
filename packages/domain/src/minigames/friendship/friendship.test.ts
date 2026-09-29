import { describe, expect, it } from 'vitest'
import { CARD_EFFECTS, type CardEffect } from '../../cards'
import type { RaceTemplate, SkillTemplate, SupportCardTemplate } from '../../content'
import { ftBotPlay } from './bot'
import {
  FtActionError,
  ftApply,
  parseFtAction,
  parseFtActions,
  ftReplay,
  ftScoreTrain,
  ftStart,
  ftStateHash,
  type FtAction,
  type FtState,
} from './engine'
import { FT_SHOP_PRICES, ftFavouredTypes, type FtRivalRuleId, type FtSkillRuleId, type FtTwistId } from './rules'
import {
  FT_SETUP_VERSION,
  buildFriendshipSetup,
  defaultFriendshipPartners,
  ftCardDef,
  ftSkillRule,
  ftTrait,
  parseFtSetup,
  type FtCardDef,
  type FtSetup,
  type FtSkillDef,
} from './setup'
import type { StatKey } from '../../types'

// ── Fixtures ────────────────────────────────────────────────────────────────────────────────────────────────────────

const profile = (strongest: CardEffect): Record<CardEffect, number> =>
  Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, effect === strongest ? 2 : 1])) as Record<CardEffect, number>

function template(id: string, options: { type?: SupportCardTemplate['type']; trait?: CardEffect; era?: number; unique?: number[]; hints?: string[] } = {}): SupportCardTemplate {
  return {
    id,
    charaId: `chara-${id}`,
    charName: `Runner ${id}`,
    title: 'Practice Notes',
    type: options.type ?? 'speed',
    jpRelease: '2021-01-01',
    era: options.era ?? 1,
    obtain: 'free',
    starter: false,
    hintSkillIds: options.hints ?? [],
    eventSkillIds: [],
    effectProfile: profile(options.trait ?? 'trainingBonus'),
    uniqueEffect: options.unique ? { level: 30, effects: options.unique.map((type) => ({ type, value: 10 })) } : null,
    imageSource: 'https://example.invalid/card.png',
  }
}

function skill(id: string, options: { kind?: SkillTemplate['kind']; condition?: string; effects?: { type: number; value: number; target?: number }[] } = {}): SkillTemplate {
  return {
    id,
    kind: options.kind ?? 'white',
    name: `Skill ${id}`,
    description: 'A synthetic skill.',
    costSp: 100,
    iconId: null,
    conditions: [{ precondition: null, condition: options.condition ?? null, baseTime: 30000, cooldown: null, effects: options.effects ?? [{ type: 27, value: 1500 }] }],
    inheritedSkillId: null,
    normalSkillId: null,
  }
}

function race(id: string, grade: RaceTemplate['grade'], distanceCategory: RaceTemplate['distanceCategory'] = 'mile', surface: RaceTemplate['surface'] = 'turf'): RaceTemplate {
  return {
    id, familyId: id, name: `Race ${id}`, grade, surface, distance: 1600, distanceCategory, direction: 'right', venue: 'Tokyo',
    venueKey: 'tokyo', venueTags: [], series: [], seriesLegs: [], courseId: 'c', season: 1, fieldSize: 16,
  }
}

const def = (id: string, type: FtCardDef['type'], trait: CardEffect = 'trainingBonus', extra: Partial<FtCardDef> = {}): FtCardDef => ({
  id, charaId: `chara-${id}`, name: id, title: '', type, trait, signature: [trait], stars: 0, ...extra,
})

const skillDef = (id: string, rule: FtSkillRuleId, gold = false, stat?: StatKey): FtSkillDef => ({
  id, name: id, description: '', gold, rule, ...(stat ? { stat } : {}),
})

/** A hand-made setup: the engine tests control every card, skill and race. */
function setupWith(cards: FtCardDef[], options: { twist?: FtTwistId; deck?: string[]; skills?: FtSkillDef[]; earning?: number; legends?: string | null } = {}): FtSetup {
  const byId = Object.fromEntries(cards.map((card) => [card.id, card]))
  const skills = Object.fromEntries((options.skills ?? []).map((entry) => [entry.id, entry]))
  return {
    version: FT_SETUP_VERSION, seed: 1234, tier: 1, twist: options.twist ?? 'foundation', earning: options.earning ?? 1,
    mainCardId: cards[0]!.id,
    deck: options.deck ?? cards.flatMap((card) => [card.id, card.id]),
    cards: byId,
    rewardPool: cards.map((card) => card.id),
    skills,
    skillSources: { main: Object.keys(skills), deck: [], pool: [] },
    races: [{ id: 'r', name: 'Race', grade: 'g3', distance: 1600, distanceCategory: 'mile', surface: 'turf' }],
    legendsCardId: options.legends ?? null,
  }
}

/** A state in an encounter holding exactly these cards (uids 1…n in order). */
function inHand(setup: FtSetup, hand: string[], options: { kind?: 'week' | 'race'; facility?: StatKey; favoured?: StatKey[]; rival?: FtRivalRuleId | null; trainsUsed?: number; trainsLeft?: number; skills?: string[]; bonded?: boolean } = {}): FtState {
  const state = ftStart(setup)
  state.deck = hand.map((cardId, index) => ({ uid: index + 1, cardId, bonus: 0 }))
  state.skills = options.skills ?? []
  state.bonded = options.bonded ?? false
  state.phase = 'encounter'
  state.encounter = {
    kind: options.kind ?? 'week', facility: options.kind === 'race' ? null : options.facility ?? 'speed',
    favoured: options.favoured ?? [], rival: options.rival ?? null, target: 1e9, payout: 3, score: 0,
    trainsLeft: options.trainsLeft ?? 3, trainsUsed: options.trainsUsed ?? 0, redrawsLeft: 2,
    draw: [], hand: state.deck.map((entry) => entry.uid), discard: [], reshuffles: 0, order: null, orderFilled: false,
  }
  return state
}

const uids = (state: FtState) => state.encounter!.hand
const score = (setup: FtSetup, state: FtState, picks = uids(state)) => ftScoreTrain(setup, state, picks)

// ── Setup ───────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('Friendship Training setup', () => {
  const main = template('main', { type: 'speed', trait: 'friendshipBonus', unique: [8, 30], hints: ['h1', 'h2'] })
  const others = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => template(id, { type: (['stamina', 'power', 'guts', 'wit', 'friend', 'speed'] as const)[index], hints: ['h3'] }))
  const late = template('late', { era: 9 })
  const owned = [main, ...others, late].map((entry) => ({ template: entry, stars: 2 }))
  const skills = [skill('h1'), skill('h2', { kind: 'gold' }), skill('h3'), skill('unique', { kind: 'unique' }), ...Array.from({ length: 60 }, (_, index) => skill(`p${index}`))]
  const races = [race('g3a', 'g3'), race('g3b', 'g3'), race('g2a', 'g2'), race('g1a', 'g1', 'long', 'dirt')]
  const build = (overrides: Partial<Parameters<typeof buildFriendshipSetup>[0]> = {}) => buildFriendshipSetup({
    seed: 42, tier: 1, mainStars: 2, mainCard: main, setCardIds: ['a', 'b', 'c', 'd', 'e'], owned, skills, races, ...overrides,
  })

  it('deals two of the main card and two of each other set card, and earns the next star', () => {
    const setup = build()
    expect(setup.earning).toBe(3)
    expect(setup.version).toBe(FT_SETUP_VERSION)
    expect(setup.deck).toHaveLength(12)
    expect(setup.deck.filter((id) => id === 'main')).toHaveLength(2)
    expect(new Set(setup.deck)).toEqual(new Set(['main', 'a', 'b', 'c', 'd', 'e']))
    expect(setup.cards.main!.stars).toBe(2)
  })

  it('tops a short set up from owned, era-eligible cards, never a later era', () => {
    const setup = build({ setCardIds: ['a'] })
    expect(setup.deck).toHaveLength(12)
    expect(setup.deck).not.toContain('late')
    expect(setup.rewardPool).not.toContain('late')
    expect(build({ tier: 9 }).rewardPool).toContain('late')
  })

  it('reads traits and signatures from the card data', () => {
    expect(ftTrait(template('x', { trait: 'hintFrequency' }))).toBe('hintFrequency')
    expect(ftCardDef(main, 0).signature).toEqual(['trainingBonus', 'skillPointBonus'])
    expect(ftCardDef(template('y', { trait: 'statBonus' }), 0).signature).toEqual(['statBonus'])
  })

  it('offers the main card hints first, then the deck, then a slice of the pool; never uniques', () => {
    const setup = build()
    expect(setup.skillSources.main).toEqual(['h1', 'h2'])
    expect(setup.skillSources.deck).toEqual(['h3'])
    expect(setup.skillSources.pool.length).toBeLessThanOrEqual(40)
    expect(setup.skills.unique).toBeUndefined()
  })

  it('draws one real race per stage at its grade, and a Legends card only in The Twinkle Legends', () => {
    const setup = build()
    expect(setup.races.map((entry) => entry.grade)).toEqual(['g3', 'g2', 'g1'])
    expect(build({ mainStars: 0 }).races).toHaveLength(1)
    expect(setup.legendsCardId).toBeNull()
    expect(build({ tier: 10 }).legendsCardId).not.toBeNull()
    expect(build({ tier: 10 }).twist).toBe('legends')
  })

  it('refuses a card already at 3★, and runs one · two · three stages for 1★ · 2★ · 3★ (D200)', () => {
    expect(() => build({ mainStars: 3 })).toThrow()
    expect([0, 1, 2].map((mainStars) => build({ mainStars }).races.length)).toEqual([1, 2, 3])
  })

  it('never reads a setup frozen for five stars', () => {
    expect(parseFtSetup({ ...build(), version: 1 })).toBeNull()
    expect(parseFtSetup(build())).toEqual(build())
  })
})

describe('default partners (D199)', () => {
  const card = (id: string, type: SupportCardTemplate['type'], era = 1) => ({ id, type, era })
  const owned = (entries: [ReturnType<typeof card>, number][]) => entries.map(([template, stars]) => ({ template, stars }))

  it('takes the most-starred eligible cards, preferring a stat type not yet picked, then newer eras, never the main card', () => {
    const partners = defaultFriendshipPartners({
      tier: 3,
      mainCardId: 'main',
      owned: owned([
        [card('main', 'speed'), 3], [card('s1', 'speed'), 3], [card('s2', 'speed', 2), 3], [card('p1', 'power'), 2],
        [card('w1', 'wit'), 2], [card('w2', 'wit', 3), 2], [card('g1', 'guts'), 0], [card('late', 'stamina', 9), 3],
      ]),
    })
    // 3★ first (s2 is newer than s1), then the 2★ wit and power before a second of either, then the rest.
    expect(partners).toEqual(['s2', 's1', 'w2', 'p1', 'w1'])
  })

  it('offers fewer than five when fewer are owned, and nothing needs an Uma', () => {
    expect(defaultFriendshipPartners({ tier: 1, mainCardId: 'main', owned: owned([[card('main', 'speed'), 0], [card('a', 'wit'), 0]]) }))
      .toEqual(['a'])
  })
})

describe('skill rules from skill data', () => {
  const rule = (options: Parameters<typeof skill>[1]) => ftSkillRule(skill('s', options))
  it('maps each effect and place to its rule', () => {
    expect(rule({ effects: [{ type: 10, value: 1 }] }).rule).toBe<FtSkillRuleId>('gate')
    expect(rule({ effects: [{ type: 9, value: 100 }] }).rule).toBe('second-wind')
    expect(rule({ effects: [{ type: 8, value: 1 }] }).rule).toBe('vision')
    expect(rule({ effects: [{ type: 28, value: 1 }] }).rule).toBe('positioning')
    expect(rule({ effects: [{ type: 31, value: 1 }] }).rule).toBe('kick')
    expect(rule({ condition: 'corner==1', effects: [{ type: 27, value: 1 }] }).rule).toBe('corner')
    expect(rule({ condition: 'straight_random==1', effects: [{ type: 27, value: 1 }] }).rule).toBe('straight')
    expect(rule({ condition: 'phase>=2', effects: [{ type: 27, value: 1 }] }).rule).toBe('spurt')
    expect(rule({ effects: [{ type: 27, value: 1 }] }).rule).toBe('surge')
    expect(rule({ effects: [{ type: 3, value: 40 }] })).toEqual({ rule: 'aptitude', stat: 'power' })
    expect(rule({ effects: [{ type: 27, value: -1 }] }).rule).toBe('pressure')
    expect(rule({ effects: [{ type: 99, value: 1 }] }).rule).toBe('form')
    // Recovery outranks speed when a skill does both.
    expect(rule({ effects: [{ type: 27, value: 1 }, { type: 9, value: 1 }] }).rule).toBe('second-wind')
  })
})

// ── Scoring ─────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('formations', () => {
  const cards = [def('m', 'wit'), def('s1', 'speed'), def('s2', 'speed'), def('s3', 'speed'), def('s4', 'speed'), def('s5', 'speed'),
    def('st', 'stamina'), def('po', 'power'), def('gu', 'guts'), def('wi', 'wit'), def('fr', 'friend')]
  const setup = setupWith(cards)
  const formation = (hand: string[]) => score(setup, inHand(setup, hand)).formation

  it('detects every formation and takes the best', () => {
    expect(formation(['st'])).toBe('solo')
    expect(formation(['st', 'st'])).toBe('duo')
    expect(formation(['s1', 's2'])).toBe('friendship')
    expect(formation(['st', 'st', 'st'])).toBe('trio')
    expect(formation(['s1', 's2', 's3'])).toBe('rainbow')
    expect(formation(['s1', 'st', 'po', 'gu', 'wi'])).toBe('full-team')
    expect(formation(['s1', 'st', 'po', 'gu', 'fr'])).toBe('full-team')
    expect(formation(['s1', 's2', 's3', 's4', 's5'])).toBe('rainbow-team')
  })

  it('scores (card points + formation points) × mult: 10 on-type, 5 elsewhere, 7 for broad cards', () => {
    const solo = score(setup, inHand(setup, ['st']))
    expect(solo.cardPoints).toBe(5 + 6)
    expect(solo.total).toBe((11 + 5) * 1)
    const rainbow = score(setup, inHand(setup, ['s1', 's2', 's3', 's4']))
    expect(rainbow.mult).toBe(4)
    expect(rainbow.total).toBe((4 * 16 + 30) * 4)
    expect(score(setup, inHand(setup, ['fr'])).cardPoints).toBe(7 + 6)
  })

  it('caps a Rainbow at ×5', () => {
    const special = setupWith([def('m', 'wit'), ...[1, 2, 3, 4].map((index) => def(`sp${index}`, 'speed', 'specialtyPriority'))])
    expect(score(special, inHand(special, ['sp1', 'sp2', 'sp3', 'sp4'])).mult).toBe(5)
  })

  it('grows with the card’s stars and shop upgrades', () => {
    // A maxed card plays at × 1.5, as a 5★ card did (D200).
    const starred = setupWith([def('m', 'wit'), def('x', 'speed', 'trainingBonus', { stars: 3 })])
    const state = inHand(starred, ['x'])
    expect(score(starred, state).cardPoints).toBeCloseTo(10 * 1.5 + 6, 9)
    state.deck[0]!.bonus = 5
    expect(score(starred, state).cardPoints).toBeCloseTo(10 * 1.5 + 6 + 5, 9)
  })
})

describe('traits', () => {
  it('applies each trait', () => {
    const cards = [def('m', 'wit'), def('fb', 'speed', 'friendshipBonus'), def('sb', 'speed', 'statBonus'), def('sbo', 'power', 'statBonus'),
      def('is', 'power', 'initialStats'), def('rb', 'speed', 'raceBonus'), def('hf', 'power', 'hintFrequency'), def('sp', 'power', 'skillPointBonus')]
    const setup = setupWith(cards)
    expect(score(setup, inHand(setup, ['fb'])).mult).toBe(1 + 1)
    expect(score(setup, inHand(setup, ['sb'])).cardPoints).toBe(10 + 6)
    expect(score(setup, inHand(setup, ['sbo'])).cardPoints).toBe(5 + 4)
    expect(score(setup, inHand(setup, ['is'])).cardPoints).toBe(5 + 10)
    expect(score(setup, inHand(setup, ['is'], { trainsUsed: 1 })).cardPoints).toBe(5)
    expect(score(setup, inHand(setup, ['rb'], { kind: 'race', favoured: ['speed', 'wit'] })).cardPoints).toBe(15)
    // Hint Frequency draws one extra; Skill Point Bonus pays a fan.
    const hint = inHand(setup, ['hf', 'm', 'm', 'm', 'm', 'm', 'm', 'm'])
    hint.encounter!.hand = [1, 2, 3, 4, 5, 6, 7]
    hint.encounter!.draw = [8]
    const afterHint = ftApply(setup, hint, { type: 'train', uids: [1] })
    expect(afterHint.encounter!.hand).toHaveLength(7 + 1)
    const fan = ftApply(setup, inHand(setup, ['sp', 'm']), { type: 'train', uids: [1] })
    expect(fan.fans).toBe(1)
  })
})

describe('the main card', () => {
  const cards = [def('m', 'stamina', 'trainingBonus', { signature: ['friendshipBonus'] }), def('s', 'speed')]
  const setup = setupWith(cards)

  it('bonds after three trains, then counts as on-type everywhere and plays its signature at ×1.5', () => {
    let state = inHand(setup, ['m', 's', 's', 's', 's', 's', 's'], { trainsLeft: 5 })
    for (let train = 0; train < 3; train += 1) {
      expect(state.bonded).toBe(false)
      state = ftApply(setup, state, { type: 'train', uids: [1] })
      state.encounter!.hand = [1, ...state.encounter!.hand.filter((uid) => uid !== 1)]
    }
    expect(state.gauge).toBe(3)
    expect(state.bonded).toBe(true)
    const bonded = inHand(setup, ['m'], { bonded: true })
    const result = score(setup, bonded)
    expect(result.cardPoints).toBe(10 + 6)
    expect(result.mult).toBe(1 + 1.5)
  })

  it('opens every encounter in hand', () => {
    const run = setupWith([def('m', 'wit'), ...['a', 'b', 'c', 'd', 'e'].map((id) => def(id, 'speed'))])
    const state = ftApply(run, ftStart(run), { type: 'facility', index: 0 })
    expect(state.encounter!.hand.map((uid) => state.deck.find((entry) => entry.uid === uid)!.cardId)).toContain('m')
    expect(state.encounter!.hand).toHaveLength(7)
  })
})

describe('races and rival rules', () => {
  it('favours two types by distance and surface', () => {
    expect(ftFavouredTypes('long', 'turf')).toEqual(['stamina', 'guts'])
    expect(ftFavouredTypes('sprint', 'dirt')).toEqual(['power', 'guts'])
  })

  const cards = [def('m', 'wit'), def('sp', 'speed'), def('st', 'stamina'), def('wi', 'wit')]
  const setup = setupWith(cards)
  const race = (rival: FtRivalRuleId | null, hand = ['sp', 'st', 'wi'], extra: Parameters<typeof inHand>[2] = {}) =>
    inHand(setup, hand, { kind: 'race', favoured: ['speed', 'wit'], rival, trainsLeft: 4, ...extra })

  it('scores favoured types as on-type', () => {
    const result = score(setup, race(null))
    expect(result.cardPoints).toBe(16 + 11 + 16)
    expect(result.formation).toBe('friendship')
  })

  it('applies each per-train rival rule', () => {
    const base = score(setup, race(null)).total
    expect(score(setup, race('front-runner')).total).toBe(Math.round(base * 0.5))
    expect(score(setup, race('front-runner', undefined, { trainsUsed: 1 })).total).toBe(base)
    expect(score(setup, race('heavy-going')).cardPoints).toBe(8 + 3 + 11 + 16)
    expect(score(setup, race('stamina-test', ['sp', 'wi'])).total).toBe(Math.round(score(setup, race(null, ['sp', 'wi'])).total * 0.5))
    const rainbow = setupWith([def('m', 'wit'), def('a', 'speed'), def('b', 'speed'), def('c', 'speed')])
    const hand = inHand(rainbow, ['a', 'b', 'c'], { kind: 'race', favoured: ['speed', 'wit'], rival: 'traffic' })
    expect(score(rainbow, hand).mult).toBe(2)
    const marked = setupWith([def('m', 'speed', 'friendshipBonus'), def('x', 'wit')])
    expect(score(marked, inHand(marked, ['m'], { kind: 'race', favoured: ['speed'], rival: 'marked' })).mult).toBe(1)
  })

  it('shapes a race with fast pace, a crowded field and a duel', () => {
    const run = setupWith([def('m', 'wit'), ...['a', 'b', 'c', 'd', 'e'].map((id) => def(id, 'speed'))], { deck: ['m', 'm', 'a', 'a', 'b', 'b', 'c', 'c', 'd', 'd', 'e', 'e'] })
    const reach = (): FtState => {
      let state = ftStart(run)
      state = { ...state, week: 2 }
      return ftApply(run, { ...state, phase: 'reward', rewardOffer: [] }, { type: 'reward', cardId: null })
    }
    const state = reach()
    expect(state.encounter!.kind).toBe('race')
    const rule = state.encounter!.rival!
    if (rule === 'fast-pace') expect(state.encounter!.redrawsLeft).toBe(1)
    else if (rule === 'crowded-field') expect(state.encounter!.hand).toHaveLength(6)
    else if (rule === 'duel') expect(state.encounter!.trainsLeft).toBe(5)
    else expect(state.encounter!.trainsLeft).toBe(4)
  })

  it('lets Pressure lift or cancel the rival rule', () => {
    const skills = [skillDef('pw', 'pressure'), skillDef('pg', 'pressure', true)]
    const pressed = setupWith(cards, { skills })
    const base = score(pressed, inHand(pressed, ['sp', 'st', 'wi'], { kind: 'race', favoured: ['speed', 'wit'] })).total
    const white = inHand(pressed, ['sp', 'st', 'wi'], { kind: 'race', favoured: ['speed', 'wit'], rival: 'front-runner', skills: ['pw'] })
    expect(score(pressed, white).total).toBe(Math.round(base * 0.5))
    white.encounter!.trainsUsed = 1
    const heavy = inHand(pressed, ['sp', 'st', 'wi'], { kind: 'race', favoured: ['speed', 'wit'], rival: 'heavy-going', skills: ['pw'], trainsUsed: 1 })
    expect(score(pressed, heavy).total).toBe(base)
    const gold = inHand(pressed, ['sp', 'st', 'wi'], { kind: 'race', favoured: ['speed', 'wit'], rival: 'front-runner', skills: ['pg'] })
    expect(score(pressed, gold).total).toBe(base)
  })
})

describe('skill rules', () => {
  const cards = [def('m', 'wit'), def('sp', 'speed'), def('st', 'stamina'), def('po', 'power'), def('gu', 'guts')]
  const skills = [skillDef('kick', 'kick'), skillDef('corner', 'corner', true), skillDef('straight', 'straight'), skillDef('spurt', 'spurt'),
    skillDef('surge', 'surge'), skillDef('apt', 'aptitude', false, 'power'), skillDef('form', 'form', true), skillDef('gate', 'gate')]
  const setup = setupWith(cards, { skills })
  const with1 = (skillId: string, hand: string[], extra: Parameters<typeof inHand>[2] = {}) => score(setup, inHand(setup, hand, { skills: [skillId], trainsUsed: 1, ...extra }))
  const plain = (hand: string[], extra: Parameters<typeof inHand>[2] = {}) => score(setup, inHand(setup, hand, { trainsUsed: 1, ...extra }))

  it('applies each rule', () => {
    expect(with1('kick', ['st', 'po']).cardPoints).toBe(plain(['st', 'po']).cardPoints + 8)
    expect(score(setup, inHand(setup, ['st'], { skills: ['corner'] })).factor).toBe(2)
    expect(with1('straight', ['st', 'po', 'gu', 'sp']).bonusPoints).toBe(20)
    expect(with1('straight', ['st', 'po', 'gu']).bonusPoints).toBe(0)
    expect(with1('spurt', ['st'], { trainsLeft: 1 }).mult).toBe(1 + 3)
    expect(with1('surge', ['sp']).mult).toBe(plain(['sp']).mult + 2)
    expect(with1('apt', ['po']).cardPoints).toBe(plain(['po']).cardPoints + 5)
    expect(with1('form', ['st']).bonusPoints).toBe(15)
    expect(score(setup, inHand(setup, ['st'], { skills: ['gate'], kind: 'race', favoured: ['speed', 'wit'] })).factor).toBe(1.5)
  })
})

// ── Flow ────────────────────────────────────────────────────────────────────────────────────────────────────────────

const deckCards = [def('m', 'speed'), def('a', 'speed'), def('b', 'stamina'), def('c', 'power'), def('d', 'guts'), def('e', 'wit')]

describe('a run', () => {
  const setup = setupWith(deckCards, { skills: [skillDef('w1', 'form'), skillDef('g1', 'kick', true)] })

  it('loses when the trains run out short of the target', () => {
    let state = ftApply(setup, ftStart(setup), { type: 'facility', index: 0 })
    state.encounter!.target = 1e9
    for (let train = 0; train < 3; train += 1) state = ftApply(setup, state, { type: 'train', uids: [state.encounter!.hand[0]!] })
    expect(state.phase).toBe('lost')
    expect(() => ftApply(setup, state, { type: 'train', uids: [1] })).toThrow(FtActionError)
  })

  it('pays the week and two fans per unused train, then offers three cards', () => {
    let state = ftApply(setup, ftStart(setup), { type: 'facility', index: 0 })
    const payout = state.encounter!.payout
    state.encounter!.target = 1
    state = ftApply(setup, state, { type: 'train', uids: [state.encounter!.hand[0]!] })
    expect(state.phase).toBe('reward')
    expect(state.fans).toBe(payout + 2 * 2)
    expect(state.rewardOffer).toHaveLength(3)
  })

  it('lets you give up at any point', () => {
    const state = ftApply(setup, ftStart(setup), { type: 'give-up' })
    expect(state.phase).toBe('lost')
    expect(state.lossReason).toBe('Gave up.')
  })

  it('rejects choices the phase does not allow', () => {
    expect(() => ftApply(setup, ftStart(setup), { type: 'train', uids: [1] })).toThrow(FtActionError)
    expect(() => ftApply(setup, ftStart(setup), { type: 'facility', index: 7 })).toThrow(FtActionError)
    const state = ftApply(setup, ftStart(setup), { type: 'facility', index: 0 })
    expect(() => ftApply(setup, state, { type: 'train', uids: [] })).toThrow(FtActionError)
    expect(() => ftApply(setup, state, { type: 'train', uids: [999] })).toThrow(FtActionError)
    expect(() => ftApply(setup, state, { type: 'redraw', uids: state.encounter!.hand.slice(0, 6) })).toThrow(FtActionError)
  })

  it('redraws twice a week, then refuses', () => {
    let state = ftApply(setup, ftStart(setup), { type: 'facility', index: 0 })
    state = ftApply(setup, state, { type: 'redraw', uids: [state.encounter!.hand[1]!] })
    state = ftApply(setup, state, { type: 'redraw', uids: [state.encounter!.hand[1]!] })
    expect(state.encounter!.hand).toHaveLength(7)
    expect(() => ftApply(setup, state, { type: 'redraw', uids: [state.encounter!.hand[1]!] })).toThrow(FtActionError)
  })
})

describe('the shop', () => {
  const setup = setupWith(deckCards, { skills: [skillDef('w1', 'form'), skillDef('w2', 'kick'), skillDef('g1', 'kick', true)] })
  const shopState = (fans: number): FtState => {
    const state = ftStart(setup)
    return { ...state, phase: 'shop', fans, facilityOffers: null, shop: { copy: 'a', white: 'w1', gold: 'g1', bought: [], rerolls: 0 } }
  }

  it('charges its prices, sells each item once a visit, and needs a slot for a skill', () => {
    let state = ftApply(setup, shopState(30), { type: 'buy', item: 'copy' })
    expect(state.fans).toBe(30 - FT_SHOP_PRICES.copy)
    expect(state.deck.filter((entry) => entry.cardId === 'a')).toHaveLength(3)
    expect(() => ftApply(setup, state, { type: 'buy', item: 'copy' })).toThrow(FtActionError)
    state = ftApply(setup, state, { type: 'buy', item: 'upgrade', uid: 1 })
    expect(state.deck.find((entry) => entry.uid === 1)!.bonus).toBe(5)
    state = ftApply(setup, state, { type: 'buy', item: 'gold' })
    expect(state.skills).toEqual(['g1'])
    state = ftApply(setup, state, { type: 'buy', item: 'remove', uid: 2 })
    expect(state.deck.some((entry) => entry.uid === 2)).toBe(false)
    expect(state.fans).toBe(30 - 4 - 3 - 8 - 3)
    expect(() => ftApply(setup, shopState(1), { type: 'buy', item: 'gold' })).toThrow(FtActionError)
  })

  it('rerolls the stock for two fans and moves on to the next stage', () => {
    const rolled = ftApply(setup, shopState(10), { type: 'buy', item: 'reroll' })
    expect(rolled.fans).toBe(8)
    expect(rolled.shop!.rerolls).toBe(1)
    const two = { ...setup, races: [...setup.races, { ...setup.races[0]!, grade: 'g2' as const }] }
    const left = ftApply(two, { ...shopState(0) }, { type: 'leave-shop' })
    expect(left.stage).toBe(1)
    expect(left.phase).toBe('facility')
  })
})

// ── Twists ──────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('scenario twists', () => {
  const cards = [def('m', 'wit'), def('a', 'speed'), def('b', 'stamina'), def('c', 'power'), def('d', 'guts'), def('e', 'wit'),
    def('hi', 'speed', 'trainingBonus', { stars: 3 })]
  const twist = (id: FtTwistId, extra: Parameters<typeof setupWith>[1] = {}) => setupWith(cards, { twist: id, ...extra })

  it('Team Spirit: five different characters add +1 mult', () => {
    const setup = twist('team-spirit')
    expect(score(setup, inHand(setup, ['a', 'b', 'c', 'd', 'e'])).mult).toBe(4 + 1)
  })

  it('Climax: each race won adds +1 mult', () => {
    const setup = twist('climax')
    const state = inHand(setup, ['b'])
    state.twist.racesWon = 2
    expect(score(setup, state).mult).toBe(1 + 2)
  })

  it('Performance: five notes make the next train score × 2', () => {
    const setup = twist('performance')
    const after = ftApply(setup, inHand(setup, ['a', 'b', 'c', 'd', 'e', 'm'], { trainsLeft: 3 }), { type: 'train', uids: [1, 2, 3, 4, 5] })
    expect(after.twist.performanceReady).toBe(true)
    expect(score(setup, after, after.encounter!.hand.slice(0, 1)).factor).toBe(2)
  })

  it('Fragments: a 3★ card earns two, and eight make × 1.5', () => {
    const setup = twist('fragments')
    const state = inHand(setup, ['hi', 'a'], { trainsLeft: 3 })
    state.twist.fragments = 6
    const after = ftApply(setup, state, { type: 'train', uids: [1] })
    expect(after.twist.fragmentsReady).toBe(true)
    expect(score(setup, after, after.encounter!.hand).factor).toBe(1.5)
  })

  it('Expedition: a won race makes its first favoured type on-type', () => {
    const setup = twist('expedition')
    const state = inHand(setup, ['b'], { facility: 'speed' })
    state.twist.expedition = ['stamina']
    expect(score(setup, state).cardPoints).toBe(16)
  })

  it('Genres: the same facility again adds +1 mult per week of the streak', () => {
    const setup = twist('genres')
    const state = inHand(setup, ['b'], { facility: 'speed' })
    state.weeksTrained = ['stamina', 'speed', 'speed', 'speed']
    expect(score(setup, state).mult).toBe(1 + 2)
  })

  it('Cooking: three of an ingredient cook × 1.2 for three trains', () => {
    const setup = twist('cooking')
    const state = inHand(setup, ['b'])
    state.twist.dishTrains = 3
    expect(score(setup, state).factor).toBe(1.2)
  })

  it('Research: each level adds 10% at its facility', () => {
    const setup = twist('research')
    const state = inHand(setup, ['b'], { facility: 'speed' })
    state.twist.research.speed = 2
    expect(score(setup, state).factor).toBeCloseTo(1.2, 9)
  })

  it('Legends: one card plays as if at 5★', () => {
    const setup = twist('legends', { legends: 'a' })
    expect(score(setup, inHand(setup, ['a'])).cardPoints).toBe(10 * 1.5 + 6)
  })

  it('Construction: build two facilities first; they pay +5 per card', () => {
    const setup = twist('construction')
    const start = ftStart(setup)
    expect(start.phase).toBe('build')
    expect(() => ftApply(setup, start, { type: 'build', facilities: ['speed', 'speed'] })).toThrow(FtActionError)
    const built = ftApply(setup, start, { type: 'build', facilities: ['speed', 'wit'] })
    expect(built.phase).toBe('facility')
    const state = inHand(setup, ['b'], { facility: 'speed' })
    state.twist.built = ['speed', 'wit']
    expect(score(setup, state).cardPoints).toBe(5 + 6 + 5)
  })

  it('Soak: the stage after a race gets +1 redraw a week', () => {
    const setup = twist('soak')
    const state = ftStart(setup)
    state.twist.soakStage = 0
    expect(ftApply(setup, state, { type: 'facility', index: 0 }).encounter!.redrawsLeft).toBe(3)
  })

  it('Shared Light: the two least-trained types get +1 mult', () => {
    const setup = twist('shared-light')
    const state = inHand(setup, ['b'], { facility: 'guts' })
    state.trainsByType = { speed: 3, stamina: 2, power: 4, guts: 0, wit: 1 }
    expect(score(setup, state).mult).toBe(2)
    state.encounter!.facility = 'power'
    expect(score(setup, state).mult).toBe(1)
  })

  it('Orders: filling the week’s formation pays 3 fans', () => {
    const setup = twist('orders')
    const state = inHand(setup, ['b', 'b', 'a'])
    state.encounter!.order = 'duo'
    expect(ftApply(setup, state, { type: 'train', uids: [1, 2] }).fans).toBe(3)
  })
})

// ── Determinism ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('determinism', () => {
  const pool = [...deckCards, def('f', 'friend', 'friendshipBonus'), def('g', 'stamina', 'hintFrequency'), def('h', 'power', 'specialtyPriority')]
  const setup = { ...setupWith(pool, { deck: ['m', 'm', 'a', 'a', 'b', 'b', 'c', 'c', 'd', 'd', 'e', 'e'], earning: 3, skills: [skillDef('s1', 'surge'), skillDef('s2', 'second-wind', true), skillDef('s3', 'vision')] }),
    races: [
      { id: 'r1', name: 'One', grade: 'g3' as const, distance: 1200, distanceCategory: 'sprint' as const, surface: 'turf' as const },
      { id: 'r2', name: 'Two', grade: 'g2' as const, distance: 2000, distanceCategory: 'medium' as const, surface: 'dirt' as const },
      { id: 'r3', name: 'Three', grade: 'g1' as const, distance: 3000, distanceCategory: 'long' as const, surface: 'turf' as const },
    ] }

  it('replays the same choices to the same run', () => {
    const { actions, state } = ftBotPlay(setup)
    expect(actions.length).toBeGreaterThan(5)
    expect(ftReplay(setup, actions)).toEqual(state)
    expect(ftReplay(setup, actions.slice(0, 4))).toEqual(ftReplay(setup, actions.slice(0, 4)))
    expect(parseFtSetup(JSON.parse(JSON.stringify(setup)))).toEqual(setup)
    expect(parseFtActions(JSON.parse(JSON.stringify(actions)))).toEqual(actions)
    expect(ftStateHash(ftReplay(setup, actions))).toBe(ftStateHash(state))
  })

  it('rejects malformed and unbounded saved inputs and actions', () => {
    expect(parseFtSetup({ ...setup, extra: true })).toBeNull()
    expect(parseFtSetup({ ...setup, deck: Array.from({ length: 65 }, () => 'm') })).toBeNull()
    expect(parseFtAction({ type: 'train', uids: [] })).toBeNull()
    expect(parseFtAction({ type: 'facility', index: 0, extra: true })).toBeNull()
    expect(parseFtActions(Array.from({ length: 65 }, () => ({ type: 'give-up' })))).toBeNull()
  })

  it('rejects an action list that does not fit the run', () => {
    const bogus: FtAction[] = [{ type: 'facility', index: 0 }, { type: 'train', uids: [424242] }]
    expect(() => ftReplay(setup, bogus)).toThrow(FtActionError)
  })

  it('never lets a different seed reuse the same draws', () => {
    const one = ftApply(setup, ftStart(setup), { type: 'facility', index: 0 })
    const two = ftApply({ ...setup, seed: 99 }, ftStart({ ...setup, seed: 99 }), { type: 'facility', index: 0 })
    expect(one.encounter!.draw).not.toEqual(two.encounter!.draw)
  })
})
