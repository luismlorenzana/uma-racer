// Save sync contract between the local-first client and the server (docs/technical/architecture.md#1-local-first-game-state).

/** Mutable, versioned entities. */
export const ENTITY_KINDS = ['profile', 'umas', 'cards', 'badges'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

/** Append-only records — never conflict, idempotent by id. */
export const LOG_KINDS = ['raceResults', 'ledger'] as const
export type LogKind = (typeof LOG_KINDS)[number]

export const MAX_SYNC_OPERATIONS = 400

export interface EntityRecord {
  kind: EntityKind
  id: string
  version: number
  data: Record<string, unknown>
  deleted: boolean
  updatedAt: number
}

export interface LogRecord {
  kind: LogKind
  id: string
  data: Record<string, unknown>
  createdAt: number
}

export interface EntityUpsert {
  kind: EntityKind
  id: string
  /** Version the client last saw; 0 for a new entity. */
  baseVersion: number
  data: Record<string, unknown>
  deleted?: boolean
}

export interface LogAppend {
  kind: LogKind
  id: string
  data: Record<string, unknown>
  createdAt: number
}

export interface SyncRequest {
  upserts: EntityUpsert[]
  appends: LogAppend[]
}

export interface SyncResponse {
  applied: { kind: EntityKind; id: string; version: number }[]
  /** Server copies for stale upserts; the client adopts them. */
  conflicts: EntityRecord[]
  appended: number
  serverTime: number
}

export interface SaveSnapshot {
  entities: EntityRecord[]
  logs: LogRecord[]
  serverTime: number
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(v)

/** Shape-checks an untrusted sync body. Returns an error message, or the parsed request. */
export function parseSyncRequest(body: unknown): SyncRequest | string {
  if (!isObject(body)) return 'body must be an object'
  const upserts = body.upserts ?? []
  const appends = body.appends ?? []
  if (!Array.isArray(upserts) || !Array.isArray(appends)) return 'upserts and appends must be arrays'
  if (upserts.length + appends.length > MAX_SYNC_OPERATIONS) return `at most ${MAX_SYNC_OPERATIONS} operations per sync`

  for (const u of upserts) {
    if (!isObject(u)) return 'upsert must be an object'
    if (!ENTITY_KINDS.includes(u.kind as EntityKind)) return `unknown entity kind ${String(u.kind)}`
    if (!isId(u.id)) return 'invalid entity id'
    if (!Number.isInteger(u.baseVersion) || (u.baseVersion as number) < 0) return 'invalid baseVersion'
    if (!isObject(u.data)) return 'upsert data must be an object'
  }
  for (const a of appends) {
    if (!isObject(a)) return 'append must be an object'
    if (!LOG_KINDS.includes(a.kind as LogKind)) return `unknown log kind ${String(a.kind)}`
    if (!isId(a.id)) return 'invalid log id'
    if (!isObject(a.data)) return 'append data must be an object'
    if (typeof a.createdAt !== 'number') return 'append createdAt must be a number'
  }
  return { upserts: upserts as EntityUpsert[], appends: appends as LogAppend[] }
}

/**
 * Pure optimistic-concurrency step shared by every repository: an upsert applies only when its baseVersion
 * matches the stored version. An entity the server doesn't have is always accepted (first sync or a restored
 * device). Returns the records to write and the conflicts to send back.
 */
export function resolveUpserts(
  existing: Map<string, EntityRecord>,
  upserts: EntityUpsert[],
  now: number,
): { writes: EntityRecord[]; conflicts: EntityRecord[] } {
  const writes: EntityRecord[] = []
  const conflicts: EntityRecord[] = []
  for (const u of upserts) {
    const key = `${u.kind}/${u.id}`
    const current = existing.get(key)
    const currentVersion = current?.version ?? 0
    if (current && u.baseVersion !== currentVersion) {
      conflicts.push(current)
      continue
    }
    const record: EntityRecord = {
      kind: u.kind,
      id: u.id,
      version: currentVersion + 1,
      data: u.data,
      deleted: u.deleted ?? false,
      updatedAt: now,
    }
    existing.set(key, record)
    writes.push(record)
  }
  return { writes, conflicts }
}
