import 'fake-indexeddb/auto'

import { CARD_EFFECTS, createCardSave, createPlayerProfile, type SupportCardTemplate } from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { promoteMemoryCard, promotePersistentCard } from './cards'
import { db } from './db'

const template: SupportCardTemplate = {
  id: 'card-synthetic',
  charaId: 'character-synthetic',
  charName: 'Synthetic Runner',
  title: 'Practice Notes',
  type: 'speed',
  jpRelease: '2000-01-01',
  era: 1,
  obtain: 'free',
  starter: true,
  hintSkillIds: [],
  eventSkillIds: [],
  effectProfile: Object.fromEntries(CARD_EFFECTS.map((effect) => [effect, 1])) as SupportCardTemplate['effectProfile'],
  uniqueEffect: null,
  imageSource: 'https://example.invalid/synthetic.png',
}

const content: LoadedContent = {
  manifest: { version: 'synthetic', generatedAt: '', source: {}, files: [] },
  origin: 'network',
  umas: { items: [], byId: new Map() },
  cards: { items: [template], byId: new Map([[template.id, template]]) },
  skills: { items: [], byId: new Map() },
  races: { items: [], byId: new Map() },
  courses: { items: [], byId: new Map() },
  atlases: {
    'uma-icons': { descriptor: { schemaVersion: 1, kind: 'uma-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
    'card-icons': { descriptor: { schemaVersion: 1, kind: 'card-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
  },
    art: { has: () => false, load: async () => null },
}

async function resetDatabase(): Promise<void> {
  db.close()
  await db.delete()
}

async function seed(tickets = 100): Promise<void> {
  await db.open()
  const profile = { ...createPlayerProfile('synthetic', 1), tickets }
  const card = { ...createCardSave(template), exp: 100 }
  await db.profile.put({ id: 'main', data: profile, version: 2 })
  await db.cards.put({ id: template.id, data: card, version: 3 })
}

describe('card promotion persistence', () => {
  beforeEach(resetDatabase)
  afterEach(resetDatabase)

  it('updates profile/card and appends exact ledger/outbox rows atomically', async () => {
    await seed()
    const mutation = await promotePersistentCard(content, template.id, '2000-01-02', 50)
    expect(mutation).toMatchObject({
      profile: { tickets: 95 },
      card: { limitBreak: 1 },
      ledgerIds: ['card-limit-break:card-synthetic:1', 'card-level-tickets:card-synthetic:10'],
    })
    expect((await db.profile.get('main'))?.version).toBe(2)
    expect((await db.cards.get(template.id))?.version).toBe(3)
    expect(await db.ledger.get('card-limit-break:card-synthetic:1')).toMatchObject({
      data: { resource: 'tickets', delta: -10, reason: 'card-limit-break' },
    })
    expect(await db.ledger.get('card-level-tickets:card-synthetic:10')).toMatchObject({
      data: { resource: 'tickets', delta: 5, reason: 'card-level' },
    })
    expect(await db.outbox.count()).toBe(8)
    expect(await db.badges.get('trainer')).toMatchObject({ data: { scope: 'trainer' } })
    expect((await db.flairEvents.toArray()).every((row) => row.data.scope === 'trainer')).toBe(true)
    // A second run advances again: there is no EXP bar left to gate it, only tickets and the board.
    await promotePersistentCard(content, template.id, '2000-01-02', 51)
    expect((await db.cards.get(template.id))?.data).toMatchObject({ limitBreak: 2 })
    expect((await db.profile.get('main'))?.data.tickets).toBe(90)
    expect(await db.ledger.count()).toBe(4)
  })

  it('rolls back unaffordable promotion and matches memory-only rules', async () => {
    await seed(4)
    await expect(promotePersistentCard(content, template.id, '2000-01-02', 50)).rejects.toThrow('need 10')
    expect((await db.cards.get(template.id))?.data).toMatchObject({ limitBreak: 0 })
    expect(await db.ledger.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)

    const profile = { ...createPlayerProfile('synthetic', 1), tickets: 4 }
    const card = createCardSave(template)
    expect(() => promoteMemoryCard(content, profile, card, '2000-01-02', 50)).toThrow(/need 10/i)
  })

  it('rolls back the card action when Trainer reconciliation cannot parse its state', async () => {
    await seed()
    await db.badges.put({ id: 'trainer', version: 2, data: { scope: 'trainer', corrupt: true } as never })
    await expect(promotePersistentCard(content, template.id, '2000-01-02', 50)).rejects.toThrow(/Trainer badge state/)
    expect((await db.profile.get('main'))?.data.tickets).toBe(100)
    expect((await db.cards.get(template.id))?.data).toMatchObject({ limitBreak: 0 })
    expect(await db.ledger.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})
