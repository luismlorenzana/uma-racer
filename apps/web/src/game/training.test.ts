import 'fake-indexeddb/auto'

import {
  createCardSave,
  createUmaSave,
  cardExpToNext,
  type CardEffect,
  type ContentAtlas,
  type CourseTemplate,
  type RaceTemplate,
  type SupportCardTemplate,
  type UmaTemplate,
} from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveApi } from '../api/client'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { bootstrapBadgeFacts } from './badges'
import { setMemoryUmaDeck, setPersistentUmaDeck } from './decks'
import { persistInitial, readLocalSnapshot } from './persistence'
import { GameRuntime } from './runtime'
import { clearGameState, useGame } from './store'
import { persistTraining, resolveMemoryTraining } from './training'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

const effects = (): Record<CardEffect, number> => ({
  trainingBonus: 0,
  friendshipBonus: 0,
  statBonus: 0,
  skillPointBonus: 0,
  specialtyPriority: 0,
  hintFrequency: 0,
  raceBonus: 0,
  initialStats: 0,
})

function uma(id: string): UmaTemplate {
  return {
    id,
    charaId: `uma-chara-${id}`,
    name: `Synthetic Runner ${id}`,
    outfit: null,
    jpRelease: '2000-01-01',
    globalRelease: null,
    starter: true,
    baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    growthRates: { speed: 0.1, stamina: 0, power: 0.2, guts: 0, wit: 0 },
    aptitudes,
    uniqueSkillId: null,
    awakeningSkillIds: [],
    realHorseSex: null,
    signatureRaceFamilyIds: [],
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

function card(type: SupportCardTemplate['type']): SupportCardTemplate {
  return {
    id: `card-${type}`,
    charaId: `card-chara-${type}`,
    charName: `Synthetic ${type}`,
    title: 'Synthetic Starter',
    type,
    jpRelease: '2000-01-01',
    era: 1,
    obtain: 'free',
    starter: true,
    hintSkillIds: [],
    eventSkillIds: [],
    effectProfile: effects(),
    uniqueEffect: null,
    imageSource: 'https://invalid.test/synthetic.png',
  }
}

function atlas(kind: ContentAtlas['kind'], ids: readonly string[]): ContentAtlas {
  return {
    schemaVersion: 1,
    kind,
    frameWidth: 128,
    frameHeight: 128,
    pages: [{ path: `${kind}.webp`, width: 128 * ids.length, height: 128 }],
    frames: Object.fromEntries(ids.map((id, index) => [id, { page: 0, x: index * 128, y: 0, width: 128 as const, height: 128 as const }])),
  }
}

function content(): LoadedContent {
  const umas = Array.from({ length: 25 }, (_, index) => uma(`uma-${String(index).padStart(2, '0')}`))
  const cards = (['speed', 'stamina', 'power', 'guts', 'wit'] as const).map(card)
  const races: RaceTemplate[] = [
    ['race-a', 'pre-op', '101'], ['race-b', 'op', '102'], ['race-c', 'g1', '103'],
  ].map(([id, grade, familyId], index) => ({
    id: id!, familyId: familyId!, name: `Synthetic Race ${index + 1}`, grade: grade as RaceTemplate['grade'],
    surface: 'turf', distance: 1600 + index * 200, distanceCategory: index < 2 ? 'mile' : 'medium',
    direction: 'left', venue: 'Synthetic', venueKey: 'synthetic-venue', venueTags: [], series: [], courseId: 'course-goals', season: 1, fieldSize: 8,
  }))
  const course: CourseTemplate = {
    id: 'course-goals', trackId: 'track-goals', distance: 3, terrain: 1, turn: 1,
    corners: [], straights: [{ start: 0, end: 2400, frontType: 1 }], slopes: [],
  }
  return {
    manifest: { version: 'synthetic-v1', generatedAt: '2000-01-01T00:00:00Z', source: {}, files: [] },
    origin: 'network',
    umas: { items: umas, byId: new Map(umas.map((item) => [item.id, item])) },
    cards: { items: cards, byId: new Map(cards.map((item) => [item.id, item])) },
    skills: { items: [], byId: new Map() },
    races: { items: races, byId: new Map(races.map((race) => [race.id, race])) },
    courses: { items: [course], byId: new Map([[course.id, course]]) },
    atlases: {
      'uma-icons': { descriptor: atlas('uma-icons', umas.map((item) => item.id)), pageUrls: ['blob:synthetic-umas'] },
      'card-icons': { descriptor: atlas('card-icons', cards.map((item) => item.id)), pageUrls: ['blob:synthetic-cards'] },
    },
  }
}

async function resetDatabase(): Promise<void> {
  db.close()
  await db.delete()
}

async function seed(loaded: LoadedContent): Promise<void> {
  await db.open()
  await persistInitial(loaded, '2000-01-02', 100)
  await bootstrapBadgeFacts(loaded, 100)
  const row = await db.umas.get('uma-00')
  await db.umas.put({ ...row!, data: { ...row!.data, goalPlanVersion: 0, scenarioStarted: true } })
}

describe('Training persistence', () => {
  beforeEach(resetDatabase)
  afterEach(resetDatabase)

  it('atomically spends, updates Uma/cards, rewards levels, appends ledgers, and coalesces entities', async () => {
    const loaded = content()
    await seed(loaded)
    const deckCardIds = ['card-power', 'card-speed', 'card-stamina', 'card-guts']
    await setPersistentUmaDeck(loaded, 'uma-00', deckCardIds, 101)
    for (const id of deckCardIds) {
      const row = await db.cards.get(id)
      await db.cards.put({ ...row!, data: { ...row!.data, exp: 35 } })
    }
    const umaRow = await db.umas.get('uma-00')
    await db.umas.put({ ...umaRow!, data: { ...umaRow!.data, stats: { ...umaRow!.data.stats, speed: 599 } } })
    await db.outbox.clear()

    const mutation = await persistTraining(loaded, 'uma-00', 'speed', '2000-01-02', 200)
    expect(mutation.profile.tickets).toBe(57)
    expect(mutation.uma.trainingsThisScenario).toBe(1)
    expect(mutation.result.ticketReward).toBe(8)
    expect(mutation.cards.map((saved) => saved.level)).toEqual([2, 2, 2, 2])
    expect(mutation.ledgerIds).toEqual([
      'training:uma-00:1:0',
      'card-level-tickets:card-power:2',
      'card-level-tickets:card-speed:2',
      'card-level-tickets:card-stamina:2',
      'card-level-tickets:card-guts:2',
    ])
    expect(mutation.earnedFlairEventIds[0]).toBe('flair:uma:uma-00:badge:stat:speed:bronze')
    expect(mutation.earnedFlairEventIds.slice(1).every((id) => id.startsWith('flair:trainer:'))).toBe(true)
    expect(mutation.earnedFlairEventIds).toHaveLength(9)

    const snapshot = await readLocalSnapshot()
    expect(snapshot?.profile.data.tickets).toBe(57)
    expect(snapshot?.umas.find((row) => row.id === 'uma-00')?.data.trainingsThisScenario).toBe(1)
    expect(await db.ledger.get('training:uma-00:1:0')).toMatchObject({
      data: { delta: -1, reason: 'training', localDay: '2000-01-02', createdAt: 200 },
    })
    expect(await db.outbox.count()).toBe(22)
    expect(await db.outbox.where('[kind+id]').equals(['badges', 'uma:uma-00']).count()).toBe(1)
    expect(await db.outbox.where('[kind+id]').equals(['badges', 'trainer']).count()).toBe(1)
    expect(await db.flairEvents.get(mutation.earnedFlairEventIds[0]!)).toMatchObject({ data: { source: { kind: 'training' } } })
    for (const id of mutation.ledgerIds) {
      expect(await db.outbox.where('[kind+id]').equals(['ledger', id]).count()).toBe(1)
    }
  })

  it('rejects no-ticket and empty-deck turns without partial writes', async () => {
    const loaded = content()
    await seed(loaded)
    await db.outbox.clear()
    const profileRow = await db.profile.get('main')
    await db.profile.put({ ...profileRow!, data: { ...profileRow!.data, tickets: 0 } })
    const before = await readLocalSnapshot()

    await expect(persistTraining(loaded, 'uma-00', 'speed', '2000-01-02', 200)).rejects.toThrow(/Ticket/)
    expect(await readLocalSnapshot()).toEqual(before)
    expect(await db.ledger.count()).toBe(2)
    expect(await db.outbox.count()).toBe(0)

    await db.profile.put({ ...profileRow!, data: profileRow!.data })
    await expect(persistTraining(loaded, 'uma-00', 'speed', '2000-01-02', 201)).rejects.toThrow(/at least one/)
    expect((await db.umas.get('uma-00'))?.data.trainingsThisScenario).toBe(0)
    expect(await db.ledger.count()).toBe(2)
    expect(await db.outbox.count()).toBe(0)

    const invalidUmaRow = await db.umas.get('uma-00')
    await db.umas.put({ ...invalidUmaRow!, data: { ...invalidUmaRow!.data, deckCardIds: ['card-speed', 'card-power'] } })
    const speed = loaded.cards.byId.get('card-speed')!
    const power = loaded.cards.byId.get('card-power')!
    const duplicateCharacter: LoadedContent = {
      ...loaded,
      cards: {
        items: loaded.cards.items.map((item) => item.id === power.id ? { ...item, charaId: speed.charaId } : item),
        byId: new Map(loaded.cards.items.map((item) => [
          item.id,
          item.id === power.id ? { ...item, charaId: speed.charaId } : item,
        ])),
      },
    }
    await expect(persistTraining(duplicateCharacter, 'uma-00', 'speed', '2000-01-02', 202)).rejects.toThrow(/character/)
    expect((await db.umas.get('uma-00'))?.data.trainingsThisScenario).toBe(0)
    expect(await db.ledger.count()).toBe(2)
    expect(await db.outbox.count()).toBe(0)
  })

  it('uses the same deck and mutation rules in memory-only mode', () => {
    const loaded = content()
    const template = loaded.umas.items[0]!
    const cardsById = Object.fromEntries(loaded.cards.items.map((item) => [item.id, createCardSave(item)]))
    const umaSave = setMemoryUmaDeck(
      loaded,
      { ...createUmaSave(template), goalPlanVersion: 0, scenarioStarted: true },
      cardsById,
      ['card-power', 'card-speed', 'card-stamina', 'card-guts'],
    ).uma
    const result = resolveMemoryTraining({
      content: loaded,
      profile: {
        schemaVersion: 2,
        tickets: 3,
        cardCoupons: 0,
        umaCoupons: 0,
        umaShards: 0,
        lastDailyGrant: null,
        featuredUmaId: template.id,
        starterSeedContentVersion: loaded.manifest.version,
        createdAt: 100,
      },
      uma: umaSave,
      cardsById,
      facility: 'speed',
      today: '2000-01-02',
      now: 200,
    })
    expect(result.profile.tickets).toBe(2)
    expect(result.uma.trainingsThisScenario).toBe(1)
    expect(result.ledgerIds[0]).toBe('training:uma-00:1:0')
  })

  it('grants one Card Select Coupon when Training first reaches level 25', async () => {
    const loaded = content()
    await seed(loaded)
    const umaRow = await db.umas.get('uma-00')
    const cardRow = await db.cards.get('card-speed')
    await db.umas.put({ ...umaRow!, data: { ...umaRow!.data, deckCardIds: ['card-speed'] } })
    await db.cards.put({
      ...cardRow!,
      data: { ...cardRow!.data, level: 24, exp: cardExpToNext(24) - 5, limitBreak: 4, maxCouponGranted: false },
    })
    await db.outbox.clear()

    const first = await persistTraining(loaded, 'uma-00', 'power', '2000-01-02', 300)
    expect(first.result).toMatchObject({ cardCouponReward: 1, newlyMaxedCardIds: ['card-speed'] })
    expect(first.profile.cardCoupons).toBe(4)
    expect(first.cards[0]).toMatchObject({ level: 25, maxCouponGranted: true })
    expect(await db.ledger.get('card-max-coupon:card-speed')).toMatchObject({
      data: { resource: 'card-coupons', delta: 1, reason: 'card-max' },
    })

    const second = await persistTraining(loaded, 'uma-00', 'power', '2000-01-02', 301)
    expect(second.result.cardCouponReward).toBe(0)
    expect(second.profile.cardCoupons).toBe(4)
    expect(await db.ledger.where('id').equals('card-max-coupon:card-speed').count()).toBe(1)
  })
})

describe('Training runtime lock', () => {
  let runtime: GameRuntime

  beforeEach(async () => {
    await resetDatabase()
    clearGameState()
    runtime = new GameRuntime()
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.stubGlobal('navigator', { onLine: false })
  })

  afterEach(async () => {
    runtime.stop()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await resetDatabase()
  })

  it('allows only one same-Uma resolution and publishes the committed result', async () => {
    const loaded = content()
    vi.spyOn(saveApi, 'load').mockRejectedValue(new Error('synthetic offline'))
    await runtime.start(loaded)
    await runtime.startScenario('uma-00', { parents: [], grandparentUniqueSkillIds: [], grandparentWhiteSkillIds: [], pinkSparks: [] }, 100)
    await runtime.setUmaDeck('uma-00', ['card-power', 'card-speed', 'card-stamina', 'card-guts'], 101)

    const first = runtime.trainUma('uma-00', 'speed', '2000-01-02', 200)
    const second = runtime.trainUma('uma-00', 'power', '2000-01-02', 201)
    await expect(second).rejects.toThrow(/already resolving/)
    await expect(first).resolves.toMatchObject({ uma: { trainingsThisScenario: 1 } })
    expect(useGame.getState().umas['uma-00']?.trainingsThisScenario).toBe(1)
    expect(useGame.getState().profile?.tickets).toBe(49)
    expect((await db.umas.get('uma-00'))?.data.trainingsThisScenario).toBe(1)
  })
})
