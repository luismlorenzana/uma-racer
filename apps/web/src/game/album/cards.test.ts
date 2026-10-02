import { withRun } from '../__fixtures__/save'
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
  CARD_COLLECTION_FACETS,
  CARD_COLLECTION_QUERY,
  CARD_SCENARIO_FACETS,
  CARD_SCENARIO_QUERY,
  CARD_TIE_BREAK,
  buildCardAlbumRows,
  buildCardPresets,
  cardSortValueLabel,
  type CardLens,
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
  // Two Late Surger skills, so a card hinting both reads as Late (D201).
  const late = [1, 2].map((index) => ({
    ...skill, id: `late-${index}`, name: `Late Kick ${index}`,
    conditions: [{ precondition: null, condition: 'running_style==3&phase==2', baseTime: 30_000, cooldown: null, effects: [{ type: 27, value: 1_500 }] }],
  }))
  const skills = [skill, ...late]
  return {
    manifest: { version: 'synthetic', generatedAt: '', source: {}, files: [] }, origin: 'network', sparkRivals: null,
    umas: { items: umas, byId: new Map(umas.map((item) => [item.id, item])) },
    cards: { items: cards, byId: new Map(cards.map((item) => [item.id, item])) },
    skills: { items: skills, byId: new Map(skills.map((item) => [item.id, item])) },
    races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
    atlases: {
      'uma-icons': { descriptor: atlas('uma-icons', umas.map((item) => item.id)), pageUrls: ['blob:uma'] },
      'card-icons': { descriptor: atlas('card-icons', cards.map((item) => item.id)), pageUrls: ['blob:card'] },
    },
    art: { has: () => false, load: async () => null },
  }
}

const templates = [
  card('c1', 1, 'speed', true),
  // An authored correction, for the distance only: its style still comes from its skills.
  { ...card('c2', 3, 'stamina'), focus: { distance: 'long' as const } },
  { ...card('c3', 2, 'friend'), hintSkillIds: ['late-1', 'late-2', 'skill-1'] },
]
const content = loaded(templates, [uma('u1')])

function album(
  lens: CardLens,
  ownedIds: readonly string[],
  options: { deck?: readonly string[]; breaks?: Record<string, Record<string, number>> } = {},
) {
  const cards = Object.fromEntries(ownedIds.map((id) => {
    const save = createCardSave(templates.find((entry) => entry.id === id)!)
    return [id, { ...save, bonds: options.breaks?.[id] ?? {} }]
  }))
  const save = createUmaSave(uma('u1'))
  return buildCardAlbumRows({
    content,
    cards,
    umas: { u1: withRun(save, { cardSetIds: [...(options.deck ?? [])] }) },
    seen: [],
    lens,
  })
}

describe('card album · collection lens', () => {
  it('lists every card, newest era first, and knows nothing about bond', () => {
    const built = album('collection', ['c1', 'c2'])
    const result = runAlbumQuery(built.rows, CARD_COLLECTION_FACETS, CARD_COLLECTION_QUERY, CARD_TIE_BREAK)
    expect(result.rows.map((row) => row.id)).toEqual(['c2', 'c3', 'c1'])
    expect(built.total).toBe(3)
    expect(built.owned).toBe(2)
    expect(built.entries.get('c1')?.bond).toBeNull()
    expect(built.entries.get('c1')?.perNode).toBeNull()
  })

  it('prices unowned cards by era', () => {
    const built = album('collection', ['c1'])
    const unowned = runAlbumQuery(built.rows, CARD_COLLECTION_FACETS, { ...CARD_COLLECTION_QUERY, filters: { ownership: ['unowned'] } })
    expect(unowned.rows.map((row) => row.id).sort()).toEqual(['c2', 'c3'])
  })

  it('knows which active sets hold a card', () => {
    const built = album('collection', ['c1', 'c2'], { deck: ['c1'] })
    expect(built.entries.get('c1')?.equippedBy).toEqual(['u1'])
    expect(built.entries.get('c2')?.equippedBy).toEqual([])
  })

  it('tags running style and distance focus, override first, and filters on them', () => {
    const built = album('collection', [])
    expect(built.entries.get('c1')?.focus).toEqual({ style: 'generalist', distance: 'generalist' })
    expect(built.entries.get('c2')?.focus).toEqual({ style: 'generalist', distance: 'long' })
    expect(built.entries.get('c3')?.focus).toEqual({ style: 'late', distance: 'generalist' })
    const late = runAlbumQuery(built.rows, CARD_COLLECTION_FACETS, { ...CARD_COLLECTION_QUERY, filters: { style: ['late'] } })
    expect(late.rows.map((row) => row.id)).toEqual(['c3'])
    const long = runAlbumQuery(built.rows, CARD_COLLECTION_FACETS, { ...CARD_COLLECTION_QUERY, filters: { distance: ['long'] } })
    expect(long.rows.map((row) => row.id)).toEqual(['c2'])
    const anyStyle = runAlbumQuery(built.rows, CARD_COLLECTION_FACETS, { ...CARD_COLLECTION_QUERY, filters: { style: ['generalist'] } })
    expect(anyStyle.rows.map((row) => row.id).sort()).toEqual(['c1', 'c2'])
  })

  it('searches character names and hint skills', () => {
    const built = album('collection', ['c1'])
    const byHint = runAlbumQuery(built.rows, CARD_COLLECTION_FACETS, { ...CARD_COLLECTION_QUERY, search: 'corner recovery' })
    expect(byHint.rows.map((row) => row.id)).toContain('c1')
  })
})

describe('card album · scenario lens', () => {
  it('holds only cards that era allows, most bonded first and unowned last', () => {
    const built = album(2, ['c1', 'c3'], { breaks: { c3: { '2': 2 }, c1: { '1': 3 } } })
    expect([...built.entries.keys()].sort()).toEqual(['c1', 'c3'])
    const result = runAlbumQuery(built.rows, CARD_SCENARIO_FACETS, CARD_SCENARIO_QUERY, CARD_TIE_BREAK)
    expect(result.rows.map((row) => row.id)).toEqual(['c3', 'c1'])
    // c1 has 3★ in tier 1, but stars belong to their scenario: in tier 2 it starts over.
    expect(built.entries.get('c1')?.bond).toBe(0)
    expect(built.entries.get('c3')?.bond).toBe(2)
    expect(built.bonded).toBe(1)
  })

  it('pays per node at the scenario, by stars', () => {
    const built = album(1, ['c1'], { breaks: { c1: { '1': 1 } } })
    // 220 a node at 1★, which pays 68% (D147).
    expect(built.entries.get('c1')?.perNode).toBeCloseTo(149.6)
  })

  it('filters on what can still be bonded here', () => {
    const built = album(1, ['c1'], { breaks: { c1: { '1': 3 } } })
    const [bondable] = buildCardPresets(1)
    const result = runAlbumQuery(built.rows, CARD_SCENARIO_FACETS, bondable!.apply(CARD_SCENARIO_QUERY))
    expect(result.rows).toEqual([])
    expect(built.maxed).toBe(1)
  })

  it('labels the value the active sort is about', () => {
    const entry = album(2, ['c3'], { breaks: { c3: { '2': 3 } } }).entries.get('c3')!
    expect(cardSortValueLabel(entry, 'bond')).toBe('3★')
    expect(cardSortValueLabel(entry, 'type')).toBe('Friend')
    expect(cardSortValueLabel(entry, 'name')).toBeNull()
  })
})
