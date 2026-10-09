// Lazy protected orchestration/recovery port. T121 wires it; T124 alone enables it. No normal startup caller.
import { parseSaveSnapshotOrThrow, parseEntityData, parseUmaSaveOrThrow, type EntityKind, type SaveSnapshot } from '@racer/domain'
import { FARM_CUTOVER_GENERATION, FARM_ENTITY_KINDS, farmCanonical, farmCutoverControl, clearFarmRetiredExtra,
  parseFarmCutoverControl, parseFarmCutoverResponse, farmCutoverReceiptId, farmData, type FarmCutoverRequest,
  parseFarmCutoverRequest, farmRecord, type FarmCutoverResponse } from '@racer/domain/farm/kitchen'
import type { RacerDb, FarmCanonicalRow } from '../../db'
import { FARM_KITCHEN_RELEASE_ENABLED } from './capability'
import { farmArchiveProof, retainFarmArchive, verifyFarmArchive, exportFarmArchive, FARM_ARCHIVE_REASON } from './backup'
export interface FarmCutoverPorts {
  accountId: string; build: string; persistent: () => boolean; online: () => boolean; safeToPrepare: () => boolean; current: () => boolean;
  snapshot: () => Promise<unknown>; prepare: (request: FarmCutoverRequest) => Promise<unknown>; publish: () => Promise<void>
}
export interface FarmCutoverRecovery {
  phase: 'needs-sync' | 'preparing' | 'resetting' | 'active' | 'recoverable-error'; message: string | null;
  request: FarmCutoverRequest | null; archiveId: string | null
}
const RECOVERY_ID = 'farm-cutover-recovery-v1'
const inFlight = new WeakSet<RacerDb>()
export async function readFarmCutoverRecovery(db: RacerDb): Promise<FarmCutoverRecovery | null> {
  const row = await db.farmRecovery.get(RECOVERY_ID)
  if (!row) return null
  const v = row.data
  if (!farmRecord(v) || Object.keys(v).sort().join() !== 'archiveId,message,phase,request' ||
    !['needs-sync', 'preparing', 'resetting', 'active', 'recoverable-error'].includes(String(v.phase)) ||
    !(v.message === null || typeof v.message === 'string') || !(v.archiveId === null || typeof v.archiveId === 'string' && /^farm-archive:[a-f0-9]{64}$/.test(v.archiveId)) ||
    v.request !== null && !parseFarmCutoverRequest(v.request)) throw new Error('Malformed Farm recovery state; Export, never discard it')
  return structuredClone(v) as unknown as FarmCutoverRecovery
}
export async function exportFarmCutoverRecovery(db: RacerDb, accountId: string): Promise<void> {
  const state = await readFarmCutoverRecovery(db), profile = await db.profile.get('main')
  if (!state?.archiveId || !profile) throw new Error('No Farm archive here; use the preparation device')
  await exportFarmArchive(db, state.archiveId, accountId, profile.data.createdAt)
}
const cutoverTables = (db: RacerDb) => ['umas', 'farm', ...FARM_ENTITY_KINDS, 'farmOperations', 'farmRecovery', 'outbox'].map(k => db.table(k))
/** Patch only reset-owned fields; a newer local race/preset edit never becomes an older server object. */
export async function adoptFarmCutoverInTransaction(db: RacerDb, ack: FarmCutoverResponse, afterWrite: (key: string) => void = () => {}) {
  for (const r of ack.entities) {
    if (!parseEntityData(r.kind as EntityKind, r.data) || r.deleted || !['umas', 'farm', ...FARM_ENTITY_KINDS].includes(r.kind))
      throw new Error('Invalid/unrelated Farm reset acknowledgement; preserve for recovery')
    const table = db.table<FarmCanonicalRow, string>(r.kind), local = await table.get(r.id)
    if (r.kind === 'umas') {
      const queued = await db.outbox.where('[kind+id]').equals(['umas', r.id]).count()
      const data = local && (queued || local.version > r.version) ? clearFarmRetiredExtra(local.data) : r.data
      await db.umas.put({ id: r.id, data: parseUmaSaveOrThrow(data), version: Math.max(local?.version ?? 0, r.version) })
      if (local && (queued || local.version > r.version) && farmCanonical(data) !== farmCanonical(r.data) && !queued)
        await db.outbox.add({ kind: 'umas', id: r.id, op: 'upsert', queuedAt: r.updatedAt })
    } else {
      if (local && local.version > r.version) continue
      if (local?.version === r.version && farmCanonical(local.data) !== farmCanonical(r.data)) throw new Error('Farm reset canonical version diverged; export and retry')
      await table.put({ id: r.id, data: r.data, version: r.version, updatedAt: r.updatedAt, deleted: r.deleted,
        ...(r.kind === 'farm' ? { revision: r.version } : {}) })
    }
    afterWrite(`${r.kind}/${r.id}`)
  }
  if (ack.receipt) {
    const r = ack.receipt, id = farmCutoverReceiptId(r.generation, r.action, r.index), old = await db.farmOperations.get(id)
    if (old && farmCanonical(old.data) !== farmCanonical(r)) throw new Error('Immutable Farm reset evidence changed; keep archive')
    await db.farmOperations.put({ id, data: farmData(r), createdAt: r.createdAt }); afterWrite(id)
  }
}
/** Full pulls use the control/step evidence to clear only outfits whose authoritative reset already happened. */
export async function adoptFarmResetSnapshotInTransaction(db: RacerDb, snapshot: SaveSnapshot) {
  const incoming = farmCutoverControl(new Map(snapshot.entities.map(r => [`${r.kind}/${r.id}`, r])))
  const local = parseFarmCutoverControl((await db.farmCutover.get('main'))?.data)
  const control = incoming ?? local
  if (!control) return
  if (local && incoming && local.generation !== incoming.generation) throw new Error('Farm generation changed; export and recover')
  const resetIds = new Set(snapshot.logs.filter(l => l.kind === 'farmOperations' && l.data.type === 'cutover' &&
    l.data.action === 'advance' && l.data.generation === control.generation).map(l => String(l.data.outfitId)))
  for (const row of await db.umas.toArray()) if (control.phase === 'active' || local?.phase === 'active' || resetIds.has(row.id)) {
    const canonical = snapshot.entities.find(r => r.kind === 'umas' && r.id === row.id && !r.deleted)
    const queued = await db.outbox.where('[kind+id]').equals(['umas', row.id]).count()
    const data = clearFarmRetiredExtra(canonical && !queued && canonical.version >= row.version ? canonical.data : farmData(row.data))
    if (farmCanonical(data) !== farmCanonical(row.data) || canonical && canonical.version > row.version)
      await db.umas.put({ ...row, version: Math.max(row.version, canonical?.version ?? 0), data: parseUmaSaveOrThrow(data) })
  }
}
async function queuesDrained(db: RacerDb): Promise<boolean> {
  return !await db.outbox.count() && !await db.pendingRpgCommands.count() && !await db.pendingPuzzleOperations.count() && !await db.farmPending.count()
}
/** One durable request per idle call. Retry resumes its exact target; it never refreezes or discards failed intent. */
export async function prepareFarmCutoverOnce(db: RacerDb, ports: FarmCutoverPorts, enabled = FARM_KITCHEN_RELEASE_ENABLED, now = Date.now()): Promise<boolean> {
  if (!enabled || !ports.current() || inFlight.has(db)) return false // Off means zero storage/port access.
  inFlight.add(db)
  let validRecovery = false, state: FarmCutoverRecovery = { phase: 'needs-sync', message: null, request: null, archiveId: null }
  const save = async () => db.farmRecovery.put({ id: RECOVERY_ID, reason: 'Farm cutover status: Retry/Export, never auto-restore', data: state, createdAt: now })
  try {
    state = await readFarmCutoverRecovery(db) ?? state; validRecovery = true
    if (!ports.persistent() || !ports.online() || !ports.safeToPrepare() || !await queuesDrained(db)) {
      state = { ...state, phase: 'needs-sync', message: 'Connect, retain persistent storage and finish pending commits/sync before Farm preparation' }
      await save(); return false
    }
    const snapshot = parseSaveSnapshotOrThrow(await ports.snapshot())
    if (!ports.current()) return false
    const control = farmCutoverControl(new Map(snapshot.entities.map(r => [`${r.kind}/${r.id}`, r])))
    let request = state.request
    if (control) {
      // A new device adopts server-owned progress; it never captures a replacement pre-reset archive or prepares again.
      if (!request || request.generation !== control.generation || request.action === 'prepare') request = control.phase === 'active'
        ? { schemaVersion: 1, generation: control.generation, action: 'status' }
        : control.nextOutfitIndex < control.outfitCount ? { schemaVersion: 1, generation: control.generation, action: 'advance', index: control.nextOutfitIndex }
          : (() => { const index = Array.from({ length: control.pageCount }, (_, i) => i).find(i => !snapshot.logs.some(l =>
            l.kind === 'farmOperations' && l.id === farmCutoverReceiptId(control.generation, 'verify', i)))
          return index === undefined ? { schemaVersion: 1 as const, generation: control.generation, action: 'finalize' as const }
            : { schemaVersion: 1 as const, generation: control.generation, action: 'verify' as const, index } })()
    } else if (!request || state.phase === 'recoverable-error') {
      const archive = await retainFarmArchive(db, snapshot, ports.accountId, ports.build, ports.current, now)
      state.archiveId = archive.id
      request = { schemaVersion: 1, generation: FARM_CUTOVER_GENERATION, action: 'prepare', archive: await farmArchiveProof(archive.archive) }
    }
    if (!request) throw new Error('Missing durable Farm preparation request; export and recover')
    // Verify original proof every destructive call on the preparation device. Other devices resume the server's frozen cohort.
    if (state.archiveId) {
      const archive = await db.farmRecovery.get(state.archiveId), profile = await db.profile.get('main')
      if (!archive || archive.reason !== FARM_ARCHIVE_REASON || !profile) throw new Error('Farm archive unavailable; use the preparation device')
      const verified = await verifyFarmArchive(archive.data, ports.accountId, profile.data.createdAt)
      if (control && verified.digest !== control.archiveDigest) throw new Error('Farm archive differs from the frozen cohort; no reset requested')
    }
    state.request = request; await save()
    if (!ports.current() || !ports.safeToPrepare() || !await queuesDrained(db)) throw new Error('A commit arrived before preparation; drain sync and retry')
    const ack = parseFarmCutoverResponse(await ports.prepare(request))
    if (!ack || ack.status === 'disabled' || ack.status === 'recoverable-error') throw new Error(ack?.message ?? 'Farm acknowledgement unavailable; retain exact request for Retry')
    if (!ports.current()) return false
    const accepted = parseFarmCutoverControl(ack.entities.find(r => r.kind === 'farmCutover')?.data)
    if (!accepted || accepted.generation !== request.generation) throw new Error('Farm acknowledgement generation mismatch')
    await db.transaction('rw', cutoverTables(db), async () => {
      await adoptFarmCutoverInTransaction(db, ack)
      await adoptFarmResetSnapshotInTransaction(db, snapshot)
      state = { ...state, phase: accepted.phase, message: null, request: null }; await save()
    })
    // A lost step response returns its original receipt, not stale full objects. Adopt canonical Farm-only fields from the next pull.
    const latest = parseSaveSnapshotOrThrow(await ports.snapshot())
    if (!ports.current()) return false
    await db.transaction('rw', cutoverTables(db), async () => {
      if (!ports.current()) return
      const rows = latest.entities.filter(r => r.kind === 'farmCutover' || FARM_ENTITY_KINDS.includes(r.kind as never) || r.kind === 'farm' && r.data.schemaVersion === 3)
      const c = farmCutoverControl(new Map(rows.map(r => [`${r.kind}/${r.id}`, r])))
      if (!c) throw new Error('Canonical Farm control is missing; Retry/Export')
      // Snapshot sets are intentionally not bounded per-response; adopt validated rows individually.
      for (const row of rows) await adoptFarmCutoverInTransaction(db, { status: c.phase, message: null, entities: [row], receipt: null })
      await adoptFarmResetSnapshotInTransaction(db, latest)
    })
    await ports.publish(); return true
  } catch (error) {
    if (validRecovery && ports.current()) {
      state = { ...state, phase: 'recoverable-error', message: error instanceof Error ? error.message : 'Keep the Farm archive and Retry/Export' }
      try { await save() } catch { throw new Error('Farm recovery status could not be stored. Keep this device; no unverified reset was requested. Export recovery and free storage.') }
    }
    return false
  } finally { inFlight.delete(db) }
}
