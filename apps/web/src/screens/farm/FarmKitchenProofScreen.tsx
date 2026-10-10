// DEV-only synthetic real-host proof. No auth, game runtime, owner save, API or private Uma art (T122).
import { useEffect, useState } from 'react'
import {
  FARM_CUTOVER_GENERATION,
  FARM_KITCHEN_CATALOGUE,
  FARM_KITCHEN_ENERGY_ID,
  FARM_KITCHEN_JOB_MS,
  FARM_EXTRA_NODES,
  farmMealId,
  createFarmKitchenWorker,
  emptyFarmRecipes,
  farmData,
  resolveFarmOperations,
  parseFarmStoredEntity,
  type FarmOperationV1,
  type FarmStoredEntity,
  type FarmStoredLog,
} from '@racer/domain/farm/kitchen'
import { farmProtocolFixture } from '../../../../../packages/domain/src/farm/kitchen/protocol-fixtures'
import { RacerDb } from '../../game/db'
import { PersistentFarmKitchenHost } from '../../game/farm/kitchen/host'
import { farmProofCards, farmProofUma } from '../../game/farm/kitchen/proof-content'
import { FarmKitchenCommonShell, type FarmKitchenEnvironment } from './FarmKitchenScreen'

const ROOT = '/dev/farm-kitchen-proof'
const booting = new Map<string, Promise<FarmKitchenEnvironment>>()
function proofDatabaseName(): string {
  const key = 'farm-kitchen-proof-database-v3'
  try {
    const retained = sessionStorage.getItem(key)
    if (retained && /^farm-kitchen-proof-[A-Za-z0-9-]+$/.test(retained)) return retained
    const created = `farm-kitchen-proof-${crypto.randomUUID()}`; sessionStorage.setItem(key, created); return created
  } catch { return `farm-kitchen-proof-${crypto.randomUUID()}` }
}
async function putEntity(database: RacerDb, row: FarmStoredEntity) {
  await database.table(row.kind).put({ id: row.id, data: row.data, version: row.version, updatedAt: row.updatedAt, deleted: row.deleted })
}

export async function createFarmKitchenProofEnvironment(name = proofDatabaseName()): Promise<FarmKitchenEnvironment> {
  if (!/^farm-kitchen-proof-[A-Za-z0-9-]+$/.test(name)) throw new Error('Farm proof storage must use an isolated namespace')
  const database = new RacerDb(name); await database.open()
  let now = FARM_KITCHEN_JOB_MS * 2
  const fixture = farmProtocolFixture(240, FARM_CUTOVER_GENERATION)
  if (!await database.farmCutover.count()) {
    if ((await Promise.all(database.tables.map(table => table.count()))).some(Boolean)) throw new Error('Incomplete isolated Farm proof retained; clear only its named proof database')
    const baseUma = fixture.entities.get('umas/invented-0')!
    for (const id of ['invented-0', 'invented-1']) {
      const row = fixture.entities.get(`umas/${id}`)!
      row.data = farmData(farmProofUma(id))
    }
    for (let index = 2; index < 12; index += 1) {
      const id = `invented-${index}`
      fixture.put('umas', id, { ...structuredClone(baseUma.data), templateId: id })
      fixture.put('farmWorkers', id, createFarmKitchenWorker(fixture.generation, id, index * 24))
    }
    fixture.put('farmCutover', 'main', { schemaVersion: 1, generation: fixture.generation, phase: 'active', cohortDigest: 'a'.repeat(64), archiveDigest: 'b'.repeat(64),
      outfitCount: 12, pageCount: 1, nextOutfitIndex: 12, createdAt: 0, activatedAt: 1 })
    const opened = { ...emptyFarmRecipes(fixture.generation, 1), processing: { jobId: `farm-job:${fixture.generation}:garden-1:1`, outfitId: 'invented-0', level: 6 },
      cooking: { jobId: `farm-job:${fixture.generation}:garden-1:2`, outfitId: 'invented-0', level: 9 } }
    fixture.put('farmRecipes', 'b1', opened)
    for (const [id, quantity] of [[FARM_KITCHEN_ENERGY_ID, 12], ['farm:raw:ura-finale:vegetable:speed', 24],
      ['farm:raw:ura-finale:fruit:speed', 18], ['farm:processed:ura-finale:canned-vegetable:speed', 12], ['farm:meal:b1:speed', 2]] as const)
      fixture.put('items', id, { itemId: id, quantity, updatedAt: 1 })
    for (const [stationId, outfitId] of [['orchard-1', 'invented-1'], ['barn-1', 'invented-2'], ['workshop-1', 'invented-3'], ['kitchen-1', 'invented-4']] as const)
      fixture.apply(fixture.operation({ kind: 'assign', stationId, outfitId }, `seed-assign-${stationId}`, now - FARM_KITCHEN_JOB_MS))
    // Seed two already-frozen jobs directly as fixture state; all interactive proof writes below still use the real host.
    const farmRow = fixture.entities.get('farm/main')!, farm = structuredClone(farmRow.data) as { generation: string; stations: Array<Record<string, unknown>> }
    for (const setup of [{ stationId: 'garden-1', outfitId: 'invented-0', recipeId: 'farm:raw:ura-finale:vegetable:speed', startedAt: now - FARM_KITCHEN_JOB_MS },
      { stationId: 'orchard-1', outfitId: 'invented-1', recipeId: 'farm:raw:ura-finale:fruit:speed', startedAt: now - FARM_KITCHEN_JOB_MS / 2 }]) {
      const station = farm.stations.find(row => row.id === setup.stationId)!
      station.attempt = 1
      station.job = { rulesVersion: 1, id: `farm-job:${fixture.generation}:${setup.stationId}:1`, generation: fixture.generation,
        stationId: setup.stationId, attempt: 1, outfitId: setup.outfitId, recipeId: setup.recipeId, block: 1, quantity: 1,
        startedAt: setup.startedAt, durationMs: FARM_KITCHEN_JOB_MS, accelerationMs: 0, readyAt: setup.startedAt + FARM_KITCHEN_JOB_MS,
        inputs: [], output: { itemId: setup.recipeId, amount: 6 }, expAward: 12 }
    }
    farmRow.data = farmData(farm)
    for (const row of fixture.entities.values()) {
      if (!parseFarmStoredEntity(row)) throw new Error(`Invented proof fixture row is invalid: ${row.kind}/${row.id}`)
      await putEntity(database, row)
    }
    for (const row of fixture.logs.values()) await database.table(row.kind).put({ id: row.id, data: row.data, createdAt: row.createdAt })
    for (const [id, data] of Object.entries(farmProofCards())) await database.cards.put({ id, data, version: 1 })
  } else {
    fixture.entities.clear(); fixture.logs.clear()
    for (const kind of ['farm', 'farmWorkers', 'farmRecipes', 'farmExtra', 'farmCutover', 'farmCutoverPages', 'umas', 'items']) for (const row of await database.table(kind).toArray()) {
      const entity: FarmStoredEntity = { kind, id: String(row.id), data: farmData(row.data), version: Number(row.version), deleted: Boolean(row.deleted), updatedAt: Number(row.updatedAt ?? 1) }
      fixture.entities.set(`${kind}/${entity.id}`, entity)
    }
    for (const kind of ['farmOperations', 'itemLedger']) for (const row of await database.table(kind).toArray()) {
      const log: FarmStoredLog = { kind, id: String(row.id), data: farmData(row.data), createdAt: Number(row.createdAt) }; fixture.logs.set(`${kind}/${log.id}`, log)
    }
  }
  let host: PersistentFarmKitchenHost, flushing = false
  const resolve = (operations: readonly FarmOperationV1[]) => {
    const result = resolveFarmOperations({ enabled: true, allowEnergyGrant: true, now, entities: fixture.entities, logs: fixture.logs }, operations)
    result.writes.forEach(row => fixture.entities.set(`${row.kind}/${row.id}`, row)); result.appends.forEach(row => fixture.logs.set(`${row.kind}/${row.id}`, row))
    return result.responses
  }
  const flush = async () => {
    if (flushing) return
    flushing = true
    try {
      for (let batch = await host.coordinator.nextBatch(); batch.length; batch = await host.coordinator.nextBatch()) await host.coordinator.adopt(batch, resolve(batch), now)
      await database.outbox.clear()
    } finally { flushing = false }
  }
  host = new PersistentFarmKitchenHost({ database, enabled: true, clock: () => now, persistent: () => true, current: () => true,
    ownerDebugAllowed: () => true, schedule: () => { queueMicrotask(() => { void flush() }) }, recover: async operations => resolve(operations) })
  const workers = Array.from({ length: 12 }, (_, index) => ({ id: `invented-${index}`, name: ['Aster', 'Birch', 'Clover', 'Dahlia', 'Elm', 'Fern', 'Ginger', 'Hazel', 'Iris', 'Juniper', 'Kestrel', 'Lilac'][index]!, outfit: `Proof Outfit ${index + 1}` }))
  const prepareFullMapProof = async () => {
    if (await database.farmPending.count()) throw new Error('Resolve proof pending commands before preparing a full-map witness')
    const map = fixture.entities.get('farmExtra/invented-0:b1')?.data as { boughtNodeIds: string[] } | undefined
    for (const node of FARM_EXTRA_NODES) {
      if (map?.boughtNodeIds.includes(node.id)) continue
      const itemId = farmMealId(1, node.signature), old = fixture.entities.get(`items/${itemId}`)
      fixture.put('items', itemId, { itemId, quantity: Number(old?.data.quantity ?? 0) + 1, updatedAt: now }, (old?.version ?? 0) + 1)
      const result = fixture.apply(fixture.operation({ kind: 'buy-node', outfitId: 'invented-0', scenarioId: 'ura-finale', distance: 'sprint', nodeId: node.id, autoactivate: false }, `witness-buy-${node.id}`, now))
      if (result.responses[0]?.status === 'rejected') throw new Error('Invented full-map fixture rejected')
    }
    const result = fixture.apply(fixture.operation({ kind: 'set-active', outfitId: 'invented-0', scenarioId: 'ura-finale', distance: 'sprint',
      nodeIds: FARM_EXTRA_NODES.slice(0, 18).map(n => n.id) }, `witness-full-sprint-${fixture.logs.size}`, now))
    if (result.responses[0]?.status === 'rejected') throw new Error('Invented full build rejected')
    await database.transaction('rw', database.tables, async () => {
      for (const row of fixture.entities.values()) await putEntity(database, row)
      for (const row of fixture.logs.values()) await database.table(row.kind).put({ id: row.id, data: row.data, createdAt: row.createdAt })
    })
  }
  return { database, host, workers, content: null, isolated: true, root: ROOT, ownerDebugAllowed: true,
    advanceProofClock: ms => { now += ms }, prepareFullMapProof }
}

export function FarmKitchenProofShell() {
  const [environment, setEnvironment] = useState<FarmKitchenEnvironment | null>(null), [error, setError] = useState<string | null>(null)
  useEffect(() => { let live = true; const name = proofDatabaseName(), boot = booting.get(name) ?? createFarmKitchenProofEnvironment(name); booting.set(name, boot)
    void boot.then(value => { if (live) setEnvironment(value) }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : String(reason)) }); return () => { live = false }
  }, [])
  if (!environment) return <div className="flex h-dvh items-center justify-center bg-page p-6 text-center text-sm text-ink">{error ?? 'Preparing unique invented Farm proof…'}</div>
  return <FarmKitchenCommonShell environment={environment} />
}
