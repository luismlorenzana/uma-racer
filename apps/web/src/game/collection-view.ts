// Pure collection album, selection, and reveal projections (docs/design/collection.md).

import {
  SAVE_ID_PATTERN,
  cardCollectionCounts,
  umaCollectionCounts,
  type CardSave,
  type DistanceCategory,
  type PlayerProfile,
  type Strategy,
  type SupportCardTemplate,
  type Surface,
  type UmaSave,
  type UmaTemplate,
} from '@racer/domain'
import { getContentAsset, type ContentAsset, type LoadedContent } from '../content/runtime'
import { buildCardAlbum, type CardAlbumItem, type CardTypeFilter } from './cards-view'
import { joinUma, type UmaSort, type UmaViewModel } from './view'

export interface CardSelectionFilters {
  era: number | null
  type: CardTypeFilter
}

export interface CardSelectionItem extends CardAlbumItem {
  acquisitionNote: string | null
}

export function buildCardSelection(
  content: LoadedContent,
  cardsById: Readonly<Record<string, CardSave>>,
  profile: PlayerProfile,
  filters: CardSelectionFilters = { era: null, type: 'all' },
) {
  const counts = cardCollectionCounts(content.cards.items, cardsById)
  const items: CardSelectionItem[] = buildCardAlbum(content, cardsById, profile.tickets, { ownership: 'unowned', type: filters.type }).items
    .filter((item) => filters.era === null || item.template.era === filters.era)
    .map((item) => ({
      ...item,
      acquisitionNote: item.template.type === 'friend' || item.template.type === 'group'
        ? 'Collectible now; Friend/Group gameplay is not active yet.'
        : item.template.era > 1 ? `Collectible now; equipping waits until tier ${item.template.era}.` : null,
    }))
  return { items, ...counts, couponBalance: profile.cardCoupons }
}

export type UmaOwnershipFilter = 'all' | 'owned' | 'unowned'

export interface UmaAlbumFilters {
  ownership: UmaOwnershipFilter
  tier: number | null
  surface: Surface | null
  distance: DistanceCategory | null
  strategy: Strategy | null
  sex: UmaTemplate['realHorseSex'] | 'unknown'
  ready: boolean
}

export const EMPTY_UMA_ALBUM_FILTERS: UmaAlbumFilters = {
  ownership: 'owned', tier: null, surface: null, distance: null, strategy: null, sex: null, ready: false,
}

export interface UmaAlbumItem {
  template: UmaTemplate
  save: UmaSave | null
  view: UmaViewModel | null
  asset: ContentAsset | null
  owned: boolean
  redemptionLock: string | null
}

const strong = (grade: string) => grade === 'A' || grade === 'S'

export function buildUmaAlbum(
  content: LoadedContent,
  umasById: Readonly<Record<string, UmaSave>>,
  profile: PlayerProfile,
  filters: UmaAlbumFilters = EMPTY_UMA_ALBUM_FILTERS,
  sort: UmaSort = 'name',
) {
  const counts = umaCollectionCounts(content.umas.items, umasById)
  const all: UmaAlbumItem[] = content.umas.items.map((template) => {
    const save = umasById[template.id]
    const joined = save ? joinUma(save, content) : null
    const view = joined?.status === 'ready' ? joined.value : null
    return {
      template,
      save: save ?? null,
      view,
      asset: getContentAsset(content, 'uma-icons', template.id),
      owned: save !== undefined,
      redemptionLock: save ? 'Uma outfit is already owned' : profile.umaCoupons < 1 ? 'Exchange five Uma Shards for a Select Coupon first' : null,
    }
  })
  const items = all.filter((item) => {
    if (filters.ownership !== 'all' && (filters.ownership === 'owned') !== item.owned) return false
    if (filters.tier !== null && (item.view?.tier ?? 1) !== filters.tier) return false
    const aptitudes = item.save?.aptitudes ?? item.template.aptitudes
    if (filters.surface && !strong(aptitudes.surface[filters.surface])) return false
    if (filters.distance && !strong(aptitudes.distance[filters.distance])) return false
    if (filters.strategy && !strong(aptitudes.strategy[filters.strategy])) return false
    if (filters.sex !== null && (item.template.realHorseSex ?? 'unknown') !== filters.sex) return false
    return !filters.ready || item.view?.readyToPromote === true
  }).sort((left, right) => {
    const id = left.template.id.localeCompare(right.template.id)
    if (sort === 'uma-level') return (right.save?.level ?? 0) - (left.save?.level ?? 0) || id
    if (sort === 'training-level') return (right.save?.trainingLevel ?? 0) - (left.save?.trainingLevel ?? 0) || id
    return left.template.name.localeCompare(right.template.name) || id
  })
  return { items, ...counts, couponBalance: profile.umaCoupons, shardBalance: profile.umaShards }
}

export type CollectionReveal =
  | { kind: 'card'; id: string; template: SupportCardTemplate; save: CardSave; asset: ContentAsset | null }
  | { kind: 'uma'; id: string; template: UmaTemplate; save: UmaSave; asset: ContentAsset | null }

export function resolveCollectionReveal(
  content: LoadedContent,
  cardsById: Readonly<Record<string, CardSave>>,
  umasById: Readonly<Record<string, UmaSave>>,
  kind: string | undefined,
  id: string | undefined,
): CollectionReveal | null {
  if ((kind !== 'card' && kind !== 'uma') || !id || !SAVE_ID_PATTERN.test(id)) return null
  if (kind === 'card') {
    const template = content.cards.byId.get(id)
    const save = cardsById[id]
    return template && save ? { kind, id, template, save, asset: getContentAsset(content, 'card-icons', id) } : null
  }
  const template = content.umas.byId.get(id)
  const save = umasById[id]
  return template && save ? { kind, id, template, save, asset: getContentAsset(content, 'uma-icons', id) } : null
}
