import { CARD_EFFECTS, createCardSave, createPlayerProfile, createUmaSave, type ContentAtlas, type SupportCardTemplate, type UmaTemplate } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { buildCardSelection, buildUmaAlbum, resolveCollectionReveal } from './collection-view'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const
const uma = (id: string, name: string, dirt: 'A' | 'G' = 'G', realHorseSex: UmaTemplate['realHorseSex'] = null): UmaTemplate => ({
  id, charaId: `runner-${id}`, name, outfit: 'Practice Outfit', jpRelease: '2000-01-01', globalRelease: null,
  starter: false, baseStats: { speed: 101, stamina: 102, power: 103, guts: 104, wit: 105 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { ...aptitudes, surface: { turf: 'A', dirt } }, uniqueSkillId: `skill-${id}`,
  awakeningSkillIds: [], realHorseSex, signatureRaceFamilyIds: [], imageSource: 'https://example.invalid/synthetic.png',
})
const card = (id: string, era: number, type: SupportCardTemplate['type']): SupportCardTemplate => ({
  id, charaId: `runner-${id}`, charName: `Synthetic ${id}`, title: 'Practice Notes', type,
  jpRelease: '2000-01-01', era, obtain: 'gacha', starter: false, hintSkillIds: [], eventSkillIds: [],
  effectProfile: Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 1])) as SupportCardTemplate['effectProfile'],
  uniqueEffect: null, imageSource: 'https://example.invalid/synthetic.png',
})

function loaded(umas: UmaTemplate[], cards: SupportCardTemplate[]): LoadedContent {
  const atlas = (kind: ContentAtlas['kind'], ids: string[]): ContentAtlas => ({
    schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128,
    pages: [{ path: `${kind}.webp`, width: Math.max(128, ids.length * 128), height: 128 }],
    frames: Object.fromEntries(ids.map((id, index) => [id, { page: 0, x: index * 128, y: 0, width: 128, height: 128 }])),
  })
  return {
    manifest: { version: 'synthetic', generatedAt: '', source: {}, files: [] }, origin: 'network',
    umas: { items: umas, byId: new Map(umas.map((item) => [item.id, item])) },
    cards: { items: cards, byId: new Map(cards.map((item) => [item.id, item])) },
    skills: { items: [], byId: new Map() }, races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
    atlases: {
      'uma-icons': { descriptor: atlas('uma-icons', umas.map((item) => item.id)), pageUrls: ['blob:synthetic-uma'] },
      'card-icons': { descriptor: atlas('card-icons', cards.map((item) => item.id)), pageUrls: ['blob:synthetic-card'] },
    },
  }
}

describe('collection projections', () => {
  it('builds an unowned card selector with completion, filters, and honest future/Friend states', () => {
    const cards = [card('c-owned', 1, 'speed'), card('c-future', 8, 'wit'), card('c-group', 1, 'group')]
    const content = loaded([], cards)
    const profile = { ...createPlayerProfile('synthetic', 1), cardCoupons: 2 }
    const view = buildCardSelection(content, { 'c-owned': createCardSave(cards[0]!), orphan: createCardSave(card('orphan', 1, 'power')) }, profile)
    expect(view).toMatchObject({ owned: 1, total: 3, couponBalance: 2, orphanedIds: ['orphan'] })
    expect(view.items.map((item) => item.template.id)).toEqual(['c-group', 'c-future'])
    expect(view.items.find((item) => item.template.id === 'c-group')?.acquisitionNote).toBeNull()
    expect(view.items.find((item) => item.template.id === 'c-future')?.acquisitionNote).toMatch(/tier 8/)
    expect(buildCardSelection(content, {}, profile, { era: 8, type: 'wit' }).items.map((item) => item.template.id)).toEqual(['c-future'])
  })

  it('projects owned and unowned Uma outfits with deterministic aptitude filtering and honest counts', () => {
    const umas = [uma('u2', 'Beta'), uma('u1', 'Alpha')]
    const content = loaded(umas, [])
    const profile = { ...createPlayerProfile('synthetic', 1), umaCoupons: 1, umaShards: 4 }
    const u2 = createUmaSave(umas[0]!)
    const owned = {
      u2: { ...u2, aptitudes: { ...u2.aptitudes, surface: { ...u2.aptitudes.surface, dirt: 'A' as const } } },
      orphan: createUmaSave(uma('orphan', 'Missing')),
    }
    const all = buildUmaAlbum(content, owned, profile, { ownership: 'all', tier: null, surface: null, distance: null, strategy: null, sex: null, ready: false })
    expect(all).toMatchObject({ owned: 1, total: 2, orphanedIds: ['orphan'], couponBalance: 1, shardBalance: 4 })
    expect(all.items.map((item) => item.template.id)).toEqual(['u1', 'u2'])
    expect(all.items[0]).toMatchObject({ owned: false, redemptionLock: null })
    const dirt = buildUmaAlbum(content, owned, profile, { ownership: 'all', tier: null, surface: 'dirt', distance: null, strategy: null, sex: null, ready: false })
    expect(dirt.items.map((item) => item.template.id)).toEqual(['u2'])
  })

  it('filters male, female, and unknown real-horse records explicitly', () => {
    const umas = [uma('female', 'Alpha', 'G', 'female'), uma('male', 'Beta', 'G', 'male'), uma('unknown', 'Gamma')]
    const content = loaded(umas, [])
    const profile = createPlayerProfile('synthetic', 1)
    const base = { ownership: 'all' as const, tier: null, surface: null, distance: null, strategy: null, ready: false }
    expect(buildUmaAlbum(content, {}, profile, { ...base, sex: 'female' }).items.map((item) => item.template.id)).toEqual(['female'])
    expect(buildUmaAlbum(content, {}, profile, { ...base, sex: 'male' }).items.map((item) => item.template.id)).toEqual(['male'])
    expect(buildUmaAlbum(content, {}, profile, { ...base, sex: 'unknown' }).items.map((item) => item.template.id)).toEqual(['unknown'])
  })

  it('reconstructs reveals only from safe routes with matching owned entities and content', () => {
    const umas = [uma('u1', 'Alpha')]
    const cards = [card('c1', 1, 'speed')]
    const content = loaded(umas, cards)
    const ownedCards = { c1: createCardSave(cards[0]!) }
    const ownedUmas = { u1: createUmaSave(umas[0]!) }
    expect(resolveCollectionReveal(content, ownedCards, ownedUmas, 'card', 'c1')).toMatchObject({ kind: 'card', id: 'c1' })
    expect(resolveCollectionReveal(content, ownedCards, ownedUmas, 'uma', 'u1')).toMatchObject({ kind: 'uma', id: 'u1' })
    expect(resolveCollectionReveal(content, ownedCards, ownedUmas, 'card', 'not-owned')).toBeNull()
    expect(resolveCollectionReveal(content, ownedCards, ownedUmas, 'card', '../unsafe')).toBeNull()
    expect(resolveCollectionReveal(content, ownedCards, ownedUmas, 'unknown', 'c1')).toBeNull()
  })
})
