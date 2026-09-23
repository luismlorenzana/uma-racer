// Shared support-deck validation (docs/design/support-cards.md#deck).

import { STATS } from './types'
import { cardLimitBreak } from './card-progression'
import { CARD_SET_SIZE, cardNodeValue, paysSkillPoints, type NodeAssignment } from './constellation'
import { cardRaceBonus, deckSlotCount } from './cards'
import type { SupportCardTemplate, UmaTemplate } from './content'
import type { CardSave, ScenarioTraining } from './save'
import { SAVE_ID_PATTERN } from './save'

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

/** The share of race EXP a card set adds: each card's Race Bonus at its bond in this scenario (D125, D127). */
export function cardSetRaceBonus(cards: readonly SupportDeckCard[], tier: number): number {
  return cards.reduce((total, card) => total + cardRaceBonus(card.template, cardLimitBreak(card.save, tier)), 0)
}

/**
 * Deterministic auto-fill for a scenario's six-card set. Prefers one card per stat in the Uma's growth
 * order, then one Friend or Group card for the set's skill points (D132), then the strongest remaining stat
 * cards; further skill-point cards only if nothing else is left. Ties break on era, then limit break, then card
 * id, so the same collection always produces the same set.
 */
export function autoCardSet(
  umaTemplate: Pick<UmaTemplate, 'growthRates'>,
  tier: number,
  owned: readonly SupportDeckCard[],
): string[] {
  const eligible = owned.filter((card) => card.template.era <= tier)
  const strength = (card: SupportDeckCard) =>
    cardNodeValue(tier, { template: card.template, limitBreak: cardLimitBreak(card.save, tier) })
  const ranked = [...eligible].sort((left, right) =>
    strength(right) - strength(left) ||
    right.template.era - left.template.era ||
    cardLimitBreak(right.save, tier) - cardLimitBreak(left.save, tier) ||
    left.template.id.localeCompare(right.template.id))

  const picked: SupportDeckCard[] = []
  const characters = new Set<string>()
  const take = (card: SupportDeckCard): boolean => {
    if (picked.length >= CARD_SET_SIZE || characters.has(card.template.charaId)) return false
    picked.push(card)
    characters.add(card.template.charaId)
    return true
  }

  // First pass: cover each stat, strongest growth first, so her identity shapes the set.
  const byGrowth = [...STATS].sort((left, right) =>
    (umaTemplate.growthRates[right] ?? 0) - (umaTemplate.growthRates[left] ?? 0) || left.localeCompare(right))
  for (const stat of byGrowth) {
    const match = ranked.find((card) => card.template.type === stat && !picked.includes(card))
    if (match) take(match)
  }
  // Second pass: one skill-point card, so the set can afford a loadout.
  if (!picked.some((card) => paysSkillPoints(card.template))) {
    const skillPoints = ranked.find((card) => paysSkillPoints(card.template) && !picked.includes(card))
    if (skillPoints) take(skillPoints)
  }
  // Third pass: the strongest remaining stat cards, then anything left.
  for (const statCardsOnly of [true, false]) {
    for (const card of ranked) {
      if (picked.length >= CARD_SET_SIZE) break
      if (!picked.includes(card) && (!statCardsOnly || !paysSkillPoints(card.template))) take(card)
    }
  }
  return picked.map((card) => card.template.id)
}

/**
 * A scenario run with a new card set. A card replaced in its slot hands its nodes to the card that replaced it, so
 * trading up keeps the constellation filled; a card removed outright empties its nodes rather than leaving them
 * assigned to a card the set no longer holds, which would pay nothing and still look filled.
 */
export function withCardSet(run: ScenarioTraining, orderedCardIds: readonly string[]): ScenarioTraining {
  const next = new Set(orderedCardIds)
  const previous = new Set(run.cardSetIds)
  const handoff = new Map<string, string>()
  run.cardSetIds.forEach((id, index) => {
    const replacement = orderedCardIds[index]
    if (!next.has(id) && replacement !== undefined && !previous.has(replacement)) handoff.set(id, replacement)
  })
  const assignments: Record<string, NodeAssignment> = {}
  for (const [nodeId, assignment] of Object.entries(run.assignments)) {
    if (assignment.kind !== 'card' || next.has(assignment.cardId)) {
      assignments[nodeId] = assignment
      continue
    }
    const replacement = handoff.get(assignment.cardId)
    if (replacement) assignments[nodeId] = { kind: 'card', cardId: replacement }
  }
  return { ...run, cardSetIds: [...orderedCardIds], assignments }
}

/** How many of a run's nodes a card fills. */
export const cardNodeCount = (run: Pick<ScenarioTraining, 'assignments'>, cardId: string): number =>
  Object.values(run.assignments).filter((assignment) => assignment.kind === 'card' && assignment.cardId === cardId).length
