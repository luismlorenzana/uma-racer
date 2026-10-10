// Acknowledged Farm -> production race input, with invented rows/real IndexedDB only.
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlayerProfile, parseUmaSaveOrThrow, zeroStats } from '@racer/domain'
import { FARM_CUTOVER_GENERATION, createFarmExtraBlock, emptyFarmDistanceBuilds, farmData } from '@racer/domain/farm/kitchen'
import { farmProtocolFixture } from '../../../../packages/domain/src/farm/kitchen/protocol-fixtures'
import { db } from './db'
import { PersistentFarmKitchenHost } from './farm/kitchen/host'
import { observeFarmStats, readFarmStatState } from './farm/kitchen/stats'
import { farmProofCards, farmProofContent, farmProofUma } from './farm/kitchen/proof-content'
import { farmRaceLocked, farmStatsFor, lockFarmRace } from './farm-stats'
import { preparePersistentRace, completePersistentRace, preparedRaceFromRecord, type PreparedRace } from './racing'
import { joinUma } from './view'
vi.mock('./farm/kitchen/capability', () => ({ FARM_KITCHEN_RELEASE_ENABLED: true }))
const content = farmProofContent(), cards = farmProofCards()
let host: PersistentFarmKitchenHost, fixture: ReturnType<typeof farmProtocolFixture>
const target = { outfitId: 'invented-0', scenarioId: 'ura-finale' }
async function flush() {
  const operations = await host.coordinator.nextBatch()
  await host.coordinator.adopt(operations, operations.flatMap(op => fixture.apply(op).responses), 1000)
}
async function prepare(distance: 'sprint' | 'long'): Promise<PreparedRace> {
  const result = await preparePersistentRace(content, 'invented-0', `invented-race-${distance}`, 'pace')
  if (result.status !== 'prepared') throw new Error('Expected new race')
  return result.attempt
}
beforeEach(async () => {
  await db.open(); await Promise.all(db.tables.map(t => t.clear()))
  fixture = farmProtocolFixture(240, FARM_CUTOVER_GENERATION)
  const uma = farmProofUma()
  for (const build of Object.values(uma.scenarios[0]!.presets)) build.activeExtraStats = ['power-1']
  uma.scenarios[0]!.extraStatsUnlocked.power = 1
  fixture.put('umas', uma.templateId, uma)
  fixture.put('items', 'farm:meal:b1:power', { itemId: 'farm:meal:b1:power', quantity: 2, updatedAt: 1 })
  for (const row of fixture.entities.values()) await db.table(row.kind).put({ id: row.id, data: row.data, version: row.version, updatedAt: row.updatedAt, deleted: row.deleted })
  await db.profile.put({ id: 'main', data: createPlayerProfile('2000-01-01', 0), version: 1 })
  for (const [id, data] of Object.entries(cards)) await db.cards.put({ id, data, version: 1 })
  host = new PersistentFarmKitchenHost({ database: db, enabled: true, clock: () => 1000,
    canEditExtra: (id, scenario) => !farmRaceLocked(id, scenario === 'ura-finale' ? 1 : 2) })
})
afterEach(async () => db.delete())
describe('Farm stat race and adoption boundary', () => {
  it('uses actual Long/Sprint presets, not the selected tab; pending is excluded and retired crop bonuses are zero', async () => {
    expect((await prepare('long')).startStats.power).toBe(600)
    const intentId = await host.createIntent(), view = await host.read(target)
    await host.buyNode({ ...target, intentId, expectedRevision: view.revision, distance: 'long', nodeId: 'power-01', autoactivate: true })
    expect((await host.read(target)).extra?.projected.activeByScenario['ura-finale']?.long).toEqual(['power-01'])
    expect((await prepare('long')).startStats.power).toBe(600)
    await flush()
    expect((await prepare('long')).startStats.power).toBe(620)
    expect((await prepare('sprint')).startStats.power).toBe(600)
    const uma = parseUmaSaveOrThrow((await db.umas.get('invented-0'))!.data), projection = await readFarmStatState(db, true)
    const joined = joinUma(uma, content, cards, 1, 'long', projection)
    expect(joined.status === 'ready' && joined.value.derived.stats.power).toBe(620)
    const id = await host.createIntent(), next = await host.read(target)
    await host.setActive({ ...target, intentId: id, expectedRevision: next.revision, distance: 'sprint', nodeIds: ['power-01'] })
    expect((await prepare('sprint')).startStats.power).toBe(600)
    await flush(); db.close(); await db.open()
    expect((await prepare('sprint')).startStats.power).toBe(620)
    expect((await db.umas.get('invented-0'))!.data).toEqual(uma) // No CL/goals/skills/aptitudes/card/Uma rewrites.
  })
  it('keeps accepted history frozen and rejects a changed in-flight build rather than changing its race', async () => {
    const attempt = await prepare('long'), frozen = structuredClone(attempt)
    const map = { ...createFarmExtraBlock(FARM_CUTOVER_GENERATION, 'invented-0', 1), boughtNodeIds: ['power-01'],
      activeByScenario: { 'ura-finale': { ...emptyFarmDistanceBuilds(), long: ['power-01'] } } }
    await db.farmExtra.put({ id: 'invented-0:b1', data: farmData(map), version: 1, updatedAt: 1, deleted: false })
    await expect(completePersistentRace(content, attempt, '2000-01-01', 1000)).rejects.toThrow(/stale/)
    expect(await db.raceResults.count()).toBe(0); expect(attempt).toEqual(frozen)
    const accepted = await completePersistentRace(content, await prepare('long'), '2000-01-01', 1000)
    const replay = preparedRaceFromRecord(content, accepted.record)
    await db.farmExtra.put({ id: 'invented-0:b1', data: farmData({ ...map, activeByScenario: {} }), version: 2, updatedAt: 2, deleted: false })
    expect(preparedRaceFromRecord(content, accepted.record)).toEqual(replay)
    expect(replay.startStats.power).toBe(620)
  })
  it('adopts committed/cloud-style changes reactively, never pending; future templates fail closed', async () => {
    const published: Awaited<ReturnType<typeof readFarmStatState>>[] = []
    const stop = observeFarmStats(db, true, state => published.push(state))
    await vi.waitFor(() => expect(published.length).toBeGreaterThan(0))
    const map = { ...createFarmExtraBlock(FARM_CUTOVER_GENERATION, 'invented-0', 1), boughtNodeIds: ['sun-01'],
      activeByScenario: { 'ura-finale': { ...emptyFarmDistanceBuilds(), long: ['sun-01'] } } }
    await db.farmExtra.put({ id: 'invented-0:b1', data: farmData(map), version: 1, updatedAt: 1, deleted: false })
    await vi.waitFor(() => expect(farmStatsFor(published.at(-1)!, 'invented-0', 1, 'long')?.speed).toBe(4))
    expect(farmStatsFor(await readFarmStatState(db, true), 'another-outfit', 1, 'long')).toEqual(zeroStats())
    expect(farmStatsFor(await readFarmStatState(db, true), 'invented-0', 6, 'long')).toEqual(zeroStats())
    await db.farmExtra.put({ id: 'invented-0:b1', data: farmData({ ...map, templateVersion: 2 }), version: 2, updatedAt: 2, deleted: false })
    await vi.waitFor(() => expect(published.at(-1)?.mode).toBe('recovery'))
    await expect(prepare('long')).rejects.toThrow(/recovery/)
    stop()
  })
  it('locks local mid-race edits without changing inventory; stale confirmed previews require reconfirmation', async () => {
    const release = lockFarmRace('invented-0', 1), view = await host.read(target), intentId = await host.createIntent()
    await expect(host.buyNode({ ...target, intentId, expectedRevision: view.revision, distance: 'long', nodeId: 'power-01', autoactivate: true })).rejects.toThrow(/race/)
    release(); expect(await db.farmPending.count()).toBe(0)
    const row = (await db.items.get('farm:meal:b1:power'))!
    await db.items.put({ ...row, version: row.version + 1 })
    await expect(host.buyNode({ ...target, intentId, expectedRevision: view.revision, distance: 'long', nodeId: 'power-01', autoactivate: true })).rejects.toThrow(/changed/)
    expect(await db.farmPending.count()).toBe(0)
    expect((await db.items.get(row.id))!.data.quantity).toBe(2)
  })
  it('reacts to a generation first arriving while the tab is open and never treats a disabled active generation as legacy', async () => {
    const control = (await db.farmCutover.get('main'))!, farm = (await db.farm.get('main'))!
    await db.transaction('rw', [db.farmCutover, db.farm], async () => { await db.farmCutover.clear(); await db.farm.clear() })
    const published: Awaited<ReturnType<typeof readFarmStatState>>[] = []
    const stop = observeFarmStats(db, true, state => published.push(state))
    await vi.waitFor(() => expect(published.at(-1)?.mode).toBe('legacy'))
    await db.transaction('rw', [db.farmCutover, db.farm], async () => { await db.farmCutover.put(control); await db.farm.put(farm) })
    await vi.waitFor(() => expect(published.at(-1)?.mode).toBe('active'))
    expect((await readFarmStatState(db, false)).mode).toBe('recovery')
    await db.farm.delete('main') // Farm tombstones remove the legacy-shaped row rather than storing a deleted flag.
    await vi.waitFor(() => expect(published.at(-1)?.mode).toBe('recovery'))
    stop()
  })
})
