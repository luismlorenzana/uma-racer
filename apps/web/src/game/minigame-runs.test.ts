import 'fake-indexeddb/auto'

import {
  CARD_EFFECTS,
  activeScenario,
  addTrainingExp,
  constellationTemplate,
  createCardSave,
  createPlayerProfile,
  createUmaSave,
  isNodeUnlocked,
  nodesUnlockedBetween,
  type CardEffect,
  type CardSave,
  type ContentAtlas,
  type SupportCardTemplate,
  type UmaSave,
  type UmaTemplate,
} from '@racer/domain'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { minigameNodeLabel, minigameAttemptSeed, PersistentMinigameHost, PersistentMinigameJournal, retireBondRecallRuns } from './minigame-runs'
import { sparkRivalStateHash } from './minigames/spark-rival'

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
  sparkRivals: null,
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

const lineageTemplates = Array.from({ length: 3 }, (_, index): UmaTemplate => ({
  ...umaTemplate,
  id: `lineage-${index + 1}`,
  charaId: `lineage-character-${index + 1}`,
  name: `Synthetic Lineage ${index + 1}`,
  aptitudes: { ...aptitudes, strategy: { front: 'A', pace: 'C', late: 'C', end: 'C' } },
}))
const lineageContent: LoadedContent = {
  ...content,
  umas: {
    items: [umaTemplate, ...lineageTemplates],
    byId: new Map([umaTemplate, ...lineageTemplates].map((entry) => [entry.id, entry])),
  },
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

async function finishSpark(ticket: { runId: string }) {
  const journal = new PersistentMinigameJournal(content)
  let view = await journal.loadSpark(ticket.runId)
  while (!view.replay.outcome) {
    view = await journal.appendSpark(ticket.runId, view.actions.length, {
      type: 'drag', path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], movementMs: 250,
    })
  }
  return view
}

describe('persistent minigame host', () => {
  beforeEach(resetDatabase)
  afterEach(resetDatabase)

  it('rejects every invalid reservation without writing anything', async () => {
    await seed({ tickets: 0, future: true })
    const current = host()
    const assertNoWrites = async () => {
      expect((await db.profile.get('main'))?.data.tickets).toBe(0)
      expect(await db.ledger.count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
      expect(await db.minigameRuns.count()).toBe(0)
    }
    await expect(current.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })).rejects.toThrow(/need 1/i)
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
    await db.umas.put({
      ...umaRow,
      data: { ...umaRow.data, scenarios: umaRow.data.scenarios.map((scenario) => ({ ...scenario, trainingLevel: 10, trainingExp: 0 })) },
    })
    await expect(current.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })).rejects.toThrow(/already at Training Level 10/i)
    await assertNoWrites()
    await db.umas.put(umaRow)
    await expect(current.beginRun('friendship-training', { kind: 'friendship-training', cardId: futureCard.id, tier: 1 })).rejects.toThrow(/not available/i)
    await assertNoWrites()
    const saved = (await db.cards.get(card.id))!
    await db.cards.put({ ...saved, data: { ...saved.data, stars: { '1': 5 } } })
    await expect(current.beginRun('friendship-training', { kind: 'friendship-training', cardId: card.id, tier: 1 })).rejects.toThrow(/already has 5★/i)
    await assertNoWrites()
  })

  it('reuses one open reservation, charges once, and derives deterministic attempts', async () => {
    const profile = await seed()
    const current = host()
    const target = { kind: 'spark-match' as const, umaId: umaTemplate.id }
    const first = await current.beginRun('spark-match', target)
    const second = await current.beginRun('spark-match', target)
    expect(second).toEqual(first)
    expect((await db.profile.get('main'))?.data.tickets).toBe(99)
    expect(await db.ledger.count()).toBe(1)
    expect(await db.minigameRuns.count()).toBe(1)
    expect(first.seed).toBe(minigameAttemptSeed(profile.createdAt, content.manifest.version, target, 1, 0))
    expect(minigameAttemptSeed(profile.createdAt, content.manifest.version, target, 1, 1)).not.toBe(first.seed)
    const row = (await db.minigameRuns.get(first.runId))!
    expect(row.journal).toEqual({ format: 1, engine: 'spark-rival-v1', actions: [] })
    expect(row.sparkSnapshot).toMatchObject({ version: 1, contentVersion: content.manifest.version, source: 'fallback' })
    expect(row.sparkSnapshot?.encounter.trainee.strategyAptitudes).toEqual(aptitudes.strategy)
  })

  it('lazily adopts a legacy open Spark row without changing identity or charging twice', async () => {
    const profile = await seed()
    const target = { kind: 'spark-match' as const, umaId: umaTemplate.id }
    const id = 'spark-match:uma-synthetic:1:0'
    const seedValue = minigameAttemptSeed(profile.createdAt, content.manifest.version, target, 1, 0)
    await db.ledger.add({ id, data: { resource: 'tickets', delta: -1, reason: 'training', localDay: '2000-01-01', createdAt: 100 }, createdAt: 100 })
    await db.minigameRuns.add({ id, targetKey: 'spark-match:uma-synthetic:1', kind: 'spark-match', target,
      tier: 1, attemptIndex: 0, seed: seedValue, status: 'open', outcome: null, reward: null, createdAt: 100, completedAt: null })
    const before = (await db.minigameRuns.get(id))!
    const restored = await new PersistentMinigameJournal(content).loadSpark(id)
    const after = (await db.minigameRuns.get(id))!
    expect(restored.ticket).toEqual({ runId: id, seed: seedValue, attemptIndex: 0 })
    expect(after).toMatchObject(before)
    expect(after.createdAt).toBe(100)
    expect(after.journal).toEqual({ format: 1, engine: 'spark-rival-v1', actions: [] })
    expect(await db.ledger.count()).toBe(1)
    expect((await db.profile.get('main'))?.data.tickets).toBe(100)
  })

  it('preserves completed v10 minigame rows byte-for-byte through the additive v11 migration', async () => {
    db.close()
    await db.delete()
    const legacy = new Dexie('uma-racer')
    legacy.version(10).stores({
      profile: 'id',
      umas: 'id',
      cards: 'id',
      badges: 'id',
      raceResults: 'id, createdAt',
      ledger: 'id, createdAt',
      flairEvents: 'id, createdAt',
      outbox: '++seq, [kind+id]',
      albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
    })
    await legacy.open()
    const completed = {
      id: 'spark-match:uma-synthetic:1:0',
      targetKey: 'spark-match:uma-synthetic:1',
      kind: 'spark-match',
      target: { kind: 'spark-match', umaId: umaTemplate.id },
      tier: 1,
      attemptIndex: 0,
      seed: 'legacy-seed',
      status: 'completed',
      outcome: { kind: 'spark-match', score: 425, moves: 8 },
      reward: {
        kind: 'spark-match', ticketsSpent: 1, trainingLevelBefore: 1,
        trainingLevelAfter: 1, nodesUnlocked: [],
      },
      createdAt: 100,
      completedAt: 200,
    }
    await legacy.table('minigameRuns').put(completed)
    legacy.close()

    await db.open()
    expect(await db.minigameRuns.get(completed.id)).toEqual(completed)
  })

  it('freezes active derived constellation aptitudes rather than template aptitudes', async () => {
    const template = constellationTemplate(1)
    const lineageNodes = template.nodes.filter((node) =>
      (node.kind === 'parent' || node.kind === 'grandparent') && isNodeUnlocked(template, node, 9))
    const configured = startedUma()
    await seed({ uma: {
      ...configured,
      scenarios: configured.scenarios.map((scenario) => ({
        ...scenario,
        trainingLevel: 9,
        assignments: Object.fromEntries(lineageNodes.slice(0, 3).map((node, index) => [
          node.id, { kind: 'lineage' as const, templateId: lineageTemplates[index]!.id },
        ])),
      })),
    } })
    const ticket = await new PersistentMinigameHost(lineageContent).beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })
    const snapshot = (await db.minigameRuns.get(ticket.runId))!.sparkSnapshot!
    expect(umaTemplate.aptitudes.strategy.front).toBe('D')
    expect(snapshot.encounter.trainee.strategyAptitudes.front).toBe('B')
  })

  it('restores the identical open replay through a new host and journal instance', async () => {
    await seed()
    const target = { kind: 'spark-match' as const, umaId: umaTemplate.id }
    const beforeReload = await host().beginRun('spark-match', target)
    const afterReload = await host(3000).beginRun('spark-match', target)
    expect(afterReload).toEqual(beforeReload)
    const firstView = await new PersistentMinigameJournal(content).loadSpark(beforeReload.runId)
    const secondView = await new PersistentMinigameJournal(content).loadSpark(afterReload.runId)
    expect(JSON.parse(JSON.stringify(secondView))).toEqual(JSON.parse(JSON.stringify(firstView)))
    expect((await db.profile.get('main'))?.data.tickets).toBe(99)
  })

  it('applies engine-derived Spark EXP once and reports real structured opened nodes', async () => {
    await seed()
    const current = host()
    const ticket = await current.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })
    const terminal = await finishSpark(ticket)
    const outcome = {
      kind: 'spark-match' as const,
      engine: 'spark-rival-v1' as const,
      actionCount: terminal.actions.length,
      stateHash: sparkRivalStateHash(terminal.replay.state),
    }
    const first = await current.commitRun(ticket.runId, outcome)
    const second = await current.commitRun(ticket.runId, outcome)
    const gain = addTrainingExp(1, 0, terminal.replay.outcome!.trainingExp)
    const expectedNodes = nodesUnlockedBetween(constellationTemplate(1), 1, gain.trainingLevel)
      .map((node) => ({ id: node.id, label: minigameNodeLabel(node) }))
    expect(first).toMatchObject({ ticketsSpent: 1, trainingExpEarned: terminal.replay.outcome!.trainingExp,
      trainingExpBefore: 0, trainingExpAfter: gain.trainingExp, trainingLevelBefore: 1,
      trainingLevelAfter: gain.trainingLevel, nodesUnlocked: expectedNodes })
    expect(second).toEqual(first)
    expect(activeScenario((await db.umas.get(umaTemplate.id))!.data)).toMatchObject({ trainingLevel: gain.trainingLevel, trainingExp: gain.trainingExp })
    expect((await db.profile.get('main'))?.data.tickets).toBe(99)
    expect(await db.ledger.count()).toBe(1)
    expect((await db.minigameRuns.get(ticket.runId))?.status).toBe('completed')
  })

  it('keeps journal and save unchanged for stale, nonterminal, and invalid-scenario commits', async () => {
    await seed()
    const current = host()
    const ticket = await current.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })
    await expect(current.commitRun(ticket.runId, {
      kind: 'spark-match', engine: 'spark-rival-v1', actionCount: 0, stateHash: '00000000',
    })).rejects.toThrow(/not finished/)
    const terminal = await finishSpark(ticket)
    const beforeUma = (await db.umas.get(umaTemplate.id))!.data
    await expect(current.commitRun(ticket.runId, {
      kind: 'spark-match', engine: 'spark-rival-v1', actionCount: terminal.actions.length, stateHash: '00000000',
    })).rejects.toThrow(/stale/)
    expect((await db.umas.get(umaTemplate.id))!.data).toEqual(beforeUma)
    const row = (await db.umas.get(umaTemplate.id))!
    await db.umas.put({ ...row, data: { ...row.data, scenarios: row.data.scenarios.map((scenario) => ({ ...scenario, started: false })) } })
    await expect(current.commitRun(ticket.runId, {
      kind: 'spark-match', engine: 'spark-rival-v1', actionCount: terminal.actions.length,
      stateHash: sparkRivalStateHash(terminal.replay.state),
    })).rejects.toThrow(/no longer active/)
    expect((await db.minigameRuns.get(ticket.runId))?.status).toBe('open')
  })

  it('rolls back stale and invalid journal appends byte-for-byte and rejects terminal appends', async () => {
    await seed()
    const ticket = await host().beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })
    const journal = new PersistentMinigameJournal(content)
    const action = { type: 'drag' as const, path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], movementMs: 250 }
    await journal.appendSpark(ticket.runId, 0, action)
    const before = JSON.stringify(await db.minigameRuns.get(ticket.runId))
    await expect(journal.appendSpark(ticket.runId, 0, action)).rejects.toThrow(/action count changed/)
    await expect(journal.appendSpark(ticket.runId, 1, { type: 'drag', path: [], movementMs: 0 } as never)).rejects.toThrow(/invalid/)
    expect(JSON.stringify(await db.minigameRuns.get(ticket.runId))).toBe(before)
    const terminal = await finishSpark(ticket)
    await expect(journal.appendSpark(ticket.runId, terminal.actions.length, action)).rejects.toThrow(/already terminal/)
  })

  it('retires an open Bond Recall run once, giving its ticket back (D177)', async () => {
    await seed()
    const id = 'bond-recall:card-synthetic:1:0'
    await db.ledger.add({ id, data: { resource: 'tickets', delta: -1, reason: 'card-limit-break', localDay: '2000-01-01', createdAt: 1 }, createdAt: 1 })
    await db.minigameRuns.add({
      id, targetKey: 'bond-recall:card-synthetic:1', kind: 'bond-recall', target: { kind: 'bond-recall', cardId: card.id, tier: 1 },
      tier: 1, attemptIndex: 0, seed: '1', status: 'open', outcome: null, reward: null, createdAt: 1, completedAt: null,
    })
    expect(await retireBondRecallRuns(2000, '2000-01-02')).toBe(1)
    expect((await db.profile.get('main'))?.data.tickets).toBe(101)
    expect((await db.ledger.get(`${id}:refund`))?.data).toMatchObject({ resource: 'tickets', delta: 1, reason: 'minigame-refund' })
    expect((await db.minigameRuns.get(id))?.status).toBe('completed')
    expect(await retireBondRecallRuns(3000, '2000-01-03')).toBe(0)
    expect((await db.profile.get('main'))?.data.tickets).toBe(101)
  })

  it('never begins a Bond Recall run again', async () => {
    await seed()
    const retired = host() as unknown as { beginRun: (kind: string, target: unknown) => Promise<unknown> }
    await expect(retired.beginRun('bond-recall', { kind: 'bond-recall', cardId: card.id, tier: 1 })).rejects.toThrow(/retired/i)
  })
})
