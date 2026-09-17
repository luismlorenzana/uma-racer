import 'fake-indexeddb/auto'

import {
  CARD_EFFECTS,
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
import { setMemoryUmaDeck, setPersistentUmaDeck } from './decks'
import { persistInitial } from './persistence'
import { GameRuntime } from './runtime'
import { clearGameState, useGame } from './store'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const
const profile = Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, effect === 'raceBonus' ? 2 : 0])) as Record<CardEffect, number>

function uma(id: string): UmaTemplate {
  return {
    id, charaId: `uma-character-${id}`, name: `Synthetic ${id}`, outfit: null,
    jpRelease: '2000-01-01', globalRelease: null, starter: true,
    baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
    growthRates: { speed: 0.1, stamina: 0, power: 0.2, guts: 0, wit: 0 },
    aptitudes, uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null,
    signatureRaces: [], imageSource: 'https://example.invalid/synthetic.png',
  }
}

function card(id: string, type: SupportCardTemplate['type'], options: { era?: number; charaId?: string } = {}): SupportCardTemplate {
  return {
    id, charaId: options.charaId ?? `card-character-${id}`, charName: `Synthetic ${id}`, title: 'Practice Notes', type,
    jpRelease: '2000-01-01', era: options.era ?? 1, obtain: 'free', starter: true,
    hintSkillIds: [], eventSkillIds: [], effectProfile: profile, uniqueEffect: null,
    imageSource: 'https://example.invalid/synthetic.png',
  }
}

function atlas(kind: ContentAtlas['kind'], ids: readonly string[]): ContentAtlas {
  return {
    schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128,
    pages: [{ path: `${kind}.webp`, width: Math.max(1, ids.length) * 128, height: 128 }],
    frames: Object.fromEntries(ids.map((id, index) => [id, { page: 0, x: index * 128, y: 0, width: 128 as const, height: 128 as const }])),
  }
}

function content(): LoadedContent {
  const umas = Array.from({ length: 25 }, (_, index) => uma(`uma-${String(index).padStart(2, '0')}`))
  const cards = [
    card('speed', 'speed'), card('power', 'power'), card('stamina', 'stamina'), card('guts', 'guts'), card('wit', 'wit'),
    card('same-character', 'power', { charaId: 'card-character-speed' }),
    card('future', 'speed', { era: 2 }), card('friend', 'friend'),
  ]
  return {
    manifest: { version: 'synthetic-decks', generatedAt: '', source: {}, files: [] }, origin: 'network',
    umas: { items: umas, byId: new Map(umas.map((item) => [item.id, item])) },
    cards: { items: cards, byId: new Map(cards.map((item) => [item.id, item])) },
    skills: { items: [], byId: new Map() }, races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
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

describe('manual support deck persistence', () => {
  beforeEach(resetDatabase)
  afterEach(resetDatabase)

  it('atomically preserves order, coalesces outbox, and makes no-op saves quiet', async () => {
    const loaded = content()
    await db.open()
    await persistInitial(loaded, '2000-01-02', 1)
    await db.outbox.clear()
    const first = await setPersistentUmaDeck(loaded, 'uma-00', ['power', 'speed', 'guts'], 10)
    expect(first).toMatchObject({ changed: true, uma: { deckCardIds: ['power', 'speed', 'guts'] } })
    expect((await db.umas.get('uma-00'))?.data.deckCardIds).toEqual(['power', 'speed', 'guts'])
    expect(await db.outbox.where('[kind+id]').equals(['umas', 'uma-00']).count()).toBe(1)

    const noOp = await setPersistentUmaDeck(loaded, 'uma-00', ['power', 'speed', 'guts'], 11)
    expect(noOp.changed).toBe(false)
    expect(await db.outbox.count()).toBe(1)
    await setPersistentUmaDeck(loaded, 'uma-00', ['speed', 'power'], 12)
    expect((await db.outbox.toArray())[0]).toMatchObject({ kind: 'umas', id: 'uma-00', queuedAt: 12 })
  })

  it('rejects stale or invalid drafts with zero writes', async () => {
    const loaded = content()
    await db.open()
    await persistInitial(loaded, '2000-01-02', 1)
    await db.outbox.clear()
    const before = (await db.umas.get('uma-00'))?.data
    for (const [ids, message] of [
      [[], /at least one/],
      [['speed', 'speed'], /selected twice/],
      [['speed', 'same-character'], /Another card/],
      [['future'], /tier 2/],
      [['friend'], /Friend\/Group/],
      [['missing'], /not owned/],
      [['speed', 'power', 'stamina', 'guts', 'wit'], /only 4/],
    ] as const) {
      await expect(setPersistentUmaDeck(loaded, 'uma-00', ids, 20)).rejects.toThrow(message)
      expect((await db.umas.get('uma-00'))?.data).toEqual(before)
      expect(await db.outbox.count()).toBe(0)
    }
  })

  it('uses identical validation in memory-only mode', () => {
    const loaded = content()
    const template = loaded.umas.items[0]!
    const cards = Object.fromEntries(loaded.cards.items.map((item) => [item.id, createCardSave(item)]))
    const mutation = setMemoryUmaDeck(loaded, createUmaSave(template), cards, ['power', 'speed'])
    expect(mutation).toMatchObject({ changed: true, uma: { deckCardIds: ['power', 'speed'] } })
    expect(() => setMemoryUmaDeck(loaded, mutation.uma, cards, ['friend'])).toThrow(/Friend\/Group/)
  })
})

describe('manual support deck runtime', () => {
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

  it('locks concurrent same-Uma saves and publishes only committed state', async () => {
    const loaded = content()
    vi.spyOn(saveApi, 'load').mockRejectedValue(new Error('synthetic offline'))
    await runtime.start(loaded)
    const first = runtime.setUmaDeck('uma-00', ['power', 'speed'], 30)
    const second = runtime.setUmaDeck('uma-00', ['speed', 'guts'], 31)
    await expect(second).rejects.toThrow(/already being saved/)
    await expect(first).resolves.toBeUndefined()
    expect(useGame.getState().umas['uma-00']?.deckCardIds).toEqual(['power', 'speed'])
    expect((await db.umas.get('uma-00'))?.data.deckCardIds).toEqual(['power', 'speed'])
  })
})
