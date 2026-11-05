// What generation 3 stores and the wire carries (D381): one row per entity or log entry, each stamped with the
// generation and its kind's schema. An entity's `version` starts at 1 and rises by one with each committed sync that
// changes it; a log row never changes once written. Drafts are rows before the server stamps them.
import type { AccountRecord, BondRecord, CareerRecord, OperationRecord, RaceResultRecord, UnlockRecord } from './records'
import { KIND_SCHEMA, SAVE_GENERATION, type EntityKind, type LogKind } from './kinds'

/** Each entity kind's `data`. */
export interface EntityData {
  readonly account: AccountRecord
  readonly umas: UnlockRecord
  readonly cards: UnlockRecord
  readonly careers: CareerRecord
  readonly bonds: BondRecord
}

/** Each log kind's `data`. */
export interface LogData {
  readonly raceResults: RaceResultRecord
  readonly operations: OperationRecord
}

interface Stamped {
  readonly generation: typeof SAVE_GENERATION
  readonly schema: typeof KIND_SCHEMA
}

/** A row's identity and data: what the state is read from, stamped or not. */
export type EntityRef<K extends EntityKind = EntityKind> = K extends EntityKind
  ? { readonly kind: K; readonly id: string; readonly data: EntityData[K] } : never
export type LogRef<K extends LogKind = LogKind> = K extends LogKind
  ? { readonly kind: K; readonly id: string; readonly data: LogData[K] } : never

/** An entity before the writer stamps it. */
export type EntityDraft<K extends EntityKind = EntityKind> = K extends EntityKind ? EntityRef<K> & Stamped : never
/** A log row before the writer stamps it. `at` is when it happened, in the device's time. */
export type LogDraft<K extends LogKind = LogKind> = K extends LogKind ? LogRef<K> & Stamped & { readonly at: number } : never

/** A stored entity: `version` from 1, and the server's time of the commit that wrote it. */
export type EntityRow<K extends EntityKind = EntityKind> = K extends EntityKind
  ? EntityDraft<K> & { readonly version: number; readonly savedAt: number } : never
/** A stored log row. */
export type LogRow<K extends LogKind = LogKind> = K extends LogKind ? LogDraft<K> & { readonly savedAt: number } : never

/** An entity draft of `kind`. */
export const entityDraft = <K extends EntityKind>(kind: K, id: string, data: EntityData[K]): EntityDraft<K> =>
  ({ kind, id, generation: SAVE_GENERATION, schema: KIND_SCHEMA, data }) as unknown as EntityDraft<K>

/** A log draft of `kind`, at `at`. */
export const logDraft = <K extends LogKind>(kind: K, id: string, at: number, data: LogData[K]): LogDraft<K> =>
  ({ kind, id, generation: SAVE_GENERATION, schema: KIND_SCHEMA, at, data }) as unknown as LogDraft<K>

/** The writer's stamp on an entity: its new version and the commit's time. */
export const stampEntity = <K extends EntityKind>(draft: EntityDraft<K>, version: number, savedAt: number): EntityRow<K> =>
  ({ ...draft, version, savedAt }) as EntityRow<K>

/** The writer's stamp on a log row: the commit's time. */
export const stampLog = <K extends LogKind>(draft: LogDraft<K>, savedAt: number): LogRow<K> => ({ ...draft, savedAt }) as LogRow<K>

/** A row's key, `kind/id`, as the outbox and the repositories name it. */
export const rowKey = (row: { readonly kind: string; readonly id: string }): string => `${row.kind}/${row.id}`
