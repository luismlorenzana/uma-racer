// Card album/content joins (docs/design/support-cards.md).

import {
  MAX_LIMIT_BREAK,
  cardLevel,
  BOND_RECALL_TICKET_COST,
  cardLevelCap,
  projectCardEffects,
  type CardEffectProjection,
  type CardSave,
  type SupportCardTemplate,
} from '@racer/domain'
import { getContentAsset, type ContentAsset, type LoadedContent } from '../content/runtime'

export type CardOwnershipFilter = 'all' | 'owned' | 'unowned'
export type CardTypeFilter = 'all' | SupportCardTemplate['type']

export interface CardAlbumFilters {
  ownership: CardOwnershipFilter
  type: CardTypeFilter
}

export interface CardAlbumItem {
  template: SupportCardTemplate
  save: CardSave | null
  asset: ContentAsset | null
  owned: boolean
  maxed: boolean
  expToNext: number
  currentEffects: CardEffectProjection[]
  nextEffects: CardEffectProjection[] | null
  promotionCost: number | null
  promotionLock: string | null
}

export interface CardAlbumView {
  items: CardAlbumItem[]
  owned: number
  maxed: number
  total: number
  orphanedIds: string[]
}

const TYPE_ORDER: readonly SupportCardTemplate['type'][] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']

function albumItem(
  template: SupportCardTemplate,
  save: CardSave | undefined,
  tickets: number,
  content: LoadedContent,
): CardAlbumItem {
  const owned = save !== undefined
  const limitBreak = save?.limitBreak ?? 0
  const state = { level: cardLevel({ limitBreak }), limitBreak }
  const maxed = limitBreak === MAX_LIMIT_BREAK
  let promotionLock: string | null = null
  let promotionCost: number | null = null
  let nextEffects: CardEffectProjection[] | null = null
  if (!save) {
    promotionLock = 'Unowned card'
  } else if (maxed) {
    promotionLock = 'Maximum limit break reached'
  } else {
    // A Bond Recall run is the limit break, so its ticket price is the whole cost (D120).
    promotionCost = BOND_RECALL_TICKET_COST
    nextEffects = projectCardEffects(template, {
      level: cardLevel({ limitBreak: limitBreak + 1 }),
      limitBreak: limitBreak + 1,
    })
    if (tickets < promotionCost) promotionLock = `Need ${promotionCost} Training Tickets`
  }
  return {
    template,
    save: save ?? null,
    asset: getContentAsset(content, 'card-icons', template.id),
    owned,
    maxed,
    expToNext: 0,
    currentEffects: projectCardEffects(template, state),
    nextEffects,
    promotionCost,
    promotionLock,
  }
}

export function buildCardAlbum(
  content: LoadedContent,
  cardsById: Readonly<Record<string, CardSave>>,
  tickets: number,
  filters: CardAlbumFilters = { ownership: 'all', type: 'all' },
): CardAlbumView {
  const all = content.cards.items.map((template) => albumItem(template, cardsById[template.id], tickets, content))
  const items = all
    .filter((item) => filters.ownership === 'all' || (filters.ownership === 'owned') === item.owned)
    .filter((item) => filters.type === 'all' || item.template.type === filters.type)
    .sort((left, right) =>
      left.template.era - right.template.era ||
      TYPE_ORDER.indexOf(left.template.type) - TYPE_ORDER.indexOf(right.template.type) ||
      left.template.id.localeCompare(right.template.id),
    )
  return {
    items,
    owned: all.filter((item) => item.owned).length,
    maxed: all.filter((item) => item.maxed).length,
    total: all.length,
    orphanedIds: Object.keys(cardsById).filter((id) => !content.cards.byId.has(id)).sort(),
  }
}
