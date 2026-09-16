import 'fake-indexeddb/auto'

import {
  createCardSave,
  createUmaSave,
  type CardEffect,
  type ContentAtlas,
  type SupportCardTemplate,
  type UmaTemplate,
} from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveApi } from '../api/client'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { persistInitial, readLocalSnapshot } from './persistence'
import { GameRuntime } from './runtime'
import { clearGameState, useGame } from './store'
import {
  ensureMemoryTrainingDeck,
  ensurePersistentTrainingDeck,
  persistTraining,
  resolveMemoryTraining,
} from './training'

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
    signatureRaces: [],
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
  return {
    manifest: { version: 'synthetic-v1', generatedAt: '2000-01-01T00:00:00Z', source: {}, files: [] },
    origin: 'network',
    umas: { items: umas, byId: new Map(umas.map((item) => [item.id, item])) },
    cards: { items: cards, byId: new Map(cards.map((item) => [item.id, item])) },
    skills: { items: [], byId: new Map() },
    races: { items: [], byId: new Map() },
    courses: { items: [], byId: new Map() },
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
}

describe('Training persistence', () => {
  beforeEach(resetDatabase)
  afterEach(resetDatabase)

  it('persists a deterministic full auto-deck once', async () => {
    const loaded = content()
    await seed(loaded)
    const first = await ensurePersistentTrainingDeck(loaded, 'uma-00', 101)
    expect(first.deckCardIds).toEqual(['card-power', 'card-speed', 'card-stamina', 'card-guts'])
    const second = await ensurePersistentTrainingDeck(loaded, 'uma-00', 102)
    expect(second.deckCardIds).toEqual(first.deckCardIds)
    expect((await db.umas.get('uma-00'))?.data.deckCardIds).toEqual(first.deckCardIds)
    expect(await db.outbox.where('[kind+id]').equals(['umas', 'uma-00']).count()).toBe(1)
  })

  it('atomically spends, updates Uma/cards, rewards levels, appends ledgers, and coalesces entities', async () => {
    const loaded = content()
    await seed(loaded)
    const deck = await ensurePersistentTrainingDeck(loaded, 'uma-00', 101)
    for (const id of deck.deckCardIds) {
      const row = await db.cards.get(id)
      await db.cards.put({ ...row!, data: { ...row!.data, exp: 35 } })
    }
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

    const snapshot = await readLocalSnapshot()
    expect(snapshot?.profile.data.tickets).toBe(57)
    expect(snapshot?.umas.find((row) => row.id === 'uma-00')?.data.trainingsThisScenario).toBe(1)
    expect(await db.ledger.get('training:uma-00:1:0')).toMatchObject({
      data: { delta: -1, reason: 'training', localDay: '2000-01-02', createdAt: 200 },
    })
    expect(await db.outbox.count()).toBe(11)
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
    const umaSave = ensureMemoryTrainingDeck(loaded, createUmaSave(template), cardsById)
    const result = resolveMemoryTraining({
      content: loaded,
      profile: {
        schemaVersion: 1,
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
    await runtime.ensureTrainingDeck('uma-00')

    const first = runtime.trainUma('uma-00', 'speed', '2000-01-02', 200)
    const second = runtime.trainUma('uma-00', 'power', '2000-01-02', 201)
    await expect(second).rejects.toThrow(/already resolving/)
    await expect(first).resolves.toMatchObject({ uma: { trainingsThisScenario: 1 } })
    expect(useGame.getState().umas['uma-00']?.trainingsThisScenario).toBe(1)
    expect(useGame.getState().profile?.tickets).toBe(49)
    expect((await db.umas.get('uma-00'))?.data.trainingsThisScenario).toBe(1)
  })
})
