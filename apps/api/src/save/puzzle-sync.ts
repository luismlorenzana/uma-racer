// Repository integration: one transaction/read set, semantic Puzzle lane, unchanged unrelated sync (implementation §5).
import { ConflictException, Logger } from '@nestjs/common'
import { isDeepStrictEqual } from 'node:util'
import { parseConstellationBankSave, parsePuzzleOperationBatch, puzzleOperationReferences, resolvePuzzleOperations,
  resolvePuzzleTakeover, PUZZLE_SYNC_LIMITS, type PuzzleStoredEntity, type PuzzleStoredLog, type PuzzleTakeoverRequest } from './puzzles'
import { MAX_SYNC_OPERATIONS, resolveUpserts, type EntityRecord, type EntityUpsert, type LogRecord, type SyncRequest, type SyncResponse } from './save.types'
const logger = new Logger('SaveSync')

export function puzzleSyncReadSet(request: SyncRequest): { entities: string[]; logs: string[] } {
  if (request.upserts.length + request.appends.length + (request.puzzleOperations?.length ?? 0) > MAX_SYNC_OPERATIONS) throw new Error('Sync operation bounds exceeded')
  if (request.puzzleOperations && !parsePuzzleOperationBatch(request.puzzleOperations)) throw new Error('Invalid Puzzle operations or transport bounds')
  const entities = new Set(['constellationBank/main', ...request.upserts.map(r => `${r.kind}/${r.id}`)]), logs = new Set(request.appends.map(r => `${r.kind}/${r.id}`))
  for (const operation of request.puzzleOperations ?? []) {
    const refs = puzzleOperationReferences(operation)
    refs.entities.forEach(k => entities.add(k)); refs.logs.forEach(k => logs.add(k))
  }
  if (request.puzzleOperations?.length && entities.size + logs.size > PUZZLE_SYNC_LIMITS.documents) throw new Error('Puzzle transaction references too many documents')
  return { entities: [...entities], logs: [...logs] }
}
function protectedUpserts(existing: Map<string, EntityRecord>, request: SyncRequest): EntityUpsert[] {
  const raw = existing.get('constellationBank/main'), bank = raw && parseConstellationBankSave(raw.data)
  if (!bank || bank.phase !== 'active') return request.upserts
  return request.upserts.map(row => {
    if (row.kind !== 'umas' && row.kind !== 'profile' && !(row.kind === 'items' && row.id === 'training:level-up-ticket')) return row
    if (request.puzzleProtocolVersion !== 1) throw new ConflictException('Update required: Training has moved to Constellation Levels. Keep the local save and reload before syncing.')
    if (row.kind === 'items') throw new ConflictException('Recovery required: universal ticket quantities are owned by Puzzle receipts after cutover')
    if (row.kind === 'profile') {
      if (row.data.trainingExpBank !== 0) throw new ConflictException('Recovery required: retired Training EXP cannot be restored')
      return row
    }
    const before = existing.get(`umas/${row.id}`)
    if (!Array.isArray(row.data.scenarios) || row.data.schemaVersion !== 15 || row.deleted) throw new ConflictException('Update required: post-cutover Uma save is unavailable')
    const old = before?.data.scenarios as Record<string, unknown>[] | undefined
    const scenarios: Record<string, unknown>[] = (row.data.scenarios as Record<string, unknown>[]).map(s => {
      if (s.trainingExp !== 0) throw new ConflictException('Recovery required: retired unit Training EXP cannot be restored')
      const previous = old?.find(o => o.tier === s.tier)
      return { ...s, trainingLevel: previous?.trainingLevel ?? 1, trainingExp: 0 }
    })
    if (old?.some(s => !scenarios.some(next => next.tier === s.tier))) throw new ConflictException('Recovery required: a racing write cannot remove a Constellation unit')
    return { ...row, data: { ...row.data, scenarios } }
  })
}
const entity = (row: PuzzleStoredEntity): EntityRecord => ({ ...row, kind: row.kind as EntityRecord['kind'] })
const log = (row: PuzzleStoredLog): LogRecord => ({ ...row, kind: row.kind as LogRecord['kind'] })
export function resolveSyncWithPuzzles(uid: string, request: SyncRequest, existingEntities: Map<string, EntityRecord>, existingLogs: Map<string, LogRecord>, now: number, enabled: boolean) {
  puzzleSyncReadSet(request) // Validate before either adapter reads; also defend direct repository callers.
  const entities = new Map(existingEntities), logs = new Map(existingLogs)
  const bank = parseConstellationBankSave(entities.get('constellationBank/main')?.data)
  if (bank?.phase === 'active' && request.appends.some(a => a.kind === 'itemLedger' && a.data.itemId === 'training:level-up-ticket' &&
    !logs.has(`itemLedger/${a.id}`))) throw new ConflictException('Update required: retired Training EXP/ticket movements cannot be appended after cutover')
  const ordinary = resolveUpserts(entities, protectedUpserts(entities, request), now)
  let appended = 0
  const ordinaryLogs: LogRecord[] = []
  for (const row of request.appends) {
    const key = `${row.kind}/${row.id}`
    const previous = logs.get(key)
    if (previous) {
      if (!isDeepStrictEqual(previous.data, row.data) || previous.createdAt !== row.createdAt) logger.warn(`Append conflict ignored (first write wins): ${key}`)
      continue
    }
    const record: LogRecord = { kind: row.kind, id: row.id, data: row.data, createdAt: row.createdAt }
    logs.set(key, record); ordinaryLogs.push(record); appended++
  }
  const operations = request.puzzleOperations ?? []
  if (operations.length && !parsePuzzleOperationBatch(operations)) throw new Error('Puzzle operation bounds invalid')
  const resolved = resolvePuzzleOperations({ accountSeed: uid, enabled, now, entities, logs }, operations)
  const writes = [...ordinary.writes, ...resolved.writes.map(entity)], appends = [...ordinaryLogs, ...resolved.appends.map(log)]
  const response: SyncResponse = { applied: ordinary.writes.map(w => ({ kind: w.kind, id: w.id, version: w.version })),
    conflicts: ordinary.conflicts, appended, serverTime: now,
    ...(request.puzzleOperations ? { puzzleOperations: resolved.responses } : {}) }
  return { writes, appends, response }
}
export function resolveTakeover(uid: string, request: PuzzleTakeoverRequest, entities: Map<string, EntityRecord>, logs: Map<string, LogRecord>, now: number, enabled: boolean) {
  const resolved = resolvePuzzleTakeover({ accountSeed: uid, enabled, entities, logs, now }, request)
  return { response: resolved.response, writes: resolved.writes.map(entity) }
}
