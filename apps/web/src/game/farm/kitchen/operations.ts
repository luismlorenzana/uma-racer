// Canonical inventory is acknowledged only; offline intent/predictions live in farmPending (technical §§4–5).
import { createFarmOperation, parseFarmOperationResponses, parseFarmOperationReceipt, parseFarmOperationLog, farmLogIdMatches,
  farmOperationReferences, partitionFarmOperations, resolveFarmOperations, farmSafeOperationId, farmCanonical, farmData, farmKey,
  parseFarmStoredEntity, FARM_ENTITY_KINDS, FARM_SYNC_LIMITS, farmBytes, type FarmPayloadV1, type FarmOperationV1,
  type FarmStoredEntity, type FarmStoredLog, type FarmOperationResponse } from '@racer/domain/farm/kitchen'
import { parseEntityData, parseLogData, type EntityKind, type LogKind, type EntityRecord, type LogRecord } from '@racer/domain'
import { RacerDb, type FarmPendingRow, type FarmCanonicalRow, type LogRow } from '../../db'
import { FARM_KITCHEN_RELEASE_ENABLED } from './capability'
const entityKinds = ['farm', ...FARM_ENTITY_KINDS, 'umas', 'items', 'constellationBank']
export const farmTransactionTables = (db: RacerDb) => [...entityKinds, 'itemLedger', 'farmOperations', 'farmPending', 'farmRecovery', 'farmPreferences', 'outbox'].map(k => db.table(k))
const table = (db: RacerDb, kind: string) => db.table<FarmCanonicalRow, string>(kind)
const logTable = (db: RacerDb, kind: string) => db.table<LogRow<Record<string, unknown>>, string>(kind)
async function readState(db: RacerDb) {
  const entities = new Map<string, FarmStoredEntity>(), logs = new Map<string, FarmStoredLog>()
  for (const kind of entityKinds) for (const row of await table(db, kind).toArray()) {
    // The unchanged live v2 Farm is not a v3 production view.
    if (kind === 'farm' && row.data.schemaVersion !== 3) continue
    const record = { kind, id: row.id, data: row.data, version: row.version, deleted: row.deleted ?? false, updatedAt: row.updatedAt ?? 0 }
    if (!parseFarmStoredEntity(record) || !parseEntityData(kind as EntityKind, record.data)) throw new Error(`Invalid canonical Farm read ${farmKey(record)}; preserve for recovery`)
    entities.set(farmKey(record), record)
  }
  for (const kind of ['farmOperations', 'itemLedger']) for (const row of await logTable(db, kind).toArray()) {
    if (!parseLogData(kind as LogKind, row.data)) throw new Error(`Invalid canonical evidence ${kind}/${row.id}; preserve for recovery`)
    logs.set(`${kind}/${row.id}`, { kind, ...row })
  }
  return { entities, logs }
}
async function putCanonical(db: RacerDb, record: FarmStoredEntity, afterWrite: (key: string) => void) {
  if (!parseFarmStoredEntity(record) || !parseEntityData(record.kind as EntityKind, record.data)) throw new Error(`Invalid Farm acknowledgement ${farmKey(record)}`)
  if (record.kind === 'umas' || record.kind === 'constellationBank') return // Farm owns neither: never replace an unrelated edit from an ack.
  const previous = await table(db, record.kind).get(record.id)
  if (previous && previous.version > record.version) return // Lost/stale reply, including a response overtaken on another device.
  if (previous && previous.version === record.version) {
    if (farmCanonical(previous.data) !== farmCanonical(record.data) || (previous.deleted ?? false) !== record.deleted) throw new Error(`Divergent canonical version ${farmKey(record)}; recovery required`)
    return
  }
  // Preserve tombstones as versioned metadata, rather than accidentally recreating their old data on import.
  await table(db, record.kind).put({ id: record.id, data: record.data, version: record.version, updatedAt: record.updatedAt,
    deleted: record.deleted, ...(record.kind === 'farm' ? { revision: record.version } : {}) })
  afterWrite(farmKey(record))
}
async function putLog(db: RacerDb, log: FarmStoredLog, afterWrite: (key: string) => void) {
  const data = parseLogData(log.kind as LogKind, log.data)
  if (!data || data.createdAt !== log.createdAt || (log.kind === 'farmOperations'
    ? !farmLogIdMatches(log.id, parseFarmOperationLog(data)!) : data.id !== log.id)) throw new Error(`Invalid immutable Farm evidence ${farmKey(log)}`)
  const existing = await logTable(db, log.kind).get(log.id)
  if (existing) {
    if (existing.createdAt !== log.createdAt || farmCanonical(existing.data) !== farmCanonical(data)) throw new Error(`Immutable Farm evidence changed ${farmKey(log)}`)
    return
  }
  await logTable(db, log.kind).put({ id: log.id, data, createdAt: log.createdAt }); afterWrite(farmKey(log))
}
/** No host installation here. Capability injection exists only for isolated tests until T123's coordinated release. */
export class FarmOperationCoordinator {
  constructor(private readonly db: RacerDb, private readonly schedule: () => void, private readonly enabled = FARM_KITCHEN_RELEASE_ENABLED,
    private readonly afterWrite: (key: string) => void = () => {}) {}
  /** Reserve from persisted device identity + sequence; callers retain this identity across retries, not Date/Math.random. */
  async reserveOperationId(deviceId: string): Promise<string> {
    return await this.db.transaction('rw', this.db.farmPreferences, async () => {
      const key = `sequence:${deviceId}`, prior = await this.db.farmPreferences.get(key), n = Number(prior?.value ?? 0) + 1
      const id = farmSafeOperationId(deviceId, n); await this.db.farmPreferences.put({ id: key, value: n }); return id
    })
  }
  async enqueue(payload: FarmPayloadV1, operationId: string, dependencies: string[] = [], now = Date.now()) {
    const op = await this.db.transaction('rw', farmTransactionTables(this.db), async () => this.enqueueInTransaction(payload, operationId, dependencies, now))
    this.schedule(); return op
  }
  async enqueueInTransaction(payload: FarmPayloadV1, operationId: string, dependencies: string[] = [], now = Date.now()): Promise<FarmOperationV1> {
    const pending = await this.db.farmPending.get(operationId), accepted = await this.db.farmOperations.get(operationId)
    const prior = pending?.operation ?? (accepted ? parseFarmOperationReceipt(accepted.data)?.operation : null)
    if (prior) {
      if (farmCanonical(prior.payload) !== farmCanonical(payload) || farmCanonical(prior.dependencies) !== farmCanonical(dependencies)) throw new Error('Farm operation id reused with different input')
      if (pending && pending.status !== 'pending') throw new Error(pending.reason ?? 'Farm input needs recovery')
      return prior
    }
    const state = await this.overlayInTransaction(), control = state.entities.get('farmCutover/main')
    if (!control || typeof control.data.generation !== 'string') throw new Error('Farm generation is not prepared')
    const provisional = createFarmOperation({ schemaVersion: 1, generation: control.data.generation, now, operationId, dependencies, expected: [], payload })
    const refs = farmOperationReferences(provisional), rows = await this.db.farmPending.orderBy('order').toArray()
    const ancestry = new Set(dependencies), visit = [...dependencies]
    while (visit.length) {
      const id = visit.pop()!, parent = rows.find(r => r.id === id)?.operation ??
        parseFarmOperationReceipt((await this.db.farmOperations.get(id))?.data)?.operation
      for (const ancestor of parent?.dependencies ?? []) if (!ancestry.has(ancestor)) { ancestry.add(ancestor); visit.push(ancestor) }
    }
    // Any pending producer whose writes this command reads must be declared; no invisible optimistic stock dependency.
    for (const row of rows.filter(r => r.status === 'pending')) if (row.prediction.changes.some(c => refs.entities.includes(farmKey(c))) && !ancestry.has(row.id))
      throw new Error(`Farm command must depend on pending producer ${row.id}`)
    const expected = refs.entities.map(k => { const [kind, id] = k.split('/'); return { kind: kind!, id: id!, version: state.entities.get(k)?.version ?? 0 } })
    const operation = createFarmOperation({ ...provisional, expected }), response = resolveFarmOperations({ ...state, enabled: this.enabled, allowEnergyGrant: true, now }, [operation]).responses[0]!
    if (!response.receipt || response.status !== 'applied') throw new Error(response.reason ?? 'Farm prediction failed')
    const order = Number((await this.db.farmPreferences.get('order'))?.value ?? 0) + 1
    if (!Number.isSafeInteger(order)) throw new Error('Farm queue order overflow')
    await this.db.farmPreferences.put({ id: 'order', value: order }); this.afterWrite('order')
    await this.db.farmPending.put({ id: operationId, order, operation, prediction: response.receipt, status: 'pending', reason: null, queuedAt: now }); this.afterWrite('pending')
    await this.db.outbox.add({ kind: 'farmOperations', id: operationId, op: 'farm', queuedAt: now }); this.afterWrite('outbox')
    return operation
  }
  /** View-only replay. This never writes an Item, station, worker, milestone or evidence projection. */
  async overlayInTransaction() {
    let state = await readState(this.db)
    for (const row of await this.db.farmPending.orderBy('order').toArray()) {
      if (row.status !== 'pending') continue
      const resolved = resolveFarmOperations({ ...state, enabled: this.enabled, allowEnergyGrant: true, now: row.operation.now }, [row.operation])
      if (resolved.responses[0]!.status !== 'applied' && resolved.responses[0]!.status !== 'duplicate') throw new Error(resolved.responses[0]!.reason ?? 'Farm queue requires recovery')
      state = { entities: resolved.entities, logs: resolved.logs }
    }
    return state
  }
  async nextBatch() {
    const rows = (await this.db.farmPending.orderBy('order').toArray()).filter(r => r.status === 'pending')
    const batch = partitionFarmOperations(rows.map(r => r.operation))[0] ?? []
    while (batch.length && farmBytes({ upserts: [], appends: [], farmProtocolVersion: 1, farmOperations: batch }) > FARM_SYNC_LIMITS.bytes) batch.pop()
    if (rows.length && !batch.length) throw new Error('One Farm command exceeds complete request bounds; preserve it for recovery')
    return batch
  }
  async adopt(operations: readonly FarmOperationV1[], raw: unknown, now = Date.now()) {
    const responses = parseFarmOperationResponses(raw, operations)
    if (!responses) throw new Error('Farm response is incomplete or invalid; keep intent for retry')
    await this.db.transaction('rw', farmTransactionTables(this.db), async () => {
      for (const response of responses) await this.adoptOne(response, now)
      await this.revalidatePendingInTransaction(now)
    })
    this.schedule()
  }
  private async adoptOne(response: FarmOperationResponse, now: number) {
    for (const a of response.authoritative) {
      if (a.record) await putCanonical(this.db, a.record, this.afterWrite)
      // An absent read is not a tombstone and cannot erase newer acknowledged state.
      else if (await table(this.db, a.kind).get(a.id)) throw new Error(`Missing canonical ${farmKey(a)}; preserve for recovery`)
    }
    const pending = await this.db.farmPending.get(response.operationId)
    if (response.receipt) {
      // Complete authoritative views may include a later command in the same transaction. Never replay older changes over them.
      for (const c of response.receipt.changes) await putCanonical(this.db, c.after, this.afterWrite)
      for (const log of response.receipt.logs) await putLog(this.db, log, this.afterWrite)
      await putLog(this.db, { kind: 'farmOperations', id: response.operationId, data: farmData(response.receipt), createdAt: response.receipt.createdAt }, this.afterWrite)
      await this.db.farmPending.delete(response.operationId); this.afterWrite('pending')
    } else if (pending) {
      await this.db.farmPending.put({ ...pending, status: response.status === 'blocked' ? 'blocked' : 'rejected', reason: response.reason }); this.afterWrite('pending')
      await this.db.farmRecovery.put({ id: pending.id, reason: response.reason!, data: pending.operation, createdAt: now }); this.afterWrite('recovery')
    }
    await this.db.outbox.where('[kind+id]').equals(['farmOperations', response.operationId]).delete(); this.afterWrite('outbox')
  }
  async revalidatePendingInTransaction(now: number) {
    if (!this.enabled) return // A dormant capability is not a rejected economic input; keep restored intents intact.
    let state = await readState(this.db)
    for (const pending of await this.db.farmPending.orderBy('order').toArray()) {
      if (pending.status !== 'pending') continue
      const result = resolveFarmOperations({ ...state, enabled: this.enabled, allowEnergyGrant: true, now: pending.operation.now }, [pending.operation])
      const r = result.responses[0]!
      if (r.receipt) {
        await this.db.farmPending.put({ ...pending, prediction: r.receipt }); this.afterWrite('pending')
        state = { entities: result.entities, logs: result.logs }
      } else {
        const row: FarmPendingRow = { ...pending, status: r.status === 'blocked' ? 'blocked' : 'rejected', reason: r.reason }
        await this.db.farmPending.put(row); this.afterWrite('pending')
        await this.db.farmRecovery.put({ id: row.id, reason: r.reason!, data: row.operation, createdAt: now }); this.afterWrite('recovery')
        await this.db.outbox.where('[kind+id]').equals(['farmOperations', row.id]).delete(); this.afterWrite('outbox')
      }
    }
  }
  async adoptSnapshotInTransaction(entities: readonly EntityRecord[], logs: readonly LogRecord[], now: number) {
    for (const record of entities) if (FARM_ENTITY_KINDS.includes(record.kind as never) || record.kind === 'farm' && record.data.schemaVersion === 3 ||
      record.kind === 'items' && (record.id.startsWith('farm:') || record.id.startsWith('produce:'))) await putCanonical(this.db, record, this.afterWrite)
    for (const log of logs) if (log.kind === 'farmOperations' || log.kind === 'itemLedger' && log.data.reason === 'farm-command') await putLog(this.db, log, this.afterWrite)
    for (const pending of await this.db.farmPending.toArray()) if (await this.db.farmOperations.get(pending.id)) {
      const receipt = parseFarmOperationReceipt((await this.db.farmOperations.get(pending.id))!.data)
      if (!receipt || farmCanonical(receipt.operation) !== farmCanonical(pending.operation)) throw new Error('Snapshot reused a Farm operation id')
      await this.db.farmPending.delete(pending.id); await this.db.outbox.where('[kind+id]').equals(['farmOperations', pending.id]).delete()
    }
    await this.revalidatePendingInTransaction(now)
  }
}
