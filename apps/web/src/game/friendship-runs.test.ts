import 'fake-indexeddb/auto'

import {
  CARD_EFFECTS,
  cardStars,
  createCardSave,
  createPlayerProfile,
  ftBotPlay,
  ftReplay,
  parseCardSave,
  parsePlayerProfileOrThrow,
  type CardEffect,
  type ContentAtlas,
  type FtAction,
  type RaceTemplate,
  type SupportCardTemplate,
} from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { PersistentMinigameHost } from './minigame-runs'

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
    await db.cards.put({ id: template.id, data: template.id === 'card-0' ? { ...save, stars: mainStars } : save, version: 1 })
  }
}

/** Plays the reserved run with the bot and commits what it did. */
async function playOut(runId: string) {
  const { setup } = (await host().loadRun(runId))!
  const { actions, state } = ftBotPlay(setup)
  return { cleared: state.phase === 'won', reward: await host().commitRun(runId, { kind: 'friendship-training', cleared: state.phase === 'won', actions }) }
}

const tickets = async () => parsePlayerProfileOrThrow((await db.profile.get('main'))!.data).tickets
const stars = async () => cardStars(parseCardSave((await db.cards.get('card-0'))!.data)!, 1)

describe('Friendship Training runs', () => {
  beforeEach(reset)
  afterEach(reset)

  it('spends one ticket and freezes a setup built from the owned cards', async () => {
    await seed()
    const ticket = await host().beginRun('friendship-training', target)
    expect(await tickets()).toBe(2)
    const saved = await host().loadRun(ticket.runId)
    expect(saved!.actions).toEqual([])
    expect(saved!.setup.mainCardId).toBe('card-0')
    expect(saved!.setup.deck).toHaveLength(12)
    expect(saved!.setup.races.map((entry) => entry.grade)).toEqual(['g3'])
    // A second Begin resumes the open run instead of spending again.
    expect((await host().beginRun('friendship-training', target)).runId).toBe(ticket.runId)
    expect(await tickets()).toBe(2)
  })

  it('saves choices as they are made and refuses ones the run does not accept', async () => {
    await seed()
    const { runId } = await host().beginRun('friendship-training', target)
    await host().saveProgress(runId, [{ type: 'facility', index: 1 }])
    expect((await host().loadRun(runId))!.actions).toEqual([{ type: 'facility', index: 1 }])
    await expect(host().saveProgress(runId, [{ type: 'train', uids: [1] }])).rejects.toThrow()
    expect((await host().loadRun(runId))!.actions).toHaveLength(1)
  })

  it('grants the star only for a clear that replays, once', async () => {
    await seed()
    const { runId } = await host().beginRun('friendship-training', target)
    const { setup } = (await host().loadRun(runId))!
    // The bot clears this small synthetic run, so the star path is the one exercised.
    const { actions, state } = ftBotPlay(setup)
    const cleared = state.phase === 'won'
    expect(cleared).toBe(true)
    await expect(host().commitRun(runId, { kind: 'friendship-training', cleared: !cleared, actions })).rejects.toThrow()
    const reward = await host().commitRun(runId, { kind: 'friendship-training', cleared, actions })
    expect(reward.starsBefore).toBe(0)
    expect(reward.starsAfter).toBe(cleared ? 1 : 0)
    expect(await stars()).toBe(cleared ? 1 : 0)
    expect(await host().commitRun(runId, { kind: 'friendship-training', cleared, actions })).toEqual(reward)
    await expect(host().saveProgress(runId, actions)).rejects.toThrow()
  })

  it('refuses to commit an unfinished run, and counts giving up as a loss', async () => {
    await seed()
    const { runId } = await host().beginRun('friendship-training', target)
    await expect(host().commitRun(runId, { kind: 'friendship-training', cleared: false, actions: [] })).rejects.toThrow()
    const actions: FtAction[] = [{ type: 'give-up' }]
    const { setup } = (await host().loadRun(runId))!
    expect(ftReplay(setup, actions).phase).toBe('lost')
    const reward = await host().commitRun(runId, { kind: 'friendship-training', cleared: false, actions })
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
    expect(parseCardSave((await db.cards.get('card-0'))!.data)!.stars).toEqual({ '1': 2, '2': 1 })
    expect(await tickets()).toBe(2)
    expect(await db.ledger.count()).toBe(1)
  })

  it('grants the 5★ Card Select Coupon once across scenarios', async () => {
    await seed(3, { '1': 4, '2': 4 })
    // A 5★ season is balanced for a real collection; this rule is about the coupon, so each run is cut to one stage.
    const shorten = async (runId: string) => {
      const row = (await db.minigameRuns.get(runId))!
      await db.minigameRuns.put({ ...row, setup: { ...row.setup!, earning: 1, races: row.setup!.races.slice(0, 1) } })
    }
    const first = await host().beginRun('friendship-training', target)
    await shorten(first.runId)
    const one = await playOut(first.runId)
    const second = await host().beginRun('friendship-training', { ...target, tier: 2 })
    await shorten(second.runId)
    const two = await playOut(second.runId)
    expect([one.cleared, two.cleared]).toEqual([true, true])
    expect(one.reward).toMatchObject({ starsAfter: 5, couponGranted: true })
    expect(two.reward).toMatchObject({ starsAfter: 5, couponGranted: false })
    expect((await db.ledger.toArray()).filter((row) => row.data.reason === 'card-max')).toHaveLength(1)
  })

  it('starts a new attempt after a loss', async () => {
    await seed()
    const first = await host().beginRun('friendship-training', target)
    await host().commitRun(first.runId, { kind: 'friendship-training', cleared: false, actions: [{ type: 'give-up' }] })
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
