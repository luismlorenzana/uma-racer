import 'fake-indexeddb/auto'

import {
  CARD_EFFECTS,
  activeScenario,
  constellationTemplate,
  createCardSave,
  createPlayerProfile,
  createUmaSave,
  nodesUnlockedBetween,
  type CardEffect,
  type CardSave,
  type ContentAtlas,
  type SupportCardTemplate,
  type UmaSave,
  type UmaTemplate,
} from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { minigameNodeLabel, minigameAttemptSeed, PersistentMinigameHost } from './minigame-runs'
import { startSparkRun } from './minigames/spark-match'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const
const effects = Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 0])) as Record<CardEffect, number>

const umaTemplate: UmaTemplate = {
  id: 'uma-synthetic',
  charaId: 'character-synthetic',
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
  imageSource: 'https://example.invalid/uma.png',
}

function cardTemplate(id: string, era: number): SupportCardTemplate {
  return {
    id,
    charaId: `character-${id}`,
    charName: `Synthetic ${id}`,
    title: 'Practice Notes',
    type: 'speed',
    jpRelease: '2000-01-01',
    era,
    obtain: 'free',
    starter: true,
    hintSkillIds: [],
    eventSkillIds: [],
    effectProfile: effects,
    uniqueEffect: null,
    imageSource: 'https://example.invalid/card.png',
  }
}

const card = cardTemplate('card-synthetic', 1)
const futureCard = cardTemplate('card-future', 2)

function atlas(kind: ContentAtlas['kind']): ContentAtlas {
  return { schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, pages: [], frames: {} }
}

const content: LoadedContent = {
  manifest: { version: 'synthetic-minigames', generatedAt: '', source: {}, files: [] },
  origin: 'network',
  umas: { items: [umaTemplate], byId: new Map([[umaTemplate.id, umaTemplate]]) },
  cards: { items: [card, futureCard], byId: new Map([[card.id, card], [futureCard.id, futureCard]]) },
  skills: { items: [], byId: new Map() },
  races: { items: [], byId: new Map() },
  courses: { items: [], byId: new Map() },
  atlases: {
    'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: [] },
    'card-icons': { descriptor: atlas('card-icons'), pageUrls: [] },
  },
  art: { has: () => false, load: async () => null },
}

const startedUma = (): UmaSave => {
  const created = createUmaSave(umaTemplate)
  return {
    ...created,
    scenarios: created.scenarios.map((scenario) => ({ ...scenario, started: true })),
  }
}

async function resetDatabase(): Promise<void> {
  db.close()
  await db.delete()
}

async function seed(options: { tickets?: number; uma?: UmaSave; card?: CardSave; future?: boolean } = {}) {
  await db.open()
  const profile = { ...createPlayerProfile('synthetic-minigames', 1234), tickets: options.tickets ?? 100 }
  await db.profile.put({ id: 'main', data: profile, version: 2 })
  await db.umas.put({ id: umaTemplate.id, data: options.uma ?? startedUma(), version: 3 })
  await db.cards.put({ id: card.id, data: options.card ?? createCardSave(card), version: 4 })
  if (options.future) await db.cards.put({ id: futureCard.id, data: createCardSave(futureCard), version: 0 })
  return profile
}

const host = (now = 2000) => new PersistentMinigameHost(content, {
  now: () => now,
  today: () => '2000-01-02',
})

describe('persistent minigame host', () => {
  beforeEach(resetDatabase)
  afterEach(resetDatabase)

  it('rejects every invalid reservation without writing anything', async () => {
    await seed({ tickets: 4, future: true })
    const current = host()
    const assertNoWrites = async () => {
      expect((await db.profile.get('main'))?.data.tickets).toBe(4)
      expect(await db.ledger.count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
      expect(await db.minigameRuns.count()).toBe(0)
    }
    await expect(current.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })).rejects.toThrow(/need 5/i)
    await assertNoWrites()
    await expect(current.beginRun('spark-match', { kind: 'spark-match', umaId: 'uma-unowned' })).rejects.toThrow(/not owned/i)
    await assertNoWrites()
    const umaRow = (await db.umas.get(umaTemplate.id))!
    await db.umas.put({
      ...umaRow,
      data: { ...umaRow.data, scenarios: umaRow.data.scenarios.map((scenario) => ({ ...scenario, started: false })) },
    })
    await expect(current.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })).rejects.toThrow(/start this scenario/i)
    await assertNoWrites()
    await db.umas.put(umaRow)
    await expect(current.beginRun('bond-recall', { kind: 'bond-recall', cardId: futureCard.id, tier: 1 })).rejects.toThrow(/not available/i)
    await assertNoWrites()
    const saved = (await db.cards.get(card.id))!
    await db.cards.put({ ...saved, data: { ...saved.data, limitBreaks: { '1': 4 } } })
    await expect(current.beginRun('bond-recall', { kind: 'bond-recall', cardId: card.id, tier: 1 })).rejects.toThrow(/maximum/i)
    await assertNoWrites()
  })

  it('reuses one open reservation, charges once, and derives deterministic attempts', async () => {
    const profile = await seed()
    const current = host()
    const target = { kind: 'spark-match' as const, umaId: umaTemplate.id }
    const first = await current.beginRun('spark-match', target)
    const second = await current.beginRun('spark-match', target)
    expect(second).toEqual(first)
    expect((await db.profile.get('main'))?.data.tickets).toBe(95)
    expect(await db.ledger.count()).toBe(1)
    expect(await db.minigameRuns.count()).toBe(1)
    expect(first.seed).toBe(minigameAttemptSeed(profile.createdAt, content.manifest.version, target, 1, 0))
    expect(minigameAttemptSeed(profile.createdAt, content.manifest.version, target, 1, 1)).not.toBe(first.seed)
  })

  it('restores the identical open board through a new host instance', async () => {
    await seed()
    const target = { kind: 'spark-match' as const, umaId: umaTemplate.id }
    const beforeReload = await host().beginRun('spark-match', target)
    const afterReload = await host(3000).beginRun('spark-match', target)
    expect(afterReload).toEqual(beforeReload)
    expect(startSparkRun(afterReload.seed).board).toEqual(startSparkRun(beforeReload.seed).board)
    expect((await db.profile.get('main'))?.data.tickets).toBe(95)
  })

  it('applies a two-level Spark result once and reports the exact opened nodes', async () => {
    await seed()
    const current = host()
    const ticket = await current.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })
    const outcome = { kind: 'spark-match' as const, score: 2400, moves: 25 }
    const first = await current.commitRun(ticket.runId, outcome)
    const second = await current.commitRun(ticket.runId, outcome)
    const expectedNodes = nodesUnlockedBetween(constellationTemplate(1), 1, 3).map(minigameNodeLabel)
    expect(first).toEqual({
      ticketsSpent: 5,
      trainingLevelBefore: 1,
      trainingLevelAfter: 3,
      nodesUnlocked: expectedNodes,
    })
    expect(second).toEqual(first)
    expect(activeScenario((await db.umas.get(umaTemplate.id))!.data)).toMatchObject({ trainingLevel: 3, trainingExp: 50 })
    expect((await db.profile.get('main'))?.data.tickets).toBe(95)
    expect(await db.ledger.count()).toBe(1)
    expect((await db.minigameRuns.get(ticket.runId))?.status).toBe('completed')
  })

  it('advances only the named Bond tier and grants each reward once', async () => {
    await seed({ card: { ...createCardSave(card), limitBreaks: { '1': 2 } } })
    const current = host()
    const ticket = await current.beginRun('bond-recall', { kind: 'bond-recall', cardId: card.id, tier: 2 })
    const first = await current.commitRun(ticket.runId, { kind: 'bond-recall', cleared: true, mismatches: 1 })
    const second = await current.commitRun(ticket.runId, { kind: 'bond-recall', cleared: true, mismatches: 1 })
    expect(first).toEqual({ ticketsSpent: 10, limitBreakBefore: 0, limitBreakAfter: 1, couponGranted: false })
    expect(second).toEqual(first)
    expect((await db.cards.get(card.id))?.data.limitBreaks).toEqual({ '1': 2, '2': 1 })
    expect((await db.profile.get('main'))?.data).toMatchObject({ tickets: 95, cardCoupons: 3 })
    expect(await db.ledger.count()).toBe(2)
  })

  it('closes a lost Bond run without progression and increments the next attempt', async () => {
    await seed()
    const current = host()
    const target = { kind: 'bond-recall' as const, cardId: card.id, tier: 1 }
    const first = await current.beginRun('bond-recall', target)
    expect(await current.commitRun(first.runId, { kind: 'bond-recall', cleared: false, mismatches: 4 })).toEqual({
      ticketsSpent: 10,
      limitBreakBefore: 0,
      limitBreakAfter: 0,
      couponGranted: false,
    })
    const next = await current.beginRun('bond-recall', target)
    expect(next.attemptIndex).toBe(1)
    expect((await db.cards.get(card.id))?.data.limitBreaks).toEqual({})
    expect((await db.profile.get('main'))?.data.tickets).toBe(80)
    expect(await db.ledger.count()).toBe(2)
  })

  it('grants the LB4 coupon only once across scenarios', async () => {
    await seed({ card: { ...createCardSave(card), limitBreaks: { '1': 3, '2': 3 } } })
    const current = host()
    const first = await current.beginRun('bond-recall', { kind: 'bond-recall', cardId: card.id, tier: 1 })
    expect(await current.commitRun(first.runId, { kind: 'bond-recall', cleared: true, mismatches: 0 })).toMatchObject({
      limitBreakAfter: 4,
      couponGranted: true,
    })
    const second = await current.beginRun('bond-recall', { kind: 'bond-recall', cardId: card.id, tier: 2 })
    expect(await current.commitRun(second.runId, { kind: 'bond-recall', cleared: true, mismatches: 0 })).toMatchObject({
      limitBreakAfter: 4,
      couponGranted: false,
    })
    expect((await db.cards.get(card.id))?.data).toMatchObject({ limitBreaks: { '1': 4, '2': 4 }, maxCouponGranted: true })
    expect((await db.profile.get('main'))?.data).toMatchObject({ tickets: 90, cardCoupons: 4 })
    expect((await db.ledger.toArray()).filter((row) => row.data.reason === 'card-max')).toHaveLength(1)
  })
})
