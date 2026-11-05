// Generation 3's sync and pull, pure (docs/game/architecture.md "The save and sync"; D381; T152). Both repositories read
// what `syncReadSet` names, hand those rows to `resolveSync` and write what it returns, so Firestore and the local file
// answer alike. The server is the authority: it re-runs every operation with the domain's `commitOperation` on its own
// rows, and a missing save accepts only a create. A pull hands its candidate rows to `snapshotPage`, which orders, bounds
// and pages them.
import {
  commitOperation, ENTITY_KINDS, initialSave, isEntityKind, isRowId, jsonBytes, KIND_ORDER, OPERATIONS_WINDOW_MS, rowKey,
  SAVE_LIMITS, stampEntity, stampLog, STAMP, toSaveState,
  type EntityDraft, type EntityKind, type EntityRow, type LogDraft, type LogRow, type OperationEnv, type SaveKind, type SaveSnapshot,
  type SaveState, type SyncRequest, type SyncResponse, type SyncResult,
} from '@racer/domain/save'

/** A stored row of either shape. */
export type SaveRow = EntityRow | LogRow

/** `resolveSync`'s answer when there is no `account/main` and the request doesn't open with a create: the caller's 409. */
export const NO_SAVE: unique symbol = Symbol('no-save')
export type NoSave = typeof NO_SAVE

/** What one sync reads, and nothing else. */
export interface SyncReadSet {
  /** Entity kinds read whole: every one for a create or an operation, so the rules and an `exists` see the whole account. */
  readonly collections: readonly EntityKind[]
  /** Single rows, as `kind/id`: the request's `operations/{id}`, or `account/main` alone for an empty request. */
  readonly documents: readonly string[]
}

/** Whether a request holds an operation, so the operation env must be loaded (and only then). */
export const needsOperationEnv = (request: Pick<SyncRequest, 'changes'>): boolean => request.changes.some((change) => change.type === 'operation')

/**
 * The rows a sync reads. A create or an operation reads every entity kind whole, and `operations/{id}` for each of the
 * request's operation ids (what a retried id answers with). An empty request reads `account/main` alone, so a missing
 * save is still a 409.
 */
export function syncReadSet(request: Pick<SyncRequest, 'changes'>): SyncReadSet {
  if (request.changes.length === 0) return { collections: [], documents: ['account/main'] }
  const documents = request.changes.flatMap((change) => (change.type === 'operation' ? [`operations/${change.operation.id}`] : []))
  return { collections: [...ENTITY_KINDS], documents }
}

/** The rows the read set covers, out of every row of one save: what the local repository hands `resolveSync`. */
export function selectReadSet(rows: Iterable<SaveRow>, readSet: SyncReadSet): StoredRows {
  const documents = new Set(readSet.documents)
  const entities = new Map<string, EntityRow>()
  const logs = new Map<string, LogRow>()
  for (const row of rows) {
    const key = rowKey(row)
    if (isEntityRow(row)) {
      if (readSet.collections.includes(row.kind) || documents.has(key)) entities.set(key, row)
    } else if (documents.has(key)) logs.set(key, row)
  }
  return { entities, logs }
}

/** The rows a sync read, by `kind/id`. */
export interface StoredRows {
  readonly entities: ReadonlyMap<string, EntityRow>
  readonly logs: ReadonlyMap<string, LogRow>
}

/** A sync's answer and its writes: each document once, with its final data, stamped. */
export interface ResolvedSync {
  readonly response: SyncResponse
  readonly entities: readonly EntityRow[]
  readonly logs: readonly LogRow[]
}

export const isEntityRow = (row: SaveRow): row is EntityRow => isEntityKind(row.kind)

const kindIndex = (kind: string): number => KIND_ORDER.indexOf(kind as SaveKind)
const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
/** `KIND_ORDER`, then id: the order a response lists rows in. */
const byKindThenId = (a: SaveRow, b: SaveRow): number => kindIndex(a.kind) - kindIndex(b.kind) || byId(a.id, b.id)

/** A row as JSON carries it: a field holding `undefined` is dropped, so Firestore, the file and the wire hold one copy. */
const asJson = <T>(row: T): T => JSON.parse(JSON.stringify(row)) as T

/**
 * One sync on the rows it read, at the server's `now`. It walks the changes in order on one in-memory state:
 * - a create is `exists` when `account/main` is there, and otherwise writes `initialSave(createdAt)`'s rows;
 * - an operation is `commitOperation` on the state so far: `invalid` when the rules throw on it (a malformed input or
 *   another caller's bug; the walk goes on), `refused` with its plain words, `repeated` with its first receipt, or
 *   `applied`, whose state carries to the next change. Only `applied` writes.
 * Writes are coalesced to one per document: an entity gets its stored version + 1 (1 when new) once, every written row
 * `savedAt = now`, and a log row is written only if absent. The response lists the written rows and, after `exists`,
 * every entity. `env` is needed only when the request holds an operation.
 */
export function resolveSync(stored: StoredRows, request: SyncRequest, now: number, env?: OperationEnv): ResolvedSync | NoSave {
  const read = (): SaveState => toSaveState([...stored.entities.values()], [...stored.logs.values()])
  let state: SaveState | null = stored.entities.has('account/main') ? read() : null
  if (state === null && request.changes[0]?.type !== 'create') return NO_SAVE

  const entities = new Map<string, EntityDraft>()
  const logs = new Map<string, LogDraft>()
  const results: SyncResult[] = []
  let exists = false
  const writeEntity = (draft: EntityDraft): void => void entities.set(rowKey(draft), draft)
  const writeLog = (draft: LogDraft): void => {
    const key = rowKey(draft)
    if (!stored.logs.has(key) && !logs.has(key)) logs.set(key, draft)
  }

  for (const change of request.changes) {
    if (change.type === 'create') {
      if (state !== null) {
        exists = true
        results.push({ type: 'create', status: 'exists' })
        continue
      }
      const created = initialSave(change.createdAt)
      state = created.state
      created.entities.forEach(writeEntity)
      created.logs.forEach(writeLog)
      results.push({ type: 'create', status: 'created' })
      continue
    }
    const { operation } = change
    // A create opens every request that reaches here without a save, so the state is there.
    if (state === null) throw new Error('An operation needs a save')
    if (env === undefined) throw new Error('An operation needs its env')
    let commit: ReturnType<typeof commitOperation>
    try {
      commit = commitOperation(state, operation, env)
    } catch {
      results.push({ type: 'operation', id: operation.id, status: 'invalid' })
      continue
    }
    if (commit.status === 'refused') {
      results.push({ type: 'operation', id: operation.id, status: 'refused', refusal: commit.refusal })
      continue
    }
    results.push({ type: 'operation', id: operation.id, status: commit.status, receipt: commit.receipt })
    if (commit.status === 'repeated') continue
    state = commit.state
    commit.entities.forEach(writeEntity)
    commit.logs.forEach(writeLog)
  }

  const writtenEntities = [...entities].map(([key, draft]) => asJson(stampEntity(draft, (stored.entities.get(key)?.version ?? 0) + 1, now)))
    .sort(byKindThenId) as EntityRow[]
  const writtenLogs = [...logs.values()].map((draft) => asJson(stampLog(draft, now))).sort(byKindThenId) as LogRow[]
  const answered = new Map<string, EntityRow>(exists ? stored.entities : [])
  for (const row of writtenEntities) answered.set(rowKey(row), row)
  return {
    response: {
      ...STAMP, serverTime: now, results, entities: [...answered.values()].sort(byKindThenId) as EntityRow[], logs: writtenLogs,
    },
    entities: writtenEntities,
    logs: writtenLogs,
  }
}

// --- The pull -------------------------------------------------------------------------------------------------------

/** Where a page ended: its last row's kind, `savedAt` and id. */
export interface PageCursor {
  readonly kind: SaveKind
  readonly savedAt: number
  readonly id: string
}

/** The cursor as the wire carries it: `kind~savedAt~id`, inside the wire's cursor alphabet (`~` is in no kind or id). */
export const encodeCursor = (cursor: PageCursor): string => `${cursor.kind}~${cursor.savedAt}~${cursor.id}`

/** A cursor this server wrote, or null. */
export function parseCursor(value: string): PageCursor | null {
  const parts = value.split('~')
  if (parts.length !== 3) return null
  const [kind, savedAt, id] = parts as [string, string, string]
  if (kindIndex(kind) < 0 || !/^\d{1,16}$/.test(savedAt) || !Number.isSafeInteger(Number(savedAt)) || !isRowId(id)) return null
  return { kind: kind as SaveKind, savedAt: Number(savedAt), id }
}

/** The pull's order: `KIND_ORDER`, then `savedAt`, then id. */
export function comparePulled(a: PageCursor, b: PageCursor): number {
  return kindIndex(a.kind) - kindIndex(b.kind) || a.savedAt - b.savedAt || byId(a.id, b.id)
}

/** A kind's rows are pulled when saved after this: `since`, and for `operations` a week before `now` at the earliest. */
export const pullFloor = (kind: SaveKind, since: number, now: number): number =>
  kind === 'operations' ? Math.max(since, now - OPERATIONS_WINDOW_MS) : since

/** Room in a page's JSON for its envelope with the longest cursor (11 + 16 + 160 characters and two `~`). */
const ENVELOPE_BYTES = jsonBytes({ ...STAMP, serverTime: Number.MAX_SAFE_INTEGER, entities: [], logs: [], cursor: 'x'.repeat(189) })

/**
 * One page of `GET /api/save` from candidate rows: those saved after `since` (and, for `operations`, within the week
 * before `now`), after `cursor`, in `KIND_ORDER`, then `savedAt`, then id, up to 1,000 rows and 4 MiB. The cursor is the
 * page's last row when rows remain among the candidates, else null. A caller passes a superset; any extra row it holds
 * past the page is what makes the cursor non-null.
 */
export function snapshotPage(rows: Iterable<SaveRow>, since: number, cursor: string | null, now: number): SaveSnapshot {
  const after = cursor === null ? null : parseCursor(cursor)
  if (cursor !== null && after === null) throw new RangeError('an invalid cursor')
  const candidates = [...rows]
    .filter((row) => row.savedAt > pullFloor(row.kind, since, now) && (after === null || comparePulled(row, after) > 0))
    .sort(comparePulled)
  const page: SaveRow[] = []
  let bytes = ENVELOPE_BYTES
  for (const row of candidates) {
    const size = jsonBytes(row) + 1
    if (page.length > 0 && (page.length === SAVE_LIMITS.pageRows || bytes + size > SAVE_LIMITS.pageBytes)) break
    page.push(row)
    bytes += size
  }
  const last = page.at(-1)
  return {
    ...STAMP,
    serverTime: now,
    entities: page.filter(isEntityRow),
    logs: page.filter((row): row is LogRow => !isEntityRow(row)),
    cursor: last !== undefined && page.length < candidates.length ? encodeCursor(last) : null,
  }
}
