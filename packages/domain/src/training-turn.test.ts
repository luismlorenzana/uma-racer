import { describe, expect, it } from 'vitest'
import type { CardSave } from './save'
import type { SkillTemplate, SupportCardTemplate, UmaTemplate } from './content'
import {
  addCardTrainingExp,
  assertTrainingContent,
  autoTrainingDeck,
  dealTrainingCards,
  previewTrainingFacilities,
  resolveTrainingTurn,
  trainingDeckError,
  trainingTurnSeed,
  type TrainingCardInput,
  type TrainingDeal,
} from './training-turn'
import { createCardSave, createUmaSave } from './save'
import { CARD_EFFECTS, type CardEffect } from './cards'
import { createScenarioModifierState } from './scenario-modifiers'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

const zeroProfile = (): Record<CardEffect, number> =>
  Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 0])) as Record<CardEffect, number>

function uma(growthRates = { speed: 0.1, stamina: 0, power: 0.2, guts: 0, wit: 0 }): UmaTemplate {
  return {
    id: 'uma-1',
    charaId: 'uma-character-1',
    name: 'Synthetic Runner',
    outfit: null,
    jpRelease: '2000-01-01',
    globalRelease: null,
    starter: true,
    baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    growthRates,
    aptitudes,
    uniqueSkillId: 'skill-unique',
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaceFamilyIds: [],
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

function card(
  id: string,
  type: SupportCardTemplate['type'],
  options: { charaId?: string; era?: number; hints?: string[]; profile?: Partial<Record<CardEffect, number>> } = {},
): SupportCardTemplate {
  return {
    id,
    charaId: options.charaId ?? `character-${id}`,
    charName: `Synthetic ${id}`,
    title: '',
    type,
    jpRelease: '2000-01-01',
    era: options.era ?? 1,
    obtain: 'free',
    starter: true,
    hintSkillIds: options.hints ?? [],
    eventSkillIds: [],
    effectProfile: { ...zeroProfile(), ...options.profile },
    uniqueEffect: null,
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

function input(template: SupportCardTemplate, save: CardSave = createCardSave(template)): TrainingCardInput {
  return { template, save }
}

function skill(id: string, kind: SkillTemplate['kind'] = 'white'): SkillTemplate {
  return { id, kind, name: `Synthetic ${id}`, description: '', costSp: 100, iconId: null, conditions: [], inheritedSkillId: null, normalSkillId: null }
}

const unique = skill('skill-unique', 'unique')

describe('Training decks and content', () => {
  it('auto-fills growth-priority types deterministically and rejects invalid decks', () => {
    const cards = [
      input(card('speed-b', 'speed')),
      input(card('speed-a', 'speed')),
      input(card('stamina-a', 'stamina')),
      input(card('power-a', 'power')),
      input(card('guts-a', 'guts')),
      input(card('wit-a', 'wit')),
      input(card('future-a', 'power', { era: 2 })),
      input(card('group-a', 'group')),
    ]
    expect(autoTrainingDeck(uma(), 1, cards)).toEqual(['power-a', 'speed-a', 'stamina-a', 'guts-a'])
    expect(autoTrainingDeck(uma(), 1, [...cards].reverse())).toEqual(['power-a', 'speed-a', 'stamina-a', 'guts-a'])
    expect(autoTrainingDeck(uma(), 1, [input(card('future-only', 'speed', { era: 2 })), input(card('friend-only', 'friend'))])).toEqual(['friend-only'])
    expect(autoTrainingDeck(uma(), 3, [
      ...cards.filter((entry) => ['speed-a', 'stamina-a', 'power-a', 'guts-a', 'wit-a'].includes(entry.template.id)),
      input(card('friend-wildcard', 'friend')),
      input(card('group-wildcard', 'group')),
    ])).toEqual(['power-a', 'speed-a', 'stamina-a', 'guts-a', 'wit-a', 'friend-wildcard'])
    expect(trainingDeckError(1, cards.slice(0, 1))).toBeNull()
    expect(trainingDeckError(1, [])).toMatch(/at least one/)
    expect(trainingDeckError(1, [input(card('a', 'speed', { charaId: 'same' })), input(card('b', 'power', { charaId: 'same' }))])).toMatch(/character/)
    expect(trainingDeckError(1, [input(card('future', 'speed', { era: 2 }))])).toMatch(/locked/)
    expect(trainingDeckError(1, [input(card('friend', 'friend'))])).toBeNull()
  })

  it('validates Training-only content fields and cross references', () => {
    const cards = [card('card-1', 'speed', { hints: ['skill-white'] })]
    expect(() => assertTrainingContent([uma()], cards, [unique, skill('skill-white')])).not.toThrow()
    expect(() => assertTrainingContent([{ ...uma(), growthRates: { ...uma().growthRates, speed: Number.NaN } }], cards, [unique, skill('skill-white')])).toThrow(/growth/)
    expect(() => assertTrainingContent([uma()], [{ ...cards[0]!, hintSkillIds: ['missing'] }], [unique])).toThrow(/hint/)
  })
})

describe('deterministic Training deal and preview', () => {
  it('keeps seeds/deals stable and reaches specialty, random, and sit-out paths', () => {
    const synthetic = input(card('card-1', 'speed'))
    const seed = trainingTurnSeed(1234, 'uma-1', 1, 0)
    expect(trainingTurnSeed(1234, 'uma-1', 1, 0)).toBe(seed)
    expect(trainingTurnSeed(1234, 'uma-1', 1, 1)).not.toBe(seed)
    expect(dealTrainingCards([synthetic], seed)).toEqual(dealTrainingCards([synthetic], seed))

    const placements = new Set(
      Array.from({ length: 500 }, (_, index) =>
        dealTrainingCards([synthetic], trainingTurnSeed(1234, 'uma-1', 1, index)).placements[0]!.placement,
      ),
    )
    expect(placements.has('speed')).toBe(true)
    expect(placements.has('out')).toBe(true)
    expect([...placements].some((placement) => placement !== 'speed' && placement !== 'out')).toBe(true)

    const guaranteed = input(card('card-2', 'power', { profile: { specialtyPriority: 10 } }))
    expect(dealTrainingCards([guaranteed], 1).placements[0]!.placement).toBe('power')
  })

  it('places Friend/Group uniformly at facilities, spreads stats, and never creates friendship', () => {
    const broad = input(card('broad-card', 'group', { profile: { statBonus: 1 } }))
    const placements = new Set(
      Array.from({ length: 500 }, (_, index) =>
        dealTrainingCards([broad], trainingTurnSeed(5678, 'uma-1', 1, index)).placements[0]!.placement,
      ),
    )
    expect([...placements].sort()).toEqual([...(['guts', 'power', 'speed', 'stamina', 'wit'] as const)].sort())

    const template = uma({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 })
    const save = { ...createUmaSave(template), scenarioStarted: true }
    const deal: TrainingDeal = { seed: 1, placements: [{ cardId: broad.template.id, placement: 'speed' }] }
    const preview = previewTrainingFacilities(save, template, [broad], deal).speed
    expect(preview).toMatchObject({
      rawGains: { speed: 64, stamina: 1, power: 26, guts: 1, wit: 1, sp: 6 },
      friendship: false,
      friendshipCardIds: [],
    })
    const result = resolveTrainingTurn({
      uma: save,
      template,
      cards: [broad],
      skills: new Map([[unique.id, unique]]),
      deal,
      facility: 'speed',
    })
    expect(result.trainingExpGained).toBe(36)
    expect(result.cards[0]).toMatchObject({ expGained: 15 })
  })

  it('previews the exact capped gains for every facility', () => {
    const template = uma({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 })
    const save = { ...createUmaSave(template), scenarioStarted: true }
    const cards = [input(card('speed-card', 'speed')), input(card('power-card', 'power'))]
    const deal: TrainingDeal = {
      seed: 1,
      placements: [
        { cardId: 'speed-card', placement: 'speed' },
        { cardId: 'power-card', placement: 'speed' },
      ],
    }
    const preview = previewTrainingFacilities(save, template, cards, deal).speed
    expect(preview).toMatchObject({
      rawGains: { speed: 66, power: 26, sp: 7 },
      appliedGains: { speed: 66, power: 26, sp: 7 },
      friendship: true,
      presentCardIds: ['speed-card', 'power-card'],
      friendshipCardIds: ['speed-card'],
    })

    const capped = previewTrainingFacilities({ ...save, stats: { ...save.stats, speed: 955 } }, template, cards, deal).speed
    expect(capped.appliedGains.speed).toBe(5)

    const softCappedUma = {
      ...save,
      level: 11,
      trainingLevel: 10,
      stats: { ...save.stats, speed: 1190 },
    }
    const sitOut: TrainingDeal = { seed: 2, placements: cards.map((entry) => ({ cardId: entry.template.id, placement: 'out' })) }
    const softCapped = previewTrainingFacilities(softCappedUma, template, cards, sitOut).speed
    expect(softCapped).toMatchObject({ rawGains: { speed: 60 }, appliedGains: { speed: 35 } })
    const maxTraining = resolveTrainingTurn({
      uma: softCappedUma,
      template,
      cards,
      skills: new Map([[unique.id, unique]]),
      deal: sitOut,
      facility: 'speed',
    })
    expect(maxTraining.uma).toMatchObject({ trainingLevel: 10, trainingExp: 0, trainingsThisScenario: 1 })
  })

  it('previews and commits Team Spirit and opt-in Climax gains through the same path', () => {
    const template = uma({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 })
    const cards = [input(card('speed-card', 'speed')), input(card('power-card', 'power')), input(card('guts-card', 'guts'))]
    const deal: TrainingDeal = { seed: 3, placements: cards.map((entry) => ({ cardId: entry.template.id, placement: 'speed' })) }
    const teamUma = {
      ...createUmaSave(template),
      level: 11,
      scenarioStarted: true,
      scenarioModifier: createScenarioModifierState(2),
    }
    const ordinary = previewTrainingFacilities({ ...teamUma, scenarioModifier: null }, template, cards, deal).speed
    const spirit = previewTrainingFacilities(teamUma, template, cards, deal).speed
    for (const stat of ['speed', 'stamina', 'power', 'guts', 'wit'] as const) {
      expect(spirit.rawGains[stat]).toBe((ordinary.rawGains[stat] ?? 0) + 10)
    }
    expect(spirit.rawGains.sp).toBe(ordinary.rawGains.sp)
    expect(spirit.scenarioModifier).toMatchObject({ kind: 'team-spirit', triggered: true, presentCardCount: 3 })
    const spiritResult = resolveTrainingTurn({ uma: teamUma, template, cards, skills: new Map([[unique.id, unique]]), deal, facility: 'speed' })
    expect(spiritResult.uma.scenarioModifier).toMatchObject({ kind: 'team-spirit', bursts: 1 })

    const climaxState = {
      version: 1 as const,
      tier: 3 as const,
      kind: 'climax' as const,
      earned: 1,
      stock: 1,
      used: 0,
    }
    const climaxUma = { ...createUmaSave(template), level: 21, scenarioStarted: true, scenarioModifier: climaxState }
    const oneCard = cards.slice(0, 1)
    const oneDeal: TrainingDeal = { seed: 4, placements: [{ cardId: 'speed-card', placement: 'speed' }] }
    const saved = previewTrainingFacilities(climaxUma, template, oneCard, oneDeal).speed
    const armed = previewTrainingFacilities(climaxUma, template, oneCard, oneDeal, true).speed
    expect(armed.rawGains.speed).toBe(Math.round(saved.rawGains.speed! * 1.2))
    expect(saved.rawGains.sp).toBe(6)
    expect(armed.rawGains.sp).toBe(8)
    const climaxResult = resolveTrainingTurn({
      uma: climaxUma,
      template,
      cards: oneCard,
      skills: new Map([[unique.id, unique]]),
      deal: oneDeal,
      facility: 'speed',
      useClimaxItem: true,
    })
    expect(climaxResult.uma.scenarioModifier).toEqual({ version: 1, tier: 3, kind: 'climax', earned: 1, stock: 0, used: 1 })
    expect(climaxResult.scenarioModifier).toMatchObject({ kind: 'climax', itemConsumed: true })
  })

  it('previews and commits Concert, Masters, and L Arc progress through the same path', () => {
    const template = uma({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 })
    const cards = [input(card('speed-card', 'speed'))]
    const deal: TrainingDeal = { seed: 5, placements: [{ cardId: 'speed-card', placement: 'wit' }] }
    const base = { ...createUmaSave(template), scenarioStarted: true }

    const concertUma = {
      ...base,
      level: 31,
      scenarioModifier: { version: 1 as const, tier: 4 as const, kind: 'performances' as const, notes: ['speed', 'stamina', 'power', 'guts'] as ('speed' | 'stamina' | 'power' | 'guts' | 'wit')[], performances: 0 },
    }
    const ordinary = previewTrainingFacilities({ ...concertUma, scenarioModifier: null }, template, cards, deal).wit
    const concert = previewTrainingFacilities(concertUma, template, cards, deal).wit
    for (const stat of ['speed', 'stamina', 'power', 'guts', 'wit'] as const) {
      expect(concert.rawGains[stat]).toBe((ordinary.rawGains[stat] ?? 0) + 20)
    }
    expect(concert.rawGains.sp).toBe(ordinary.rawGains.sp)
    const concertResult = resolveTrainingTurn({ uma: concertUma, template, cards, skills: new Map(), deal, facility: 'wit' })
    expect(concertResult.uma.scenarioModifier).toEqual({ version: 1, tier: 4, kind: 'performances', notes: [], performances: 1 })

    const mastersUma = {
      ...base,
      level: 41,
      scenarioModifier: { version: 1 as const, tier: 5 as const, kind: 'goddess-fragments' as const, fragments: 7, bursts: 0 },
    }
    const plainMasters = previewTrainingFacilities({ ...mastersUma, scenarioModifier: null }, template, cards, deal).wit
    const masters = previewTrainingFacilities(mastersUma, template, cards, deal).wit
    expect(masters.rawGains.wit).toBeGreaterThan(plainMasters.rawGains.wit!)
    expect(masters.rawGains.sp).toBeGreaterThan(plainMasters.rawGains.sp!)
    expect(masters.scenarioModifier).toMatchObject({ kind: 'goddess-fragments', burst: true, multiplier: 1.5 })
    const mastersResult = resolveTrainingTurn({ uma: mastersUma, template, cards, skills: new Map(), deal, facility: 'wit' })
    expect(mastersResult.uma.scenarioModifier).toEqual({ version: 1, tier: 5, kind: 'goddess-fragments', fragments: 0, bursts: 1 })

    const expeditionUma = {
      ...base,
      level: 51,
      scenarioModifier: { version: 1 as const, tier: 6 as const, kind: 'expedition' as const, stamps: 4, completed: 0, upgraded: 0 },
    }
    const expedition = previewTrainingFacilities(expeditionUma, template, cards, deal).wit
    expect(expedition.rawGains).toEqual(plainMasters.rawGains)
    const expeditionResult = resolveTrainingTurn({ uma: expeditionUma, template, cards, skills: new Map(), deal, facility: 'wit' })
    expect(expeditionResult.uma.scenarioModifier).toEqual({ version: 1, tier: 6, kind: 'expedition', stamps: 5, completed: 0, upgraded: 0 })
    expect(expeditionResult.scenarioModifier).toMatchObject({ kind: 'expedition', stampGranted: true, ready: true })
  })
})

describe('Training resolution', () => {
  it('applies gains, friendship EXP, every card EXP bucket, levels, rewards, and opening unlock', () => {
    const template = uma({ speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 })
    const save = { ...createUmaSave(template), scenarioStarted: true }
    const nearLevel = (template: SupportCardTemplate): CardSave => ({ ...createCardSave(template), exp: 35 })
    const templates = [card('speed-card', 'speed'), card('power-card', 'power'), card('stamina-card', 'stamina')]
    const cards = templates.map((template) => input(template, nearLevel(template)))
    const deal: TrainingDeal = {
      seed: 4,
      placements: [
        { cardId: 'speed-card', placement: 'speed' },
        { cardId: 'power-card', placement: 'speed' },
        { cardId: 'stamina-card', placement: 'out' },
      ],
    }
    const result = resolveTrainingTurn({
      uma: save,
      template,
      cards,
      skills: new Map([[unique.id, unique]]),
      deal,
      facility: 'speed',
    })
    expect(result.uma).toMatchObject({
      stats: { speed: 166, stamina: 100, power: 126, guts: 100, wit: 100 },
      skillPoints: 7,
      trainingLevel: 1,
      trainingExp: 54,
      trainingsThisScenario: 1,
    })
    expect(result.cards.map((entry) => [entry.expGained, entry.card.level, entry.card.exp])).toEqual([
      [25, 2, 20],
      [15, 2, 10],
      [5, 2, 0],
    ])
    expect(result.ticketReward).toBe(6)
    expect(result.trainingExpGained).toBe(54)
  })

  it('adds deterministic hints, gates golds, and converts known pools into capped SP', () => {
    const template = uma()
    const white = skill('skill-white')
    const gold = skill('skill-gold', 'gold')
    const hintCard = card('hint-card', 'speed', {
      hints: [gold.id, white.id],
      profile: { hintFrequency: 25 },
    })
    const deal: TrainingDeal = { seed: 9, placements: [{ cardId: hintCard.id, placement: 'speed' }] }
    const skills = new Map([unique, white, gold].map((entry) => [entry.id, entry]))
    const learned = resolveTrainingTurn({
      uma: { ...createUmaSave(template), scenarioStarted: true },
      template,
      cards: [input(hintCard)],
      skills,
      deal,
      facility: 'speed',
    })
    expect(learned.hintResults).toEqual([{ cardId: hintCard.id, learnedSkillId: white.id, fallbackSp: 0 }])
    expect(learned.uma.skillLibrary.map((entry) => entry.skillId)).toContain(white.id)
    expect(learned.uma.skillLibrary.map((entry) => entry.skillId)).not.toContain(gold.id)

    const knownUma = {
      ...createUmaSave(template),
      scenarioStarted: true,
      skillPoints: 224,
      skillLibrary: [
        ...createUmaSave(template).skillLibrary,
        { skillId: white.id, origin: 'card' as const, sourceId: hintCard.id },
      ],
    }
    const fallback = resolveTrainingTurn({ uma: knownUma, template, cards: [input(hintCard)], skills, deal, facility: 'speed' })
    expect(fallback.hintSpGained).toBe(10)
    expect(fallback.uma.skillPoints).toBe(240)

    const lb3 = input(hintCard, { ...createCardSave(hintCard), level: 16, limitBreak: 3 })
    const goldOnly = { ...hintCard, hintSkillIds: [gold.id] }
    const goldResult = resolveTrainingTurn({
      uma: { ...createUmaSave(template), scenarioStarted: true },
      template,
      cards: [{ ...lb3, template: goldOnly }],
      skills,
      deal,
      facility: 'speed',
    })
    expect(goldResult.hintResults[0]?.learnedSkillId).toBe(gold.id)
  })

  it('carries Card EXP remainder and stops with full EXP at the current LB cap', () => {
    const template = card('card-1', 'speed')
    expect(addCardTrainingExp({ ...createCardSave(template), level: 4, exp: 80 }, 25)).toMatchObject({
      card: { level: 5, exp: 20 },
      levelsGained: [5],
    })
    expect(addCardTrainingExp({ ...createCardSave(template), level: 5, exp: 95 }, 25)).toMatchObject({
      card: { level: 5, exp: 100 },
      levelsGained: [],
    })
  })
})
