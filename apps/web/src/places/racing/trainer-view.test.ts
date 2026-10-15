import { umaFixture, emptySubject } from './__fixtures__/save'
import {
  CARD_EFFECTS,
  createCardSave,
  createTrainerBadgeState,
  createUmaBadgeState,
  createUmaSave,
  reconcileTrainerState,
  replaceTrainerPreferences,
  trainerUmaAwardRef,
  type FlairEventV1,
  type RaceResultRecord,
  type SupportCardTemplate,
  type UmaBadgeStateV1,
  type UmaTemplate,
} from '@racer/domain'
import { describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { filterBadgeItems } from './badge-collection-view'
import {
  buildStableRecentFlair,
  buildTrainerBadgeCollection,
  buildTrainerPinnedUmas,
  buildTrainerShowcase,
} from './trainer-view'

const uma: UmaTemplate = {
  id: 'trainer-view-uma', charaId: 'trainer-view-character', name: 'Synthetic Profile Runner', outfit: null,
  jpRelease: '2000-01-01', globalRelease: null, starter: false,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes: { surface: { turf: 'A', dirt: 'B' }, distance: { sprint: 'A', mile: 'A', medium: 'A', long: 'A' }, strategy: { front: 'A', pace: 'A', late: 'A', end: 'A' } },
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [], imageSource: 'https://invalid.test/synthetic.png',
}

const card: SupportCardTemplate = {
  id: 'trainer-view-card', charaId: 'trainer-view-support', charName: 'Synthetic Support', title: 'Profile Notes', type: 'speed',
  jpRelease: '2000-01-01', era: 7, obtain: 'gacha', starter: false, hintSkillIds: [], eventSkillIds: [],
  effectProfile: Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 0])) as SupportCardTemplate['effectProfile'],
  uniqueEffect: null, imageSource: 'https://invalid.test/synthetic.png',
}

const content: LoadedContent = {
  manifest: { version: 'synthetic-profile', generatedAt: '', source: {}, files: [] }, origin: 'network',
  umas: { items: [uma], byId: new Map([[uma.id, uma]]) }, cards: { items: [card], byId: new Map([[card.id, card]]) },
  skills: { items: [], byId: new Map() }, races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
  atlases: {
    'uma-icons': { descriptor: { schemaVersion: 1, kind: 'uma-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
    'card-icons': { descriptor: { schemaVersion: 1, kind: 'card-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
  },
    art: { has: () => false, load: async () => null },
}

function contributor(): UmaBadgeStateV1 {
  const base = createUmaBadgeState(createUmaSave(uma), emptySubject(), 1)
  return {
    ...base,
    sourceWatermarks: { ...base.sourceWatermarks, raceSequence: 9 },
    facts: {
      ...base.facts,
      starts: 10,
      wins: 10,
      gradeWins: [{ key: 'g1', count: 2 }],
      statPeaks: { ...base.facts.statPeaks, speed: 999 },
      longestWinStreak: 4,
    },
    awards: { ...base.awards, badges: [{
      awardKey: 'badge:winner', stage: 'bronze', earnedAt: 150, history: 'exact', frozenKeys: [],
      source: { kind: 'race', id: `race:${uma.id}:0`, tier: 1 },
    }] },
  }
}

function raceResult(): RaceResultRecord {
  const stats = { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 }
  const aptitude = { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }
  return {
    engineVersion: 3, contentVersion: content.manifest.version, umaId: uma.id, raceId: 'synthetic-race', sequence: 0, seed: 1,
    strategy: 'pace', startLevel: 1, startExp: 0, startStats: stats, raceBonus: 0, playerPlacement: 1,
    expGained: 0, levelsGained: [], ticketReward: 0, shardReward: 0, completedGoalIds: [],
    course: { distance: 1_600, surface: 'turf', season: 1 }, createdAt: 180,
    field: [
      { umaId: uma.id, isPlayer: true, strategy: 'pace', gate: 0, stats, aptitude, placement: 1, finishTime: 100, marginLengths: 0 },
      { umaId: 'synthetic-rival', isPlayer: false, strategy: 'pace', gate: 1, stats, aptitude, placement: 2, finishTime: 101, marginLengths: 6 },
    ],
  }
}

describe('Trainer profile projections', () => {
  it('projects achievement filters, records, owned pins, mixed showcases, and stable recent flair', () => {
    const save = umaFixture(uma, { level: 50 })
    const orphan = { ...save, templateId: 'owned-missing-content', level: 12 }
    const badge = contributor()
    const reconciled = reconcileTrainerState({
      state: createTrainerBadgeState(1), contentVersion: content.manifest.version,
      umas: content.umas.items, cards: content.cards.items, races: [], ownedUmas: [save, orphan],
      ownedCards: [createCardSave(card)], contributors: [badge], ledger: [], raceResults: [raceResult()], now: 200, retroactive: false,
    })
    const mixedRef = trainerUmaAwardRef(uma.id, 'badge:winner')
    const trainer = replaceTrainerPreferences(reconciled.state, {
      ...reconciled.state.preferences,
      displayName: 'Synthetic Trainer',
      pinnedUmaIds: [orphan.templateId, uma.id],
      showcaseGroups: [{ id: 'default', name: null, awardRefs: ['trainer:stable-master', mixedRef] }],
    }, new Set(['trainer:stable-master', mixedRef]), new Set([uma.id, orphan.templateId]))
    const saves = { [uma.id]: save, [orphan.templateId]: orphan }
    const collection = buildTrainerBadgeCollection(content, trainer, saves, [raceResult()])
    expect(filterBadgeItems(collection.items, '', [{ kind: 'category', value: 'collection' }]).every((item) => item.category === 'collection')).toBe(true)
    expect(collection.items.every((item) => item.venue === null && item.points === 0)).toBe(true)
    expect(collection.records).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'highest-stat', umaName: uma.name, valueLabel: '999 Speed' }),
      expect.objectContaining({ kind: 'biggest-winning-margin', source: expect.objectContaining({ to: expect.stringContaining('/race/run?') }) }),
    ]))
    expect(buildTrainerPinnedUmas(content, trainer, saves)).toEqual([
      { umaId: orphan.templateId, name: orphan.templateId, level: 12, missingContent: true },
      { umaId: uma.id, name: uma.name, level: 50, missingContent: false },
    ])

    const trainerEvent = reconciled.events.find((event) => event.data.awardKey === 'trainer:stable-master')!
    const umaEvent: FlairEventV1 & { id: string } = {
      id: 'flair:uma:trainer-view-uma:badge:winner:bronze', version: 1, scope: 'uma', umaId: uma.id,
      kind: 'badge-tier', awardKey: 'badge:winner', stage: 'bronze', earnedAt: 210,
      source: { kind: 'race', id: `race:${uma.id}:0`, tier: 1 }, retroactive: false,
    }
    const events = [umaEvent, { id: trainerEvent.id, ...trainerEvent.data }]
    const states = { [`uma:${uma.id}`]: badge, trainer }
    expect(buildTrainerShowcase(content, trainer, states, saves, events).map((item) => [item.ownerLabel, item.missing])).toEqual([
      ['Synthetic Trainer', false], [uma.name, false],
    ])
    expect(buildStableRecentFlair(content, states, saves, events, 2)).toEqual([
      expect.objectContaining({ ownerLabel: uma.name, trainer: false, to: expect.stringContaining('scope=uma') }),
      expect.objectContaining({ ownerLabel: 'Synthetic Trainer', trainer: true, to: expect.stringContaining('scope=trainer') }),
    ])
  })
})
