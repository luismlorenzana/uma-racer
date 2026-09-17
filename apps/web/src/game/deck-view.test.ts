import {
  CARD_EFFECTS,
  createCardSave,
  createUmaSave,
  type CardEffect,
  type ContentAtlas,
  type SupportCardTemplate,
  type UmaTemplate,
} from '@racer/domain'
import { describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { buildDeckView } from './deck-view'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' }, distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const
const effectProfile = (raceBonus = 0): Record<CardEffect, number> => Object.fromEntries(
  CARD_EFFECTS.map((effect) => [effect, effect === 'raceBonus' ? raceBonus : 0]),
) as Record<CardEffect, number>
const umaTemplate: UmaTemplate = {
  id: 'uma-synthetic', charaId: 'uma-character', name: 'Synthetic Runner', outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, aptitudes,
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaces: [],
  imageSource: 'https://example.invalid/synthetic.png',
}
function card(id: string, type: SupportCardTemplate['type'], options: { era?: number; charaId?: string; raceBonus?: number; hints?: string[] } = {}): SupportCardTemplate {
  return {
    id, charaId: options.charaId ?? `character-${id}`, charName: `Synthetic ${id}`, title: 'Practice Notes', type,
    jpRelease: '2000-01-01', era: options.era ?? 1, obtain: 'free', starter: true,
    hintSkillIds: options.hints ?? [], eventSkillIds: [], effectProfile: effectProfile(options.raceBonus), uniqueEffect: null,
    imageSource: 'https://example.invalid/synthetic.png',
  }
}
function atlas(kind: ContentAtlas['kind'], ids: readonly string[]): ContentAtlas {
  return { schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, pages: [{ path: '', width: 128 * ids.length, height: 128 }], frames: Object.fromEntries(ids.map((id, index) => [id, { page: 0, x: index * 128, y: 0, width: 128 as const, height: 128 as const }])) }
}
function fixture() {
  const templates = [
    card('speed', 'speed', { raceBonus: 3, hints: ['hint-a'] }),
    card('power', 'power', { raceBonus: 4, hints: ['hint-a', 'hint-b'] }),
    card('duplicate', 'stamina', { charaId: 'character-speed' }),
    card('future', 'guts', { era: 2 }),
    card('friend', 'friend'),
  ]
  const content: LoadedContent = {
    manifest: { version: 'synthetic', generatedAt: '', source: {}, files: [] }, origin: 'network',
    umas: { items: [umaTemplate], byId: new Map([[umaTemplate.id, umaTemplate]]) },
    cards: { items: templates, byId: new Map(templates.map((item) => [item.id, item])) },
    skills: { items: [], byId: new Map() }, races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
    atlases: {
      'uma-icons': { descriptor: atlas('uma-icons', [umaTemplate.id]), pageUrls: ['blob:uma'] },
      'card-icons': { descriptor: atlas('card-icons', templates.map((item) => item.id)), pageUrls: ['blob:cards'] },
    },
  }
  return { content, templates }
}

describe('deck view model', () => {
  it('projects slots, effects, hints, order, and explicit candidate disable reasons', () => {
    const { content, templates } = fixture()
    const cards = Object.fromEntries(templates.map((template) => [template.id, createCardSave(template)]))
    const uma = { ...createUmaSave(umaTemplate), deckCardIds: ['speed', 'power'] }
    const model = buildDeckView(uma, cards, content)
    expect(model.slots.map((slot) => slot.unlocked)).toEqual([true, true, true, true, false, false])
    expect(model.slots.slice(0, 2).map((slot) => slot.card?.id)).toEqual(['speed', 'power'])
    expect(model.raceBonus).toBe(0)
    expect(model.hintSkillCount).toBe(2)
    expect(Object.fromEntries(model.candidates.map((item) => [item.id, item.disabledReason]))).toMatchObject({
      speed: 'Already selected', power: 'Already selected', duplicate: 'Duplicate character',
      future: 'Later scenario · Tier 2', friend: 'Friend/Group unavailable',
    })
  })

  it('filters candidates and retains missing saved references as repair state', () => {
    const { content, templates } = fixture()
    const retired = { ...createCardSave(card('retired', 'wit')), templateId: 'retired' }
    const cards = { ...Object.fromEntries(templates.map((template) => [template.id, createCardSave(template)])), retired }
    const uma = { ...createUmaSave(umaTemplate), deckCardIds: ['retired'] }
    const repair = buildDeckView(uma, cards, content)
    expect(repair.needsRepair).toBe(true)
    expect(repair.slots[0]?.card).toMatchObject({ id: 'retired', template: null, asset: null })
    expect(repair.validationErrors[0]).toMatch(/missing/)
    const unowned = buildDeckView({ ...createUmaSave(umaTemplate), deckCardIds: ['speed'] }, { retired }, content)
    expect(unowned.needsRepair).toBe(true)
    expect(unowned.slots[0]?.card).toMatchObject({ id: 'speed', save: null })
    expect(buildDeckView(createUmaSave(umaTemplate), cards, content, [], { type: 'speed', era: 'current' }).candidates.map((item) => item.id)).toEqual(['speed'])
    expect(buildDeckView(createUmaSave(umaTemplate), cards, content, [], { type: 'all', era: 'later' }).candidates.map((item) => item.id)).toEqual(['future'])
  })
})
