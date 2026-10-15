// Sync v2 on the wire (docs/rearchitecture/01-target-architecture.md §4.3; docs/rearchitecture/07-data-reset.md §3–§4;
// T134). Every request and response carries `protocol: 2` and `generation: 2`, and anything else is the caller's 426.
// One ordered lane of changes: the create (only first), the device's badge upserts and flair appends, and operations.
// Entities are versioned, logs are first write wins, operations are re-run, and a missing save accepts only a create.
// Each parser returns the value or a developer's reason; the screens never show it.
import type { BadgeStateV1, FlairEventV1 } from '../badges'
import { isRefusal, type Refusal } from '../rework/types'
import { parseOperationEnvelope, type OperationEnvelope } from './commit'
import { isRowId, OPERATION_ID_PATTERN, SAVE_GENERATION, SAVE_LIMITS, SAVE_PROTOCOL, type DeviceKind } from './kinds'
import { exactKeys, isJson, isNonNegativeInt, isObject, isPositiveInt, isTimestamp, jsonBytes, parseEntityData, parseEntityRow, parseLogData, parseLogRow, parseRefusal } from './parse'
import { rowKey, type EntityRow, type LogRow } from './rows'

/** The stamp on every request and response. */
export interface Stamp {
  readonly protocol: typeof SAVE_PROTOCOL
  readonly generation: typeof SAVE_GENERATION
}

export const STAMP: Stamp = Object.freeze({ protocol: SAVE_PROTOCOL, generation: SAVE_GENERATION })

/**
 * Whether a request is this generation's: `protocol` and `generation` are read before anything else, and anything other
 * than 2 and 2 is the caller's 426 (07 §4). A GET passes its query's values as numbers.
 */
export const isCurrentStamp = (value: unknown): boolean =>
  isObject(value) && value.protocol === SAVE_PROTOCOL && value.generation === SAVE_GENERATION

// --- Requests -------------------------------------------------------------------------------------------------------

/** One change in the device's outbox, in order. */
export type SyncChange =
  /** The initial save: the server builds its rows from `createdAt` (`initialSave`). At most one, and only first. */
  | { readonly type: 'create'; readonly createdAt: number }
  /** A badge row; `baseVersion` 0 creates it. */
  | { readonly type: 'upsert'; readonly kind: 'badges'; readonly id: string; readonly baseVersion: number; readonly data: BadgeStateV1 }
  /** A flair event; the first write wins. */
  | { readonly type: 'append'; readonly kind: 'flairEvents'; readonly id: string; readonly at: number; readonly data: FlairEventV1 }
  | { readonly type: 'operation'; readonly operation: OperationEnvelope }

export interface SyncRequestV2 extends Stamp {
  readonly changes: readonly SyncChange[]
}

const DEVICE_WRITES: Readonly<Record<'upsert' | 'append', DeviceKind>> = { upsert: 'badges', append: 'flairEvents' }

/** A change's key in one request: two changes of one row or one operation are refused. */
function changeKey(change: SyncChange): string {
  if (change.type === 'create') return 'create'
  if (change.type === 'operation') return `operations/${change.operation.id}`
  return rowKey(change)
}

function parseChange(value: unknown, index: number): SyncChange | string {
  if (!isObject(value)) return `change ${index} is not an object`
  if (value.type === 'create') {
    if (!exactKeys(value, ['type', 'createdAt']) || !isTimestamp(value.createdAt)) return 'a create is exactly { type, createdAt }'
    if (index !== 0) return 'a create comes first'
    return { type: 'create', createdAt: value.createdAt }
  }
  if (value.type === 'upsert' || value.type === 'append') {
    if (value.kind !== DEVICE_WRITES[value.type]) return `${String(value.kind)} changes only by operation`
    if (!isRowId(value.id)) return `change ${index} has an invalid id`
    if (value.type === 'upsert') {
      if (!exactKeys(value, ['type', 'kind', 'id', 'baseVersion', 'data']) || !isNonNegativeInt(value.baseVersion)) return 'an upsert is exactly { type, kind, id, baseVersion, data }'
      const data = parseEntityData('badges', value.data, value.id)
      if (data === null) return `invalid badges/${value.id}`
      if (jsonBytes(value) > SAVE_LIMITS.rowBytes) return `badges/${value.id} is over ${SAVE_LIMITS.rowBytes} bytes`
      return { type: 'upsert', kind: 'badges', id: value.id, baseVersion: value.baseVersion, data }
    }
    if (!exactKeys(value, ['type', 'kind', 'id', 'at', 'data']) || !isTimestamp(value.at)) return 'an append is exactly { type, kind, id, at, data }'
    const data = parseLogData('flairEvents', value.data, value.id)
    if (data === null || data.earnedAt !== value.at) return `invalid flairEvents/${value.id}`
    if (jsonBytes(value) > SAVE_LIMITS.rowBytes) return `flairEvents/${value.id} is over ${SAVE_LIMITS.rowBytes} bytes`
    return { type: 'append', kind: 'flairEvents', id: value.id, at: value.at, data }
  }
  if (value.type === 'operation') {
    if (!exactKeys(value, ['type', 'operation'])) return 'an operation change is exactly { type, operation }'
    const operation = parseOperationEnvelope(value.operation)
    return typeof operation === 'string' ? operation : { type: 'operation', operation }
  }
  return `change ${index} has an unknown type ${String(value.type)}`
}

/** The device's outbox: stamped, at most 100 changes and 2 MiB, a create only first, each row and operation once. */
export function parseSyncRequestV2(value: unknown): SyncRequestV2 | string {
  if (!isCurrentStamp(value)) return 'protocol 2 and generation 2 only'
  const body = value as Record<string, unknown>
  if (!exactKeys(body, ['protocol', 'generation', 'changes']) || !Array.isArray(body.changes)) return 'a sync is exactly { protocol, generation, changes }'
  if (body.changes.length > SAVE_LIMITS.changes) return `at most ${SAVE_LIMITS.changes} changes a sync`
  if (jsonBytes(body) > SAVE_LIMITS.requestBytes) return `a sync is at most ${SAVE_LIMITS.requestBytes} bytes`
  const changes: SyncChange[] = []
  const keys = new Set<string>()
  for (const [index, entry] of body.changes.entries()) {
    const change = parseChange(entry, index)
    if (typeof change === 'string') return change
    const key = changeKey(change)
    if (keys.has(key)) return `${key} is changed twice`
    keys.add(key)
    changes.push(change)
  }
  return { ...STAMP, changes }
}

// --- Responses ------------------------------------------------------------------------------------------------------

/** One change's answer, in the request's order. */
export type SyncResult =
  | { readonly type: 'create'; readonly status: 'created' | 'exists' }
  | { readonly type: 'upsert'; readonly kind: 'badges'; readonly id: string; readonly status: 'applied'; readonly version: number }
  /** The server's copy, if it has one, is in the response's `entities`. */
  | { readonly type: 'upsert'; readonly kind: 'badges'; readonly id: string; readonly status: 'conflict' }
  | { readonly type: 'append'; readonly kind: 'flairEvents'; readonly id: string; readonly status: 'appended' | 'exists' }
  | { readonly type: 'operation'; readonly id: string; readonly status: 'applied' | 'repeated'; readonly receipt: unknown }
  | { readonly type: 'operation'; readonly id: string; readonly status: 'refused'; readonly refusal: Refusal }
  /** A malformed input, or a caller's bug the rules threw on: the outbox drops it and says "That didn't work. Try again." */
  | { readonly type: 'operation'; readonly id: string; readonly status: 'invalid' }

/**
 * What a sync wrote: one result per change, every row it wrote, the server's copy of each conflicted row, and every
 * entity of the save after an `exists`.
 */
export interface SyncResponseV2 extends Stamp {
  readonly serverTime: number
  readonly results: readonly SyncResult[]
  readonly entities: readonly EntityRow[]
  readonly logs: readonly LogRow[]
}

/** `GET /api/save`: the rows saved after `since`, one page at a time; `cursor` is null on the last page. */
export interface SaveSnapshotV2 extends Stamp {
  readonly serverTime: number
  readonly entities: readonly EntityRow[]
  readonly logs: readonly LogRow[]
  readonly cursor: string | null
}

const isOpId = (value: unknown): value is string => typeof value === 'string' && OPERATION_ID_PATTERN.test(value)

function parseResult(value: unknown): SyncResult | null {
  if (!isObject(value)) return null
  if (value.type === 'create') {
    return exactKeys(value, ['type', 'status']) && (value.status === 'created' || value.status === 'exists') ? { type: 'create', status: value.status } : null
  }
  if (value.type === 'upsert') {
    if (value.kind !== 'badges' || !isRowId(value.id)) return null
    if (value.status === 'applied') {
      return exactKeys(value, ['type', 'kind', 'id', 'status', 'version']) && isPositiveInt(value.version)
        ? { type: 'upsert', kind: 'badges', id: value.id, status: 'applied', version: value.version } : null
    }
    return value.status === 'conflict' && exactKeys(value, ['type', 'kind', 'id', 'status']) ? { type: 'upsert', kind: 'badges', id: value.id, status: 'conflict' } : null
  }
  if (value.type === 'append') {
    return value.kind === 'flairEvents' && isRowId(value.id) && exactKeys(value, ['type', 'kind', 'id', 'status']) &&
      (value.status === 'appended' || value.status === 'exists')
      ? { type: 'append', kind: 'flairEvents', id: value.id, status: value.status } : null
  }
  if (value.type !== 'operation' || !isOpId(value.id)) return null
  if (value.status === 'applied' || value.status === 'repeated') {
    return exactKeys(value, ['type', 'id', 'status', 'receipt']) && isObject(value.receipt) && isJson(value.receipt)
      ? { type: 'operation', id: value.id, status: value.status, receipt: value.receipt } : null
  }
  if (value.status === 'refused') {
    const refusal = exactKeys(value, ['type', 'id', 'status', 'refusal']) ? parseRefusal(value.refusal) : null
    return refusal && isRefusal(refusal) ? { type: 'operation', id: value.id, status: 'refused', refusal } : null
  }
  return value.status === 'invalid' && exactKeys(value, ['type', 'id', 'status']) ? { type: 'operation', id: value.id, status: 'invalid' } : null
}

/** Rows parsed, each `kind/id` once, or the reason they aren't. */
function parseRows<R extends { readonly kind: string; readonly id: string }>(value: unknown, parse: (row: unknown) => R | null, what: string): R[] | string {
  if (!Array.isArray(value)) return `${what} is not a list`
  const rows: R[] = []
  const keys = new Set<string>()
  for (const entry of value) {
    const row = parse(entry)
    if (row === null) return `an invalid row in ${what}`
    if (keys.has(rowKey(row))) return `${rowKey(row)} is in ${what} twice`
    keys.add(rowKey(row))
    rows.push(row)
  }
  return rows
}

export function parseSyncResponseV2(value: unknown): SyncResponseV2 | string {
  if (!isCurrentStamp(value)) return 'protocol 2 and generation 2 only'
  const body = value as Record<string, unknown>
  if (!exactKeys(body, ['protocol', 'generation', 'serverTime', 'results', 'entities', 'logs']) || !isTimestamp(body.serverTime) ||
    !Array.isArray(body.results)) return 'a sync answer is exactly { protocol, generation, serverTime, results, entities, logs }'
  const results = body.results.map(parseResult)
  if (results.some((result) => result === null)) return 'an invalid result'
  const entities = parseRows(body.entities, parseEntityRow, 'entities')
  const logs = parseRows(body.logs, parseLogRow, 'logs')
  if (typeof entities === 'string') return entities
  if (typeof logs === 'string') return logs
  return { ...STAMP, serverTime: body.serverTime, results: results as SyncResult[], entities, logs }
}

/** Whether `result` answers `change`: the same type, and the same row or operation. */
export function resultAnswers(change: SyncChange, result: SyncResult): boolean {
  if (change.type !== result.type) return false
  if (change.type === 'create') return true
  if (change.type === 'operation') return result.type === 'operation' && result.id === change.operation.id
  return 'kind' in result && result.kind === change.kind && result.id === change.id
}

/** Whether a response answers every change of its request, one each, in order (T136 applies nothing otherwise). */
export const answersRequest = (request: Pick<SyncRequestV2, 'changes'>, response: Pick<SyncResponseV2, 'results'>): boolean =>
  request.changes.length === response.results.length && request.changes.every((change, i) => resultAnswers(change, response.results[i]!))

/** A pulled page: stamped, at most 1,000 rows and 4 MiB, each row once. */
export function parseSaveSnapshotV2(value: unknown): SaveSnapshotV2 | string {
  if (!isCurrentStamp(value)) return 'protocol 2 and generation 2 only'
  const body = value as Record<string, unknown>
  if (!exactKeys(body, ['protocol', 'generation', 'serverTime', 'entities', 'logs', 'cursor']) || !isTimestamp(body.serverTime)) {
    return 'a snapshot is exactly { protocol, generation, serverTime, entities, logs, cursor }'
  }
  if (body.cursor !== null && !isCursor(body.cursor)) return 'an invalid cursor'
  if (!Array.isArray(body.entities) || !Array.isArray(body.logs)) return 'a snapshot holds lists of rows'
  if (body.entities.length + body.logs.length > SAVE_LIMITS.pageRows) return `a page is at most ${SAVE_LIMITS.pageRows} rows`
  if (jsonBytes(body) > SAVE_LIMITS.pageBytes) return `a page is at most ${SAVE_LIMITS.pageBytes} bytes`
  const entities = parseRows(body.entities, parseEntityRow, 'entities')
  const logs = parseRows(body.logs, parseLogRow, 'logs')
  if (typeof entities === 'string') return entities
  if (typeof logs === 'string') return logs
  return { ...STAMP, serverTime: body.serverTime, entities, logs, cursor: body.cursor as string | null }
}

/** A page's cursor: opaque to the device (T135 encodes the last row's kind, `savedAt` and id), up to 512 safe characters. */
const isCursor = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_.:~=-]{1,512}$/.test(value)

/** `GET /api/save`'s query: the stamp, `since` (whole milliseconds, 0 when absent) and the page's `cursor`. */
export interface SnapshotQuery extends Stamp {
  readonly since: number
  readonly cursor: string | null
}

/** The query a device sends, as strings for a URL. */
export function snapshotQuery(since: number, cursor: string | null): Record<string, string> {
  return {
    protocol: String(SAVE_PROTOCOL), generation: String(SAVE_GENERATION), since: String(since), ...(cursor === null ? {} : { cursor }),
  }
}

/**
 * A GET's query as the server reads it: `undefined` for a stamp other than 2 and 2 (the caller's 426), else the query or
 * the reason it is malformed.
 */
export function parseSnapshotQuery(query: Readonly<Record<string, unknown>>): SnapshotQuery | string | undefined {
  const stamp = { protocol: Number(query.protocol), generation: Number(query.generation) }
  if (typeof query.protocol !== 'string' || typeof query.generation !== 'string' || !isCurrentStamp(stamp)) return undefined
  const since = query.since === undefined ? 0 : typeof query.since === 'string' && /^\d{1,16}$/.test(query.since) ? Number(query.since) : NaN
  if (!isTimestamp(since)) return 'since is whole milliseconds'
  if (query.cursor !== undefined && !isCursor(query.cursor)) return 'an invalid cursor'
  return { ...STAMP, since, cursor: (query.cursor as string | undefined) ?? null }
}

// --- The purge ------------------------------------------------------------------------------------------------------

/** `POST /api/legacy/purge` (07 §3): exactly the stamp. */
export type PurgeRequest = Stamp

export interface PurgeResponse extends Stamp {
  readonly status: 'purged' | 'already'
  /** When the purge ran: now, or the first purge's time. */
  readonly at: number
  readonly counts: { readonly collections: number; readonly documents: number }
}

export function parsePurgeRequest(value: unknown): PurgeRequest | string {
  if (!isCurrentStamp(value)) return 'protocol 2 and generation 2 only'
  return exactKeys(value as Record<string, unknown>, ['protocol', 'generation']) ? { ...STAMP } : 'a purge is exactly { protocol, generation }'
}

export function parsePurgeResponse(value: unknown): PurgeResponse | string {
  if (!isCurrentStamp(value)) return 'protocol 2 and generation 2 only'
  const body = value as Record<string, unknown>
  if (!exactKeys(body, ['protocol', 'generation', 'status', 'at', 'counts']) || (body.status !== 'purged' && body.status !== 'already') ||
    !isTimestamp(body.at)) return 'a purge answer is exactly { protocol, generation, status, at, counts }'
  const counts = body.counts
  if (!isObject(counts) || !exactKeys(counts, ['collections', 'documents']) || !isNonNegativeInt(counts.collections) ||
    !isNonNegativeInt(counts.documents)) return 'invalid purge counts'
  return { ...STAMP, status: body.status, at: body.at, counts: { collections: counts.collections, documents: counts.documents } }
}
