import { describe, expect, it } from 'vitest'
import { CARD_EFFECTS, type CardEffect } from './cards'
import type { SupportCardTemplate } from './content'
import { createCardSave } from './save'
import { equippedRaceBonus } from './progression-race'
import {
  supportDeckEffectTotals,
  supportDeckIdentityIssues,
  validateEquippedSupportDeck,
  validateSupportDeck,
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
    expect(supportDeckEffectTotals(equipped).raceBonus).toBe(equippedRaceBonus(1, equipped))
  })
})
