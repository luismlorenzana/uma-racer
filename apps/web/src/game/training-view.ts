// Training save/content joins and deterministic screen derivations (docs/design/training.md).

import {
  EXP_TO_NEXT_TRAINING_LEVEL,
  MAX_TRAINING_LEVEL,
  STATS,
  dealTrainingCards,
  previewTrainingFacilities,
  scenarioForTier,
  spCap,
  statCap,
  supportDeckIssueMessage,
  tierOfLevel,
  trainingTurnSeed,
  validateSupportDeck,
  type CardSave,
  type Facility,
  type PlayerProfile,
  type TrainingCardInput,
  type TrainingFacilityPreview,
  type TrainingPlacement,
  type UmaSave,
  type UmaTemplate,
} from '@racer/domain'
import { getContentAsset, type ContentAsset, type LoadedContent } from '../content/runtime'

export interface TrainingCardView {
  save: CardSave
  template: TrainingCardInput['template']
  asset: ContentAsset | null
  placement: TrainingPlacement
}

export interface TrainingFacilityView extends TrainingFacilityPreview {
  cards: TrainingCardView[]
}

export interface TrainingViewModel {
  profile: PlayerProfile
  uma: UmaSave
  template: UmaTemplate
  umaAsset: ContentAsset | null
  tier: number
  scenarioName: string
  statCap: number
  spCap: number
  trainingExpToNext: number
  dealSeed: number
  cards: TrainingCardView[]
  bench: TrainingCardView[]
  facilities: Record<Facility, TrainingFacilityView>
}

export type TrainingViewResult =
  | { status: 'ready'; value: TrainingViewModel }
  | { status: 'empty-deck' }
  | { status: 'error'; message: string }

export function buildTrainingView(
  profile: PlayerProfile,
  uma: UmaSave,
  cardsById: Readonly<Record<string, CardSave>>,
  content: LoadedContent,
): TrainingViewResult {
  const template = content.umas.byId.get(uma.templateId)
  if (!template) return { status: 'error', message: `Training content is missing Uma ${uma.templateId}` }
  if (uma.deckCardIds.length === 0) return { status: 'empty-deck' }
  const tier = tierOfLevel(uma.level)
  const validation = validateSupportDeck({
    tier,
    orderedCardIds: uma.deckCardIds,
    ownedCards: Object.values(cardsById),
    templates: content.cards.byId,
  })
  const issue = validation.issues[0]
  if (issue) return { status: 'error', message: supportDeckIssueMessage(issue) }
  const cards: TrainingCardInput[] = validation.cards
  const seed = trainingTurnSeed(profile.createdAt, uma.templateId, tier, uma.trainingsThisScenario)
  const deal = dealTrainingCards(cards, seed)
  const preview = previewTrainingFacilities(uma, template, cards, deal)
  const cardViews = cards.map((card, index): TrainingCardView => ({
    ...card,
    asset: getContentAsset(content, 'card-icons', card.template.id),
    placement: deal.placements[index]!.placement,
  }))
  const facilities = Object.fromEntries(STATS.map((facility) => [
    facility,
    {
      ...preview[facility],
      cards: cardViews.filter((card) => card.placement === facility),
    },
  ])) as Record<Facility, TrainingFacilityView>
  return {
    status: 'ready',
    value: {
      profile,
      uma,
      template,
      umaAsset: getContentAsset(content, 'uma-icons', uma.templateId),
      tier,
      scenarioName: scenarioForTier(tier)?.name ?? `Tier ${tier}`,
      statCap: statCap(tier, uma.trainingLevel),
      spCap: spCap(tier, uma.trainingLevel),
      trainingExpToNext: uma.trainingLevel === MAX_TRAINING_LEVEL ? 0 : EXP_TO_NEXT_TRAINING_LEVEL,
      dealSeed: seed,
      cards: cardViews,
      bench: cardViews.filter((card) => card.placement === 'out'),
      facilities,
    },
  }
}
