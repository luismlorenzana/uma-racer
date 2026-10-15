// The device's copy of generation 2 (docs/rearchitecture/01-target-architecture.md §4.2; docs/rework/02-check-ins-and-
// notifications.md §11; T136): Dexie `uma-racer-g2`, schema version 1, one table per kind and the outbox, and nothing
// else (the journals §4.2 first named left with the minigames and Puzzles). The kind tables hold the rows the server
// confirmed, as it sent them; `badges` and `flairEvents` also hold the device's own writes until their answer comes.
// Rows are read back through T134's parsers: one that fails to parse is the caller's error, and nothing deletes it.
// A later schema change that must keep data adds a version (uma-rpg's rule); until then there is one.
import {
  parseEntityRow, parseLogRow, RULE_LEDGER_REASONS, type EntityKind, type EntityRow, type LogKind, type LogRow, type OperationEnvelope,
} from '@racer/domain/save-g2'
import Dexie, { type Table } from 'dexie'

export const SAVE_DB_NAME = 'uma-racer-g2'

/** What one outbox row asks the server for. A badge's data and base, and a flair event's data, are read at flush. */
export type OutboxChange =
  | { readonly type: 'create'; readonly createdAt: number }
  | { readonly type: 'operation'; readonly operation: OperationEnvelope }
  | { readonly type: 'upsert'; readonly kind: 'badges'; readonly id: string }
  | { readonly type: 'append'; readonly kind: 'flairEvents'; readonly id: string }

/** `create`, `op:<id>`, `badges/<id>` or `flairEvents/<id>`: a badge's key is coalesced, so it holds one row. */
export interface OutboxRow {
  readonly seq?: number
  readonly key: string
  readonly change: OutboxChange
  /** When it was queued; a badge rewritten while in flight bumps it, so its answer leaves the row for the next batch. */
  readonly queuedAt: number
}

export const CREATE_KEY = 'create'
export const operationKey = (id: string): string => `op:${id}`
export const badgeKey = (id: string): string => `badges/${id}`
export const flairKey = (id: string): string => `flairEvents/${id}`

/** The stores: what `uma-racer-g2` version 1 holds, and only this. */
export const SAVE_STORES = Object.freeze({
  profile: 'id',
  umas: 'id',
  buildings: 'id',
  work: 'id',
  items: 'id',
  badges: 'id',
  ledger: 'id, at, data.reason',
  itemLedger: 'id, at',
  flairEvents: 'id, at',
  operations: 'id, at',
  raceResults: 'id, at, data.umaId',
  outbox: '++seq, &key',
})

export class SaveDb extends Dexie {
  profile!: Table<EntityRow<'profile'>, string>
  umas!: Table<EntityRow<'umas'>, string>
  buildings!: Table<EntityRow<'buildings'>, string>
  work!: Table<EntityRow<'work'>, string>
  items!: Table<EntityRow<'items'>, string>
  /** Confirmed rows, and the device's own writes: `version` is the server's the write was based on, 0 when it has none. */
  badges!: Table<EntityRow<'badges'>, string>
  ledger!: Table<LogRow<'ledger'>, string>
  itemLedger!: Table<LogRow<'itemLedger'>, string>
  /** Confirmed rows, and the device's own appends (`savedAt` 0 until the server has it). */
  flairEvents!: Table<LogRow<'flairEvents'>, string>
  operations!: Table<LogRow<'operations'>, string>
  raceResults!: Table<LogRow<'raceResults'>, string>
  outbox!: Table<OutboxRow, number>

  constructor(name = SAVE_DB_NAME) {
    super(name)
    this.version(1).stores(SAVE_STORES)
  }

  /** A kind's table. */
  kind<K extends EntityKind | LogKind>(kind: K): Table<K extends EntityKind ? EntityRow<K> : K extends LogKind ? LogRow<K> : never, string> {
    return this.table(kind)
  }

  /** Every kind table and the outbox: what a reconciling transaction spans. */
  allTables(): Table[] {
    return Object.keys(SAVE_STORES).map((name) => this.table(name))
  }
}

/** A row that didn't parse: the save can't open, and the row stays where it is. */
export class UnreadableRow extends Error {
  constructor(readonly where: string) {
    super(`An unreadable row in ${where}`)
    this.name = 'UnreadableRow'
  }
}

/**
 * An entity as stored. A badge the server hasn't confirmed yet carries `version` 0, which T134's parser (made for the
 * server's rows) refuses, so it is read at 1 and given back at 0.
 */
export function parseStoredEntity(value: unknown): EntityRow | null {
  const unconfirmed = typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'badges' &&
    (value as { version?: unknown }).version === 0
  if (!unconfirmed) return parseEntityRow(value)
  const row = parseEntityRow({ ...(value as object), version: 1 })
  return row === null ? null : { ...row, version: 0 }
}

const ENTITY_TABLES = ['profile', 'buildings', 'umas', 'work', 'items', 'badges'] as const satisfies readonly EntityKind[]

function parsedAll<T>(rows: readonly unknown[], parse: (value: unknown) => T | null, where: string): T[] {
  return rows.map((row) => {
    const parsed = parse(row)
    if (parsed === null) throw new UnreadableRow(where)
    return parsed
  })
}

/** What the fold reads: every entity, the ledger's rule rows and the `operations` rows of the queued operations. */
export interface ConfirmedRows {
  readonly entities: readonly EntityRow[]
  readonly logs: readonly LogRow[]
}

/** The confirmed rows the fold starts from, parsed. Logs other than these are never loaded into the store (T136). */
export async function readConfirmed(db: SaveDb, operationIds: readonly string[]): Promise<ConfirmedRows> {
  const entities: EntityRow[] = []
  for (const kind of ENTITY_TABLES) entities.push(...parsedAll(await db.table(kind).toArray(), parseStoredEntity, kind))
  const ledger = await db.ledger.where('data.reason').anyOf(RULE_LEDGER_REASONS as readonly string[]).toArray()
  const operations = operationIds.length === 0 ? [] : (await db.operations.bulkGet([...operationIds])).filter((row) => row !== undefined)
  return { entities, logs: [...parsedAll(ledger, parseLogRow, 'ledger'), ...parsedAll(operations, parseLogRow, 'operations')] }
}

/** The outbox in order. */
export const readOutbox = (db: SaveDb): Promise<OutboxRow[]> => db.outbox.orderBy('seq').toArray()

/** Whether the device holds a save: a profile row, or a create waiting in the outbox. */
export async function holdsSave(db: SaveDb): Promise<boolean> {
  return (await db.profile.count()) > 0 || (await db.outbox.where('key').equals(CREATE_KEY).count()) > 0
}
