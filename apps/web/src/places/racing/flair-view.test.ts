import { emptySubject } from './__fixtures__/save'
import { describe, expect, it } from 'vitest'
import { createUmaBadgeState, createUmaSave, evaluateUmaFlair, buildUmaFlairCatalog, type ContentAtlas, type RaceTemplate, type UmaTemplate } from '@racer/domain'
import { buildFlairFanfare, buildUmaFlairSummary } from './flair-view'
import type { LoadedContent } from '../../content/view'

const template: UmaTemplate = {
  id: 'flair-uma', charaId: 'flair-character', name: 'Flair Runner', outfit: null, jpRelease: '2000-01-01', globalRelease: null,
  starter: false, baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'A' }, distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' }, strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
}

const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({
  schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128,
  pages: [{ path: `${kind}.webp`, width: 128, height: 128 }], frames: {},
})
const loadedContent = (): LoadedContent => ({
  manifest: { version: 'synthetic-v1' },
  origin: 'network',
  umas: { items: [template], byId: new Map([[template.id, template]]) },
  cards: { items: [], byId: new Map() },
  skills: { items: [], byId: new Map() },
  races: { items: [], byId: new Map() },
  courses: { items: [], byId: new Map() },
  atlases: {
    'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: [] },
    'card-icons': { descriptor: atlas('card-icons'), pageUrls: [] },
  },
    art: { has: () => false, load: async () => null },
})

describe('compact flair projections', () => {
  it('collapses crossed tiers, orders fanfare, and summarizes the latest visible awards', () => {
    const content = loadedContent()
    const state = createUmaBadgeState(createUmaSave(template), emptySubject(), 1)
    const proven = {
      ...state,
      sourceWatermarks: { ...state.sourceWatermarks, raceSequence: 24 },
      facts: { ...state.facts, starts: 25, wins: 25 },
    }
    const catalog = buildUmaFlairCatalog({ state: proven, races: content.races.items as RaceTemplate[] })
    const evaluated = evaluateUmaFlair(catalog, proven, { source: { kind: 'migration', id: null, tier: null }, earnedAt: 10, retroactive: true })
    const events = evaluated.events.map((event) => ({ id: event.id, ...event.data }))
    const fanfare = buildFlairFanfare(content, evaluated.state, events, evaluated.events.map((event) => event.id))
    expect(fanfare.filter((event) => event.awardKey === 'badge:winner')).toEqual([
      expect.objectContaining({ stage: 'gold', prestigeDelta: 4 }),
    ])
    const summary = buildUmaFlairSummary(content, evaluated.state, events)
    expect(summary).toMatchObject({ prestige: 5, badgeCount: 2, titleCount: 0, trophyCount: 0 })
    expect(summary.recent).toHaveLength(2)
  })

  it('uses safe labels when private dynamic content is missing', () => {
    const content = loadedContent()
    const state = createUmaBadgeState(createUmaSave(template), emptySubject(), 1)
    const events = [{
      id: 'flair:uma:flair-uma:trophy:missing:one-off',
      version: 1 as const,
      scope: 'uma' as const,
      umaId: 'flair-uma',
      kind: 'trophy-earned' as const,
      awardKey: 'trophy:missing-family',
      stage: 'one-off' as const,
      earnedAt: 10,
      source: { kind: 'migration' as const, id: null, tier: null },
      retroactive: true,
    }]
    expect(buildUmaFlairSummary(content, state, events).recent[0]?.label).toBe('G1 Trophy · Missing race content')
  })
})
