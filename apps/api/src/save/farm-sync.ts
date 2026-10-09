// Compose Farm authority with the existing Puzzle lane; protection never depends on client protocol opt-in.
import { ConflictException } from '@nestjs/common'
import { isDeepStrictEqual } from 'node:util'
import { FARM_ENTITY_KINDS, FARM_SYNC_LIMITS, farmBytes, farmOperationReferences, parseFarmCutoverControl, parseFarmOperationBatch } from './farms'
import type { EntityRecord, LogRecord, SyncRequest } from './save.types'

export function farmSyncReadSet(request: SyncRequest): { entities: string[]; logs: string[] } {
  if (request.farmOperations && (!parseFarmOperationBatch(request.farmOperations) || request.farmProtocolVersion !== 1)) throw new Error('Invalid Farm operation batch/protocol')
  if (request.farmOperations?.length && request.puzzleOperations?.length) throw new Error('Farm and Puzzle semantic requests must be separate')
  const entities = new Set(['farmCutover/main']), logs = new Set<string>()
  for (const op of request.farmOperations ?? []) { const refs = farmOperationReferences(op); refs.entities.forEach(k => entities.add(k)); refs.logs.forEach(k => logs.add(k)) }
  if (request.farmOperations?.length && farmBytes(request) > FARM_SYNC_LIMITS.bytes) throw new Error('Farm sync byte bounds exceeded')
  return { entities: [...entities], logs: [...logs] }
}
const retiredExtra = (data: Record<string, unknown>): unknown[] | null => {
  if (![15, 16].includes(Number(data.schemaVersion)) || !Array.isArray(data.scenarios)) return null
  return (data.scenarios as Record<string, unknown>[]).map(unit => ({ tier: unit.tier, unlocked: unit.extraStatsUnlocked,
    active: Object.fromEntries(['sprint', 'mile', 'medium', 'long'].map(distance => {
      const presets = unit.presets as Record<string, Record<string, unknown>> | undefined
      return [distance, presets?.[distance]?.activeExtraStats]
    })) }))
}
const emptyExtra = (value: unknown): boolean => {
  const rows = value as Array<{ unlocked?: Record<string, unknown>; active?: Record<string, unknown> }>
  return Array.isArray(rows) && rows.every(row => row.unlocked && Object.keys(row.unlocked).length === 5 &&
    Object.values(row.unlocked).every(v => v === 0) && row.active && Object.values(row.active).every(v => Array.isArray(v) && v.length === 0))
}
export function protectFarmSync(request: SyncRequest, entities: ReadonlyMap<string, EntityRecord>, logs: ReadonlyMap<string, LogRecord>): SyncRequest {
  const raw = entities.get('farmCutover/main'), control = raw && !raw.deleted && parseFarmCutoverControl(raw.data)
  if (raw && !control) throw new ConflictException('Recovery required: preserve the invalid Farm cutover control')
  const fail = (message: string): never => { throw new ConflictException(`Update/recovery required: ${message}. Keep the local save.`) }
  for (const row of request.upserts) {
    if (FARM_ENTITY_KINDS.includes(row.kind as never) || row.kind === 'farm' && row.data.schemaVersion === 3 ||
      row.kind === 'items' && row.id.startsWith('farm:')) fail('new Farm projections and stock belong to semantic receipts')
    if (row.kind === 'farm' && Number(entities.get('farm/main')?.data.schemaVersion) >= 3) fail('legacy Farm cannot overwrite schema 3')
    if (!control) continue
    if (row.kind === 'farm' || row.kind === 'items' && row.id.startsWith('produce:')) {
      const before = entities.get(`${row.kind}/${row.id}`)
      if (!before || row.deleted || !isDeepStrictEqual(before.data, row.data)) fail('legacy Farm/Produce writes are retired during and after upgrade')
    }
    if (row.kind === 'umas') {
      if (request.farmProtocolVersion !== 1 || row.deleted) fail('refresh before writing post-upgrade Uma builds')
      const next = retiredExtra(row.data), previous = retiredExtra(entities.get(`umas/${row.id}`)?.data ?? {})
      if (!next || control.phase === 'active' && !emptyExtra(next)) fail('retired Extra Stats cannot be restored')
      if (control.phase !== 'active') {
        const old = (previous ?? []) as Array<{ tier: number }>, fresh = next as Array<{ tier: number }>
        if (old.some(unit => !isDeepStrictEqual(unit, fresh.find(n => n.tier === unit.tier))) ||
          fresh.some(unit => !old.some(o => o.tier === unit.tier) && !emptyExtra([unit]))) fail('Extra Stats cannot change during Farm preparation/reset')
      }
    }
  }
  for (const row of request.appends) {
    if (row.kind === 'farmOperations' || row.kind === 'itemLedger' && row.data.reason === 'farm-command') fail('Farm evidence belongs to semantic operations')
    if (control && row.kind === 'itemLedger' && ['farm-harvest', 'extra-stat-unlock', 'constellation-produce'].includes(String(row.data.reason))) {
      const before = logs.get(`${row.kind}/${row.id}`)
      if (!before || before.createdAt !== row.createdAt || !isDeepStrictEqual(before.data, row.data)) fail('new legacy Farm/Extra evidence is retired')
    }
  }
  return request
}
