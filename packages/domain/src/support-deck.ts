// Shared support-deck validation (docs/design/support-cards.md#deck).

import { CARD_EFFECTS, deckSlotCount, projectedCardEffectValue, type CardEffect } from './cards'
import type { SupportCardTemplate } from './content'
import type { CardSave } from './save'
import { SAVE_ID_PATTERN } from './save'
import { STATS } from './types'

export interface SupportDeckCard {
  save: CardSave
  template: SupportCardTemplate
}

export type SupportDeckIssueCode =
  | 'invalid-tier'
  | 'empty'
  | 'too-many'
  | 'unsafe-id'
  | 'duplicate-id'
  | 'not-owned'
  | 'missing-content'
  | 'save-content-mismatch'
  | 'duplicate-character'
  | 'later-era'
  | 'unsupported-type'

export interface SupportDeckIssue {
  code: SupportDeckIssueCode
  displayId: string
  limit?: number
  requiredTier?: number
  characterId?: string
}

export interface SupportDeckValidation {
  valid: boolean
  cards: SupportDeckCard[]
  issues: SupportDeckIssue[]
}

const safeDisplayId = (id: string): string => SAVE_ID_PATTERN.test(id) ? id : '(invalid id)'

export function supportDeckIssueMessage(issue: SupportDeckIssue): string {
  switch (issue.code) {
    case 'invalid-tier': return 'Support deck tier is invalid'
    case 'empty': return 'Equip at least one support card'
    case 'too-many': return `This scenario has only ${issue.limit ?? 0} support slots`
    case 'unsafe-id': return 'A support-card id is invalid'
    case 'duplicate-id': return `Support card ${issue.displayId} is selected twice`
    case 'not-owned': return `Support card ${issue.displayId} is not owned`
    case 'missing-content': return `Support card ${issue.displayId} is missing from current content`
    case 'save-content-mismatch': return `Support card ${issue.displayId} has mismatched save data`
    case 'duplicate-character': return `Another card already represents character ${issue.characterId ?? issue.displayId}`
    case 'later-era': return `Support card ${issue.displayId} is Era locked until tier ${issue.requiredTier ?? '?'}`
    case 'unsupported-type': return `Support card ${issue.displayId} cannot be used in MVP: Friend/Group is not yet equipable`
  }
}

/** Checks ordered identity/slot rules before callers perform any save or content lookup. */
export function supportDeckIdentityIssues(
  tier: number,
  orderedCardIds: readonly string[],
  allowEmpty = false,
): SupportDeckIssue[] {
  const issues: SupportDeckIssue[] = []
  if (!Number.isSafeInteger(tier) || tier < 1) {
    issues.push({ code: 'invalid-tier', displayId: '(deck)' })
    return issues
  }
  if (!allowEmpty && orderedCardIds.length === 0) issues.push({ code: 'empty', displayId: '(deck)' })
  const limit = deckSlotCount(tier)
  if (orderedCardIds.length > limit) issues.push({ code: 'too-many', displayId: '(deck)', limit })
  const seen = new Set<string>()
  for (const id of orderedCardIds) {
    if (!SAVE_ID_PATTERN.test(id)) {
      issues.push({ code: 'unsafe-id', displayId: '(invalid id)' })
      continue
    }
    if (seen.has(id)) issues.push({ code: 'duplicate-id', displayId: id })
    seen.add(id)
  }
  return issues
}

/** Resolve and validate the saved ordered ids against account ownership and current private content. */
export function validateSupportDeck(input: {
  tier: number
  orderedCardIds: readonly string[]
  ownedCards: readonly CardSave[]
  templates: ReadonlyMap<string, SupportCardTemplate>
  allowEmpty?: boolean
}): SupportDeckValidation {
  const identityIssues = supportDeckIdentityIssues(input.tier, input.orderedCardIds, input.allowEmpty)
  if (identityIssues.some((issue) => issue.code === 'invalid-tier' || issue.code === 'unsafe-id' || issue.code === 'duplicate-id')) {
    return { valid: false, cards: [], issues: identityIssues }
  }
  const issues = [...identityIssues]
  const owned = new Map(input.ownedCards.map((card) => [card.templateId, card]))
  const cards: SupportDeckCard[] = []
  const characters = new Set<string>()
  for (const id of input.orderedCardIds) {
    const save = owned.get(id)
    if (!save) {
      issues.push({ code: 'not-owned', displayId: safeDisplayId(id) })
      continue
    }
    const template = input.templates.get(id)
    if (!template) {
      issues.push({ code: 'missing-content', displayId: safeDisplayId(id) })
      continue
    }
    if (save.templateId !== template.id) {
      issues.push({ code: 'save-content-mismatch', displayId: safeDisplayId(id) })
      continue
    }
    if (!STATS.includes(template.type as (typeof STATS)[number])) {
      issues.push({ code: 'unsupported-type', displayId: safeDisplayId(id) })
    }
    if (template.era > input.tier) {
      issues.push({ code: 'later-era', displayId: safeDisplayId(id), requiredTier: template.era })
    }
    if (characters.has(template.charaId)) {
      issues.push({
        code: 'duplicate-character',
        displayId: safeDisplayId(id),
        characterId: safeDisplayId(template.charaId),
      })
    }
    characters.add(template.charaId)
    cards.push({ save, template })
  }
  return { valid: issues.length === 0, cards, issues }
}

export function validateEquippedSupportDeck(
  tier: number,
  cards: readonly SupportDeckCard[],
  allowEmpty = false,
): SupportDeckValidation {
  return validateSupportDeck({
    tier,
    orderedCardIds: cards.map((card) => card.template.id),
    ownedCards: cards.map((card) => card.save),
    templates: new Map(cards.map((card) => [card.template.id, card.template])),
    allowEmpty,
  })
}

export function supportDeckEffectTotals(cards: readonly SupportDeckCard[]): Record<CardEffect, number> {
  return Object.fromEntries(CARD_EFFECTS.map((effect) => [
    effect,
    cards.reduce((total, card) => total + projectedCardEffectValue(effect, card.template, card.save), 0),
  ])) as Record<CardEffect, number>
}
