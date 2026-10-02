import 'fake-indexeddb/auto'

import { TRAINING_LEVEL_UP_TICKET_ID, createPlayerProfile, createUmaSave, type UmaTemplate } from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { LevelUpTicketsStaleError, readLevelUpTickets, spendPersistentLevelUpTickets } from './training-level-up'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const
const template: UmaTemplate = {
  id: 'synthetic-uma', charaId: 'synthetic-chara', name: 'Synthetic Uma', outfit: 'Ticket Test',
  jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 101, stamina: 102, power: 103, guts: 104, wit: 105 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, aptitudes,
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic.png',
}
const content: LoadedContent = {
  manifest: { version: 'synthetic', generatedAt: '', source: {}, files: [] }, origin: 'network', sparkRivals: null,
  umas: { items: [template], byId: new Map([[template.id, template]]) },
  cards: { items: [], byId: new Map() }, skills: { items: [], byId: new Map() },
  races: { items: [], byId: new Map() }, courses: { items: [], byId: new Map() },
  atlases: {
    'uma-icons': { descriptor: { schemaVersion: 1, kind: 'uma-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
    'card-icons': { descriptor: { schemaVersion: 1, kind: 'card-icons', frameWidth: 128, frameHeight: 128, pages: [], frames: {} }, pageUrls: [] },
  },
  art: { has: () => false, load: async () => null },
}

async function reset(input: { trainingLevel?: number; trainingExp?: number; tickets?: number; bank?: number } = {}): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
  const uma = createUmaSave(template)
  uma.scenarios[0] = { ...uma.scenarios[0]!, trainingLevel: input.trainingLevel ?? 1, trainingExp: input.trainingExp ?? 0 }
  await db.umas.put({ id: template.id, data: uma, version: 3 })
  await db.profile.put({ id: 'main', data: { ...createPlayerProfile('synthetic', 1), trainingExpBank: input.bank ?? 0 }, version: 2 })
  await db.items.put({ id: TRAINING_LEVEL_UP_TICKET_ID, version: 5,
    data: { itemId: TRAINING_LEVEL_UP_TICKET_ID, quantity: input.tickets ?? 3, updatedAt: 1 } })
  await db.outbox.clear()
}

const unit = async () => (await db.umas.get(template.id))!.data.scenarios[0]!
const spend = (count: number, fromLevel = 1, fromExp = 0, options = {}) =>
  spendPersistentLevelUpTickets(content, { umaId: template.id, tier: 1, count, fromLevel, fromExp, now: 100 }, options)

describe('spending Training Level-Up Tickets (D213, T088)', () => {
  beforeEach(() => reset())
  afterEach(async () => { db.close(); await db.delete() })

  it('raises the unit, spends the tickets and records evidence in one commit', async () => {
    const receipt = await spend(2)
    expect(receipt).toMatchObject({ ticketsSpent: 2, trainingLevelBefore: 1, trainingLevelAfter: 3, trainingExpAfter: 0,
      trainingExpBanked: 0, levelUpTicketsGranted: 0, alreadyCommitted: false })
    expect(receipt.nodesUnlocked.length).toBeGreaterThan(0)
    expect(await unit()).toMatchObject({ trainingLevel: 3, trainingExp: 0 })
    expect(await readLevelUpTickets()).toBe(1)
    expect((await db.itemLedger.get('level-up:synthetic-uma:1:1.0'))?.data).toMatchObject({ delta: -2, reason: 'training-level-up' })
    const queued = (await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`)
    expect(queued).toEqual(expect.arrayContaining(['umas/synthetic-uma', `items/${TRAINING_LEVEL_UP_TICKET_ID}`, 'itemLedger/level-up:synthetic-uma:1:1.0']))
  })

  it('banks what passes TL10 and pays a full bank back as a ticket at once', async () => {
    await reset({ trainingLevel: 9, trainingExp: 800, tickets: 1, bank: 600 })
    const receipt = await spend(1, 9, 800)
    expect(receipt).toMatchObject({ trainingLevelAfter: 10, trainingExpAfter: 0, trainingExpBanked: 800, levelUpTicketsGranted: 1 })
    expect((await db.profile.get('main'))!.data.trainingExpBank).toBe(150)
    // One spent, one paid straight back.
    expect(await readLevelUpTickets()).toBe(1)
    expect((await db.itemLedger.get('exp-bank:level-up:synthetic-uma:1:9.800'))?.data).toMatchObject({ delta: 1, reason: 'exp-bank' })
  })

  it('refuses without writing anything: too many, at TL10, during an open Spark run, or from a stale screen', async () => {
    const untouched = async () => {
      expect(await unit()).toMatchObject({ trainingLevel: 1, trainingExp: 0 })
      expect(await readLevelUpTickets()).toBe(3)
      expect(await db.itemLedger.count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
    }
    await expect(spend(4)).rejects.toThrow(/Not enough/)
    await untouched()
    await expect(spend(1, 2, 0)).rejects.toBeInstanceOf(LevelUpTicketsStaleError)
    await untouched()
    await db.minigameRuns.put({ id: 'run-1', targetKey: 'spark-match:synthetic-uma:1', status: 'open', attemptIndex: 1 } as never)
    await expect(spend(1)).rejects.toThrow(/open Spark Match/)
    await untouched()
    await reset({ trainingLevel: 10 })
    await expect(spend(1, 10, 0)).rejects.toThrow(/TL10/)
    expect(await readLevelUpTickets()).toBe(3)
  })

  it('answers a retried tap from its evidence and never spends twice', async () => {
    await spend(1)
    const retry = await spend(1)
    expect(retry).toMatchObject({ alreadyCommitted: true, ticketsSpent: 1, trainingLevelAfter: 2 })
    expect(await readLevelUpTickets()).toBe(2)
    expect(await db.itemLedger.count()).toBe(1)
  })

  it('rolls every write back when the transaction fails', async () => {
    for (const boundary of ['uma', 'items', 'itemLedger', 'bank', 'badges'] as const) {
      await reset()
      await expect(spend(2, 1, 0, { afterWrite: (at: string) => { if (at === boundary) throw new Error(`fault:${boundary}`) } }))
        .rejects.toThrow(`fault:${boundary}`)
      expect(await unit()).toMatchObject({ trainingLevel: 1 })
      expect(await readLevelUpTickets()).toBe(3)
      expect(await db.itemLedger.count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
    }
  })
})
