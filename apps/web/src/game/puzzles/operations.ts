// Ordered durable prediction/reconciliation. Gesture journals stay device-only (implementation §§5–6).
import { createPuzzleOperation, parsePuzzleOperationResponses, partitionPuzzleOperations, puzzleOperationReferences, puzzleOutfitCheckpointReferences, parsePuzzlePresetSave,
  resolvePuzzleOperations, puzzleCanonical, puzzleData, PUZZLE_ENTITY_KINDS, parseConstellationBankSave,
  parsePuzzleCheckpointSave, type PuzzlePayload, type PuzzleOperationV1, type PuzzleOperationResponse, type PuzzleStoredEntity,
  type PuzzleStoredLog, type PuzzleOperationReceiptV1, type PuzzleAuthoritative, parseEntityData, parseLogData, type EntityKind, type LogKind } from '@racer/domain'
import { RacerDb, type PendingPuzzleOperationRow, type VersionedRow, type LogRow } from '../db'
import { PUZZLES_RELEASE_ENABLED } from './capability'
import { usePuzzleSync } from './store'

const key = (r: { kind: string; id: string }) => `${r.kind}/${r.id}`
const puzzleKinds = [...PUZZLE_ENTITY_KINDS, 'puzzleResults', 'puzzleOperations', 'pendingPuzzleOperations', 'puzzleJournals',
  'puzzleArchives', 'puzzleBases', 'puzzlePreferences', 'umas', 'items', 'itemLedger', 'outbox']
export const puzzleTransactionTables = (database: RacerDb) => puzzleKinds.map(k => database.table(k))
const table = (database: RacerDb, kind: string) => database.table<VersionedRow<Record<string, unknown>>, string>(kind)
const logTable = (database: RacerDb, kind: string) => database.table<LogRow<Record<string, unknown>>, string>(kind)
async function readEntity(database: RacerDb, kind: string, id: string): Promise<PuzzleStoredEntity | null> {
  const row = await table(database, kind).get(id)
  return row ? { kind, id, version: row.version, data: row.data, deleted: false, updatedAt: 0 } : null
}
/** CL repair changes only shared level/EXP, not Racing, Farm, Inspiration or any of the four saved builds. */
export function restorePuzzleOwnedFields(canonical: PuzzleStoredEntity, physical: PuzzleStoredEntity | null): PuzzleStoredEntity {
  if (canonical.kind !== 'umas' || !physical || !Array.isArray(canonical.data.scenarios) || !Array.isArray(physical.data.scenarios)) return canonical
  const units = canonical.data.scenarios as Record<string, unknown>[]
  return { ...canonical, data: { ...physical.data, schemaVersion: canonical.data.schemaVersion, scenarios: (physical.data.scenarios as Record<string, unknown>[]).map(s => {
    const unit = units.find(u => u.tier === s.tier)
    return unit ? { ...s, trainingLevel: unit.trainingLevel, trainingExp: unit.trainingExp } : s
  }) } }
}
async function putEntity(database: RacerDb, record: PuzzleStoredEntity | null, kind: string, id: string, physicalMerge = true) {
  if (!record || record.deleted) { await table(database, kind).delete(id); return }
  const next = physicalMerge ? restorePuzzleOwnedFields(record, await readEntity(database, kind, id)) : record
  await table(database, kind).put({ id, data: next.data, version: next.version })
}
async function readState(database: RacerDb) {
  const entities = new Map<string, PuzzleStoredEntity>(), logs = new Map<string, PuzzleStoredLog>()
  for (const kind of [...PUZZLE_ENTITY_KINDS, 'umas', 'items']) for (const row of await table(database, kind).toArray())
    entities.set(`${kind}/${row.id}`, { kind, id: row.id, version: row.version, data: row.data, deleted: false, updatedAt: 0 })
  for (const kind of ['puzzleResults', 'puzzleOperations', 'itemLedger']) for (const row of await logTable(database, kind).toArray())
    logs.set(`${kind}/${row.id}`, { kind, id: row.id, data: row.data, createdAt: row.createdAt })
  return { entities, logs }
}
async function undoPending(database: RacerDb) {
  // Frozen canonical bases are only the fields this lane owns. Unrelated edits survive each rebase.
  for (const base of await database.puzzleBases.toArray()) {
    const [kind, id] = base.id.split('/')
    await putEntity(database, base.record, kind!, id!)
  }
}
async function savePrediction(database: RacerDb, pending: PendingPuzzleOperationRow, prediction: PuzzleOperationReceiptV1, afterWrite: (kind: string) => void = () => {}) {
  for (const c of prediction.changes) {
    if (!await database.puzzleBases.get(key(c))) await database.puzzleBases.put({ id: key(c), record: c.before })
    // Mutable Uma rows use canonical version on ordinary sync. Puzzles' virtual revisions live in the pending chain.
    const baseline = await database.puzzleBases.get(key(c))
    const record = c.kind === 'umas' || c.kind === 'items' ? { ...c.after, version: baseline?.record?.version ?? 0 } : c.after
    await putEntity(database, record, c.kind, c.id)
    afterWrite(`${c.kind}/${c.id}`)
  }
  await database.pendingPuzzleOperations.put({ ...pending, changes: prediction.changes, prediction })
  afterWrite('pending')
  // Result/movement evidence is stored in that one durable prediction, never separate raw cloud logs.
  for (const log of prediction.logs) afterWrite(`${log.kind}/${log.id}`)
}
/** Publishes after the transaction; injected capability is for isolated tests, never a route/query flag. */
export class PuzzleOperationCoordinator {
  constructor(private readonly database: RacerDb, private readonly accountSeed: string, private readonly schedule: () => void,
    private readonly enabled: boolean = PUZZLES_RELEASE_ENABLED, private readonly afterWrite: (kind: string) => void = () => {}) {}

  async enqueue(payload: PuzzlePayload, operationId: string, dependencies: string[] = [], now = Date.now()): Promise<PuzzleOperationV1> {
    const operation = await this.database.transaction('rw', puzzleTransactionTables(this.database), async () => {
      return await this.enqueueInTransaction(payload, operationId, dependencies, now)
    })
    await this.afterCommit(); return operation
  }

  /** Host composition: journal/reservation or terminal archive joins these writes. No publication inside a transaction. */
  async enqueueInTransaction(payload: PuzzlePayload, operationId: string, dependencies: string[] = [], now = Date.now()): Promise<PuzzleOperationV1> {
      const existing = await this.database.pendingPuzzleOperations.get(operationId)
      if (existing) {
        if (existing.status !== 'pending') throw new Error(existing.reason ?? 'This saved operation needs recovery')
        if (puzzleCanonical(existing.operation.payload) !== puzzleCanonical(payload) || puzzleCanonical(existing.operation.dependencies) !== puzzleCanonical(dependencies))
          throw new Error('Operation id was reused with a different input')
        return existing.operation
      }
      const accepted = await this.database.puzzleOperations.get(operationId)
      if (accepted) {
        if (puzzleCanonical(accepted.data.operation.payload) !== puzzleCanonical(payload) || puzzleCanonical(accepted.data.operation.dependencies) !== puzzleCanonical(dependencies)) throw new Error('Operation id was reused')
        return accepted.data.operation
      }
      const state = await readState(this.database), pending = await this.database.pendingPuzzleOperations.orderBy('order').toArray()
      // Physical Uma/item versions remain canonical. Use the replay chain's virtual versions for new predictions.
      for (const row of pending.filter(p => p.status === 'pending')) for (const c of row.changes) {
        const physical = state.entities.get(key(c))
        state.entities.set(key(c), restorePuzzleOwnedFields(c.after, physical ?? null))
      }
      if (payload.kind === 'settle') {
        const checkpoint = parsePuzzleCheckpointSave(state.entities.get(`puzzleCheckpoints/${payload.checkpointId}`)?.data)
        if (!checkpoint?.open) throw new Error('No open encounter to settle')
      }
      const provisional = createPuzzleOperation({ schemaVersion: 1, operationId, dependencies, expected: [], payload })
      const refs = puzzleOperationReferences(provisional), extra = payload.kind === 'settle'
        ? parsePuzzleCheckpointSave(state.entities.get(`puzzleCheckpoints/${payload.checkpointId}`)?.data)!.open!.input.entrants.flatMap(e => [`puzzleOutfits/${e.outfitId}`, `umas/${e.outfitId}`]) : []
      const locks = puzzleOutfitCheckpointReferences(payload, [...state.entities.values()].flatMap(row => {
        const party = row.kind === 'puzzlePresets' && !row.deleted ? parsePuzzlePresetSave(row.data) : null
        return party ? [party] : []
      }))
      const expected = [...new Set([...refs.entities, ...extra, ...locks])].map(k => { const [kind, id] = k.split('/'); return { kind: kind!, id: id!, version: state.entities.get(k)?.version ?? 0 } })
      const op = createPuzzleOperation({ schemaVersion: 1, operationId, dependencies, expected, payload })
      const virtualLogs = new Map(state.logs)
      for (const row of pending.filter(p => p.status === 'pending')) virtualLogs.set(`puzzleOperations/${row.id}`, { kind: 'puzzleOperations', id: row.id, data: {}, createdAt: row.queuedAt })
      const projection = resolvePuzzleOperations({ accountSeed: this.accountSeed, enabled: this.enabled, now, entities: state.entities, logs: virtualLogs }, [op]).responses[0]!
      if (projection.status !== 'applied' || !projection.receipt) throw new Error(projection.reason ?? 'Puzzle prediction failed')
      const order = (pending.at(-1)?.order ?? 0) + 1
      if (!Number.isSafeInteger(order)) throw new Error('Puzzle operation order overflow')
      await savePrediction(this.database, { id: operationId, order, operation: op, status: 'pending', changes: [], prediction: projection.receipt, reason: null, queuedAt: now }, projection.receipt, this.afterWrite)
      await this.database.outbox.add({ kind: 'puzzleOperations', id: operationId, op: 'puzzle', queuedAt: now })
      this.afterWrite('outbox')
      return op
  }

  async afterCommit(): Promise<void> { await this.publish(); this.schedule() }

  async nextBatch(): Promise<PuzzleOperationV1[]> {
    const rows = (await this.database.pendingPuzzleOperations.orderBy('order').toArray()).filter(r => r.status === 'pending')
    return partitionPuzzleOperations(rows.map(r => r.operation))[0] ?? []
  }

  /** Write-free host preview, including the pending chain's virtual versions. Caller owns the read transaction. */
  async previewInTransaction(payload: PuzzlePayload, now: number): Promise<PuzzleOperationReceiptV1> {
    const state = await readState(this.database), pending = (await this.database.pendingPuzzleOperations.orderBy('order').toArray()).filter(p => p.status === 'pending')
    for (const row of pending) {
      for (const c of row.changes) state.entities.set(key(c), restorePuzzleOwnedFields(c.after, state.entities.get(key(c)) ?? null))
      state.logs.set(`puzzleOperations/${row.id}`, { kind: 'puzzleOperations', id: row.id, data: {}, createdAt: row.queuedAt })
    }
    // This is an in-memory dry run, not an idempotence lookup for a user-chosen operation id.
    state.logs.delete('puzzleOperations/puzzle-preview')
    const provisional = createPuzzleOperation({ schemaVersion: 1, operationId: 'puzzle-preview', dependencies: [], expected: [], payload })
    const op = createPuzzleOperation({ ...provisional, expected: puzzleOperationReferences(provisional).entities.map(k => {
      const [kind, id] = k.split('/'); return { kind: kind!, id: id!, version: state.entities.get(k)?.version ?? 0 }
    }) })
    const result = resolvePuzzleOperations({ ...state, enabled: this.enabled, accountSeed: this.accountSeed, now }, [op]).responses[0]!
    if (!result.receipt) throw new Error(result.reason ?? 'This material action is unavailable')
    return result.receipt
  }

  async adopt(operations: readonly PuzzleOperationV1[], raw: unknown, now = Date.now(), afterCanonical?: () => Promise<void>): Promise<void> {
    const responses = parsePuzzleOperationResponses(raw, operations)
    if (!responses) throw new Error('Puzzle sync response has missing, duplicated, changed or unknown acknowledgements')
    for (const r of responses) {
      for (const record of [...r.authoritative.flatMap(a => a.record ? [a.record] : []), ...r.receipt?.changes.flatMap(c => c.before ? [c.before, c.after] : [c.after]) ?? []])
        if (!parseEntityData(record.kind as EntityKind, record.data)) throw new Error('Puzzle canonical response contains invalid save data')
      for (const log of r.receipt?.logs ?? []) if (!parseLogData(log.kind as LogKind, log.data)) throw new Error('Puzzle canonical response contains invalid evidence')
    }
    let adjustment: string | null = null
    await this.database.transaction('rw', [...puzzleTransactionTables(this.database), ...['badges', 'cards', 'ledger', 'raceResults', 'flairEvents'].map(k => this.database.table(k))], async () => {
      await undoPending(this.database)
      const pending = await this.database.pendingPuzzleOperations.orderBy('order').toArray(), answered = new Set(responses.map(r => r.operationId))
      const authoritative = new Map<string, PuzzleAuthoritative>()
      for (const response of responses) {
        const row = pending.find(p => p.id === response.operationId)
        if (!row || puzzleCanonical(row.operation) !== puzzleCanonical(operations.find(o => o.operationId === row.id))) throw new Error('Puzzle pending operation changed in flight')
        for (const a of response.authoritative) {
          const previous = authoritative.get(key(a))
          if (previous && puzzleCanonical(previous.record) !== puzzleCanonical(a.record)) throw new Error('Puzzle response disagrees about canonical projections')
          authoritative.set(key(a), a)
        }
        if (response.receipt) {
          await this.database.puzzleOperations.put({ id: row.id, data: response.receipt, createdAt: response.receipt.createdAt })
          for (const l of response.receipt.logs) await logTable(this.database, l.kind).put({ id: l.id, data: l.data, createdAt: l.createdAt })
          // Compare evidence, not total stock: another accepted grant can change stock without changing repayment.
          const movements = (receipt: PuzzleOperationReceiptV1) => receipt.logs.filter(l => l.kind === 'itemLedger').map(l => ({
            itemId: l.data.itemId, delta: l.data.delta, debtPaid: (l.data.source as { debtPaid: number }).debtPaid,
          }))
          const predicted = movements(row.prediction), accepted = movements(response.receipt)
          if (puzzleCanonical(predicted) !== puzzleCanonical(accepted)) adjustment = 'Synced: debt repayment changed the deposited ticket amount. Gross rewards and EXP are unchanged.'
          await this.database.pendingPuzzleOperations.delete(row.id)
        } else {
          await this.database.pendingPuzzleOperations.put({ ...row, status: response.status === 'blocked' ? 'blocked' : 'rejected', reason: response.reason })
          await this.database.puzzleArchives.put({ id: `operation:${row.id}`, reason: response.reason ?? 'Conflict', data: row, createdAt: now })
        }
        await this.database.outbox.where('[kind+id]').equals(['puzzleOperations', row.id]).delete()
      }
      for (const a of authoritative.values()) {
        await putEntity(this.database, a.record, a.kind, a.id)
        await this.database.puzzleBases.put({ id: key(a), record: a.record })
      }
      await this.replayRemaining(pending.filter(p => !answered.has(p.id)), now)
      if (afterCanonical) await afterCanonical()
    })
    await this.publish()
    if (adjustment) usePuzzleSync.setState({ message: adjustment })
  }

  private async replayRemaining(rows: PendingPuzzleOperationRow[], now: number) {
    const state = await readState(this.database), rejected = new Set((await this.database.pendingPuzzleOperations.toArray()).filter(p => p.status !== 'pending').map(p => p.id))
    for (const row of rows) {
      if (row.status !== 'pending') continue
      const blocked = row.operation.dependencies.some(d => rejected.has(d))
      const response = blocked ? null : resolvePuzzleOperations({ accountSeed: this.accountSeed, enabled: this.enabled, now, ...state }, [row.operation]).responses[0]!
      if (response?.receipt && response.status === 'applied') {
        await savePrediction(this.database, row, response.receipt)
        for (const c of response.receipt.changes) state.entities.set(key(c), c.after)
        state.logs.set(`puzzleOperations/${row.id}`, { kind: 'puzzleOperations', id: row.id, data: puzzleData(response.receipt), createdAt: now })
      } else {
        const reason = blocked ? 'A required operation was rejected; review this saved input before retrying.' : response?.reason ?? 'Prediction is no longer valid'
        rejected.add(row.id)
        await this.database.pendingPuzzleOperations.put({ ...row, status: blocked ? 'blocked' : 'rejected', reason })
        await this.database.puzzleArchives.put({ id: `operation:${row.id}`, reason, data: row, createdAt: now })
        await this.database.outbox.where('[kind+id]').equals(['puzzleOperations', row.id]).delete()
      }
    }
    // Bases remain only while an unresolved prediction owns them. Diagnostic inputs remain separately.
    const alive = (await this.database.pendingPuzzleOperations.toArray()).filter(p => p.status === 'pending'), needed = new Set(alive.flatMap(p => p.changes.map(key)))
    for (const base of await this.database.puzzleBases.toArray()) if (!needed.has(base.id)) await this.database.puzzleBases.delete(base.id)
  }

  /** Snapshot adoption preserves/replays pending work; no gesture/journal data enters the cloud snapshot. */
  async adoptSnapshot(entities: readonly PuzzleStoredEntity[], logs: readonly PuzzleStoredLog[], now: number): Promise<void> {
    await this.database.transaction('rw', puzzleTransactionTables(this.database), async () => { await this.adoptSnapshotInTransaction(entities, logs, now) })
    await this.refreshStatus()
  }
  async adoptSnapshotInTransaction(entities: readonly PuzzleStoredEntity[], logs: readonly PuzzleStoredLog[], now: number): Promise<void> {
      await undoPending(this.database)
      for (const row of entities) {
        await putEntity(this.database, row, row.kind, row.id)
        await this.database.puzzleBases.put({ id: key(row), record: row })
      }
      for (const row of logs) await logTable(this.database, row.kind).put({ id: row.id, data: row.data, createdAt: row.createdAt })
      const pending = await this.database.pendingPuzzleOperations.orderBy('order').toArray()
      const remaining: PendingPuzzleOperationRow[] = []
      for (const row of pending) {
        const receipt = await this.database.puzzleOperations.get(row.id)
        if (receipt) {
          if (puzzleCanonical(receipt.data.operation) !== puzzleCanonical(row.operation)) throw new Error('Snapshot operation payload differs from this device')
          await this.database.pendingPuzzleOperations.delete(row.id)
          await this.database.outbox.where('[kind+id]').equals(['puzzleOperations', row.id]).delete()
        } else remaining.push(row)
      }
      await this.replayRemaining(remaining, now)
  }
  async refreshStatus() { await this.publish() }
  /** Inside the ordinary sync transaction: repair canonical rows first, then replay economic previews. */
  async reconcileOrdinaryInTransaction(apply: () => Promise<void>, now: number): Promise<void> {
    if (!await this.database.pendingPuzzleOperations.where('status').equals('pending').count()) { await apply(); return }
    await undoPending(this.database)
    await apply()
    for (const base of await this.database.puzzleBases.toArray()) {
      const [kind, id] = base.id.split('/')
      if (kind === 'umas' || kind === 'items') await this.database.puzzleBases.put({ id: base.id, record: await readEntity(this.database, kind, id!) })
    }
    await this.replayRemaining(await this.database.pendingPuzzleOperations.orderBy('order').toArray(), now)
  }
  private async publish() {
    const rows = await this.database.pendingPuzzleOperations.toArray(), recovery = rows.filter(r => r.status !== 'pending')
    usePuzzleSync.setState({ pending: rows.filter(r => r.status === 'pending').length, recoveryIds: recovery.map(r => r.id),
      ...(recovery.length ? { message: `A Puzzle change needs review: ${recovery[0]!.reason}. Your input and builds are saved for recovery.` } : {}) })
  }
}

/** Ordinary Racing saves must send canonical CL, never a pending economic preview. */
export async function canonicalPuzzleUmaForSync(database: RacerDb, id: string, data: Record<string, unknown>) {
  const base = await database.puzzleBases.get(`umas/${id}`)
  return base?.record ? restorePuzzleOwnedFields(base.record, { ...base.record, data }).data : data
}
/** A newer local Racing edit keeps its payload, but must still adopt receipt-owned fields from a stale-write reply. */
export async function adoptPuzzleUmaVersion(database: RacerDb, record: PuzzleStoredEntity): Promise<void> {
  const row = await database.umas.get(record.id)
  if (!row) return
  const active = parseConstellationBankSave((await database.constellationBank.get('main'))?.data)?.phase === 'active'
  const parsed = active ? parseEntityData('umas', restorePuzzleOwnedFields(record, { ...record, data: row.data as unknown as Record<string, unknown> }).data) : null
  if (active && !parsed) throw new Error('Canonical CL response is invalid; keep the local build for recovery')
  await database.umas.put({ ...row, version: record.version, ...(parsed ? { data: parsed as unknown as typeof row.data } : {}) })
}
export async function puzzleOrdinaryProtected(database: RacerDb, kind: string, id: string): Promise<boolean> {
  return kind === 'items' && (id.startsWith('constellation:') || id === 'training:level-up-ticket' &&
    parseConstellationBankSave((await database.constellationBank.get('main'))?.data)?.phase === 'active')
}
