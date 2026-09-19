import {
  createCardSave,
  createPlayerProfile,
  createUmaSave,
  type CardEffect,
  type ContentAtlas,
  type SupportCardTemplate,
  type UmaTemplate,
} from '@racer/domain'
import { describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { buildTrainingView } from './training-view'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

const effectProfile = Object.fromEntries([
  'trainingBonus', 'friendshipBonus', 'statBonus', 'skillPointBonus',
  'specialtyPriority', 'hintFrequency', 'raceBonus', 'initialStats',
].map((key) => [key, 0])) as Record<CardEffect, number>

function content(): LoadedContent {
  const uma: UmaTemplate = {
    id: 'uma-synthetic',
    charaId: 'uma-chara-synthetic',
    name: 'Synthetic Runner',
    outfit: null,
    jpRelease: '2000-01-01',
    globalRelease: null,
    starter: true,
    baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
    aptitudes,
    uniqueSkillId: null,
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaceFamilyIds: [],
    imageSource: 'https://invalid.test/synthetic.png',
  }
  const cards: SupportCardTemplate[] = ['speed', 'stamina', 'power', 'guts'].map((type) => ({
    id: `card-${type}`,
    charaId: `card-chara-${type}`,
    charName: `Synthetic ${type}`,
    title: '',
    type: type as SupportCardTemplate['type'],
    jpRelease: '2000-01-01',
    era: 1,
    obtain: 'free',
    starter: true,
    hintSkillIds: [],
    eventSkillIds: [],
    effectProfile,
    uniqueEffect: null,
    imageSource: 'https://invalid.test/synthetic.png',
  }))
  const atlas = (kind: ContentAtlas['kind'], ids: readonly string[]): ContentAtlas => ({
    schemaVersion: 1,
    kind,
    frameWidth: 128,
    frameHeight: 128,
    pages: [{ path: `${kind}.webp`, width: 128 * ids.length, height: 128 }],
    frames: Object.fromEntries(ids.map((id, index) => [id, { page: 0, x: index * 128, y: 0, width: 128 as const, height: 128 as const }])),
  })
  return {
    manifest: { version: 'synthetic-v1', generatedAt: '2000-01-01T00:00:00Z', source: {}, files: [] },
    origin: 'network',
    umas: { items: [uma], byId: new Map([[uma.id, uma]]) },
    cards: { items: cards, byId: new Map(cards.map((card) => [card.id, card])) },
    skills: { items: [], byId: new Map() },
    races: { items: [], byId: new Map() },
    courses: { items: [], byId: new Map() },
    atlases: {
      'uma-icons': { descriptor: atlas('uma-icons', [uma.id]), pageUrls: ['blob:synthetic-uma'] },
      'card-icons': { descriptor: atlas('card-icons', cards.map((card) => card.id)), pageUrls: ['blob:synthetic-cards'] },
    },
  }
}

describe('Training view model', () => {
  it('joins the reload-stable deal, exact previews, and managed atlas assets', () => {
    const loaded = content()
    const cardsById = Object.fromEntries(loaded.cards.items.map((card) => [card.id, createCardSave(card)]))
    const uma = { ...createUmaSave(loaded.umas.items[0]!), deckCardIds: Object.keys(cardsById) }
    const profile = { ...createPlayerProfile(loaded.manifest.version, 100), tickets: 3 }
    const first = buildTrainingView(profile, uma, cardsById, loaded)
    const second = buildTrainingView(profile, uma, cardsById, loaded)
    expect(first).toEqual(second)
    expect(first.status).toBe('ready')
    if (first.status !== 'ready') return
    expect(first.value.cards).toHaveLength(4)
    expect(first.value.cards[0]?.asset?.url).toBe('blob:synthetic-cards')
    expect(first.value.umaAsset?.url).toBe('blob:synthetic-uma')
    expect(Object.keys(first.value.facilities)).toEqual(['speed', 'stamina', 'power', 'guts', 'wit'])
  })

  it('reports empty and missing save/content references without inventing a deal', () => {
    const loaded = content()
    const profile = createPlayerProfile(loaded.manifest.version, 100)
    const empty = createUmaSave(loaded.umas.items[0]!)
    expect(buildTrainingView(profile, empty, {}, loaded)).toEqual({ status: 'empty-deck' })
    expect(buildTrainingView(profile, { ...empty, deckCardIds: ['card-speed'] }, {}, loaded)).toMatchObject({
      status: 'error',
      message: expect.stringMatching(/not owned/),
    })
    expect(buildTrainingView(profile, { ...empty, templateId: 'missing' }, {}, loaded)).toMatchObject({
      status: 'error',
      message: expect.stringMatching(/missing Uma/),
    })
  })

  it('refuses a saved card whose refreshed era is later than the Uma tier', () => {
    const loaded = content()
    const moved = { ...loaded.cards.items[0]!, era: 12 }
    const refreshed = { ...loaded, cards: { items: [moved], byId: new Map([[moved.id, moved]]) } }
    const cardSave = createCardSave(moved)
    const uma = { ...createUmaSave(loaded.umas.items[0]!), level: 101, deckCardIds: [moved.id] }
    expect(buildTrainingView(createPlayerProfile(loaded.manifest.version, 100), uma, { [moved.id]: cardSave }, refreshed))
      .toEqual({ status: 'error', message: `Support card ${moved.id} is Era locked until tier 12` })
  })
})
