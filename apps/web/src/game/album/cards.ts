// Card album projection: rows, facets, sorts and presets on the shared engine
// (docs/design/collection.md#card-album).

import {
  CARD_EFFECTS,
  MAX_LIMIT_BREAK,
  SCENARIOS,
  type CardEffect,
  type CardSave,
  type SupportCardTemplate,
  type UmaSave,
} from '@racer/domain'
import type { LoadedContent } from '../../content/runtime'
import { buildCardAlbum, type CardAlbumItem } from '../cards-view'
import type { AlbumQuery, AlbumRow, FacetDef, SortDef } from './query'
import type { AlbumPreset } from './stable'

export const CARDS_ALBUM_ID = 'cards'

export const CARD_TYPES: readonly SupportCardTemplate['type'][] = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group']

export const EFFECT_LABELS: Record<CardEffect, string> = {
  friendshipBonus: 'Friendship',
  statBonus: 'Stat Bonus',
  trainingBonus: 'Training',
  initialStats: 'Initial Stats',
  raceBonus: 'Race Bonus',
  hintFrequency: 'Hint Rate',
  specialtyPriority: 'Specialty',
  skillPointBonus: 'Skill Points',
}

export interface CardEntry extends CardAlbumItem {
  id: string
  /** Uma ids with this card in their deck. */
  equippedBy: string[]
  /** The card's strongest current effect, shown on the tile. */
  headline: { effect: CardEffect; value: number } | null
  hintSkillNames: string[]
  isNew: boolean
}

export interface CardAlbumInput {
  content: LoadedContent
  cards: Readonly<Record<string, CardSave>>
  umas: Readonly<Record<string, UmaSave>>
  tickets: number
  seen: readonly string[]
}

export interface CardAlbum {
  rows: AlbumRow[]
  entries: Map<string, CardEntry>
  owned: number
  maxed: number
  total: number
  orphanedIds: string[]
}

/** Percent-style effects read as percentages; flat ones as points. Both compare fine as numbers. */
function headlineEffect(item: CardAlbumItem): CardEntry['headline'] {
  const ranked = item.currentEffects
    .filter((projection) => projection.value > 0)
    .sort((left, right) => right.value - left.value)
  const best = ranked[0]
  return best ? { effect: best.effect, value: best.value } : null
}

export function buildCardAlbumRows(input: CardAlbumInput): CardAlbum {
  const album = buildCardAlbum(input.content, input.cards, input.tickets)
  const seen = new Set(input.seen)
  const equippedBy = new Map<string, string[]>()
  for (const uma of Object.values(input.umas)) {
    for (const cardId of uma.deckCardIds) {
      equippedBy.set(cardId, [...(equippedBy.get(cardId) ?? []), uma.templateId])
    }
  }

  const entries = album.items.map((item): CardEntry => {
    const hintSkillNames = item.template.hintSkillIds
      .flatMap((id) => { const skill = input.content.skills.byId.get(id); return skill ? [skill.name] : [] })
    return {
      ...item,
      id: item.template.id,
      equippedBy: equippedBy.get(item.template.id) ?? [],
      headline: headlineEffect(item),
      hintSkillNames,
      isNew: item.owned && !seen.has(item.template.id),
    }
  })

  const rows = entries.map((entry): AlbumRow => {
    const effects = Object.fromEntries(entry.currentEffects.map((projection) => [`effect:${projection.effect}`, projection.value]))
    return {
      id: entry.id,
      // Hint skills are searchable text rather than a facet, so "Corner Recovery" just works.
      search: [entry.template.charName, entry.template.title, ...entry.hintSkillNames].join(' ').toLowerCase(),
      facets: {
        ownership: [entry.owned ? 'owned' : 'unowned'],
        type: [entry.template.type],
        era: [String(entry.template.era)],
        limitBreak: entry.save ? [String(entry.save.limitBreak)] : [],
        level: entry.save?.level ?? null,
        maxed: entry.maxed,
        // Every tier this card may be equipped at, so "equippable at tier N" is a plain enum match.
        equippableAt: SCENARIOS.filter((scenario) => scenario.tier >= entry.template.era).map((scenario) => String(scenario.tier)),
        equipped: entry.equippedBy.length > 0,
        equippedByUma: entry.equippedBy,
        starter: entry.template.starter,
        effectKind: entry.currentEffects.filter((projection) => projection.value > 0).map((projection) => projection.effect),
        isNew: entry.isNew,
      },
      sorts: {
        era: entry.template.era,
        level: entry.save?.level ?? null,
        limitBreak: entry.save?.limitBreak ?? null,
        type: CARD_TYPES.indexOf(entry.template.type),
        character: entry.template.charName.toLowerCase(),
        name: entry.template.title.toLowerCase(),
        ...effects,
      },
    }
  })

  return {
    rows,
    entries: new Map(entries.map((entry) => [entry.id, entry])),
    owned: album.owned,
    maxed: album.maxed,
    total: album.total,
    orphanedIds: album.orphanedIds,
  }
}

const titleCase = (value: string): string => `${value[0]!.toUpperCase()}${value.slice(1)}`

export const CARD_FACETS: FacetDef[] = [
  {
    key: 'ownership', label: 'Ownership', kind: 'enum', group: 'Collection',
    options: [{ value: 'owned', label: 'Owned' }, { value: 'unowned', label: 'Unowned' }],
  },
  {
    key: 'type', label: 'Type', kind: 'enum', group: 'Card',
    options: CARD_TYPES.map((type) => ({ value: type, label: titleCase(type) })),
  },
  {
    key: 'era', label: 'Era', kind: 'enum', group: 'Card',
    options: SCENARIOS.map((scenario) => ({ value: String(scenario.tier), label: `${scenario.tier} · ${scenario.name}` })),
  },
  {
    key: 'limitBreak', label: 'Limit break', kind: 'enum', group: 'Progress',
    options: Array.from({ length: MAX_LIMIT_BREAK + 1 }, (_, index) => ({ value: String(index), label: `LB${index}` })),
  },
  { key: 'level', label: 'Card level', kind: 'range', group: 'Progress' },
  { key: 'maxed', label: 'Maxed', kind: 'boolean', group: 'Progress' },
  {
    key: 'equippableAt', label: 'Equippable at tier', kind: 'enum', group: 'Deck',
    options: SCENARIOS.map((scenario) => ({ value: String(scenario.tier), label: `Tier ${scenario.tier}` })),
  },
  { key: 'equipped', label: 'In a deck', kind: 'boolean', group: 'Deck' },
  { key: 'starter', label: 'Free or event card', kind: 'boolean', group: 'Collection' },
  {
    key: 'effectKind', label: 'Effect', kind: 'enum', group: 'Card',
    options: CARD_EFFECTS.map((effect) => ({ value: effect, label: EFFECT_LABELS[effect] })),
  },
  { key: 'isNew', label: 'New to you', kind: 'boolean', group: 'Collection' },
]

export const CARD_SORTS: SortDef[] = [
  { key: 'era', label: 'Era / release', defaultDirection: 'desc' },
  { key: 'level', label: 'Card level', defaultDirection: 'desc' },
  { key: 'limitBreak', label: 'Limit break', defaultDirection: 'desc' },
  { key: 'type', label: 'Type', defaultDirection: 'asc' },
  { key: 'character', label: 'Character', defaultDirection: 'asc' },
  { key: 'name', label: 'Card name', defaultDirection: 'asc' },
  {
    key: 'effect', label: 'Effect strength', defaultDirection: 'desc',
    parameter: {
      label: 'Effect',
      options: CARD_EFFECTS.map((effect) => ({ value: `effect:${effect}`, label: EFFECT_LABELS[effect] })),
    },
  },
]

/** Owned before unowned → newest era → highest level → name (docs/design/collection.md#default-sorts). */
export const CARD_DEFAULT_QUERY: AlbumQuery = {
  search: '',
  filters: { ownership: ['owned'] },
  sort: 'era',
  direction: 'desc',
  group: null,
  density: 'comfortable',
  mode: null,
}

export const CARD_TIE_BREAK = [
  { key: 'level', direction: 'desc' as const },
  { key: 'name', direction: 'asc' as const },
]

/** "Equippable now" depends on the roster, so presets are built rather than fixed. */
export function buildCardPresets(highestTier: number): AlbumPreset[] {
  return [
    { key: 'equippable', label: `Equippable now`, apply: (query) => ({ ...query, filters: { ownership: ['owned'], equippableAt: [String(highestTier)] } }) },
    { key: 'maxed', label: 'Maxed', apply: (query) => ({ ...query, filters: { ownership: ['owned'], maxed: true } }) },
    { key: 'unequipped', label: 'Not in a deck', apply: (query) => ({ ...query, filters: { ownership: ['owned'] } }) },
    { key: 'new', label: 'New to you', apply: (query) => ({ ...query, filters: { ownership: ['owned'], isNew: true } }) },
    { key: 'unowned', label: 'Unowned', apply: (query) => ({ ...query, filters: { ownership: ['unowned'] } }) },
  ]
}

/** The value the active sort is about, shown on the tile. */
export function cardSortValueLabel(entry: CardEntry, sort: string, parameter: string | null): string | null {
  if (sort === 'era') return `Era ${entry.template.era}`
  if (sort === 'limitBreak') return entry.save ? `LB${entry.save.limitBreak}` : null
  if (sort === 'type') return titleCase(entry.template.type)
  if (sort === 'character') return entry.template.charName
  if (sort === 'effect' && parameter) {
    const effect = parameter.replace('effect:', '') as CardEffect
    const projection = entry.currentEffects.find((entryProjection) => entryProjection.effect === effect)
    return projection && projection.value > 0 ? `${EFFECT_LABELS[effect]} ${projection.value}` : null
  }
  return null
}
