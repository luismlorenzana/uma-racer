// Startup cutover orchestration; each protected acknowledgement lands atomically, never a locally guessed migration.
import { parseSaveSnapshotOrThrow, parseConstellationBankSave, parseLegacySparkProof, parsePlayerProfileOrThrow, parseUmaSaveOrThrow,
  legacySparkReceiptId, parsePuzzlePreservationRecord, SAVE_ID_PATTERN, type LegacySparkRequest, type LegacySparkResponse,
  type PuzzlePreservationRequest, type PuzzlePreservationResponse, type PuzzlePreservationSummary, type PlayerProfile } from '@racer/domain'
import { RacerDb, type MinigameRunRow, type VersionedRow } from '../db'
import { restorePuzzleOwnedFields } from './operations'
import { PUZZLES_RELEASE_ENABLED } from './capability'
import { usePuzzlePreparation } from './preparation-store'
import { retainPuzzleBackup } from './backup'
export interface PuzzlePreparationPorts {
  prepare: (request: PuzzlePreservationRequest) => Promise<unknown>; retire: (request: LegacySparkRequest) => Promise<unknown>;
  verifyReplacement: () => Promise<void>; commitTerminal: (run: MinigameRunRow) => Promise<void>;
  snapshot: () => Promise<unknown>;
  publish: () => Promise<void>; schedule: () => void; current?: () => boolean; today: () => string
}
const phases = ['disabled', 'preview', 'preparing', 'active', 'recoverable-error']
function parseSummary(v: unknown): PuzzlePreservationSummary | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const s = v as Record<string, unknown>
  if (Object.keys(s).sort().join() !== ['units', 'completed', 'debt', 'rawExp', 'originalStock', 'credited', 'stockAfter'].sort().join() ||
    ![s.units, s.completed, s.rawExp, s.originalStock, s.credited, s.stockAfter].every(n => Number.isSafeInteger(n) && (n as number) >= 0) ||
    (s.completed as number) > (s.units as number) || s.credited !== Math.ceil((s.rawExp as number) / 1250) ||
    s.stockAfter !== (s.originalStock as number) + (s.credited as number) || !s.debt || typeof s.debt !== 'object' || Array.isArray(s.debt) ||
    Object.values(s.debt).some(n => !Number.isSafeInteger(n) || (n as number) < 0)) return null
  return structuredClone(v) as PuzzlePreservationSummary
}
function parseAck(v: unknown, legacy = false): PuzzlePreservationResponse | LegacySparkResponse {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Preparation acknowledgement is malformed; keep the save')
  const r = v as Record<string, unknown>, allowed = legacy ? ['disabled', 'committed', 'refunded', 'recoverable-error'] : phases
  if (!allowed.includes(r.status as string) || !(r.message === null || typeof r.message === 'string')) throw new Error('Invalid preparation status')
  const snapshot = parseSaveSnapshotOrThrow({ serverTime: 0, entities: r.entities, logs: r.logs })
  const allowedEntities = legacy ? ['profile', 'puzzlePreservation'] : ['profile', 'umas', 'items', 'constellationBank', 'puzzlePreservation', 'puzzleCohort']
  if (snapshot.entities.some(e => e.deleted || !allowedEntities.includes(e.kind) || e.kind === 'items' && e.id !== 'training:level-up-ticket') ||
    snapshot.logs.some(l => l.kind !== (legacy ? 'ledger' : 'itemLedger'))) throw new Error('Preparation acknowledgement includes unrelated rows')
  if (legacy) return { status: r.status, message: r.message, entities: snapshot.entities, logs: snapshot.logs } as LegacySparkResponse
  const summary = r.summary === null ? null : parseSummary(r.summary)
  if (r.summary !== null && !summary || ['preview', 'preparing', 'active'].includes(r.status as string) && !summary) throw new Error('Invalid preservation preview')
  return { status: r.status, message: r.message, summary, entities: snapshot.entities, logs: snapshot.logs } as PuzzlePreservationResponse
}
export function legacyProof(run: MinigameRunRow) {
  if (run.kind !== 'spark-match' || run.target.kind !== 'spark-match') return null
  return parseLegacySparkProof({ id: run.id, outfitId: run.target.umaId, tier: run.tier, attemptIndex: run.attemptIndex,
    seed: run.seed, snapshot: run.snapshot, journal: run.journal })
}
async function adopt(database: RacerDb, ack: PuzzlePreservationResponse | LegacySparkResponse, beforeProfile: PlayerProfile | null, current: () => boolean) {
  const kinds = [...new Set([...ack.entities.map(e => e.kind), ...ack.logs.map(l => l.kind), 'outbox', 'umas'])]
  await database.transaction('rw', kinds.map(k => database.table(k)), async () => {
    if (!current()) return
    for (const row of ack.entities) {
      const table = database.table<VersionedRow<Record<string, unknown>>, string>(row.kind), local = await table.get(row.id)
      if (local && local.version > row.version) continue
      let data = row.data
      if (row.kind === 'umas' && local) data = restorePuzzleOwnedFields(row, { ...row, version: local.version, data: local.data }).data
      if (row.kind === 'profile' && local && beforeProfile) {
        const incoming = parsePlayerProfileOrThrow(row.data), physical = parsePlayerProfileOrThrow(local.data)
        const tickets = physical.tickets + incoming.tickets - beforeProfile.tickets
        if (!Number.isSafeInteger(tickets) || tickets < 0) throw new Error('Concurrent ticket edits need sync; keep the preparation receipts')
        data = { ...physical, schemaVersion: incoming.schemaVersion, trainingExpBank: incoming.trainingExpBank, tickets }
      }
      await table.put({ id: row.id, version: row.version, data })
    }
    for (const row of ack.logs) await database.table(row.kind).put({ id: row.id, data: row.data, createdAt: row.createdAt })
    if (ack.status === 'active') for (const row of await database.umas.toArray()) if (row.data.schemaVersion === 15) {
      const data = parseUmaSaveOrThrow({ ...row.data, schemaVersion: 16 })
      await database.umas.put({ ...row, data })
      await database.outbox.where('[kind+id]').equals(['umas', row.id]).delete()
      await database.outbox.add({ kind: 'umas', id: row.id, op: 'upsert', queuedAt: Date.now() })
    }
  })
}
/** One bounded request/batch per idle flush. The off flag returns before reading any table or invoking any port. */
export async function preparePuzzlesOnce(database: RacerDb, ports: PuzzlePreparationPorts, enabled = PUZZLES_RELEASE_ENABLED): Promise<boolean> {
  const current = ports.current ?? (() => true)
  if (!enabled || !current() || usePuzzlePreparation.getState().busy) return false
  if (!navigator.onLine || await database.outbox.count() || await database.pendingRpgCommands.count() || await database.pendingPuzzleOperations.count()) {
    usePuzzlePreparation.setState({ phase: 'needs-sync', message: 'Connect and finish syncing before preparing. Existing progress is kept.', busy: false }); return false
  }
  usePuzzlePreparation.setState({ busy: true })
  try {
    await ports.verifyReplacement()
    if (!current()) return false
    const bank = parseConstellationBankSave((await database.constellationBank.get('main'))?.data)
    if (!bank && !await retainPuzzleBackup(database, ports.snapshot, current)) return false
    const runs = (await database.minigameRuns.toArray()).filter(r => r.kind === 'spark-match')
    // A terminal open run is committed through the old replay host, then its ordinary writes drain BEFORE freeze.
    for (const run of runs.filter(r => r.status === 'open')) {
      const proof = legacyProof(run)
      if (!proof) throw new Error('A saved Spark journal is malformed or predates the supported replay. Keep it; resume/recover it before preparing.')
      const { replaySparkRival } = await import('@racer/domain')
      if (replaySparkRival(proof.snapshot.encounter, proof.seed, proof.journal.actions).outcome) {
        if (bank) throw new Error('Another device has a pending terminal Spark result after freeze. Keep its journal; request forward recovery, never a refund plus EXP.')
        await ports.commitTerminal(run)
        usePuzzlePreparation.setState({ phase: 'needs-sync', message: 'The finished Spark result was saved. Sync it before freezing the cohort.' })
        await ports.publish(); ports.schedule(); return true
      }
    }
    for (const run of runs) {
      const proof = legacyProof(run)
      if (run.status === 'completed' && (!proof || bank)) continue // Historical older engines/rewards stay intact.
      if (!proof) throw new Error('Keep the unknown Spark row for explicit recovery')
      if (await database.puzzlePreservation.get(legacySparkReceiptId(run.id))) continue
      const before = (await database.profile.get('main'))?.data ?? null
      const request: LegacySparkRequest = { schemaVersion: 1, disposition: run.status === 'completed' ? 'committed' : 'unfinished', localDay: ports.today(), run: proof }
      const ack = parseAck(await ports.retire(request), true) as LegacySparkResponse
      if (!current()) return false
      if (ack.status === 'recoverable-error' || ack.status === 'disabled') throw new Error(ack.message ?? 'Replacement release is unavailable; no local refund was invented')
      const receipt = ack.entities.find(r => r.kind === 'puzzlePreservation' && r.id === legacySparkReceiptId(run.id)), parsed = receipt && parsePuzzlePreservationRecord(receipt.data)
      if (!parsed || parsed.type !== 'spark' || parsed.runId !== run.id || parsed.disposition !== ack.status) throw new Error('Missing stable Spark retirement receipt')
      await database.transaction('rw', [database.profile, database.puzzlePreservation, database.ledger, database.outbox, database.minigameRuns, database.umas], async () => {
        await adopt(database, ack, before, current)
        if (run.status === 'open' && current()) await database.minigameRuns.put({ ...run, status: 'completed', outcome: run.outcome,
          reward: { ticketsSpent: 0 }, completedAt: receipt!.updatedAt })
      })
      await ports.publish(); ports.schedule(); return true
    }
    if (bank?.phase === 'active') {
      // Future units created while preparing are excluded from debt; stamp their zero-EXP storage explicitly.
      await database.transaction('rw', [database.umas, database.outbox], async () => {
        for (const row of await database.umas.toArray()) if (row.data.schemaVersion === 15) {
          const data = parseUmaSaveOrThrow({ ...row.data, schemaVersion: 16 })
          await database.umas.put({ ...row, data })
          await database.outbox.where('[kind+id]').equals(['umas', row.id]).delete()
          await database.outbox.add({ kind: 'umas', id: row.id, op: 'upsert', queuedAt: Date.now() })
        }
      })
      const header = (await database.puzzlePreservation.get('main'))?.data
      if (header?.type !== 'header' || header.phase !== 'active' || !header.receipt) throw new Error('Active preservation receipt is missing; keep the save')
      usePuzzlePreparation.setState({ phase: 'active', message: null, preview: false, summary: { units: header.unitCount, completed: header.cursor,
        debt: bank.debitLimits, rawExp: header.receipt.rawExp, originalStock: header.originalStock, credited: header.receipt.credited, stockAfter: header.receipt.stockAfter } }); return false
    }
    const profile = (await database.profile.get('main'))?.data ?? null
    if (!profile) throw new Error('Sync the authoritative profile before preparation')
    const saved = (await database.puzzlePreservation.get('main'))?.data
    const cutoverId = saved && 'cutoverId' in saved ? saved.cutoverId : `puzzles-preserve-${profile.createdAt}`
    if (!SAVE_ID_PATTERN.test(cutoverId)) throw new Error('Invalid stable cutover identity')
    const action = !bank && !usePuzzlePreparation.getState().preview ? 'preview' : 'advance'
    const request: PuzzlePreservationRequest = { schemaVersion: 2, cutoverId, expectedBankRevision: bank?.revision ?? 0, action }
    let ack = parseAck(await ports.prepare(request)) as PuzzlePreservationResponse
    if (!current()) return false
    if (ack.status === 'disabled' || ack.status === 'recoverable-error') throw new Error(ack.message ?? 'Replacement release is unavailable; progress was not changed')
    if (ack.status !== 'preview') {
      const acceptedBank = parseConstellationBankSave(ack.entities.find(e => e.kind === 'constellationBank')?.data)
      if (!acceptedBank || acceptedBank.cutoverId !== cutoverId || acceptedBank.phase !== ack.status) throw new Error('Preparation acknowledgement has no matching bank')
      // A stale revision returns header/bank, not all already applied units. Reconcile only preservation-owned
      // fields from canonical save, never invoke the destructive full initial-snapshot adoption path.
      if (acceptedBank.revision !== request.expectedBankRevision + (bank ? 1 : 0) || ack.status === 'active' && !ack.entities.some(e => e.kind === 'profile') ||
        bank && ack.status === 'preparing' && !ack.entities.some(e => e.kind === 'umas')) {
        const snapshot = parseSaveSnapshotOrThrow(await ports.snapshot()), canonicalBank = parseConstellationBankSave(snapshot.entities.find(e => e.kind === 'constellationBank')?.data)
        if (!canonicalBank || canonicalBank.cutoverId !== cutoverId || canonicalBank.revision < acceptedBank.revision) throw new Error('Canonical preservation is stale; keep receipts and retry')
        ack = parseAck({ ...ack, status: canonicalBank.phase, summary: { ...ack.summary!, completed: canonicalBank.completedCount },
          entities: snapshot.entities.filter(e => ['profile', 'umas', 'constellationBank', 'puzzlePreservation', 'puzzleCohort'].includes(e.kind) || e.kind === 'items' && e.id === 'training:level-up-ticket'),
          logs: snapshot.logs.filter(l => l.kind === 'itemLedger' && l.id === `puzzle-preservation:${cutoverId}`) }) as PuzzlePreservationResponse
        if (!current()) return false
      }
      await adopt(database, ack, profile, current)
    }
    usePuzzlePreparation.setState({ phase: ack.status === 'active' ? 'active' : 'preparing', summary: ack.summary,
      message: ack.status === 'preview' ? 'Preservation preview verified. Next, freeze this authoritative cohort.' : null, preview: ack.status === 'preview' })
    await ports.publish(); ports.schedule(); return true
  } catch (error) {
    if (current()) usePuzzlePreparation.setState({ phase: 'recoverable-error', message: error instanceof Error ? error.message : 'Keep the save and retry preparation' })
    return false
  } finally { usePuzzlePreparation.setState({ busy: false }) }
}
