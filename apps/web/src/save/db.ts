// The device's copy of generation 3 (docs/game/architecture.md "The save and sync", D381; T152): Dexie
// `uma-racer-g3`, schema version 1, one table per kind, the outbox, and the device-only `stageJournal` that T155 fills.
// The kind tables hold the rows the server confirmed, as it sent them; the device writes none of its own. Rows are read
// back through the domain's parsers: one that fails to parse is the caller's error, and nothing deletes it. A later
// schema change that must keep data adds a version (uma-rpg's rule); until then there is one.
//
// Before g3 opens, the boot wipes generation 2 once (`wipeGeneration2`): the `uma-racer-g2` database and every
// `uma-racer:g2:` device key. It is the owner's intended full wipe for the restart (D380), recorded under a
// `uma-racer:g3:` marker so it runs once.
import {
  ENTITY_KINDS, parseEntityRow, parseLogRow, type EntityKind, type EntityRow, type LogKind, type LogRow, type OperationEnvelope,
} from '@racer/domain/save'
import Dexie, { type Table } from 'dexie'

export const SAVE_DB_NAME = 'uma-racer-g3'

/** What one outbox row asks the server for: the create that makes the account, or one operation. */
export type OutboxChange =
  | { readonly type: 'create'; readonly createdAt: number }
  | { readonly type: 'operation'; readonly operation: OperationEnvelope }

/** `create` or `op:<id>`. */
export interface OutboxRow {
  readonly seq?: number
  readonly key: string
  readonly change: OutboxChange
  /** When it was queued: the Sync chip turns amber once the oldest is over a day old. */
  readonly queuedAt: number
}

/**
 * One stage's journal on this device (T155 fills it): what a game played so far, so a stage closed mid-play resumes.
 * Never synced and never folded; its shape is T155's.
 */
export interface StageJournalRow {
  readonly id: string
  readonly [field: string]: unknown
}

export const CREATE_KEY = 'create'
export const operationKey = (id: string): string => `op:${id}`

/** The stores: what `uma-racer-g3` version 1 holds, and only this. */
export const SAVE_STORES = Object.freeze({
  account: 'id',
  umas: 'id',
  cards: 'id',
  careers: 'id',
  bonds: 'id',
  raceResults: 'id, at, data.umaId, data.careerId',
  operations: 'id, at',
  outbox: '++seq, &key',
  stageJournal: 'id',
})

export class SaveDb extends Dexie {
  account!: Table<EntityRow<'account'>, string>
  umas!: Table<EntityRow<'umas'>, string>
  cards!: Table<EntityRow<'cards'>, string>
  careers!: Table<EntityRow<'careers'>, string>
  bonds!: Table<EntityRow<'bonds'>, string>
  raceResults!: Table<LogRow<'raceResults'>, string>
  operations!: Table<LogRow<'operations'>, string>
  outbox!: Table<OutboxRow, number>
  /** Device-only (T155). */
  stageJournal!: Table<StageJournalRow, string>

  constructor(name = SAVE_DB_NAME) {
    super(name)
    this.version(1).stores(SAVE_STORES)
  }

  /** A kind's table. */
  kind<K extends EntityKind | LogKind>(kind: K): Table<K extends EntityKind ? EntityRow<K> : K extends LogKind ? LogRow<K> : never, string> {
    return this.table(kind)
  }

  /** Every table: what a reconciling transaction spans, and what a dropped save clears. */
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

function parsedAll<T>(rows: readonly unknown[], parse: (value: unknown) => T | null, where: string): T[] {
  return rows.map((row) => {
    const parsed = parse(row)
    if (parsed === null) throw new UnreadableRow(where)
    return parsed
  })
}

/** What the fold reads: every entity, and the `operations` rows of the queued operations. */
export interface ConfirmedRows {
  readonly entities: readonly EntityRow[]
  readonly logs: readonly LogRow[]
}

/** The confirmed rows the fold starts from, parsed. Race results are never loaded into the store. */
export async function readConfirmed(db: SaveDb, operationIds: readonly string[]): Promise<ConfirmedRows> {
  const entities: EntityRow[] = []
  for (const kind of ENTITY_KINDS) entities.push(...parsedAll(await db.table(kind).toArray(), parseEntityRow, kind))
  const operations = operationIds.length === 0 ? [] : (await db.operations.bulkGet([...operationIds])).filter((row) => row !== undefined)
  return { entities, logs: parsedAll(operations, parseLogRow, 'operations') }
}

/** The outbox in order. */
export const readOutbox = (db: SaveDb): Promise<OutboxRow[]> => db.outbox.orderBy('seq').toArray()

/** Whether the device holds a save: the account row, or a create waiting in the outbox. */
export async function holdsSave(db: SaveDb): Promise<boolean> {
  return (await db.account.count()) > 0 || (await db.outbox.where('key').equals(CREATE_KEY).count()) > 0
}

// --- The wipe of generation 2 ---------------------------------------------------------------------------------------

/** Generation 2's database and device keys: what the restart wipes (D380, D381). */
export const LEGACY_DB_NAME = 'uma-racer-g2'
export const LEGACY_PREFIX = 'uma-racer:g2:'
/** Set once the wipe has run: its time. */
export const WIPED_KEY = 'uma-racer:g3:wiped-g2'

export interface WipeOptions {
  /** Deletes a database by name: Dexie's, by default. */
  readonly deleteDatabase?: (name: string) => Promise<void>
  readonly now?: () => number
}

/**
 * Deletes the `uma-racer-g2` database and every `uma-racer:g2:` key, once: true when it ran now. It runs again on a
 * later boot while it hasn't finished (a database that couldn't be deleted, or storage that can't keep the marker).
 */
export async function wipeGeneration2(storage: Storage | null, options: WipeOptions = {}): Promise<boolean> {
  try {
    if (storage?.getItem(WIPED_KEY) != null) return false
  } catch {
    // Unreadable storage: wipe anyway; the marker just won't stick.
  }
  await (options.deleteDatabase ?? ((name: string) => Dexie.delete(name)))(LEGACY_DB_NAME)
  try {
    if (storage !== null) {
      const keys: string[] = []
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i)
        if (key?.startsWith(LEGACY_PREFIX)) keys.push(key)
      }
      for (const key of keys) storage.removeItem(key)
      storage.setItem(WIPED_KEY, String((options.now ?? Date.now)()))
    }
  } catch {
    // Blocked storage holds nothing to wipe, and the next boot tries again.
  }
  return true
}
