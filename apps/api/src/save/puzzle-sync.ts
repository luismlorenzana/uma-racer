// Repository integration: one transaction/read set, semantic Puzzle lane, unchanged unrelated sync (implementation §5).
import { ConflictException, Logger } from '@nestjs/common'
import { isDeepStrictEqual } from 'node:util'
import { farmSyncReadSet, protectFarmSync } from './farm-sync'
import { FARM_KITCHEN_RELEASE_ENABLED, FARM_SYNC_LIMITS, farmOperationReferences, parseFarmStoredEntity, resolveFarmOperations } from './farms'
import { parseConstellationBankSave, parsePuzzleOperationBatch, puzzleOperationReferences, resolvePuzzleOperations,
  resolvePuzzleTakeover, PUZZLE_SYNC_LIMITS, type PuzzleStoredEntity, type PuzzleStoredLog, type PuzzleTakeoverRequest } from './puzzles'
import { MAX_SYNC_OPERATIONS, parseEntityData, resolveUpserts, type EntityRecord, type EntityUpsert, type LogRecord, type SyncRequest, type SyncResponse } from './save.types'
const logger = new Logger('SaveSync')

export function puzzleSyncReadSet(request: SyncRequest): { entities: string[]; logs: string[] } {
  if (request.upserts.length + request.appends.length + (request.puzzleOperations?.length ?? 0) + (request.farmOperations?.length ?? 0) > MAX_SYNC_OPERATIONS) throw new Error('Sync operation bounds exceeded')
  if (request.puzzleOperations && !parsePuzzleOperationBatch(request.puzzleOperations)) throw new Error('Invalid Puzzle operations or transport bounds')
  const entities = new Set(['constellationBank/main', ...request.upserts.map(r => `${r.kind}/${r.id}`)]), logs = new Set(request.appends.map(r => `${r.kind}/${r.id}`))
  const farmRefs = farmSyncReadSet(request)
  farmRefs.entities.forEach(k => entities.add(k)); farmRefs.logs.forEach(k => logs.add(k))
  for (const operation of request.puzzleOperations ?? []) {
    const refs = puzzleOperationReferences(operation)
    refs.entities.forEach(k => entities.add(k)); refs.logs.forEach(k => logs.add(k))
  }
  if (request.puzzleOperations?.length && entities.size + logs.size > PUZZLE_SYNC_LIMITS.documents) throw new Error('Puzzle transaction references too many documents')
  if (request.farmOperations?.length && entities.size + logs.size > FARM_SYNC_LIMITS.documents) throw new Error('Farm transaction references too many documents')
  return { entities: [...entities], logs: [...logs] }
}
function protectedUpserts(existing: Map<string, EntityRecord>, request: SyncRequest): EntityUpsert[] {
  const raw = existing.get('constellationBank/main'), bank = raw && parseConstellationBankSave(raw.data)
  if (raw && (raw.deleted || !bank)) throw new ConflictException('Recovery required: preserve the invalid cutover bank; do not resume old training writes')
  if (!bank) return request.upserts
  return request.upserts.map(row => {
    if (row.kind !== 'umas' && row.kind !== 'profile' && !(row.kind === 'items' && row.id === 'training:level-up-ticket')) return row
    if (request.puzzleProtocolVersion !== 1) throw new ConflictException('Update required: Training has moved to Constellation Levels. Keep the local save and reload before syncing.')
    if (row.kind === 'items') throw new ConflictException('Recovery required: universal ticket quantities are owned by Puzzle receipts after cutover')
    if (row.kind === 'profile') {
      if (bank.phase === 'active' && bank.cutoverVersion === 2 && row.data.schemaVersion !== 16)
        throw new ConflictException('Update required: the post-cutover profile uses save schema 16')
      const bankExp = bank.phase === 'active' ? 0 : existing.get('profile/main')?.data.trainingExpBank
      if (row.data.trainingExpBank !== bankExp) throw new ConflictException('Recovery required: retired Training EXP cannot be restored or changed during preparation')
      return row
    }
    const before = existing.get(`umas/${row.id}`)
    if (!Array.isArray(row.data.scenarios) || ![15, 16].includes(row.data.schemaVersion as number) || row.deleted ||
      bank.phase === 'active' && bank.cutoverVersion === 2 && row.data.schemaVersion !== 16)
      throw new ConflictException('Update required: post-cutover Uma save is unavailable; keep the local save and reload')
    const old = before?.data.scenarios as Record<string, unknown>[] | undefined
    const scenarios: Record<string, unknown>[] = (row.data.scenarios as Record<string, unknown>[]).map(s => {
      const previous = old?.find(o => o.tier === s.tier)
      const exp = bank.phase === 'preparing' ? previous?.trainingExp ?? 0 : 0
      if (s.trainingExp !== exp || bank.phase === 'preparing' && s.trainingLevel !== (previous?.trainingLevel ?? 1))
        throw new ConflictException('Recovery required: retired unit Training EXP/level cannot change during preparation')
      return { ...s, trainingLevel: previous?.trainingLevel ?? 1, trainingExp: exp }
    })
    if (old?.some(s => !scenarios.some(next => next.tier === s.tier))) throw new ConflictException('Recovery required: a racing write cannot remove a Constellation unit')
    return { ...row, data: { ...row.data, scenarios } }
  })
}
const entity = (row: PuzzleStoredEntity): EntityRecord => ({ ...row, kind: row.kind as EntityRecord['kind'] })
const log = (row: PuzzleStoredLog): LogRecord => ({ ...row, kind: row.kind as LogRecord['kind'] })
export function resolveSyncWithPuzzles(uid: string, request: SyncRequest, existingEntities: Map<string, EntityRecord>, existingLogs: Map<string, LogRecord>, now: number, enabled: boolean, farmEnabled: boolean = FARM_KITCHEN_RELEASE_ENABLED) {
  puzzleSyncReadSet(request) // Validate before either adapter reads; also defend direct repository callers.
  const entities = new Map(existingEntities), logs = new Map(existingLogs)
  request = protectFarmSync(request, entities, logs)
  for (const op of request.farmOperations ?? []) for (const key of farmOperationReferences(op).entities) {
    const row = entities.get(key)
    if (row && (!parseFarmStoredEntity(row) || !parseEntityData(row.kind, row.data))) throw new ConflictException(`Recovery required: preserve invalid Farm read ${key}`)
  }
  const bank = parseConstellationBankSave(entities.get('constellationBank/main')?.data)
  if (bank && request.appends.some(a => a.kind === 'ledger' && a.id.startsWith('spark-match:') &&
    !logs.has(`ledger/${a.id}`))) throw new ConflictException('Update required: Spark reservations/refunds must use the protected retirement path')
  if (bank && request.appends.some(a => a.kind === 'itemLedger' && a.data.itemId === 'training:level-up-ticket' &&
    !logs.has(`itemLedger/${a.id}`))) throw new ConflictException('Update required: retired Training EXP/ticket movements cannot be appended after cutover')
  // Identical historic projections acknowledge the original version, never become fresh economic writes.
  const historic = entities.has('farmCutover/main') ? request.upserts.filter(row =>
    (row.kind === 'farm' || row.kind === 'items' && row.id.startsWith('produce:')) &&
    isDeepStrictEqual(entities.get(`${row.kind}/${row.id}`)?.data, row.data)) : []
  const historicKeys = new Set(historic.map(row => `${row.kind}/${row.id}`))
  const ordinary = resolveUpserts(entities, protectedUpserts(entities, { ...request, upserts: request.upserts.filter(row => !historicKeys.has(`${row.kind}/${row.id}`)) }), now)
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
  const farm = resolveFarmOperations({ enabled: farmEnabled, allowEnergyGrant: true, now, entities: resolved.entities, logs: resolved.logs }, request.farmOperations ?? [])
  const writes = [...ordinary.writes, ...resolved.writes.map(entity), ...farm.writes.map(entity)], appends = [...ordinaryLogs, ...resolved.appends.map(log), ...farm.appends.map(log)]
  const response: SyncResponse = { applied: [...ordinary.writes.map(w => ({ kind: w.kind, id: w.id, version: w.version })),
    ...historic.map(row => ({ kind: row.kind, id: row.id, version: entities.get(`${row.kind}/${row.id}`)!.version }))],
    conflicts: ordinary.conflicts, appended, serverTime: now,
    ...(request.puzzleOperations ? { puzzleOperations: resolved.responses } : {}), ...(request.farmOperations ? { farmOperations: farm.responses } : {}) }
  return { writes, appends, response }
}
export function resolveTakeover(uid: string, request: PuzzleTakeoverRequest, entities: Map<string, EntityRecord>, logs: Map<string, LogRecord>, now: number, enabled: boolean) {
  const resolved = resolvePuzzleTakeover({ accountSeed: uid, enabled, entities, logs, now }, request)
  return { response: resolved.response, writes: resolved.writes.map(entity) }
}
