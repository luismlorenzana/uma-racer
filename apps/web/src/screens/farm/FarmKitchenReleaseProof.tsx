// DEV-only real-host reset/recovery witness. Invented accounts, isolated storage, no account boot or HTTP.
import { useEffect, useState } from 'react'
import { farmCutoverFixture } from '../../../../../packages/domain/src/farm/kitchen/cutover-fixtures'
import { farmCutoverControl, farmCutoverSource, resolveFarmCutover, resolveFarmOperations,
  FARM_KITCHEN_JOB_MS, farmData, type FarmStoredEntity, type FarmStoredLog } from '@racer/domain/farm/kitchen'
import { RacerDb } from '../../game/db'
import { farmSha256 } from '../../game/farm/kitchen/backup'
import { PersistentFarmKitchenHost } from '../../game/farm/kitchen/host'
import { appUpdateLifecycle } from '../../app/update-lifecycle'
import { FarmKitchenCommonShell, type FarmKitchenEnvironment } from './FarmKitchenScreen'

const ROOT = '/dev/farm-kitchen-proof/release'
let boot: Promise<FarmKitchenEnvironment> | null = null
async function createEnvironment(): Promise<FarmKitchenEnvironment> {
  const key = 'farm-kitchen-release-proof-v1'
  const retained = sessionStorage.getItem(key)
  const name = retained && /^farm-kitchen-proof-release-[a-z0-9-]+$/.test(retained) ? retained : `farm-kitchen-proof-release-${crypto.randomUUID()}`
  sessionStorage.setItem(key, name)
  const database = new RacerDb(name); await database.open()
  const server = new RacerDb(`${name}-server`); await server.open()
  const f = farmCutoverFixture(6, 14, 'v2')
  if (!await database.profile.count()) {
    if ((await Promise.all(database.tables.map(table => table.count()))).some(Boolean)) throw new Error('Incomplete isolated release witness retained; no destructive retry')
    for (const row of f.entities.values()) await database.table(row.kind).put({ id: row.id, data: row.data, version: row.version, updatedAt: row.updatedAt, deleted: false })
  }
  if (await server.profile.count()) {
    f.entities.clear()
    for (const kind of ['profile', 'umas', 'farm', 'items', 'farmWorkers', 'farmRecipes', 'farmExtra', 'farmCutover', 'farmCutoverPages']) {
      for (const row of await server.table(kind).toArray()) {
        const entity: FarmStoredEntity = { kind, id: String(row.id), data: farmData(row.data), version: Number(row.version), deleted: Boolean(row.deleted), updatedAt: Number(row.updatedAt ?? 1) }
        f.entities.set(`${kind}/${entity.id}`, entity)
      }
    }
    for (const kind of ['farmOperations', 'itemLedger']) for (const row of await server.table(kind).toArray()) {
      const log: FarmStoredLog = { kind, id: String(row.id), data: farmData(row.data), createdAt: Number(row.createdAt) }; f.logs.set(`${kind}/${log.id}`, log)
    }
  }
  const retainServer = async () => {
    for (const row of f.entities.values()) await server.table(row.kind).put({ id: row.id, data: row.data, version: row.version, updatedAt: row.updatedAt, deleted: row.deleted })
    for (const row of f.logs.values()) await server.table(row.kind).put({ id: row.id, data: row.data, createdAt: row.createdAt })
  }
  await retainServer()
  let now = FARM_KITCHEN_JOB_MS * 20, lost = !farmCutoverControl(f.entities), flushing = false
  let host: PersistentFarmKitchenHost
  const flush = async () => {
    if (flushing) return
    flushing = true
    try {
      for (let batch = await host.coordinator.nextBatch(); batch.length; batch = await host.coordinator.nextBatch()) {
        const result = resolveFarmOperations({ enabled: true, allowEnergyGrant: true, now, entities: f.entities, logs: f.logs }, batch)
        result.writes.forEach(row => f.entities.set(`${row.kind}/${row.id}`, row)); result.appends.forEach(row => f.logs.set(`${row.kind}/${row.id}`, row))
        await retainServer()
        await host.coordinator.adopt(batch, result.responses, now)
      }
    } finally { flushing = false }
  }
  host = new PersistentFarmKitchenHost({ database, enabled: true, clock: () => now, ownerDebugAllowed: () => true,
    schedule: () => { queueMicrotask(() => { void flush() }) },
    cutover: { accountId: 'invented-release-account', build: 'DEV-release-proof', current: () => true, persistent: () => true,
      online: () => true, safeToPrepare: () => appUpdateLifecycle.getSnapshot().activeActions === 1,
      snapshot: async () => ({ entities: structuredClone([...f.entities.values()]), logs: structuredClone([...f.logs.values()]), serverTime: now }), publish: async () => {},
      prepare: async request => {
        const sourceDigest = !farmCutoverControl(f.entities) ? await farmSha256(farmCutoverSource('invented-release-account', f.entities, f.logs)) : undefined
        const result = resolveFarmCutover({ enabled: true, accountId: 'invented-release-account', now, entities: f.entities, logs: f.logs, sourceDigest }, request)
        result.writes.forEach(row => f.entities.set(`${row.kind}/${row.id}`, row)); result.appends.forEach(row => f.logs.set(`${row.kind}/${row.id}`, row))
        await retainServer()
        if (lost) { lost = false; throw new Error('DEV proof: lost acknowledged preparation reply. Retry unchanged request.') }
        return result.response
      } },
  })
  return { database, host, workers: Array.from({ length: 6 }, (_, index) => ({ id: `invented-${String(index).padStart(4, '0')}`, name: ['Aster', 'Birch', 'Clover', 'Dahlia', 'Elm', 'Fern'][index]!, outfit: 'Invented release outfit' })),
    content: null, isolated: true, showResetNotice: true, root: ROOT, ownerDebugAllowed: true, advanceProofClock: ms => { now += ms } }
}
export function FarmKitchenReleaseProof() {
  const [environment, setEnvironment] = useState<FarmKitchenEnvironment | null>(null), [error, setError] = useState<string | null>(null)
  useEffect(() => { let live = true; boot ??= createEnvironment()
    void boot.then(value => { if (live) setEnvironment(value) }).catch(reason => { if (live) setError(String(reason)) }); return () => { live = false }
  }, [])
  return environment ? <FarmKitchenCommonShell environment={environment} /> : <div className="p-6 text-ink">{error ?? 'Opening isolated real-host release witness…'}</div>
}
