import 'fake-indexeddb/auto'

import { createPlayerProfile } from '@racer/domain'
import {
  assignFarmOutfit,
  createInitialFarmState,
  farmCropById,
  harvestPlot,
  plantPlot,
} from '@racer/domain/farm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { adoptServerSnapshot, readLocalSnapshot, reconcileFarmProjectionsInTransaction } from '../persistence'

const crop = farmCropById('produce:t1:speed')!
const owned = new Set(['outfit-a'])

function completedHarvest() {
  const assigned = assignFarmOutfit(createInitialFarmState(), 'plot-1', 'outfit-a', owned)
  const planted = plantPlot({ farm: assigned, plotId: 'plot-1', crop, ownedTemplateIds: owned, now: 1 })
  return { planted, harvested: harvestPlot({ farm: planted.farm, plotId: 'plot-1', cycleId: planted.cycleId, crop, now: planted.readyAt }) }
}

describe('Farm persistence and adoption', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open() })
  afterEach(async () => { db.close(); await db.delete() })

  it('adopts and reads all three Farm save kinds while older saves may omit them', async () => {
    const { harvested } = completedHarvest()
    const profile = createPlayerProfile('synthetic-content', 1)
    expect(await adoptServerSnapshot({
      entities: [
        { kind: 'profile', id: 'main', version: 1, data: profile, deleted: false, updatedAt: 1 },
        { kind: 'farm', id: 'main', version: 3, data: harvested.farm, deleted: false, updatedAt: 2 },
        { kind: 'items', id: crop.id, version: 4,
          data: { itemId: crop.id, quantity: 1, updatedAt: harvested.movement.createdAt }, deleted: false, updatedAt: 2 },
      ],
      logs: [{ kind: 'itemLedger', id: harvested.movement.id, data: harvested.movement, createdAt: harvested.movement.createdAt }],
      serverTime: 3,
    })).toBe('adopted')
    const snapshot = await readLocalSnapshot()
    expect(snapshot?.farm).toMatchObject({ version: 3, revision: 3, data: harvested.farm })
    expect(snapshot?.items).toMatchObject([{ id: crop.id, version: 4, data: { quantity: 1 } }])
    expect(snapshot?.itemLedger).toMatchObject([{ id: harvested.movement.id }])
    expect(await db.outbox.count()).toBe(0)

    await db.delete()
    await db.open()
    expect(await adoptServerSnapshot({
      entities: [{ kind: 'profile', id: 'main', version: 1, data: profile, deleted: false, updatedAt: 1 }],
      logs: [], serverTime: 4,
    })).toBe('adopted')
    expect((await readLocalSnapshot())?.farm).toBeNull()
  })

  it('repairs a resurrected cycle and projections once, then performs a write-free no-op', async () => {
    const { planted, harvested } = completedHarvest()
    await db.farm.put({ id: 'main', data: planted.farm, version: 7, revision: 7 })
    await db.items.put({ id: crop.id, data: { itemId: crop.id, quantity: 0, updatedAt: 0 }, version: 2 })
    await db.itemLedger.put({ id: harvested.movement.id, data: harvested.movement, createdAt: harvested.movement.createdAt })
    await db.transaction('rw', [db.farm, db.items, db.itemLedger, db.outbox], () => reconcileFarmProjectionsInTransaction(99))
    expect((await db.farm.get('main'))?.data.plots[0]).toMatchObject({ cycle: null, templateId: 'outfit-a' })
    expect((await db.farm.get('main'))?.data.workers['outfit-a']).toEqual({ level: 1, exp: 12 })
    expect((await db.items.get(crop.id))?.data.quantity).toBe(1)
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`).sort()).toEqual([
      'farm/main', `items/${crop.id}`,
    ])
    await db.outbox.clear()
    await db.transaction('rw', [db.farm, db.items, db.itemLedger, db.outbox], () => reconcileFarmProjectionsInTransaction(100))
    expect(await db.outbox.count()).toBe(0)
  })
})
