// The active scenario's card set, joined to content (docs/design/support-cards.md#ownership-vs-the-card-set).

import {
  trainedScenario,
  cardSetRaceBonus,
  deckSlotCount,
  supportDeckIssueMessage,
  validateSupportDeck,
  type CardSave,
  type SupportCardTemplate,
  type UmaSave,
} from '@racer/domain'
import { getContentAsset, type ContentAsset, type LoadedContent } from '../content/runtime'

export interface DeckCardView {
  id: string
  save: CardSave | null
  template: SupportCardTemplate | null
  asset: ContentAsset | null
}

export interface DeckSlotView {
  index: number
  card: DeckCardView | null
}

export interface DeckViewModel {
  tier: number
  slotCount: number
  slots: DeckSlotView[]
  validationErrors: string[]
  needsRepair: boolean
  /** Share of race EXP this preset's set adds, from each card's global stars. */
  raceBonus: number
}

export function buildDeckView(
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
  content: LoadedContent,
  orderedCardIds?: readonly string[],
  /** Which of her scenarios' sets (D190); her current one when omitted. */
  requestedTier?: number,
): DeckViewModel {
  const run = trainedScenario(uma, requestedTier)
  const tier = run.tier
  orderedCardIds ??= run.cardSetIds
  const slotCount = deckSlotCount(tier)
  const validation = validateSupportDeck({
    tier,
    orderedCardIds,
    ownedCards: Object.values(cardsById),
    templates: content.cards.byId,
    allowEmpty: true,
  })
  const slots = Array.from({ length: slotCount }, (_, index): DeckSlotView => {
    const id = orderedCardIds[index]
    if (!id) return { index, card: null }
    const template = content.cards.byId.get(id) ?? null
    return {
      index,
      card: { id, save: cardsById[id] ?? null, template, asset: template ? getContentAsset(content, 'card-icons', id) : null },
    }
  })
  return {
    tier,
    slotCount,
    slots,
    validationErrors: validation.issues.map(supportDeckIssueMessage),
    needsRepair: validation.issues.some((issue) => ['not-owned', 'missing-content', 'save-content-mismatch'].includes(issue.code)),
    raceBonus: cardSetRaceBonus(validation.cards, tier),
  }
}

export const formatRaceBonus = (value: number): string => `${Math.round(value * 1000) / 10}%`
