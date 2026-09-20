import { describe, expect, it } from 'vitest'
import { CARD_EFFECTS, type CardSave, type SupportCardTemplate } from '@racer/domain'
import { buildCardAlbum } from './cards-view'
import type { LoadedContent } from '../content/runtime'

const card = (id: string, type: SupportCardTemplate['type'], era: number): SupportCardTemplate => ({
  id,
  charaId: `character-${id}`,
  charName: `Runner ${id}`,
  title: `Card ${id}`,
  type,
  jpRelease: '2021-01-01',
  era,
  obtain: 'gacha',
  starter: false,
  hintSkillIds: [],
  eventSkillIds: [],
  effectProfile: Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 1])) as SupportCardTemplate['effectProfile'],
  uniqueEffect: null,
  imageSource: 'https://example.invalid/synthetic.png',
})

function content(cards: SupportCardTemplate[]): LoadedContent {
  return {
    manifest: { version: 'synthetic', generatedAt: '', source: {}, files: [] },
    origin: 'network',
    umas: { items: [], byId: new Map() },
    cards: { items: cards, byId: new Map(cards.map((item) => [item.id, item])) },
    skills: { items: [], byId: new Map() },
    races: { items: [], byId: new Map() },
    courses: { items: [], byId: new Map() },
    atlases: {
      'uma-icons': { descriptor: { schemaVersion: 1, kind: 'uma-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
      'card-icons': { descriptor: { schemaVersion: 1, kind: 'card-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
    },
    art: { has: () => false, load: async () => null },
  }
}

const save = (id: string, overrides: Partial<CardSave> = {}): CardSave => ({
  templateId: id,
  level: 1,
  exp: 0,
  limitBreak: 0,
  maxCouponGranted: false,
  ...overrides,
})

describe('card album view', () => {
  it('groups deterministically and reports ownership, maxed, and orphaned counts', () => {
    const loaded = content([card('card-c', 'friend', 1), card('card-b', 'speed', 2), card('card-a', 'speed', 1)])
    const view = buildCardAlbum(loaded, {
      'card-a': save('card-a'),
      'card-b': save('card-b', { level: 25, limitBreak: 4, maxCouponGranted: true }),
      orphan: save('orphan'),
    }, 500)
    expect(view.items.map((item) => item.template.id)).toEqual(['card-a', 'card-c', 'card-b'])
    expect(view).toMatchObject({ owned: 2, maxed: 1, total: 3, orphanedIds: ['orphan'] })
  })

  it('filters and explains promotion readiness without hiding future effects', () => {
    const loaded = content([card('card-a', 'speed', 1), card('card-b', 'wit', 2)])
    const ready = save('card-a', { level: 5, exp: 100 })
    const view = buildCardAlbum(loaded, { 'card-a': ready }, 19, { ownership: 'owned', type: 'speed' })
    expect(view.items).toHaveLength(1)
    expect(view.items[0]).toMatchObject({ promotionCost: 20, promotionLock: 'Need 20 Training Tickets' })
    expect(view.items[0]!.currentEffects.find((effect) => effect.effect === 'raceBonus')?.value).toBe(0)
    expect(view.items[0]!.nextEffects?.find((effect) => effect.effect === 'raceBonus')?.value).toBeGreaterThan(0)
  })
})
