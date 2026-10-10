// T124 actual host + isolated Dexie + authoritative pure repository. Every account/value is invented.
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { farmCutoverFixture } from '../../../../../../packages/domain/src/farm/kitchen/cutover-fixtures'
import { SCENARIOS, STATS } from '@racer/domain'
import { farmCutoverControl, farmCutoverSource, resolveFarmCutover, resolveFarmOperations, farmCanonical,
  FARM_KITCHEN_JOB_MS, farmMealId, projectFarmExtraStats } from '@racer/domain/farm/kitchen'
import { RacerDb } from '../../db'
import { farmSha256, FARM_ARCHIVE_REASON } from './backup'
import { readFarmCutoverRecovery, type FarmCutoverPorts } from './cutover'
import { PersistentFarmKitchenHost } from './host'
import { appUpdateLifecycle } from '../../../app/update-lifecycle'

let sequence = 0
const databases: RacerDb[] = []
async function setup(count = 2, legacy: 'absent' | 'v2' = 'absent') {
  const db = new RacerDb(`farm-release-${++sequence}`); databases.push(db); await db.open()
  const f = farmCutoverFixture(count, 14, legacy)
  for (const row of f.entities.values()) await db.table(row.kind).put({ id: row.id, data: row.data, version: row.version, updatedAt: row.updatedAt, deleted: false })
  let lost = false, offline = false, now = FARM_KITCHEN_JOB_MS * 20
  const requests: string[] = [], actionCounts: number[] = []
  const ports: FarmCutoverPorts = { accountId: 'invented-account', build: 'release-proof', current: () => true,
    persistent: () => true, online: () => !offline, safeToPrepare: () => appUpdateLifecycle.getSnapshot().activeActions === 1,
    snapshot: async () => ({ entities: structuredClone([...f.entities.values()]), logs: structuredClone([...f.logs.values()]), serverTime: now }), publish: async () => {},
    prepare: async request => {
      requests.push(request.action); actionCounts.push(appUpdateLifecycle.getSnapshot().activeActions)
      const sourceDigest = !farmCutoverControl(f.entities) ? await farmSha256(farmCutoverSource(ports.accountId, f.entities, f.logs)) : undefined
      const result = resolveFarmCutover({ enabled: true, accountId: ports.accountId, now, entities: f.entities, logs: f.logs, sourceDigest }, request)
      result.writes.forEach(row => f.entities.set(`${row.kind}/${row.id}`, row)); result.appends.forEach(row => f.logs.set(`${row.kind}/${row.id}`, row))
      if (lost) { lost = false; throw new Error('Lost acknowledged reply') }
      return result.response
    } }
  const host = new PersistentFarmKitchenHost({ database: db, enabled: true, clock: () => now, cutover: ports, ownerDebugAllowed: () => true })
  const flush = async () => {
    for (let batch = await host.coordinator.nextBatch(); batch.length; batch = await host.coordinator.nextBatch()) {
      const result = resolveFarmOperations({ enabled: true, allowEnergyGrant: true, now, entities: f.entities, logs: f.logs }, batch)
      result.writes.forEach(row => f.entities.set(`${row.kind}/${row.id}`, row)); result.appends.forEach(row => f.logs.set(`${row.kind}/${row.id}`, row))
      await host.coordinator.adopt(batch, result.responses, now)
      expect(result.responses.every(row => row.status !== 'rejected')).toBe(true)
    }
  }
  const intent = async () => ({ intentId: await host.createIntent(), expectedRevision: (await host.read({ outfitId: 'invented-0000', scenarioId: 'ura-finale' })).revision })
  return { db, f, host, requests, actionCounts, flush, intent, offline: (value: boolean) => { offline = value }, loseReply: () => { lost = true }, advance: () => { now += FARM_KITCHEN_JOB_MS } }
}
afterEach(async () => { for (const db of databases.splice(0)) await db.delete(); expect(appUpdateLifecycle.getSnapshot().activeActions).toBe(0) })
describe('complete Farm release', () => {
  it.each([0, 2, 35])('one explicit preparation completes %i outfits with one archive and exact non-reset equality', async count => {
    const s = await setup(count), before = structuredClone([...s.f.entities.values()])
    expect((await s.host.read()).mode).toBe('legacy')
    expect(await s.host.prepareUpgrade()).toBe(true)
    const view = await s.host.read()
    expect(view.mode).toBe('active'); expect(view.stations).toHaveLength(30)
    expect(await s.db.farmWorkers.count()).toBe(count); expect(await s.db.farmExtra.count()).toBe(count * 3)
    expect(Object.values(view.workers).every(worker => worker.progress.level === 1 && worker.canonical.totalExp === 0)).toBe(true)
    for (const row of before) {
      const after = s.f.entities.get(`${row.kind}/${row.id}`)!
      if (row.kind !== 'umas') expect(after).toEqual(row)
      else {
        const a = structuredClone(after.data), b = structuredClone(row.data)
        for (const data of [a, b]) for (const unit of data.scenarios as Array<Record<string, unknown>>) {
          delete unit.extraStatsUnlocked
          for (const preset of Object.values(unit.presets as Record<string, Record<string, unknown>>)) delete preset.activeExtraStats
        }
        expect(a).toEqual(b)
        expect((after.data.scenarios as Array<{ extraStatsUnlocked: Record<string, number>; presets: Record<string, { activeExtraStats: unknown[] }> }>).every(unit =>
          Object.values(unit.extraStatsUnlocked).every(n => n === 0) && Object.values(unit.presets).every(p => p.activeExtraStats.length === 0))).toBe(true)
      }
    }
    expect((await s.db.farmRecovery.toArray()).filter(row => row.reason === FARM_ARCHIVE_REASON)).toHaveLength(1)
    const stable = farmCanonical([...s.f.entities.values()]); expect(await s.host.prepareUpgrade()).toBe(true)
    expect(farmCanonical([...s.f.entities.values()])).toBe(stable); expect(s.requests.at(-1)).toBe('status')
    expect(s.actionCounts.every(n => n === 1)).toBe(true)
  }, 30000)
  it('offline and lost preparation acknowledgements stop visibly; reload/Retry finishes the same frozen generation', async () => {
    const s = await setup(); s.offline(true)
    expect(await s.host.prepareUpgrade()).toBe(false); expect(s.requests).toHaveLength(0)
    expect((await readFarmCutoverRecovery(s.db))!.phase).toBe('needs-sync')
    s.offline(false); s.loseReply(); expect(await s.host.prepareUpgrade()).toBe(false)
    expect((await readFarmCutoverRecovery(s.db))!.request?.action).toBe('prepare')
    s.db.close(); await s.db.open()
    expect(await s.host.prepareUpgrade()).toBe(true)
    expect(s.requests.filter(action => action === 'prepare')).toHaveLength(1)
    expect((await s.db.farmRecovery.toArray()).filter(row => row.reason === FARM_ARCHIVE_REASON)).toHaveLength(1)
  })
  it('retains old jobs and stock; legacy collection pays once with no new EXP/milestones', async () => {
    const s = await setup(6, 'v2'); expect(await s.host.prepareUpgrade()).toBe(true)
    const view = await s.host.read(), station = view.stations.find(row => row.legacy?.cycle)!
    const worker = station.legacy!.outfitId!, cycle = station.legacy!.cycle!
    const before = (await s.db.items.get(cycle.cropId))?.data.quantity ?? 0
    const input = { ...await s.intent(), stationId: station.id, outfitId: worker, cycleId: cycle.id, cropId: cycle.cropId }
    await s.host.claim(input); await s.flush(); await s.host.claim(input); await s.flush()
    expect((await s.db.items.get(cycle.cropId))!.data.quantity).toBe(before + 1)
    expect((await s.db.farmWorkers.get(worker))!.data.totalExp).toBe(0)
    expect(Object.values((await s.host.read()).recipes).every(row => !row.canonical.processing && !row.canonical.cooking)).toBe(true)
    expect((await s.host.read()).stations.find(row => row.id === station.id)!.legacy).toBeNull()
  })
  it('earns pure/pair/Sun meals from zero new stock after reset, then buys and activates only the selected shared-block build', async () => {
    const s = await setup(); expect(await s.host.prepareUpgrade()).toBe(true)
    const outfitId = 'invented-0000'
    const job = async (stationId: 'garden-1' | 'barn-1' | 'workshop-1' | 'kitchen-1', recipeId: string, quantity = 1, choices: Record<string, string> = {}) => {
      await s.host.assign({ ...await s.intent(), stationId, outfitId }); await s.flush()
      await s.host.start({ ...await s.intent(), stationId, outfitId, recipeId, quantity, choices }); await s.flush()
      const frozen = (await s.host.read()).stations.find(row => row.id === stationId)!.job!
      s.db.close(); await s.db.open(); expect((await s.host.read()).stations.find(row => row.id === stationId)!.job).toEqual(frozen)
      s.advance(); await s.host.claim({ ...await s.intent(), stationId, outfitId, jobId: frozen.id, recipeId }); await s.flush()
    }
    for (const stat of STATS) {
      await job('garden-1', `farm:raw:ura-finale:vegetable:${stat}`)
      await job('barn-1', `farm:raw:ura-finale:milk:${stat}`)
    }
    for (let n = 0; n < 6; n++) await job('garden-1', 'farm:raw:ura-finale:vegetable:speed')
    expect((await s.host.read()).workers[outfitId]!.progress.level).toBe(9)
    for (const stat of STATS) await job('workshop-1', `farm:processed:ura-finale:cheese:${stat}`, 1, { [`raw-${stat}`]: `farm:raw:ura-finale:milk:${stat}` })
    for (const signature of ['speed', 'speed-stamina', 'sun']) {
      const stats = signature === 'sun' ? STATS : signature === 'speed' ? ['speed'] : ['speed', 'stamina']
      const choices = Object.fromEntries(stats.flatMap(stat => [[`raw-${stat}`, `farm:raw:ura-finale:vegetable:${stat}`], [`processed-${stat}`, `farm:processed:ura-finale:cheese:${stat}`]]))
      await job('kitchen-1', farmMealId(1, signature), 1, choices)
    }
    for (const nodeId of ['speed-01', 'dual-speed-stamina', 'sun-01']) {
      await s.host.buyNode({ ...await s.intent(), outfitId, scenarioId: 'ura-finale', distance: 'long', nodeId, autoactivate: true }); await s.flush()
    }
    const map = (await s.host.read({ outfitId, scenarioId: 'ura-finale' })).extra!.canonical
    expect(projectFarmExtraStats({ map, generation: map.generation, outfitId, scenarioId: 'ura-finale', distance: 'long' })).toEqual({ ok: true, value: { speed: 34, stamina: 14, power: 4, guts: 4, wit: 4 } })
    for (const distance of ['sprint', 'mile', 'medium'] as const) expect(projectFarmExtraStats({ map, generation: map.generation, outfitId, scenarioId: 'ura-finale', distance })).toEqual({ ok: true, value: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } })
    expect(map.boughtNodeIds).toHaveLength(3)
    expect(projectFarmExtraStats({ map, generation: map.generation, outfitId, scenarioId: SCENARIOS[1]!.id, distance: 'long' })).toEqual({ ok: true, value: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 } })
  }, 30000)
})
