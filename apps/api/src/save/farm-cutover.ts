// Authenticated adapter boundary for the dormant Farm migration; no content/credentials or other migration calls.
import { createHash } from 'node:crypto'
import { farmCanonical, farmCutoverControl, farmCutoverSource, resolveFarmCutover, type FarmCutoverRequest } from './farms'
import { parseEntityData, type EntityRecord, type LogRecord } from './save.types'
export function resolveProtectedFarm(uid: string, entities: Map<string, EntityRecord>, logs: Map<string, LogRecord>, request: FarmCutoverRequest, now: number) {
  const control = farmCutoverControl(entities)
  for (const row of entities.values()) if (!row.deleted && (row.kind === 'umas' || row.kind === 'profile' ||
    row.kind === 'inspirationBank' || row.kind === 'constellationBank') && !parseEntityData(row.kind, row.data))
    throw new Error('Authoritative save needs update/recovery before Farm; no progression changed')
  const sourceDigest = !control ? createHash('sha256').update(farmCanonical(farmCutoverSource(uid, entities, logs))).digest('hex') : undefined
  const result = resolveFarmCutover({ enabled: true, accountId: uid, now, entities, logs, sourceDigest }, request)
  for (const row of result.writes) if (!parseEntityData(row.kind as EntityRecord['kind'], row.data))
    throw new Error('Invalid protected Farm projection; no changes committed')
  return { writes: result.writes as EntityRecord[], appends: result.appends as LogRecord[], response: result.response }
}
