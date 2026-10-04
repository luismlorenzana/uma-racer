// Invented card collection for UI/phone checks. Never imported by production screens; no original rows or artwork.
import { CARD_EFFECTS, createCardSave, createPlayerProfile, type CardEffect, type ContentAtlas,
  type RaceTemplate, type SupportCardTemplate } from '@racer/domain'
import type { LoadedContent } from '../../content/runtime'

const types = ['speed', 'speed', 'stamina', 'power', 'guts', 'wit', 'friend'] as const
const names = ['Ember', 'Beacon', 'Rill', 'Stone', 'Dawn', 'Sage', 'Guide']
export const globalCards = types.map((type, index): SupportCardTemplate => ({
  id: `invented-card-${index}`, charaId: `invented-character-${index}`, charName: names[index]!, title: 'Practice Notes',
  type, jpRelease: '2000-01-01', era: 1, obtain: 'free', starter: true, hintSkillIds: [], eventSkillIds: [],
  effectProfile: Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, effect === 'trainingBonus' ? 2 : 1])) as Record<CardEffect, number>,
  uniqueEffect: null, imageSource: 'https://invalid.test/invented.png',
}))
const races = (['g3', 'g2', 'g1'] as const).map((grade): RaceTemplate => ({
  id: `invented-${grade}`, familyId: `invented-${grade}`, name: 'Practice Mile', grade, surface: 'turf', distance: 1600,
  distanceCategory: 'mile', direction: 'right', venue: 'Practice field', venueKey: 'practice', venueTags: [], series: [],
  seriesLegs: [], courseId: 'invented-course', season: 1, fieldSize: 16,
}))
const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({ schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, pages: [], frames: {} })
export const globalCardContent: LoadedContent = {
  origin: 'network', manifest: { version: 'invented-global-card-proof', generatedAt: '', source: {}, files: [] }, sparkRivals: null,
  umas: { items: [], byId: new Map() }, cards: { items: globalCards, byId: new Map(globalCards.map(c => [c.id, c])) },
  skills: { items: [], byId: new Map() }, races: { items: races, byId: new Map(races.map(r => [r.id, r])) },
  courses: { items: [], byId: new Map() }, art: { has: () => false, load: async () => null },
  atlases: { 'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: [] }, 'card-icons': { descriptor: atlas('card-icons'), pageUrls: [] } },
}
export const globalCardState = (stars = 1) => ({
  persistent: false, profile: { ...createPlayerProfile('invented-global-card-proof', 1), tickets: 15 }, umas: {},
  cards: Object.fromEntries(globalCards.map((card, index) => [card.id, { ...createCardSave(card), stars: index === 0 ? stars : 3, maxCouponGranted: index !== 0 }])),
})
