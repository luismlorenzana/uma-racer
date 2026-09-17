import { describe, expect, it } from 'vitest'
import {
  CARD_EFFECTS,
  CARD_UNIQUE_BONUS_MULTIPLIER,
  cardUniqueEffectKinds,
  projectCardEffects,
  promoteCard,
  projectedCardEffectValue,
  sourceCardEffect,
  type CardSave,
  type SupportCardTemplate,
} from './index'

const template = (overrides: Partial<SupportCardTemplate> = {}): SupportCardTemplate => ({
  id: 'card-synthetic',
  charaId: 'character-synthetic',
  charName: 'Synthetic Runner',
  title: 'Practice Notes',
  type: 'speed',
  jpRelease: '2021-01-01',
  era: 1,
  obtain: 'free',
  starter: true,
  hintSkillIds: [],
  eventSkillIds: [],
  effectProfile: Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 1])) as SupportCardTemplate['effectProfile'],
  uniqueEffect: null,
  imageSource: 'https://example.invalid/synthetic.png',
  ...overrides,
})

const card = (overrides: Partial<CardSave> = {}): CardSave => ({
  templateId: 'card-synthetic',
  level: 5,
  exp: 100,
  limitBreak: 0,
  maxCouponGranted: false,
  ...overrides,
})

describe('support-card promotion', () => {
  it('advances into each LB band, spends its cost, and pays the level reward', () => {
    const states: CardSave[] = [
      card(),
      card({ level: 10, exp: 175, limitBreak: 1 }),
      card({ level: 15, exp: 250, limitBreak: 2 }),
      card({ level: 20, exp: 325, limitBreak: 3 }),
    ]
    expect(states.map((state) => promoteCard(state, 500))).toMatchObject([
      { toLimitBreak: 1, cost: 20, levelGained: 6, ticketReward: 2, ticketDelta: -18, card: { level: 6, exp: 0, limitBreak: 1 } },
      { toLimitBreak: 2, cost: 40, levelGained: 11, ticketReward: 2, ticketDelta: -38, card: { level: 11, exp: 0, limitBreak: 2 } },
      { toLimitBreak: 3, cost: 60, levelGained: 16, ticketReward: 2, ticketDelta: -58, card: { level: 16, exp: 0, limitBreak: 3 } },
      { toLimitBreak: 4, cost: 80, levelGained: 21, ticketReward: 2, ticketDelta: -78, card: { level: 21, exp: 0, limitBreak: 4 } },
    ])
  })

  it('rejects incomplete, unaffordable, maxed, and malformed promotions', () => {
    expect(() => promoteCard(card({ exp: 99 }), 500)).toThrow('Fill the level 5 EXP bar')
    expect(() => promoteCard(card(), 19)).toThrow('need 20')
    expect(() => promoteCard(card({ level: 25, exp: 0, limitBreak: 4 }), 500)).toThrow('maximum limit break')
    expect(() => promoteCard(card({ level: 0 }), 500)).toThrow('state is invalid')
  })
})

describe('generated card effects', () => {
  it('applies documented LB gates and improvements through one projection', () => {
    const support = template()
    expect(projectedCardEffectValue('raceBonus', support, { level: 5, limitBreak: 0 })).toBe(0)
    expect(projectedCardEffectValue('raceBonus', support, { level: 6, limitBreak: 1 })).toBeCloseTo(0.033)
    const specialtyLb1 = projectedCardEffectValue('specialtyPriority', support, { level: 10, limitBreak: 1 })
    const specialtyLb2 = projectedCardEffectValue('specialtyPriority', support, { level: 11, limitBreak: 2 })
    expect(specialtyLb2).toBeGreaterThan(specialtyLb1 * 1.4)
    const initialLb2 = projectedCardEffectValue('initialStats', support, { level: 15, limitBreak: 2 })
    const initialLb3 = projectedCardEffectValue('initialStats', support, { level: 16, limitBreak: 3 })
    expect(initialLb3).toBeGreaterThan(initialLb2 * 1.8)
    expect(projectCardEffects(support, { level: 1, limitBreak: 0 })).toHaveLength(CARD_EFFECTS.length)
  })

  it('maps, deduplicates, and scales only supported LB4 unique identities', () => {
    const support = template({ uniqueEffect: { level: 30, effects: [
      { type: 8, value: 999 },
      { type: 8, value: -123 },
      { type: 3, value: 456 },
      { type: 999, value: 1 },
    ] } })
    expect(sourceCardEffect(3, 'speed')).toBe('statBonus')
    expect(sourceCardEffect(3, 'stamina')).toBeNull()
    expect([...cardUniqueEffectKinds(support)].sort()).toEqual(['statBonus', 'trainingBonus'])

    const rows = projectCardEffects(support, { level: 25, limitBreak: 4 })
    const training = rows.find((row) => row.effect === 'trainingBonus')!
    const stat = rows.find((row) => row.effect === 'statBonus')!
    const hint = rows.find((row) => row.effect === 'hintFrequency')!
    expect(training.signatureBonus / (training.value - training.signatureBonus)).toBeCloseTo(CARD_UNIQUE_BONUS_MULTIPLIER)
    expect(stat.signatureBonus).toBeGreaterThan(0)
    expect(hint.signatureBonus).toBe(0)
  })
})
