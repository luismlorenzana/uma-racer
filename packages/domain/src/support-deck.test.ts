import { describe, expect, it } from 'vitest'
import { CARD_EFFECTS, type CardEffect } from './cards'
import type { SupportCardTemplate } from './content'
import { createCardSave } from './save'
import { equippedRaceBonus } from './progression-race'
import type { ScenarioTraining } from './save'
import {
  autoCardSet,
  cardNodeCount,
  cardSetRaceBonus,
  supportDeckIdentityIssues,
  validateEquippedSupportDeck,
  validateSupportDeck,
  withCardSet,
} from './support-deck'

const effects = (raceBonus = 0): Record<CardEffect, number> => Object.fromEntries(
  CARD_EFFECTS.map((effect) => [effect, effect === 'raceBonus' ? raceBonus : 0]),
) as Record<CardEffect, number>

function card(id: string, options: {
  type?: SupportCardTemplate['type']
  charaId?: string
  era?: number
  raceBonus?: number
} = {}): SupportCardTemplate {
  return {
    id,
    charaId: options.charaId ?? `character-${id}`,
    charName: `Synthetic ${id}`,
    title: 'Practice Notes',
    type: options.type ?? 'speed',
    jpRelease: '2000-01-01',
    era: options.era ?? 1,
    obtain: 'free',
    starter: true,
    hintSkillIds: [],
    eventSkillIds: [],
    effectProfile: effects(options.raceBonus),
    uniqueEffect: null,
    imageSource: 'https://example.invalid/synthetic.png',
  }
}

describe('support deck validation', () => {
  it('reports identity and six-slot rules before joining content', () => {
    expect(supportDeckIdentityIssues(1, [])).toMatchObject([{ code: 'empty' }])
    expect(supportDeckIdentityIssues(1, ['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toMatchObject([{ code: 'too-many', limit: 6 }])
    expect(supportDeckIdentityIssues(2, ['a', 'b', 'c', 'd', 'e'])).toEqual([])
    expect(supportDeckIdentityIssues(3, ['a', 'b', 'c', 'd', 'e', 'f'])).toEqual([])
    expect(supportDeckIdentityIssues(1, ['safe', 'safe'])).toMatchObject([{ code: 'duplicate-id', displayId: 'safe' }])
    expect(supportDeckIdentityIssues(1, ['unsafe id'])).toMatchObject([{ code: 'unsafe-id', displayId: '(invalid id)' }])
    expect(supportDeckIdentityIssues(0, ['safe'])).toMatchObject([{ code: 'invalid-tier' }])
    expect(supportDeckIdentityIssues(1, [], true)).toEqual([])
  })

  it('preserves order and returns structured ownership/content/eligibility issues', () => {
    const first = card('first')
    const second = card('second', { type: 'power' })
    const owned = [createCardSave(first), createCardSave(second)]
    const valid = validateSupportDeck({
      tier: 1,
      orderedCardIds: ['second', 'first'],
      ownedCards: owned,
      templates: new Map([[first.id, first], [second.id, second]]),
    })
    expect(valid.valid).toBe(true)
    expect(valid.cards.map((entry) => entry.template.id)).toEqual(['second', 'first'])

    const duplicateCharacter = card('duplicate-character', { charaId: first.charaId })
    const future = card('future', { era: 2 })
    const friend = card('friend', { type: 'friend' })
    const templates = new Map([first, duplicateCharacter, future, friend].map((entry) => [entry.id, entry]))
    const invalid = validateSupportDeck({
      tier: 1,
      orderedCardIds: ['first', 'duplicate-character', 'future', 'friend', 'not-owned', 'retired'],
      ownedCards: [first, duplicateCharacter, future, friend, card('retired')].map(createCardSave),
      templates,
    })
    expect(invalid.issues.map((issue) => issue.code)).toEqual([
      'duplicate-character', 'later-era', 'not-owned', 'missing-content',
    ])

    const mismatched = validateSupportDeck({
      tier: 1,
      orderedCardIds: ['mismatch'],
      ownedCards: [{ ...createCardSave(first), templateId: 'mismatch' }],
      templates: new Map([['mismatch', { ...first, id: 'different' }]]),
    })
    expect(mismatched.issues).toMatchObject([{ code: 'save-content-mismatch', displayId: 'mismatch' }])
  })

  it('uses the same validation and generated projection for equipped gameplay cards', () => {
    const first = card('first', { raceBonus: 3 })
    const second = card('second', { type: 'friend', raceBonus: 5 })
    const third = card('third', { type: 'group', raceBonus: 4 })
    const equipped = [first, second, third].map((template) => ({
      template,
      save: { ...createCardSave(template), limitBreak: 1 as const },
    }))
    expect(validateEquippedSupportDeck(1, equipped).valid).toBe(true)
    expect(cardSetRaceBonus(equipped, 1)).toBe(equippedRaceBonus(1, equipped))
  })
})

describe('withCardSet', () => {
  const run = (cardSetIds: string[], assignments: ScenarioTraining['assignments']): ScenarioTraining => ({
    tier: 1, trainingLevel: 8, trainingExp: 0, cardSetIds, assignments, loadoutSkillIds: [], journey: null, started: true,
  })
  const base = run(['a', 'b', 'c'], {
    n1: { kind: 'card', cardId: 'a' },
    n2: { kind: 'card', cardId: 'a' },
    n3: { kind: 'card', cardId: 'b' },
    s1: { kind: 'stat', stat: 'speed' },
  })

  it('hands a replaced card\'s nodes to the card that took its slot', () => {
    const next = withCardSet(base, ['x', 'b', 'c'])
    expect(next.cardSetIds).toEqual(['x', 'b', 'c'])
    expect(cardNodeCount(next, 'x')).toBe(2)
    expect(cardNodeCount(next, 'a')).toBe(0)
    expect(next.assignments.s1).toEqual({ kind: 'stat', stat: 'speed' })
  })

  it('empties the nodes of a card removed outright', () => {
    const next = withCardSet(base, ['b', 'c'])
    expect(cardNodeCount(next, 'a')).toBe(0)
    expect(cardNodeCount(next, 'b')).toBe(1)
    expect(Object.keys(next.assignments).sort()).toEqual(['n3', 's1'])
  })

  it('keeps every node when cards only change order', () => {
    const next = withCardSet(base, ['c', 'a', 'b'])
    expect(next.assignments).toEqual(base.assignments)
  })

  it('does not hand nodes to a card that was already in the set', () => {
    // Slot 0 now holds b, which already had its own node: a's nodes must not merge into it.
    const next = withCardSet(base, ['b', 'c'])
    expect(cardNodeCount(next, 'b')).toBe(1)
  })
})

describe('autoCardSet', () => {
  const growth = { growthRates: { speed: 0.2, stamina: 0, power: 0.1, guts: 0, wit: 0 } }
  const own = (templates: SupportCardTemplate[]) => templates.map((template) => ({ save: createCardSave(template), template }))

  it('takes one Friend or Group card for skill points and fills the rest with stat cards', () => {
    const set = autoCardSet(growth, 1, own([
      card('spd', { type: 'speed' }), card('sta', { type: 'stamina' }), card('pow', { type: 'power' }),
      card('gut', { type: 'guts' }), card('wit', { type: 'wit' }), card('spd2', { type: 'speed' }),
      card('friend', { type: 'friend' }), card('group', { type: 'group' }),
    ]))
    expect(set).toHaveLength(6)
    expect(set.filter((id) => id === 'friend' || id === 'group')).toHaveLength(1)
    expect(set).toEqual(expect.arrayContaining(['spd', 'sta', 'pow', 'gut', 'wit']))
  })

  it('uses more skill-point cards only when no stat card is left', () => {
    const set = autoCardSet(growth, 1, own([card('spd', { type: 'speed' }), card('friend', { type: 'friend' }), card('group', { type: 'group' })]))
    expect([...set].sort()).toEqual(['friend', 'group', 'spd'])
  })
})
