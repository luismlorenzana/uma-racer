// What generation 2 stores and the wire carries (docs/rework/13-removals-and-plan-changes.md §6; T134): one row per
// entity or log entry, each stamped with the generation and its kind's schema. An entity's `version` starts at 1 and
// rises by one with each committed sync that changes it; a log row never changes once written. Drafts are rows before
// the writer stamps them: only the server (or the device, for its own badges and flair) gives a version and `savedAt`.
import type { BadgeStateV1, FlairEventV1 } from '../badges'
import type { RaceRun } from '../progression-race'
import type { FinishRaceReceipt } from '../check-in/finish-race'
import type { ItemLedgerReason } from '../economy/ledger'
import type { BuildingLevel } from '../farm/buildings'
import type { ItemId } from '../items/catalogue'
import type { AccountProfile, LedgerEntry, OperationRecord, ScenarioOfTier, Tier, UmaState } from '../state/types'
import type { WorkRow } from '../work/types'
import { KIND_SCHEMA, SAVE_GENERATION, type EntityKind, type LogKind } from './kinds'

/** `itemLedger/{id}`: one movement of Warehouse stock, with whose work moved it and the operation that did. */
export interface ItemLedgerRow {
  readonly id: string
  readonly itemId: ItemId
  /** Negative when stock left: a reserve, an upgrade's cost, a Speed Ticket spent, a sale. */
  readonly delta: number
  readonly reason: ItemLedgerReason
  /** Whose work moved it; null for an upgrade's cost, a purchase, a sale or a grant. */
  readonly outfitId: string | null
  readonly opId: string
  readonly at: number
}

/** `raceResults/{opId}`: a `finish-race` operation's race, kept with its commit (09 §9). */
export interface RaceResultRow {
  readonly umaId: string
  readonly raceId: string
  /** The operation's id, which is also the row's and the race result's. */
  readonly opId: string
  readonly at: number
  /** Where she raced: badges are scenario-linked (D122). */
  readonly tier: Tier
  readonly scenario: ScenarioOfTier
  /**
   * The set she raced with: the card set of the preset of the race's distance, after the operation's collect (T141).
   * Era Loyalist reads the sets of every race she ran in a scenario (06 §7).
   */
  readonly cardSetIds: readonly string[]
  readonly run: RaceRun
  /** The operation's receipt: what the result screen shows on reload. */
  readonly commit: FinishRaceReceipt
}

/** Each entity kind's `data`. */
export interface EntityData {
  readonly profile: AccountProfile
  readonly umas: UmaState
  /** Slots are read from the work rows (07 §12). */
  readonly buildings: { readonly level: BuildingLevel }
  readonly work: WorkRow
  readonly items: { readonly count: number }
  readonly badges: BadgeStateV1
}

/** Each log kind's `data`. */
export interface LogData {
  readonly raceResults: RaceResultRow
  readonly ledger: LedgerEntry
  readonly itemLedger: ItemLedgerRow
  readonly flairEvents: FlairEventV1
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
