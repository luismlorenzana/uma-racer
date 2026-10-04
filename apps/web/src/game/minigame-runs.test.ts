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
  reduceSparkRival,
  TRAINING_EXP_PER_LEVEL,
  TRAINING_LEVEL_UP_TICKET_ID,
  type CardEffect,
  type CardSave,
  type ContentAtlas,
  type SparkCell,
  type SupportCardTemplate,
  type UmaSave,
  type UmaTemplate,
  createScenarioTraining,
  withScenarioView,
} from '@racer/domain'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import {
  minigameNodeLabel,
  minigameAttemptSeed,
  parseSparkRunSnapshot,
  PersistentMinigameHost,
  PersistentMinigameJournal,
  retireBondRecallRuns,
  retireFiveStarFriendshipRuns,
} from './minigame-runs'
import { FT_SETUP_VERSION, sparkRivalStateHash } from '@racer/domain'

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

async function seed(options: { tickets?: number; bank?: number; uma?: UmaSave; card?: CardSave; future?: boolean } = {}) {
  await db.open()
  const profile = { ...createPlayerProfile('synthetic-minigames', 1234), tickets: options.tickets ?? 100, trainingExpBank: options.bank ?? 0 }
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
  const loaded = await journal.load(ticket.runId)
  if (loaded.engine !== 'spark-rival-v1') throw new Error('Expected a Spark Rival fixture')
  let view = loaded
  while (!view.replay.outcome) {
    const next = await journal.append(ticket.runId, view.actions.length, {
      type: 'drag', path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], movementMs: 250,
    })
    if (next.engine !== 'spark-rival-v1') throw new Error('Expected a Spark Rival fixture')
    view = next
  }
  return view
}

/** Plays a run greedily with the engine's own reducer, so it deals damage and earns real Training EXP. */
async function playSparkForExp(ticket: { runId: string }) {
  const journal = new PersistentMinigameJournal(content)
  const loaded = await journal.load(ticket.runId)
  if (loaded.engine !== 'spark-rival-v1') throw new Error('Expected a Spark Rival fixture')
  let view: Extract<typeof loaded, { engine: 'spark-rival-v1' }> = loaded
  const paths: SparkCell[][] = []
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      if (column < 5) paths.push([{ row, column }, { row, column: column + 1 }])
      if (row < 4) paths.push([{ row, column }, { row: row + 1, column }])
    }
  }
  while (!view.replay.outcome) {
    const state = view.replay.state
    const encounter = view.snapshot.encounter
    const damage = (path: SparkCell[]) => {
      const next = reduceSparkRival(encounter, state, { type: 'drag', path, movementMs: 250 }).state
      return next.waveIndex > state.waveIndex ? state.rival.resolve + 1 : state.rival.resolve - next.rival.resolve
    }
    const best = paths.reduce((left, right) => damage(right) > damage(left) ? right : left)
    const next = await journal.append(ticket.runId, view.actions.length, { type: 'drag', path: best, movementMs: 250 })
    if (next.engine !== 'spark-rival-v1') throw new Error('Expected a Spark Rival fixture')
    view = next
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
    await db.cards.put({ ...saved, data: { ...saved.data, stars: 3 } })
    await expect(current.beginRun('friendship-training', { kind: 'friendship-training', cardId: card.id, tier: 1 })).rejects.toThrow(/already has 3★/i)
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
    const snapshot = parseSparkRunSnapshot(row.snapshot)!
    expect(snapshot).toMatchObject({ version: 1, contentVersion: content.manifest.version, source: 'fallback' })
    expect(snapshot.encounter.trainee.strategyAptitudes).toEqual(aptitudes.strategy)
  })

  it('begins after the attempts a synced ledger remembers when this device has no run rows', async () => {
    const profile = await seed()
    const target = { kind: 'spark-match' as const, umaId: umaTemplate.id }
    // A reinstall: the cloud save brings back two attempts' ticket rows, but not their device-local run rows.
    for (const index of [0, 1]) {
      await db.ledger.add({ id: `spark-match:uma-synthetic:1:${index}`, createdAt: 100,
        data: { resource: 'tickets', delta: -1, reason: 'training', localDay: '2000-01-01', createdAt: 100 } })
    }
    const ticket = await host().beginRun('spark-match', target)
    expect(ticket).toEqual({
      runId: 'spark-match:uma-synthetic:1:2',
      seed: minigameAttemptSeed(profile.createdAt, content.manifest.version, target, 1, 2),
      attemptIndex: 2,
    })
    expect((await db.profile.get('main'))?.data.tickets).toBe(99)
    expect(await db.ledger.count()).toBe(3)
    expect(await db.minigameRuns.count()).toBe(1)
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
    const restored = await new PersistentMinigameJournal(content).load(id)
    const after = (await db.minigameRuns.get(id))!
    expect(restored.ticket).toEqual({ runId: id, seed: seedValue, attemptIndex: 0 })
    expect(after).toMatchObject(before)
    expect(after.createdAt).toBe(100)
    expect(after.journal).toEqual({ format: 1, engine: 'spark-rival-v1', actions: [] })
    expect(await db.ledger.count()).toBe(1)
    expect((await db.profile.get('main'))?.data.tickets).toBe(100)
  })

  it('moves an open v11 Spark snapshot onto the shared snapshot field', async () => {
    await seed()
    const ticket = await host().beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })
    const current = (await db.minigameRuns.get(ticket.runId))!
    const snapshot = current.snapshot!

    await resetDatabase()
    const legacy = new Dexie('uma-racer')
    legacy.version(11).stores({
      profile: 'id', umas: 'id', cards: 'id', badges: 'id', raceResults: 'id, createdAt', ledger: 'id, createdAt',
      flairEvents: 'id, createdAt', outbox: '++seq, [kind+id]', albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
    })
    await legacy.open()
    const { snapshot: _snapshot, ...legacyRow } = current
    await legacy.table('minigameRuns').put({ ...legacyRow, sparkSnapshot: snapshot })
    legacy.close()

    await db.open()
    const migrated = (await db.minigameRuns.get(ticket.runId))!
    expect(migrated.snapshot).toEqual(snapshot)
    expect('sparkSnapshot' in migrated).toBe(false)
    const restored = await new PersistentMinigameJournal(content).load(ticket.runId)
    expect(restored.engine).toBe('spark-rival-v1')
  })

  it('preserves completed minigame rows byte-for-byte through the journal migrations', async () => {
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
      (node.kind === 'parent' || node.kind === 'grandparent') && node.id.startsWith('parent0'))
    const configured = startedUma()
    await seed({ uma: withScenarioView(configured, {
      ...activeScenario(configured),
      trainingLevel: 9,
      inspiration: { slots: ['parent0', 'parent0-gp0', 'parent0-gp1'], golds: [] },
      assignments: Object.fromEntries(lineageNodes.slice(0, 3).map((node, index) => [
        node.id, { kind: 'lineage' as const, templateId: lineageTemplates[index]!.id },
      ])),
    }) })
    const ticket = await new PersistentMinigameHost(lineageContent).beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })
    const snapshot = parseSparkRunSnapshot((await db.minigameRuns.get(ticket.runId))!.snapshot)!
    expect(umaTemplate.aptitudes.strategy.front).toBe('D')
    expect(snapshot.encounter.trainee.strategyAptitudes.front).toBe('B')
  })

  it('restores the identical open replay through a new host and journal instance', async () => {
    await seed()
    const target = { kind: 'spark-match' as const, umaId: umaTemplate.id }
    const beforeReload = await host().beginRun('spark-match', target)
    const afterReload = await host(3000).beginRun('spark-match', target)
    expect(afterReload).toEqual(beforeReload)
    const firstView = await new PersistentMinigameJournal(content).load(beforeReload.runId)
    const secondView = await new PersistentMinigameJournal(content).load(afterReload.runId)
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

  it('banks a TL10 run\'s surplus and pays a Level-Up Ticket for a full level, once (D212)', async () => {
    await seed({ bank: 1249 })
    const current = host()
    const base = startedUma()
    await db.umas.put({ id: umaTemplate.id, data: { ...base, scenarios: [{ ...base.scenarios[0]!, trainingLevel: 9, trainingExp: 1249 }] }, version: 3 })
    const ticket = await current.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })
    const terminal = await playSparkForExp(ticket)
    const earned = terminal.replay.outcome!.trainingExp
    expect(earned).toBeGreaterThan(1)
    const outcome = {
      kind: 'spark-match' as const, engine: 'spark-rival-v1' as const,
      actionCount: terminal.actions.length, stateHash: sparkRivalStateHash(terminal.replay.state),
    }
    const reward = await current.commitRun(ticket.runId, outcome)
    // 1 EXP finishes TL9; the rest is past TL10. With 1,249 already banked, the first of it completes a ticket.
    const overflow = earned - 1
    const tickets = Math.floor((1249 + overflow) / TRAINING_EXP_PER_LEVEL)
    expect(reward).toMatchObject({ trainingLevelAfter: 10, trainingExpAfter: 0, trainingExpBanked: overflow, levelUpTicketsGranted: tickets })
    expect((await db.profile.get('main'))?.data.trainingExpBank).toBe((1249 + overflow) % TRAINING_EXP_PER_LEVEL)
    expect((await db.items.get(TRAINING_LEVEL_UP_TICKET_ID))?.data).toEqual({ itemId: TRAINING_LEVEL_UP_TICKET_ID, quantity: tickets, updatedAt: 2000 })
    expect((await db.itemLedger.get(`exp-bank:${ticket.runId}`))?.data).toMatchObject({
      delta: tickets, reason: 'exp-bank', source: { kind: 'spark-run', runId: ticket.runId },
    })
    expect(await db.outbox.where('kind').anyOf('profile', 'items', 'itemLedger').count()).toBe(3)
    // A retried commit is the stored reward: nothing more is banked or granted.
    expect(await current.commitRun(ticket.runId, outcome)).toEqual(reward)
    expect((await db.items.get(TRAINING_LEVEL_UP_TICKET_ID))?.data.quantity).toBe(tickets)
    expect(await db.itemLedger.count()).toBe(1)
  })

  it('trains one of her earlier scenarios toward TL10 without touching her current one (D190)', async () => {
    const base = startedUma()
    const first = { ...base.scenarios[0]!, trainingLevel: 3 }
    const current = createScenarioTraining(2)
    await seed({ uma: { ...base, level: 15, unlockedTier: 2, scenarios: [first, current] } })
    const reserved = host()
    await expect(reserved.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })).rejects.toThrow(/Start this scenario/)
    await expect(reserved.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id, tier: 3 })).rejects.toThrow(/not unlocked/)
    const ticket = await reserved.beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id, tier: 1 })
    expect(ticket.runId).toBe('spark-match:uma-synthetic:1:0')
    const terminal = await finishSpark(ticket)
    const reward = await reserved.commitRun(ticket.runId, {
      kind: 'spark-match', engine: 'spark-rival-v1', actionCount: terminal.actions.length, stateHash: sparkRivalStateHash(terminal.replay.state),
    })
    const gain = addTrainingExp(3, 0, terminal.replay.outcome!.trainingExp)
    expect(reward).toMatchObject({ trainingLevelBefore: 3, trainingLevelAfter: gain.trainingLevel })
    const saved = (await db.umas.get(umaTemplate.id))!.data as UmaSave
    expect(saved.scenarios.map((run) => [run.tier, run.trainingLevel, run.trainingExp])).toEqual([[1, gain.trainingLevel, gain.trainingExp], [2, 1, 0]])
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
    await journal.append(ticket.runId, 0, action)
    const before = JSON.stringify(await db.minigameRuns.get(ticket.runId))
    await expect(journal.append(ticket.runId, 0, action)).rejects.toThrow(/action count changed/)
    await expect(journal.append(ticket.runId, 1, { type: 'drag', path: [], movementMs: 0 } as never)).rejects.toThrow(/invalid/)
    expect(JSON.stringify(await db.minigameRuns.get(ticket.runId))).toBe(before)
    const terminal = await finishSpark(ticket)
    await expect(journal.append(ticket.runId, terminal.actions.length, action)).rejects.toThrow(/already terminal/)
  })

  it('keeps an unknown engine row and reports that it needs a compatible app', async () => {
    await seed()
    const ticket = await host().beginRun('spark-match', { kind: 'spark-match', umaId: umaTemplate.id })
    const row = (await db.minigameRuns.get(ticket.runId))!
    const unknown = { ...row, journal: { format: 1, engine: 'synthetic-future-v2', actions: [] } }
    await db.table('minigameRuns').put(unknown)
    await expect(new PersistentMinigameJournal(content).load(ticket.runId)).rejects.toThrow(/not supported.*update the app/i)
    expect(await db.table('minigameRuns').get(ticket.runId)).toEqual(unknown)
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

  it('closes a card run frozen for five stars once, giving its ticket back, and keeps a three-star run open (D200)', async () => {
    await seed()
    const old = 'friendship-training:card-synthetic:1:0'
    await db.ledger.add({ id: old, data: { resource: 'tickets', delta: -1, reason: 'card-limit-break', localDay: '2000-01-01', createdAt: 1 }, createdAt: 1 })
    const row = (id: string, attemptIndex: number, setupVersion: number) => ({
      id, targetKey: 'friendship-training:card-synthetic:1', kind: 'friendship-training' as const,
      target: { kind: 'friendship-training' as const, cardId: card.id, tier: 1 }, tier: 1, attemptIndex, seed: '1', status: 'open' as const,
      outcome: null, reward: null, createdAt: 1, completedAt: null,
      snapshot: { version: 1, setup: { version: setupVersion } } as never,
      journal: { format: 1, engine: 'friendship-training-v1', actions: [{ type: 'give-up' }] } as never,
    })
    await db.minigameRuns.add(row(old, 0, 1))
    await db.minigameRuns.add(row('friendship-training:card-synthetic:1:1', 1, FT_SETUP_VERSION))
    expect(await retireFiveStarFriendshipRuns(2000, '2000-01-02')).toBe(1)
    expect((await db.profile.get('main'))?.data.tickets).toBe(101)
    expect((await db.ledger.get(`${old}:refund`))?.data).toMatchObject({ resource: 'tickets', delta: 1, reason: 'minigame-refund' })
    expect(await db.minigameRuns.get(old)).toMatchObject({ status: 'completed', reward: { ticketsSpent: 0 }, outcome: { actionCount: 1 } })
    expect((await db.minigameRuns.get('friendship-training:card-synthetic:1:1'))?.status).toBe('open')
    expect(await retireFiveStarFriendshipRuns(3000, '2000-01-03')).toBe(0)
    expect((await db.profile.get('main'))?.data.tickets).toBe(101)
  })

  it('never begins a Bond Recall run again', async () => {
    await seed()
    const retired = host() as unknown as { beginRun: (kind: string, target: unknown) => Promise<unknown> }
    await expect(retired.beginRun('bond-recall', { kind: 'bond-recall', cardId: card.id, tier: 1 })).rejects.toThrow(/retired/i)
  })
})
