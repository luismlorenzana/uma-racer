import {
  CARD_EFFECTS,
  createCardSave,
  createUmaSave,
  type ContentAtlas,
  type SupportCardTemplate,
  type UmaTemplate,
} from '@racer/domain'
import { describe, expect, it } from 'vitest'
import type { LoadedContent } from '../../content/runtime'
import { runAlbumQuery } from './query'
import {
  CARD_DEFAULT_QUERY,
  CARD_FACETS,
  CARD_TIE_BREAK,
  buildCardAlbumRows,
  buildCardPresets,
  cardSortValueLabel,
} from './cards'

const card = (id: string, era: number, type: SupportCardTemplate['type'], starter = false): SupportCardTemplate => ({
  id, charaId: `runner-${id}`, charName: `Synthetic ${id}`, title: `Notes ${id}`, type,
  jpRelease: '2000-01-01', era, obtain: starter ? 'free' : 'gacha', starter,
  hintSkillIds: ['skill-1'], eventSkillIds: [],
  effectProfile: Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 1])) as SupportCardTemplate['effectProfile'],
  uniqueEffect: null, imageSource: 'https://example.invalid/synthetic.png',
})

const uma = (id: string): UmaTemplate => ({
  id, charaId: `chara-${id}`, name: `Runner ${id}`, outfit: null, jpRelease: '2000-01-01', globalRelease: null,
  starter: true, baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
    strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
  },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
  imageSource: 'https://example.invalid/synthetic.png',
})

function loaded(cards: SupportCardTemplate[], umas: UmaTemplate[]): LoadedContent {
  const atlas = (kind: ContentAtlas['kind'], ids: string[]): ContentAtlas => ({
    schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128,
    pages: [{ path: `${kind}.webp`, width: Math.max(128, ids.length * 128), height: 128 }],
    frames: Object.fromEntries(ids.map((id, index) => [id, { page: 0, x: index * 128, y: 0, width: 128, height: 128 }])),
  })
  const skill = { id: 'skill-1', kind: 'white' as const, name: 'Corner Recovery', description: '', costSp: 100, iconId: null, conditions: [], inheritedSkillId: null, normalSkillId: null }
  return {
    manifest: { version: 'synthetic', generatedAt: '', source: {}, files: [] }, origin: 'network',
    umas: { items: umas, byId: new Map(umas.map((item) => [item.id, item])) },
    cards: { items: cards, byId: new Map(cards.map((item) => [item.id, item])) },
    skills: { items: [skill], byId: new Map([[skill.id, skill]]) },
    races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
    atlases: {
      'uma-icons': { descriptor: atlas('uma-icons', umas.map((item) => item.id)), pageUrls: ['blob:uma'] },
      'card-icons': { descriptor: atlas('card-icons', cards.map((item) => item.id)), pageUrls: ['blob:card'] },
    },
  }
}

const templates = [card('c1', 1, 'speed', true), card('c2', 3, 'stamina'), card('c3', 2, 'friend')]
const content = loaded(templates, [uma('u1')])

function album(ownedIds: readonly string[], deck: readonly string[] = []) {
  const cards = Object.fromEntries(ownedIds.map((id) => [id, createCardSave(templates.find((entry) => entry.id === id)!)]))
  const save = createUmaSave(uma('u1'))
  return buildCardAlbumRows({
    content,
    cards,
    umas: { u1: { ...save, deckCardIds: [...deck] } },
    tickets: 0,
    seen: [],
  })
}

describe('card album projection', () => {
  it('opens on owned → newest era → highest level', () => {
    const built = album(['c1', 'c2'])
    const result = runAlbumQuery(built.rows, CARD_FACETS, CARD_DEFAULT_QUERY, CARD_TIE_BREAK)
    expect(result.rows.map((row) => row.id)).toEqual(['c2', 'c1'])
    expect(built.owned).toBe(2)
    expect(built.total).toBe(3)
  })

  it('marks unowned cards and keeps them reachable', () => {
    const built = album(['c1'])
    const unowned = runAlbumQuery(built.rows, CARD_FACETS, { ...CARD_DEFAULT_QUERY, filters: { ownership: ['unowned'] } })
    expect(unowned.rows.map((row) => row.id).sort()).toEqual(['c2', 'c3'])
  })

  it('exposes era eligibility as a tier facet', () => {
    const built = album(['c1', 'c2'])
    const atTierTwo = runAlbumQuery(built.rows, CARD_FACETS, { ...CARD_DEFAULT_QUERY, filters: { equippableAt: ['2'] } })
    // The era-3 card is not equippable at tier 2; the era-1 and era-2 cards are.
    expect(atTierTwo.rows.map((row) => row.id).sort()).toEqual(['c1', 'c3'])
  })

  it('knows which decks hold a card', () => {
    const built = album(['c1', 'c2'], ['c1'])
    expect(built.entries.get('c1')?.equippedBy).toEqual(['u1'])
    expect(built.entries.get('c2')?.equippedBy).toEqual([])
    const equipped = runAlbumQuery(built.rows, CARD_FACETS, { ...CARD_DEFAULT_QUERY, filters: { equipped: true } })
    expect(equipped.rows.map((row) => row.id)).toEqual(['c1'])
  })

  it('searches character names and hint skills', () => {
    const built = album(['c1'])
    const byHint = runAlbumQuery(built.rows, CARD_FACETS, { ...CARD_DEFAULT_QUERY, filters: {}, search: 'corner recovery' })
    expect(byHint.rows.map((row) => row.id)).toContain('c1')
    const byCharacter = runAlbumQuery(built.rows, CARD_FACETS, { ...CARD_DEFAULT_QUERY, filters: {}, search: 'synthetic c2' })
    expect(byCharacter.rows.map((row) => row.id)).toEqual(['c2'])
  })

  it('labels the value the active sort is about', () => {
    const entry = album(['c2']).entries.get('c2')!
    expect(cardSortValueLabel(entry, 'era', null)).toBe('Era 3')
    expect(cardSortValueLabel(entry, 'limitBreak', null)).toBe('LB0')
    expect(cardSortValueLabel(entry, 'name', null)).toBeNull()
  })

  it('keeps broad effects active while excluding inactive Friend specialty/friendship values', () => {
    const entry = album(['c3']).entries.get('c3')!
    const row = album(['c3']).rows.find((candidate) => candidate.id === 'c3')!
    expect(row.facets.effectKind).toContain('statBonus')
    expect(row.facets.effectKind).not.toContain('friendshipBonus')
    expect(row.facets.effectKind).not.toContain('specialtyPriority')
    expect(cardSortValueLabel(entry, 'effect', 'effect:statBonus')).toBe('Stat Bonus 1.3 each')
    expect(cardSortValueLabel(entry, 'effect', 'effect:specialtyPriority')).toBeNull()
  })

  it('builds an equippable-now preset around the roster tier', () => {
    const [equippable] = buildCardPresets(2)
    expect(equippable?.apply(CARD_DEFAULT_QUERY).filters).toEqual({ ownership: ['owned'], equippableAt: ['2'] })
  })
})
