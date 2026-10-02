import 'fake-indexeddb/auto'

import { createUmaSave, type UmaTemplate } from '@racer/domain'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { FarmConflictError, PersistentFarmHost } from './host'

// A Lv1 worker grows her first row in ten hours (D237).
const FARM_GROWTH_MS = 10 * 60 * 60 * 1_000
/** Section 1 shows plot 1 open, then Section 2 is shown locked (D234). */
const FRESH_STATUSES = ['unassigned', ...Array.from({ length: 11 }, () => 'locked')]

const aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' },
} as const

const template = (id: string, charaId = id): UmaTemplate => ({
  id, charaId, name: `Synthetic ${id}`, outfit: id, jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 101, stamina: 102, power: 103, guts: 104, wit: 105 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 }, aptitudes,
  uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic.png',
})

async function reset(): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
  await db.umas.bulkPut([
    { id: 'outfit-a', data: createUmaSave(template('outfit-a', 'same-character')), version: 0 },
    { id: 'outfit-b', data: createUmaSave(template('outfit-b', 'same-character')), version: 0 },
  ])
}

describe('PersistentFarmHost', () => {
  let now: number
  let host: PersistentFarmHost

  beforeEach(async () => {
    await reset()
    now = 1_000
    host = new PersistentFarmHost({ now: () => now })
  })
  afterEach(async () => { db.close(); await db.delete() })

  it('lazily initializes one unlocked unassigned plot and no fabricated progress or inventory', async () => {
    expect(await db.farm.count()).toBe(0)
    const view = await host.getFarm()
    expect(view.plots.map((plot) => plot.status)).toEqual(FRESH_STATUSES)
    expect(view.unlockedPlots).toBe(1)
    expect(view.state).toEqual({ schemaVersion: 2, plots: [], workers: {} })
    expect(view.inventory).toEqual({})
    expect(await db.items.count()).toBe(0)
    expect(await db.itemLedger.count()).toBe(0)
    expect(await db.outbox.where('[kind+id]').equals(['farm', 'main']).count()).toBe(1)
  })

  it('upgrades a v12 database additively without seeding Farm rows', async () => {
    db.close()
    await db.delete()
    const legacy = new Dexie('uma-racer')
    legacy.version(12).stores({
      profile: 'id', umas: 'id', cards: 'id', badges: 'id', raceResults: 'id, createdAt', ledger: 'id, createdAt',
      flairEvents: 'id, createdAt', outbox: '++seq, [kind+id]', albumPrefs: 'id',
      minigameRuns: 'id, targetKey, [targetKey+status], [targetKey+attemptIndex]',
    })
    await legacy.open()
    legacy.close()
    await db.open()
    expect(await db.farm.count()).toBe(0)
    expect(await db.items.count()).toBe(0)
    expect(await db.itemLedger.count()).toBe(0)
    const view = await new PersistentFarmHost({ now: () => now }).getFarm()
    expect(view.plots.map((plot) => plot.status)).toEqual(FRESH_STATUSES)
  })

  it('upgrades a v1 Farm row to v2 once, re-levelled and queued for upload (D234)', async () => {
    const stores = Object.fromEntries(db.tables.map((table) =>
      [table.name, [table.schema.primKey.src, ...table.schema.indexes.map((index) => index.src)].join(', ')]))
    db.close()
    await db.delete()
    const legacy = new Dexie('uma-racer')
    legacy.version(19).stores(stores)
    await legacy.open()
    const empty = (id: string) => ({ id, templateId: null, lastCropId: null, attempt: 0, cycle: null })
    await legacy.table('farm').put({ id: 'main', version: 3, revision: 3, data: {
      schemaVersion: 1,
      plots: [{ ...empty('plot-1'), templateId: 'outfit-a', attempt: 1, lastCropId: 'produce:t1:speed' },
        ...['plot-2', 'plot-3', 'plot-4', 'plot-5', 'plot-6'].map(empty)],
      workers: { 'outfit-a': { level: 2, exp: 0 } },
    } })
    legacy.close()
    await db.open()
    const row = (await db.farm.get('main'))!
    expect(row).toMatchObject({ version: 3, revision: 4 })
    // Four v1 harvests (48 XP) are two v2 levels.
    expect(row.data).toEqual({ schemaVersion: 2, workers: { 'outfit-a': { level: 3, exp: 0 } },
      plots: [{ ...empty('plot-1'), templateId: 'outfit-a', attempt: 1, lastCropId: 'produce:t1:speed' }] })
    expect(await db.outbox.where('[kind+id]').equals(['farm', 'main']).count()).toBe(1)
  })

  it('persists an assignment across reload and permits different outfits of one character', async () => {
    const initial = await host.getFarm()
    const assigned = await host.assign({ plotId: 'plot-1', templateId: 'outfit-a', expectedFarmVersion: initial.version })
    expect(assigned.plots[0]).toMatchObject({ status: 'idle', templateId: 'outfit-a' })
    const reloaded = await new PersistentFarmHost({ now: () => now }).getFarm()
    expect(reloaded.plots[0]?.templateId).toBe('outfit-a')

    const row = (await db.farm.get('main'))!
    await db.farm.put({ ...row, data: { ...row.data, workers: { 'outfit-a': { level: 3, exp: 0 } } }, revision: row.revision + 1 })
    const expanded = await host.getFarm()
    await expect(host.assign({ plotId: 'plot-2', templateId: 'outfit-a', expectedFarmVersion: expanded.version }))
      .rejects.toThrow(/already assigned/)
    const second = await host.assign({ plotId: 'plot-2', templateId: 'outfit-b', expectedFarmVersion: expanded.version })
    expect(second.plots[1]?.templateId).toBe('outfit-b')
  })

  it('freezes worker, crop, attempt, and the exact ten-hour deadline', async () => {
    const initial = await host.getFarm()
    const assigned = await host.assign({ plotId: 'plot-1', templateId: 'outfit-a', expectedFarmVersion: initial.version })
    const planted = await host.plant({ plotId: 'plot-1', cropId: 'produce:t1:speed', expectedFarmVersion: assigned.version })
    expect(planted.plots[0]).toMatchObject({ status: 'growing', templateId: 'outfit-a', cycle: {
      id: 'farm:plot-1:1', cropId: 'produce:t1:speed', plantedAt: now, readyAt: now + FARM_GROWTH_MS,
    } })
    const roundTrip = JSON.parse(JSON.stringify((await db.farm.get('main'))!.data))
    expect(roundTrip).toEqual(planted.state)
  })

  it('rejects stale commands and serializes concurrent assignment', async () => {
    const initial = await host.getFarm()
    const results = await Promise.allSettled([
      host.assign({ plotId: 'plot-1', templateId: 'outfit-a', expectedFarmVersion: initial.version }),
      host.assign({ plotId: 'plot-1', templateId: 'outfit-b', expectedFarmVersion: initial.version }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toBeInstanceOf(FarmConflictError)
  })

  it('rolls back early and wrong-id harvests, then commits and retries exactly once', async () => {
    const initial = await host.getFarm()
    const assigned = await host.assign({ plotId: 'plot-1', templateId: 'outfit-a', expectedFarmVersion: initial.version })
    const planted = await host.plant({ plotId: 'plot-1', cropId: 'produce:t1:speed', expectedFarmVersion: assigned.version })
    const before = JSON.stringify((await db.farm.get('main')))
    await expect(host.harvest({ plotId: 'plot-1', cycleId: 'farm:plot-1:1', expectedFarmVersion: planted.version }))
      .rejects.toThrow(/not ready/)
    await expect(host.harvest({ plotId: 'plot-1', cycleId: 'farm:plot-1:99', expectedFarmVersion: planted.version }))
      .rejects.toThrow(/changed or is missing/)
    expect(JSON.stringify(await db.farm.get('main'))).toBe(before)
    expect(await db.items.count()).toBe(0)
    expect(await db.itemLedger.count()).toBe(0)

    now += FARM_GROWTH_MS
    const first = await host.harvest({ plotId: 'plot-1', cycleId: 'farm:plot-1:1', expectedFarmVersion: planted.version })
    expect(first).toMatchObject({ quantity: 1, outfitLevel: 1, farmLevel: 1, alreadyHarvested: false })
    expect(first.farm.state.workers['outfit-a']).toEqual({ level: 1, exp: 12 })
    expect(first.farm.plots[0]).toMatchObject({ status: 'idle', templateId: 'outfit-a', lastCropId: 'produce:t1:speed' })
    expect(await db.itemLedger.count()).toBe(1)
    expect((await db.outbox.toArray()).map((row) => `${row.kind}/${row.id}`).sort()).toEqual([
      'farm/main', 'itemLedger/farm:plot-1:1', 'items/produce:t1:speed',
    ])
    const retry = await host.harvest({ plotId: 'plot-1', cycleId: 'farm:plot-1:1', expectedFarmVersion: planted.version })
    expect(retry).toMatchObject({ quantity: 1, alreadyHarvested: true })
    expect(await db.itemLedger.count()).toBe(1)
    expect((await db.items.get('produce:t1:speed'))?.data.quantity).toBe(1)
  })

  it('rolls every harvest write boundary back atomically', async () => {
    for (const boundary of ['farm', 'items', 'itemLedger', 'outbox']) {
      await reset()
      now = 1_000
      const setup = new PersistentFarmHost({ now: () => now })
      const initial = await setup.getFarm()
      const assigned = await setup.assign({ plotId: 'plot-1', templateId: 'outfit-a', expectedFarmVersion: initial.version })
      const planted = await setup.plant({ plotId: 'plot-1', cropId: 'produce:t1:speed', expectedFarmVersion: assigned.version })
      await db.outbox.clear()
      const before = JSON.stringify(await db.farm.get('main'))
      now += FARM_GROWTH_MS
      const failing = new PersistentFarmHost({ now: () => now, afterWrite: (at) => {
        if (at === boundary) throw new Error(`fault:${boundary}`)
      } })
      await expect(failing.harvest({ plotId: 'plot-1', cycleId: 'farm:plot-1:1', expectedFarmVersion: planted.version }))
        .rejects.toThrow(`fault:${boundary}`)
      expect(JSON.stringify(await db.farm.get('main'))).toBe(before)
      expect(await db.items.count()).toBe(0)
      expect(await db.itemLedger.count()).toBe(0)
      expect(await db.outbox.count()).toBe(0)
    }
  })
})
