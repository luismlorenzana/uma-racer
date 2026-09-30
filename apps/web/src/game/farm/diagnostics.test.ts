import 'fake-indexeddb/auto'

import { assignFarmOutfit, createInitialFarmState, farmCropById, plantPlot } from '@racer/domain/farm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { readFarmSaveSummary } from './diagnostics'

describe('Farm save diagnostics', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open() })
  afterEach(async () => { db.close(); await db.delete() })

  it('reports only aggregate Farm and Item counts', async () => {
    const crop = farmCropById('produce:t1:speed')!
    const assigned = assignFarmOutfit(createInitialFarmState(), 'plot-1', 'synthetic-outfit', new Set(['synthetic-outfit']))
    const planted = plantPlot({ farm: assigned, plotId: 'plot-1', crop, ownedTemplateIds: new Set(['synthetic-outfit']), now: 10 })
    await db.farm.put({ id: 'main', data: planted.farm, version: 0, revision: 0 })
    await db.items.put({ id: crop.id, data: { itemId: crop.id, quantity: 7, updatedAt: 20 }, version: 0 })
    const summary = await readFarmSaveSummary(20)
    expect(summary).toEqual({
      farmPresent: true, farmLevel: 1, unlockedPlots: 1, assignedPlots: 1, growingPlots: 1, readyPlots: 0,
      itemStacks: 1, totalItems: 7, itemMovements: 0,
    })
    expect(JSON.stringify(summary)).not.toContain(crop.id)
    expect(JSON.stringify(summary)).not.toContain(crop.name)
  })

  it('does not initialize a missing Farm or write an outbox row', async () => {
    expect(await readFarmSaveSummary(1)).toMatchObject({ farmPresent: false, itemStacks: 0, totalItems: 0 })
    expect(await db.farm.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })
})
