// Card album projection on the shared engine (docs/design/collection.md#card-album), seen through one of two lenses
// (M016): the **collection**, where a card is only owned or not, or **one scenario**, where it has a bond and a price
// per node. A card's power is never account-wide, so nothing here reads its best stars anywhere or a card level.

import {
  MAX_STARS,
  SCENARIOS,
  STATS,
  cardStars,
  cardNodeValue,
  cardShares,
  cardSpPerNode,
  cardUnlockCost,
  paysSkillPoints,
  type CardSave,
  type SupportCardTemplate,
  type UmaSave,
} from '@racer/domain'
import { getContentAsset, type ContentAsset, type LoadedContent } from '../../content/runtime'
import type { AlbumQuery, AlbumRow, FacetDef, SortDef } from './query'
import type { AlbumPreset } from './stable'

export const CARDS_ALBUM_ID = 'cards'
/** The scenario lens keeps its own sort and filters: bond means nothing in the collection. */
export const CARDS_SCENARIO_ALBUM_ID = 'cards-scenario'

/** The collection, or one scenario's tier. */
export type CardLens = 'collection' | number

export const CARD_TYPES: readonly SupportCardTemplate['type'][] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']

const titleCase = (value: string): string => `${value[0]!.toUpperCase()}${value.slice(1)}`

export interface CardEntry {
  id: string
  template: SupportCardTemplate
  save: CardSave | null
  owned: boolean
  asset: ContentAsset | null
  unlockCost: number
  /** Bond in the lens scenario; null in the collection lens or when unowned. */
  bond: number | null
  /** What one node pays in the lens scenario at the current bond — SP for a skill-point card; null in the collection lens. */
  perNode: number | null
  /** Friend and Group cards pay skill points instead of stats (D132). */
  skillPoints: boolean
  /** Umas with this card in a set — in the lens scenario, or in their active scenario for the collection. */
  equippedBy: string[]
  hintSkillNames: string[]
  isNew: boolean
}

export interface CardAlbumInput {
  content: LoadedContent
  cards: Readonly<Record<string, CardSave>>
  umas: Readonly<Record<string, UmaSave>>
  seen: readonly string[]
  lens: CardLens
}

export interface CardAlbum {
  lens: CardLens
  rows: AlbumRow[]
  entries: Map<string, CardEntry>
  /** Cards in this lens: every card for the collection, only era-eligible ones for a scenario. */
  total: number
  owned: number
  /** Scenario lens only: owned cards with at least one star, and at 5★. */
  bonded: number
  maxed: number
  orphanedIds: string[]
}

/** "Spe 70 · Pow 30": how one node of this card splits — or "Skill points" for a Friend or Group card. */
export function cardSplitLabel(template: SupportCardTemplate): string {
  if (paysSkillPoints(template)) return 'Skill points'
  const shares = cardShares(template)
  return STATS.filter((stat) => (shares[stat] ?? 0) > 0)
    .sort((left, right) => (shares[right] ?? 0) - (shares[left] ?? 0))
    .map((stat) => `${titleCase(stat).slice(0, 3)} ${shares[stat]}`)
    .join(' · ')
}

export function buildCardAlbumRows(input: CardAlbumInput): CardAlbum {
  const { content, lens } = input
  const tier = lens === 'collection' ? null : lens
  const seen = new Set(input.seen)

  const equippedBy = new Map<string, string[]>()
  for (const uma of Object.values(input.umas)) {
    const run = tier === null
      ? uma.scenarios.find((entry) => entry.tier === uma.unlockedTier)
      : uma.scenarios.find((entry) => entry.tier === tier)
    for (const cardId of run?.cardSetIds ?? []) equippedBy.set(cardId, [...(equippedBy.get(cardId) ?? []), uma.templateId])
  }

  const templates = content.cards.items.filter((template) => tier === null || template.era <= tier)
  const entries = templates.map((template): CardEntry => {
    const save = input.cards[template.id] ?? null
    const bond = tier !== null && save ? cardStars(save, tier) : null
    return {
      id: template.id,
      template,
      save,
      owned: save !== null,
      asset: getContentAsset(content, 'card-icons', template.id),
      unlockCost: cardUnlockCost(template.era),
      bond,
      perNode: tier === null ? null : (paysSkillPoints(template) ? cardSpPerNode : cardNodeValue)(tier, { template, stars: bond ?? 0 }),
      skillPoints: paysSkillPoints(template),
      equippedBy: equippedBy.get(template.id) ?? [],
      hintSkillNames: template.hintSkillIds.flatMap((id) => {
        const skill = content.skills.byId.get(id)
        return skill ? [skill.name] : []
      }),
      isNew: save !== null && !seen.has(template.id),
    }
  })

  const rows = entries.map((entry): AlbumRow => ({
    id: entry.id,
    // Hint skills are searchable text rather than a facet, so "Corner Recovery" just works.
    search: [entry.template.charName, entry.template.title, ...entry.hintSkillNames].join(' ').toLowerCase(),
    facets: {
      ownership: [entry.owned ? 'owned' : 'unowned'],
      type: [entry.template.type],
      era: [String(entry.template.era)],
      bond: entry.bond === null ? [] : [String(entry.bond)],
      bondable: entry.bond !== null && entry.bond < MAX_STARS,
      maxed: entry.bond === MAX_STARS,
      equipped: entry.equippedBy.length > 0,
      starter: entry.template.starter,
      isNew: entry.isNew,
    },
    sorts: {
      era: entry.template.era,
      bond: entry.bond,
      perNode: entry.owned ? entry.perNode : null,
      owned: entry.owned ? 1 : 0,
      type: CARD_TYPES.indexOf(entry.template.type),
      character: entry.template.charName.toLowerCase(),
      name: entry.template.title.toLowerCase(),
    },
  }))

  return {
    lens,
    rows,
    entries: new Map(entries.map((entry) => [entry.id, entry])),
    total: entries.length,
    owned: entries.filter((entry) => entry.owned).length,
    bonded: entries.filter((entry) => (entry.bond ?? 0) > 0).length,
    maxed: entries.filter((entry) => entry.bond === MAX_STARS).length,
    orphanedIds: Object.keys(input.cards).filter((id) => !content.cards.byId.has(id)).sort(),
  }
}

const OWNERSHIP: FacetDef = {
  key: 'ownership', label: 'Ownership', kind: 'enum', group: 'Collection',
  options: [{ value: 'owned', label: 'Owned' }, { value: 'unowned', label: 'Not owned' }],
}
const TYPE: FacetDef = {
  key: 'type', label: 'Type', kind: 'enum', group: 'Card',
  options: CARD_TYPES.map((type) => ({ value: type, label: titleCase(type) })),
}
const ERA: FacetDef = {
  key: 'era', label: 'Era', kind: 'enum', group: 'Card',
  options: SCENARIOS.map((scenario) => ({ value: String(scenario.tier), label: `${scenario.tier} · ${scenario.name}` })),
}

export const CARD_COLLECTION_FACETS: FacetDef[] = [
  OWNERSHIP,
  TYPE,
  ERA,
  { key: 'equipped', label: 'In an active set', kind: 'boolean', group: 'Sets' },
  { key: 'starter', label: 'Free or event card', kind: 'boolean', group: 'Collection' },
  { key: 'isNew', label: 'New to you', kind: 'boolean', group: 'Collection' },
]

export const CARD_SCENARIO_FACETS: FacetDef[] = [
  OWNERSHIP,
  TYPE,
  {
    key: 'bond', label: 'Stars', kind: 'enum', group: 'This scenario',
    options: Array.from({ length: MAX_STARS + 1 }, (_, index) => ({
      value: String(index),
      label: `${index}★`,
    })),
  },
  { key: 'bondable', label: 'Can still bond', kind: 'boolean', group: 'This scenario' },
  { key: 'maxed', label: '5★', kind: 'boolean', group: 'This scenario' },
  { key: 'equipped', label: 'In a set here', kind: 'boolean', group: 'This scenario' },
  ERA,
  { key: 'isNew', label: 'New to you', kind: 'boolean', group: 'Collection' },
]

const COMMON_SORTS: SortDef[] = [
  { key: 'type', label: 'Type', defaultDirection: 'asc' },
  { key: 'character', label: 'Character', defaultDirection: 'asc' },
  { key: 'name', label: 'Card name', defaultDirection: 'asc' },
]

export const CARD_COLLECTION_SORTS: SortDef[] = [
  { key: 'era', label: 'Era / release', defaultDirection: 'desc' },
  ...COMMON_SORTS,
]

export const CARD_SCENARIO_SORTS: SortDef[] = [
  { key: 'bond', label: 'Stars', defaultDirection: 'desc' },
  { key: 'perNode', label: 'Pays per node', defaultDirection: 'desc' },
  { key: 'era', label: 'Era / release', defaultDirection: 'desc' },
  ...COMMON_SORTS,
]

export const cardFacets = (lens: CardLens): FacetDef[] => lens === 'collection' ? CARD_COLLECTION_FACETS : CARD_SCENARIO_FACETS
export const cardSorts = (lens: CardLens): SortDef[] => lens === 'collection' ? CARD_COLLECTION_SORTS : CARD_SCENARIO_SORTS

/** Collection: everything, newest era first, owned before unowned within an era. */
export const CARD_COLLECTION_QUERY: AlbumQuery = {
  search: '',
  filters: {},
  sort: 'era',
  direction: 'desc',
  group: null,
  view: 'icons',
  mode: null,
}

/** A scenario: the most bonded first, so what is worth slotting leads. */
export const CARD_SCENARIO_QUERY: AlbumQuery = { ...CARD_COLLECTION_QUERY, sort: 'bond' }

export const CARD_TIE_BREAK = [
  { key: 'owned', direction: 'desc' as const },
  { key: 'perNode', direction: 'desc' as const },
  { key: 'era', direction: 'desc' as const },
  { key: 'name', direction: 'asc' as const },
]

export function buildCardPresets(lens: CardLens): AlbumPreset[] {
  if (lens === 'collection') {
    return [
      { key: 'owned', label: 'Owned', apply: (query) => ({ ...query, filters: { ownership: ['owned'] } }) },
      { key: 'unowned', label: 'Not owned', apply: (query) => ({ ...query, filters: { ownership: ['unowned'] } }) },
      { key: 'new', label: 'New to you', apply: (query) => ({ ...query, filters: { isNew: true } }) },
      { key: 'active', label: 'In an active set', apply: (query) => ({ ...query, filters: { equipped: true } }) },
    ]
  }
  return [
    { key: 'bondable', label: 'Can still bond', apply: (query) => ({ ...query, filters: { bondable: true } }) },
    { key: 'here', label: 'In a set here', apply: (query) => ({ ...query, filters: { equipped: true } }) },
    { key: 'maxed', label: '5★', apply: (query) => ({ ...query, filters: { maxed: true } }) },
    { key: 'unowned', label: 'Not owned', apply: (query) => ({ ...query, filters: { ownership: ['unowned'] } }) },
  ]
}

/** The value the active sort is about, shown under a tile. */
export function cardSortValueLabel(entry: CardEntry, sort: string): string | null {
  if (sort === 'era') return SCENARIOS.find((scenario) => scenario.tier === entry.template.era)?.name ?? `Era ${entry.template.era}`
  if (sort === 'bond') return entry.bond === null ? null : `${entry.bond}★`
  if (sort === 'perNode') return entry.owned ? cardPayLabel(entry) : null
  if (sort === 'type') return titleCase(entry.template.type)
  if (sort === 'character') return entry.template.charName
  return null
}

/** "140 per node", or "35 SP per node" for a skill-point card; null outside a scenario lens. */
export function cardPayLabel(entry: Pick<CardEntry, 'perNode' | 'skillPoints'>): string | null {
  if (entry.perNode === null) return null
  return `${Math.round(entry.perNode)}${entry.skillPoints ? ' SP' : ''} per node`
}
