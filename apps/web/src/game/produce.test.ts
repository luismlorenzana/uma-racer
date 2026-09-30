import 'fake-indexeddb/auto'

import {
  ConstellationProduceConflictError,
  constellationTemplate,
  createUmaSave,
  type UmaTemplate,
} from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { LoadedContent } from '../content/runtime'
import { db } from './db'
import { consumePersistentProduce } from './produce'

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
const nodes = constellationTemplate(1).nodes.filter((node) => node.kind === 'stat')
const unlockedNode = nodes[0]!
const lockedNode = nodes.at(-1)!

async function reset(quantity = 2, trainingLevel = 10): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
  const uma = createUmaSave(template)
  uma.scenarios[0] = { ...uma.scenarios[0]!, trainingLevel }
  await db.umas.put({ id: template.id, data: uma, version: 3 })
  await db.items.put({
    id: 'produce:t1:speed', version: 4,
    data: { itemId: 'produce:t1:speed', quantity, updatedAt: 1 },
  })
  await db.items.put({
    id: 'produce:t1:stamina', version: 0,
    data: { itemId: 'produce:t1:stamina', quantity: 2, updatedAt: 1 },
  })
  await db.items.put({
    id: 'produce:t2:speed', version: 0,
    data: { itemId: 'produce:t2:speed', quantity: 2, updatedAt: 1 },
  })
  await db.outbox.clear()
}

const command = (over: Partial<Parameters<typeof consumePersistentProduce>[1]> = {}) => ({
  umaId: template.id,
  tier: 1,
  nodeId: unlockedNode.id,
  itemId: 'produce:t1:speed',
  expectedRevision: 0,
  now: 100,
  ...over,
})

describe('persistent Produce nodes', () => {
  beforeEach(() => reset())
  afterEach(async () => { db.close(); await db.delete() })

  it('fills and replaces with one item movement per revision, then retries without a second spend', async () => {
    const first = await consumePersistentProduce(content, command())
    expect(first).toMatchObject({
      assignment: { kind: 'produce', itemId: 'produce:t1:speed', revision: 1 },
      quantityBefore: 2, quantityAfter: 1, alreadyCommitted: false,
    })
    const retry = await consumePersistentProduce(content, command({ now: 101 }))
    expect(retry).toMatchObject({ quantityAfter: 1, alreadyCommitted: true })
    expect(await db.itemLedger.count()).toBe(1)
    expect((await db.items.get('produce:t1:speed'))?.data.quantity).toBe(1)

    const replacement = await consumePersistentProduce(content, command({
      itemId: 'produce:t1:stamina', expectedRevision: 1, now: 102,
    }))
    expect(replacement).toMatchObject({ assignment: { itemId: 'produce:t1:stamina', revision: 2 }, quantityAfter: 1 })
    expect((await db.items.get('produce:t1:speed'))?.data.quantity).toBe(1)
    expect((await db.items.get('produce:t1:stamina'))?.data.quantity).toBe(1)
    expect(await db.itemLedger.count()).toBe(2)
    const lateRetry = await consumePersistentProduce(content, command({ now: 103 }))
    expect(lateRetry).toMatchObject({
      assignment: { kind: 'produce', itemId: 'produce:t1:speed', revision: 1 },
      alreadyCommitted: true,
    })
    expect(await db.itemLedger.count()).toBe(2)
    expect((await db.items.get('produce:t1:speed'))?.data.quantity).toBe(1)
    expect(await db.badges.get(`uma:${template.id}`)).toBeDefined()
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`)).toEqual(expect.arrayContaining([
      `umas/${template.id}`, 'items/produce:t1:speed', 'items/produce:t1:stamina',
      `itemLedger/produce:${template.id}:1:${unlockedNode.id}:1`, `badges/uma:${template.id}`,
    ]))
  })

  it('protects two stale screens without spending the losing crop', async () => {
    await consumePersistentProduce(content, command())
    await expect(consumePersistentProduce(content, command({ itemId: 'produce:t1:stamina', now: 101 })))
      .rejects.toBeInstanceOf(ConstellationProduceConflictError)
    expect((await db.items.get('produce:t1:stamina'))?.data.quantity).toBe(2)
    expect(await db.itemLedger.count()).toBe(1)
  })

  it('rejects zero stock, wrong-tier crops and locked nodes without any mutation', async () => {
    for (const invalid of [
      command(),
      command({ itemId: 'produce:t2:speed' }),
      command({ nodeId: lockedNode.id }),
    ]) {
      if (invalid.itemId === 'produce:t1:speed') await reset(0, invalid.nodeId === lockedNode.id ? 1 : 10)
      else await reset(2, 10)
      const before = JSON.stringify(await db.umas.get(template.id))
      await expect(consumePersistentProduce(content, invalid)).rejects.toThrow()
      expect(JSON.stringify(await db.umas.get(template.id))).toBe(before)
      expect(await db.itemLedger.count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
    }
  })

  it('rolls every write boundary back atomically', async () => {
    for (const boundary of ['uma', 'items', 'itemLedger', 'badges', 'outbox'] as const) {
      await reset()
      const beforeUma = JSON.stringify(await db.umas.get(template.id))
      const beforeItem = JSON.stringify(await db.items.get('produce:t1:speed'))
      await expect(consumePersistentProduce(content, command(), { afterWrite: (at) => {
        if (at === boundary) throw new Error(`fault:${boundary}`)
      } })).rejects.toThrow(`fault:${boundary}`)
      expect(JSON.stringify(await db.umas.get(template.id))).toBe(beforeUma)
      expect(JSON.stringify(await db.items.get('produce:t1:speed'))).toBe(beforeItem)
      expect(await db.itemLedger.count()).toBe(0)
      expect(await db.badges.count()).toBe(0)
      expect(await db.flairEvents.count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
    }
  })
})
