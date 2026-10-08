// Frozen Spark journal validation and exact-once daily-ticket refund (D177; implementation §8).
import { parseSparkRivalActions, parseSparkRivalEncounter, type SparkRivalAction, type SparkRivalEncounterV1 } from '../spark-rival/types'
import { replaySparkRival } from '../spark-rival/engine'
import { puzzleCanonical, puzzlePayloadHash, type PuzzleStoredEntity, type PuzzleStoredLog } from './records'
import { parsePuzzlePreservationRecord, type PuzzleSparkRetirementReceipt } from './preservation-records'
import { puzzleExact, puzzleId, puzzleInteger, puzzleRecord, requirePuzzle } from './validation'
export interface LegacySparkProof {
  id: string; outfitId: string; tier: number; attemptIndex: number; seed: string;
  snapshot: { version: 1; contentVersion: string; source: 'authored' | 'fallback'; encounter: SparkRivalEncounterV1 };
  journal: { format: 1; engine: 'spark-rival-v1'; actions: SparkRivalAction[] }
}
export interface LegacySparkRequest { schemaVersion: 1; disposition: 'committed' | 'unfinished'; localDay: string; run: LegacySparkProof }
export interface LegacySparkResponse { status: 'disabled' | 'committed' | 'refunded' | 'recoverable-error'; message: string | null;
  entities: PuzzleStoredEntity[]; logs: PuzzleStoredLog[] }
export const legacySparkReceiptId = (runId: string) => `spark:${puzzlePayloadHash(runId)}`
export function legacySparkSeed(createdAt: number, run: Pick<LegacySparkProof, 'outfitId' | 'tier' | 'attemptIndex' | 'snapshot'>): string {
  let hash = 0x811c9dc5
  const text = `${createdAt}:${run.snapshot.contentVersion}:spark-match:${run.outfitId}:${run.tier}:${run.attemptIndex}`
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  return String((hash >>> 0) || 1)
}
export function parseLegacySparkProof(v: unknown): LegacySparkProof | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['id', 'outfitId', 'tier', 'attemptIndex', 'seed', 'snapshot', 'journal']) ||
    !puzzleId(v.id) || !puzzleId(`${v.id}:refund`) || !puzzleId(v.outfitId) || !puzzleInteger(v.tier, 1, 14) || !puzzleInteger(v.attemptIndex) ||
    v.id !== `spark-match:${v.outfitId}:${v.tier}:${v.attemptIndex}` || !puzzleId(v.seed) || !puzzleRecord(v.snapshot) ||
    !puzzleExact(v.snapshot, ['version', 'contentVersion', 'source', 'encounter']) || v.snapshot.version !== 1 || !puzzleId(v.snapshot.contentVersion) ||
    !['authored', 'fallback'].includes(v.snapshot.source as string) || !puzzleRecord(v.journal) ||
    !puzzleExact(v.journal, ['format', 'engine', 'actions']) || v.journal.format !== 1 || v.journal.engine !== 'spark-rival-v1') return null
  const encounter = parseSparkRivalEncounter(v.snapshot.encounter), actions = parseSparkRivalActions(v.journal.actions)
  if (!encounter || !actions || encounter.scenarioTier !== v.tier || encounter.trainee.templateId !== v.outfitId) return null
  try { replaySparkRival(encounter, v.seed, actions) } catch { return null }
  return structuredClone(v) as unknown as LegacySparkProof
}
export function parseLegacySparkRequest(v: unknown): LegacySparkRequest | null {
  if (!puzzleRecord(v) || !puzzleExact(v, ['schemaVersion', 'disposition', 'localDay', 'run']) || v.schemaVersion !== 1 ||
    !['committed', 'unfinished'].includes(v.disposition as string) || typeof v.localDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.localDay)) return null
  const run = parseLegacySparkProof(v.run)
  if (!run) return null
  const terminal = replaySparkRival(run.snapshot.encounter, run.seed, run.journal.actions).outcome !== null
  if (terminal !== (v.disposition === 'committed')) return null
  return { schemaVersion: 1, disposition: v.disposition as LegacySparkRequest['disposition'], localDay: v.localDay, run }
}
export function resolveLegacySpark(request: LegacySparkRequest, entities: ReadonlyMap<string, PuzzleStoredEntity>,
  logs: ReadonlyMap<string, PuzzleStoredLog>, now: number) {
  requirePuzzle(parseLegacySparkRequest(request), 'invalid', 'Saved Spark run needs recovery; never infer a refund or EXP from malformed evidence')
  const id = legacySparkReceiptId(request.run.id), old = entities.get(`puzzlePreservation/${id}`), parsed = old && parsePuzzlePreservationRecord(old.data)
  const writes: PuzzleStoredEntity[] = [], appends: PuzzleStoredLog[] = []
  if (old) {
    requirePuzzle(!old.deleted && parsed?.type === 'spark' && parsed.runId === request.run.id, 'invalid', 'Legacy run receipt identity needs recovery')
    // A committed receipt is decisive even if another device has an earlier unfinished journal for this id.
    const original = parseLegacySparkProof(JSON.parse(parsed.proof) as unknown)
    requirePuzzle(original && puzzleCanonical({ ...original, journal: null }) === puzzleCanonical({ ...request.run, journal: null }),
      'invalid', 'Run identity/seed/encounter changed; keep the journal for recovery')
    requirePuzzle(parsed.disposition === 'committed' || request.disposition === 'unfinished',
      'invalid', 'Never apply EXP for a refunded run; keep both journals for recovery')
    return { writes, appends, response: { status: parsed.disposition, message: null,
      entities: [old, ...(entities.has('profile/main') ? [entities.get('profile/main')!] : [])],
      logs: logs.has(`ledger/${parsed.refundId}`) ? [logs.get(`ledger/${parsed.refundId}`)!] : [] } as LegacySparkResponse }
  }
  const paid = logs.get(`ledger/${request.run.id}`), profile = entities.get('profile/main'), refundId = `${request.run.id}:refund`, refunded = logs.get(`ledger/${refundId}`)
  requirePuzzle(paid && paid.data.resource === 'tickets' && paid.data.reason === 'training' && puzzleInteger(paid.data.delta, -15, -1),
    'invalid', 'Sync the original paid reservation before resolving this Spark run')
  requirePuzzle(profile && !profile.deleted && puzzleInteger(profile.data.tickets), 'invalid', 'Keep the save: ticket profile needs recovery')
  requirePuzzle(puzzleInteger(profile.data.createdAt) && request.run.seed === legacySparkSeed(profile.data.createdAt, request.run),
    'invalid', 'The original save-derived Spark seed does not match; keep this row for recovery')
  if (request.disposition === 'committed') requirePuzzle(!entities.has('constellationBank/main') && !refunded,
    'locked', 'Terminal Spark results must be committed and synced before freezing. Another device must recover this journal explicitly.')
  const cost = -(paid.data.delta as number), amount = request.disposition === 'unfinished' ? cost : 0
  if (refunded) requirePuzzle(refunded.data.resource === 'tickets' && refunded.data.reason === 'minigame-refund' && refunded.data.delta === cost,
    'invalid', 'Original refund evidence is inconsistent; do not issue another refund')
  if (amount && !refunded) {
    const tickets = (profile.data.tickets as number) + amount
    requirePuzzle(puzzleInteger(tickets), 'invalid', 'Refund exceeds safe ticket bounds')
    // D177 deliberately returns the paid ticket even above the 60-ticket daily storage cap.
    writes.push({ ...profile, data: { ...profile.data, tickets }, version: profile.version + 1, updatedAt: now })
    appends.push({ kind: 'ledger', id: refundId, createdAt: now, data: { resource: 'tickets', delta: amount,
      reason: 'minigame-refund', localDay: request.localDay, createdAt: now } })
  }
  const receipt: PuzzleSparkRetirementReceipt = { schemaVersion: 1, type: 'spark', runId: request.run.id,
    disposition: amount ? 'refunded' : 'committed', proof: puzzleCanonical(request.run), refundId: amount ? refundId : null, refunded: amount }
  requirePuzzle(parsePuzzlePreservationRecord(receipt), 'invalid', 'Retirement evidence exceeds safe record bounds')
  writes.push({ kind: 'puzzlePreservation', id, version: 1, data: receipt as unknown as Record<string, unknown>, deleted: false, updatedAt: now })
  return { writes, appends, response: { status: receipt.disposition, message: null, entities: writes, logs: appends } as LegacySparkResponse }
}
