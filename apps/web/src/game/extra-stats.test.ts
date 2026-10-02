import 'fake-indexeddb/auto'

import { createUmaSave, type UmaTemplate } from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { ExtraStatConflictError, readProduceInventory, unlockPersistentExtraStat } from './extra-stats'

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const
const template: UmaTemplate = {
  id: 'synthetic-uma', charaId: 'synthetic-chara', name: 'Synthetic Uma', outfit: 'Farm Test',
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
async function reset(stamina = 4, trainingLevel = 1): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
  const uma = createUmaSave(template)
  uma.scenarios[0] = { ...uma.scenarios[0]!, trainingLevel }
  await db.umas.put({ id: template.id, data: uma, version: 3 })
  await db.items.put({ id: 'produce:t1:stamina', version: 4, data: { itemId: 'produce:t1:stamina', quantity: stamina, updatedAt: 1 } })
  await db.items.put({ id: 'produce:t2:stamina', version: 0, data: { itemId: 'produce:t2:stamina', quantity: 9, updatedAt: 1 } })
  await db.outbox.clear()
}

const grid = async () => (await db.umas.get(template.id))!.data.scenarios[0]!.extraStats
const stock = async () => (await db.items.get('produce:t1:stamina'))!.data.quantity

describe('persistent Extra stats (D235)', () => {
  beforeEach(() => reset())
  afterEach(async () => { db.close(); await db.delete() })

  it('buys a stat\'s nodes in order for 1 then 2 of its crop, at Training Level 1, and turns them on', async () => {
    const first = await unlockPersistentExtraStat(content, { umaId: template.id, tier: 1, nodeId: 'stamina-1', now: 100 })
    expect(first).toMatchObject({ nodeId: 'stamina-1', cost: 1, quantityBefore: 4, quantityAfter: 3, alreadyCommitted: false })
    const second = await unlockPersistentExtraStat(content, { umaId: template.id, tier: 1, nodeId: 'stamina-2', now: 101 })
    expect(second).toMatchObject({ cost: 2, quantityAfter: 1 })
    expect(await grid()).toEqual({ unlocked: { speed: 0, stamina: 2, power: 0, guts: 0, wit: 0 }, active: ['stamina-1', 'stamina-2'] })
    expect(await stock()).toBe(1)
    expect((await db.itemLedger.toArray()).map((row) => [row.id, row.data.delta]))
      .toEqual([['extra:synthetic-uma:1:stamina-1', -1], ['extra:synthetic-uma:1:stamina-2', -2]])
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`).filter((key) => !key.startsWith('badges/')).sort()).toEqual([
      'itemLedger/extra:synthetic-uma:1:stamina-1', 'itemLedger/extra:synthetic-uma:1:stamina-2',
      'items/produce:t1:stamina', 'umas/synthetic-uma',
    ])
    // The third node costs three; one is left.
    await expect(unlockPersistentExtraStat(content, { umaId: template.id, tier: 1, nodeId: 'stamina-3', now: 102 }))
      .rejects.toThrow(/needs 3/)
  })

  it('answers an exact retry from its evidence, and refuses a node out of order', async () => {
    await unlockPersistentExtraStat(content, { umaId: template.id, tier: 1, nodeId: 'stamina-1', now: 100 })
    const retry = await unlockPersistentExtraStat(content, { umaId: template.id, tier: 1, nodeId: 'stamina-1', now: 200 })
    expect(retry).toMatchObject({ alreadyCommitted: true, cost: 1, quantityAfter: 3 })
    expect(await stock()).toBe(3)
    expect(await db.itemLedger.count()).toBe(1)
    await expect(unlockPersistentExtraStat(content, { umaId: template.id, tier: 1, nodeId: 'stamina-3', now: 300 }))
      .rejects.toBeInstanceOf(ExtraStatConflictError)
  })

  it('rolls every write back when the transaction fails', async () => {
    for (const boundary of ['uma', 'items', 'itemLedger', 'badges', 'outbox'] as const) {
      await reset()
      await expect(unlockPersistentExtraStat(content, { umaId: template.id, tier: 1, nodeId: 'stamina-1', now: 100 }, {
        afterWrite: (at) => { if (at === boundary) throw new Error(`fault:${boundary}`) },
      })).rejects.toThrow(`fault:${boundary}`)
      expect(await grid()).toEqual({ unlocked: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, active: [] })
      expect(await stock()).toBe(4)
      expect(await db.itemLedger.count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
    }
  })

  it('reads the five crops of a scenario, missing stacks as zero', async () => {
    expect((await readProduceInventory(1)).map((stack) => [stack.itemId, stack.quantity])).toEqual([
      ['produce:t1:speed', 0], ['produce:t1:stamina', 4], ['produce:t1:power', 0], ['produce:t1:guts', 0], ['produce:t1:wit', 0],
    ])
  })
})
