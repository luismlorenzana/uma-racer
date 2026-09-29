import 'fake-indexeddb/auto'

import {
  CARD_EFFECTS,
  buildFriendshipSetup,
  cardStars,
  createCardSave,
  createPlayerProfile,
  ftBotPlay,
  ftReplay,
  ftStateHash,
  parseCardSave,
  parsePlayerProfileOrThrow,
  type CardEffect,
  type ContentAtlas,
  type RaceTemplate,
  type SupportCardTemplate,
} from '@racer/domain'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { PersistentMinigameHost, PersistentMinigameJournal } from './minigame-runs'
import type { FriendshipRunView } from './minigame-journal'

// Friendship Training through the real local-first host (M020 T063, D168): Begin freezes the setup, choices are saved
// as they are made, and the commit replays them before a star is granted.

const effects = Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, effect === 'trainingBonus' ? 2 : 1])) as Record<CardEffect, number>
const TYPES = ['speed', 'speed', 'stamina', 'power', 'guts', 'wit', 'friend'] as const

const cards: SupportCardTemplate[] = TYPES.map((type, index) => ({
  id: `card-${index}`,
  charaId: `chara-${index}`,
  charName: `Runner ${index}`,
  title: 'Practice Notes',
  type,
  jpRelease: '2000-01-01',
  era: 1,
  obtain: 'free',
  starter: true,
  hintSkillIds: [],
  eventSkillIds: [],
  effectProfile: effects,
  uniqueEffect: null,
  imageSource: 'https://example.invalid/card.png',
}))

const race = (id: string, grade: RaceTemplate['grade']): RaceTemplate => ({
  id, familyId: id, name: `Race ${id}`, grade, surface: 'turf', distance: 1600, distanceCategory: 'mile', direction: 'right',
  venue: 'Tokyo', venueKey: 'tokyo', venueTags: [], series: [], seriesLegs: [], courseId: 'c', season: 1, fieldSize: 16,
})
const races = [race('g3', 'g3'), race('g2', 'g2'), race('g1', 'g1')]

const atlas = (kind: ContentAtlas['kind']): ContentAtlas => ({ schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, pages: [], frames: {} })

const content: LoadedContent = {
  manifest: { version: 'synthetic-friendship', generatedAt: '', source: {}, files: [] },
  origin: 'network',
  sparkRivals: null,
  umas: { items: [], byId: new Map() },
  cards: { items: cards, byId: new Map(cards.map((entry) => [entry.id, entry])) },
  skills: { items: [], byId: new Map() },
  races: { items: races, byId: new Map(races.map((entry) => [entry.id, entry])) },
  courses: { items: [], byId: new Map() },
  atlases: {
    'uma-icons': { descriptor: atlas('uma-icons'), pageUrls: [] },
    'card-icons': { descriptor: atlas('card-icons'), pageUrls: [] },
  },
  art: { has: () => false, load: async () => null },
}

const host = () => new PersistentMinigameHost(content, { now: () => 5000, today: () => '2000-01-02' })
const journal = () => new PersistentMinigameJournal(content)
const target = { kind: 'friendship-training' as const, cardId: 'card-0', tier: 1 }

async function reset() {
  db.close()
  await db.delete()
}

async function seed(tickets = 3, mainStars: Record<string, number> = {}) {
  await db.open()
  await db.profile.put({ id: 'main', data: { ...createPlayerProfile('synthetic-friendship', 1234), tickets }, version: 1 })
  for (const template of cards) {
    const save = createCardSave(template)
    await db.cards.put({ id: template.id, data: template.id === 'card-0' ? { ...save, bonds: mainStars } : save, version: 1 })
  }
}

const legacyStores = {
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
}

function migrationSetup(mainCardIndex: number, seedValue: number) {
  return buildFriendshipSetup({
    seed: seedValue,
    tier: 1,
    mainStars: 1,
    mainCard: cards[mainCardIndex]!,
    setCardIds: cards.map((entry) => entry.id),
    owned: cards.map((template) => ({ template, stars: 1 })),
    skills: [],
    races,
  })
}

function prefixWhere(setup: ReturnType<typeof migrationSetup>, predicate: (state: ReturnType<typeof ftReplay>) => boolean) {
  const actions = [] as ReturnType<typeof ftBotPlay>['actions']
  for (const action of ftBotPlay(setup).actions) {
    actions.push(action)
    if (predicate(ftReplay(setup, actions))) return [...actions]
  }
  throw new Error('Synthetic run did not reach the requested migration state')
}

async function friendshipView(runId: string): Promise<FriendshipRunView> {
  const view = await journal().load(runId)
  if (view.engine !== 'friendship-training-v1') throw new Error('Expected a Friendship Training fixture')
  return view
}

const claim = (view: FriendshipRunView) => ({
  kind: 'friendship-training' as const,
  engine: 'friendship-training-v1' as const,
  actionCount: view.actions.length,
  stateHash: ftStateHash(view.replay),
})

/** Plays the reserved run through the journal with the bot and commits its authoritative claim. */
async function playOut(runId: string) {
  let view = await friendshipView(runId)
  const played = ftBotPlay(view.snapshot.setup)
  for (const action of played.actions) {
    const next = await journal().append(runId, view.actions.length, action)
    if (next.engine !== 'friendship-training-v1') throw new Error('Expected a Friendship Training fixture')
    view = next
  }
  return { cleared: view.replay.phase === 'won', reward: await host().commitRun(runId, claim(view)) }
}

const tickets = async () => parsePlayerProfileOrThrow((await db.profile.get('main'))!.data).tickets
const stars = async () => cardStars(parseCardSave((await db.cards.get('card-0'))!.data)!, 1)

describe('Friendship Training runs', () => {
  beforeEach(reset)
  afterEach(reset)

  it('migrates open v11 runs mid-week and mid-encounter to identical replay states', async () => {
    const weekSetup = migrationSetup(0, 101)
    const encounterSetup = migrationSetup(1, 202)
    const weekActions = prefixWhere(weekSetup, (state) => state.phase === 'facility' && state.week === 1)
    const encounterActions = prefixWhere(encounterSetup, (state) => state.phase === 'encounter' && state.encounter!.trainsUsed > 0)
    const fixtures = [
      { id: 'friendship-training:card-0:1:0', cardId: 'card-0', seed: '101', setup: weekSetup, actions: weekActions },
      { id: 'friendship-training:card-1:1:0', cardId: 'card-1', seed: '202', setup: encounterSetup, actions: encounterActions },
    ]

    const legacy = new Dexie('uma-racer')
    legacy.version(11).stores(legacyStores)
    await legacy.open()
    for (const fixture of fixtures) {
      await legacy.table('minigameRuns').put({
        id: fixture.id,
        targetKey: `friendship-training:${fixture.cardId}:1`,
        kind: 'friendship-training',
        target: { kind: 'friendship-training', cardId: fixture.cardId, tier: 1 },
        tier: 1,
        attemptIndex: 0,
        seed: fixture.seed,
        status: 'open',
        outcome: null,
        reward: null,
        createdAt: 100,
        completedAt: null,
        setup: fixture.setup,
        actions: fixture.actions,
      })
    }
    legacy.close()

    await db.open()
    for (const fixture of fixtures) {
      const restored = await friendshipView(fixture.id)
      expect(ftStateHash(restored.replay)).toBe(ftStateHash(ftReplay(fixture.setup, fixture.actions)))
      expect(restored.ticket).toEqual({ runId: fixture.id, seed: fixture.seed, attemptIndex: 0 })
      const row = (await db.minigameRuns.get(fixture.id))!
      expect(row.snapshot).toEqual({ version: 1, setup: fixture.setup })
      expect(row.journal).toEqual({ format: 1, engine: 'friendship-training-v1', actions: fixture.actions })
      expect('setup' in row).toBe(false)
      expect('actions' in row).toBe(false)
    }
  })

  it('keeps a malformed legacy run for visible recovery instead of deleting it', async () => {
    const legacy = new Dexie('uma-racer')
    legacy.version(11).stores(legacyStores)
    await legacy.open()
    const malformed = {
      id: 'friendship-training:card-0:1:0',
      targetKey: 'friendship-training:card-0:1',
      kind: 'friendship-training',
      target: { kind: 'friendship-training', cardId: 'card-0', tier: 1 },
      tier: 1,
      attemptIndex: 0,
      seed: '101',
      status: 'open',
      outcome: null,
      reward: null,
      createdAt: 100,
      completedAt: null,
      setup: { version: 1, malformed: true },
      actions: [{ type: 'give-up' }],
    }
    await legacy.table('minigameRuns').put(malformed)
    legacy.close()

    await db.open()
    expect(await db.minigameRuns.get(malformed.id)).toBeDefined()
    await expect(journal().load(malformed.id)).rejects.toThrow(/malformed.*kept|kept.*recovery/i)
    expect(await db.minigameRuns.get(malformed.id)).toBeDefined()
  })

  it('spends one ticket and freezes a setup built from the owned cards', async () => {
    await seed()
    const ticket = await host().beginRun('friendship-training', target)
    expect(await tickets()).toBe(2)
    const saved = await friendshipView(ticket.runId)
    expect(saved.actions).toEqual([])
    expect(saved.snapshot.setup.mainCardId).toBe('card-0')
    expect(saved.snapshot.setup.deck).toHaveLength(12)
    expect(saved.snapshot.setup.races.map((entry) => entry.grade)).toEqual(['g3'])
    // A second Begin resumes the open run instead of spending again.
    expect((await host().beginRun('friendship-training', target)).runId).toBe(ticket.runId)
    expect(await tickets()).toBe(2)
  })

  it('saves choices as they are made and refuses ones the run does not accept', async () => {
    await seed()
    const { runId } = await host().beginRun('friendship-training', target)
    await journal().append(runId, 0, { type: 'facility', index: 1 })
    expect((await friendshipView(runId)).actions).toEqual([{ type: 'facility', index: 1 }])
    await expect(journal().append(runId, 1, { type: 'train', uids: [999] })).rejects.toThrow()
    expect((await friendshipView(runId)).actions).toHaveLength(1)
  })

  it('grants the star only for a clear that replays, once', async () => {
    await seed()
    const { runId } = await host().beginRun('friendship-training', target)
    let view = await friendshipView(runId)
    // The bot clears this small synthetic run, so the star path is the one exercised.
    const played = ftBotPlay(view.snapshot.setup)
    for (const action of played.actions) {
      const next = await journal().append(runId, view.actions.length, action)
      if (next.engine !== 'friendship-training-v1') throw new Error('Expected a Friendship Training fixture')
      view = next
    }
    expect(view.replay.phase).toBe('won')
    await expect(host().commitRun(runId, { ...claim(view), stateHash: '00000000' })).rejects.toThrow(/stale/)
    const reward = await host().commitRun(runId, claim(view))
    expect(reward.starsBefore).toBe(0)
    expect(reward.starsAfter).toBe(1)
    expect(await stars()).toBe(1)
    expect(await host().commitRun(runId, claim(view))).toEqual(reward)
    await expect(journal().append(runId, view.actions.length, { type: 'give-up' })).rejects.toThrow(/finished/)
  })

  it('refuses to commit an unfinished run, and counts giving up as a loss', async () => {
    await seed()
    const { runId } = await host().beginRun('friendship-training', target)
    const open = await friendshipView(runId)
    await expect(host().commitRun(runId, claim(open))).rejects.toThrow(/not finished/)
    const ended = await journal().append(runId, 0, { type: 'give-up' })
    if (ended.engine !== 'friendship-training-v1') throw new Error('Expected a Friendship Training fixture')
    expect(ended.replay.phase).toBe('lost')
    const reward = await host().commitRun(runId, claim(ended))
    expect(reward.starsAfter).toBe(0)
    expect(await stars()).toBe(0)
    expect(await tickets()).toBe(2)
  })

  it('advances only the named scenario’s star, and pays no tickets for it', async () => {
    await seed(3, { '1': 2 })
    const { runId } = await host().beginRun('friendship-training', { ...target, tier: 2 })
    const { cleared, reward } = await playOut(runId)
    expect(cleared).toBe(true)
    expect(reward).toEqual({ ticketsSpent: 1, starsBefore: 0, starsAfter: 1, couponGranted: false })
    expect(parseCardSave((await db.cards.get('card-0'))!.data)!.bonds).toEqual({ '1': 2, '2': 1 })
    expect(await tickets()).toBe(2)
    expect(await db.ledger.count()).toBe(1)
  })

  it('grants the 3★ Card Select Coupon once across scenarios', async () => {
    await seed(3, { '1': 2, '2': 2 })
    // A 3★ season is balanced for a real collection; this rule is about the coupon, so each run is cut to one stage.
    const shorten = async (runId: string) => {
      const row = (await db.minigameRuns.get(runId))!
      if (!row.snapshot || !('setup' in row.snapshot)) throw new Error('Expected a Friendship Training snapshot')
      await db.minigameRuns.put({
        ...row,
        snapshot: { ...row.snapshot, setup: { ...row.snapshot.setup, earning: 1, races: row.snapshot.setup.races.slice(0, 1) } },
      })
    }
    const first = await host().beginRun('friendship-training', target)
    await shorten(first.runId)
    const one = await playOut(first.runId)
    const second = await host().beginRun('friendship-training', { ...target, tier: 2 })
    await shorten(second.runId)
    const two = await playOut(second.runId)
    expect([one.cleared, two.cleared]).toEqual([true, true])
    expect(one.reward).toMatchObject({ starsAfter: 3, couponGranted: true })
    expect(two.reward).toMatchObject({ starsAfter: 3, couponGranted: false })
    expect((await db.ledger.toArray()).filter((row) => row.data.reason === 'card-max')).toHaveLength(1)
  })

  it('starts a new attempt after a loss', async () => {
    await seed()
    const first = await host().beginRun('friendship-training', target)
    const ended = await journal().append(first.runId, 0, { type: 'give-up' })
    if (ended.engine !== 'friendship-training-v1') throw new Error('Expected a Friendship Training fixture')
    await host().commitRun(first.runId, claim(ended))
    const next = await host().beginRun('friendship-training', target)
    expect(next.attemptIndex).toBe(1)
    expect(next.seed).not.toBe(first.seed)
    expect(await tickets()).toBe(1)
  })

  it('needs a ticket', async () => {
    await seed(0)
    await expect(host().beginRun('friendship-training', target)).rejects.toThrow(/Training Tickets/)
  })
})
