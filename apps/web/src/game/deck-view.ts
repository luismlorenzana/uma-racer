// Pure mobile support-deck projection (docs/design/support-cards.md#deck).

import {
  activeScenario,
  CARD_EFFECTS,
  STATS,
  deckSlotCount,
  supportDeckEffectTotals,
  supportDeckIssueMessage,
  tierOfLevel,
  validateSupportDeck,
  type CardEffect,
  type CardSave,
  type SupportCardTemplate,
  type SupportCardType,
  type UmaSave,
} from '@racer/domain'
import { getContentAsset, type ContentAsset, type LoadedContent } from '../content/runtime'

export type DeckTypeFilter = 'all' | SupportCardType
export type DeckEraFilter = 'all' | 'current' | 'later'

export interface DeckFilters {
  type: DeckTypeFilter
  era: DeckEraFilter
}

export interface DeckCardView {
  id: string
  save: CardSave | null
  template: SupportCardTemplate | null
  asset: ContentAsset | null
}

export interface DeckSlotView {
  index: number
  unlocked: boolean
  card: DeckCardView | null
}

export interface DeckCandidateView extends Omit<DeckCardView, 'save'> {
  save: CardSave
  disabledReason: string | null
}

export interface DeckViewModel {
  tier: number
  slotCount: number
  slots: DeckSlotView[]
  candidates: DeckCandidateView[]
  validationErrors: string[]
  needsRepair: boolean
  effects: Record<CardEffect, number>
  raceBonus: number
  hintSkillCount: number
}

const typeRank = (type: SupportCardType): number => {
  const stat = STATS.indexOf(type as (typeof STATS)[number])
  if (stat >= 0) return stat
  return type === 'friend' ? STATS.length : STATS.length + 1
}

export function buildDeckView(
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
  content: LoadedContent,
  orderedCardIds: readonly string[] = activeScenario(uma).cardSetIds,
  filters: DeckFilters = { type: 'all', era: 'all' },
): DeckViewModel {
  const tier = uma.unlockedTier
  const slotCount = deckSlotCount(tier)
  const validation = validateSupportDeck({
    tier,
    orderedCardIds,
    ownedCards: Object.values(cardsById),
    templates: content.cards.byId,
    allowEmpty: true,
  })
  const selectedCharacters = new Set(validation.cards.map((card) => card.template.charaId))
  const selectedIds = new Set(orderedCardIds)
  const cardView = (id: string, save: CardSave | null): DeckCardView => {
    const template = content.cards.byId.get(id) ?? null
    return {
      id,
      save,
      template,
      asset: template ? getContentAsset(content, 'card-icons', id) : null,
    }
  }
  const slots = Array.from({ length: 6 }, (_, index): DeckSlotView => {
    const id = orderedCardIds[index]
    const save = id ? cardsById[id] : undefined
    return {
      index,
      unlocked: index < slotCount,
      card: id ? cardView(id, save ?? null) : null,
    }
  })
  const candidates = Object.values(cardsById)
    .map((save): DeckCandidateView => {
      const view = cardView(save.templateId, save)
      let disabledReason: string | null = null
      if (!view.template) disabledReason = 'Missing current content'
      else if (selectedIds.has(view.id)) disabledReason = 'Already selected'
      else if (view.template.era > tier) disabledReason = `Era locked · Tier ${view.template.era}`
      else if (selectedCharacters.has(view.template.charaId)) disabledReason = 'Duplicate character'
      else if (orderedCardIds.length >= slotCount) disabledReason = 'All unlocked slots filled'
      return { ...view, save, disabledReason }
    })
    .filter((candidate) => {
      if (filters.type !== 'all' && candidate.template?.type !== filters.type) return false
      if (filters.era === 'current' && (!candidate.template || candidate.template.era > tier)) return false
      if (filters.era === 'later' && (!candidate.template || candidate.template.era <= tier)) return false
      return true
    })
    .sort((left, right) => {
      if (!left.template || !right.template) return left.template ? -1 : right.template ? 1 : left.id.localeCompare(right.id)
      return typeRank(left.template.type) - typeRank(right.template.type)
        || left.template.era - right.template.era
        || left.template.charName.localeCompare(right.template.charName)
        || left.template.title.localeCompare(right.template.title)
        || left.id.localeCompare(right.id)
    })
  const effects = supportDeckEffectTotals(validation.cards, tier)
  const hintSkillCount = new Set(validation.cards.flatMap((card) => card.template.hintSkillIds)).size
  return {
    tier,
    slotCount,
    slots,
    candidates,
    validationErrors: validation.issues.map(supportDeckIssueMessage),
    needsRepair: validation.issues.some((issue) => ['not-owned', 'missing-content', 'save-content-mismatch'].includes(issue.code)),
    effects,
    raceBonus: effects.raceBonus,
    hintSkillCount,
  }
}

export const deckEffectRows = (model: DeckViewModel): { effect: CardEffect; value: number }[] =>
  CARD_EFFECTS.map((effect) => ({ effect, value: model.effects[effect] })).filter((row) => row.value > 0)

const PERCENT_EFFECTS = new Set<CardEffect>(['trainingBonus', 'friendshipBonus', 'hintFrequency', 'raceBonus'])

export const formatDeckEffect = (effect: CardEffect, value: number): string =>
  PERCENT_EFFECTS.has(effect) ? `${Math.round(value * 1000) / 10}%` : `+${Math.round(value * 10) / 10}`
