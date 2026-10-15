// Generation 2's kinds, stamps and bounds (docs/rework/13-removals-and-plan-changes.md §6; docs/rearchitecture/01-target-
// architecture.md §4.3, §5; docs/rearchitecture/07-data-reset.md §4; T134). Eleven kinds and only these: six entities,
// versioned, and five logs, written once. Only badges and flair events are the device's to write; every other kind
// changes by an operation, or by the create that makes a new account. Pure constants.

/** The save's generation, on every row, request and response (07 §4). */
export const SAVE_GENERATION = 2
/** The sync protocol, on every request and response. Anything else is the caller's 426 (07 §4). */
export const SAVE_PROTOCOL = 2
/** One schema version per kind (01 §5), with no migrations: generation 2 starts every kind at 1. */
export const KIND_SCHEMA = 1

/** The entities: `profile/main`, `umas/{outfitId}`, `buildings/{id}`, `work/{outfitId}`, `items/{itemId}` and `badges/…`. */
export const ENTITY_KINDS = Object.freeze(['profile', 'umas', 'buildings', 'work', 'items', 'badges'] as const)
export type EntityKind = (typeof ENTITY_KINDS)[number]
/** The logs: append-only, first write wins. */
export const LOG_KINDS = Object.freeze(['raceResults', 'ledger', 'itemLedger', 'flairEvents', 'operations'] as const)
export type LogKind = (typeof LOG_KINDS)[number]
export type SaveKind = EntityKind | LogKind

/**
 * The order a pull walks the kinds: the profile and the account's parts first, then the logs the rules read (the
 * ledger's rule rows and the operations), then history. A second device can play once the kinds before `flairEvents`
 * have arrived (T136).
 */
export const KIND_ORDER: readonly SaveKind[] = Object.freeze([
  'profile', 'buildings', 'umas', 'work', 'items', 'badges', 'ledger', 'operations', 'flairEvents', 'itemLedger', 'raceResults',
] as const)

/** The kinds the device writes as rows, as today: badge state and flair events (M034). */
export const DEVICE_KINDS = Object.freeze(['badges', 'flairEvents'] as const)
export type DeviceKind = (typeof DEVICE_KINDS)[number]

export const isEntityKind = (value: unknown): value is EntityKind => (ENTITY_KINDS as readonly unknown[]).includes(value)
export const isLogKind = (value: unknown): value is LogKind => (LOG_KINDS as readonly unknown[]).includes(value)

/**
 * The bounds (T134): under Firestore's 1 MiB document and Cloud Run's response limits, with room for a 25-Uma Collect
 * all's receipt.
 */
export const SAVE_LIMITS = Object.freeze({
  /** Changes in one sync request. */
  changes: 100,
  /** A sync request's JSON, in bytes. */
  requestBytes: 2 * 1024 * 1024,
  /** One row's JSON, or one operation's input, in bytes. */
  rowBytes: 512 * 1024,
  /** Rows in one pulled page. */
  pageRows: 1_000,
  /** One pulled page's JSON, in bytes. */
  pageBytes: 4 * 1024 * 1024,
  /** A row id's length, in today's id alphabet. */
  idLength: 160,
})

/** A row id: today's alphabet (`SAVE_ID_PATTERN`), up to 160 characters, so ids derived from an operation's fit. */
export const ROW_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,160}$/
/**
 * An operation's id, chosen before the tap is written: 8–64 letters, digits, `_` or `-`, never a colon, so the ids
 * derived from it (`race:<id>:prize`, `<id>:m3`) stay within 160 and parse cleanly.
 */
export const OPERATION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

/** A pull leaves out `operations` rows older than a week: the summary reads only recent receipts (02 §10). */
export const OPERATIONS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const isRowId = (value: unknown): value is string => typeof value === 'string' && ROW_ID_PATTERN.test(value)
export const isOperationId = (value: unknown): value is string => typeof value === 'string' && OPERATION_ID_PATTERN.test(value)
