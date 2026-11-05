// Generation 3's kinds, stamps and bounds (docs/game/architecture.md "The save and sync", D381). Five entities,
// versioned, and two logs, written once. Every kind changes by an operation, or by the create that makes a new account;
// the device writes no rows of its own. Pure constants.

/** The save's generation, on every row, request and response. Generation 2 was wiped by the restart (D380). */
export const SAVE_GENERATION = 3
/** The sync protocol, on every request and response. Anything else is the caller's 426. */
export const SAVE_PROTOCOL = 3
/** One schema version per kind, with no migrations: generation 3 starts every kind at 1. */
export const KIND_SCHEMA = 1

/** The entities: `account/main`, `umas/{outfitId}`, `cards/{cardId}`, `careers/{umaId}:{T}` and `bonds/{umaId}:{tier}:{cardId}`. */
export const ENTITY_KINDS = Object.freeze(['account', 'umas', 'cards', 'careers', 'bonds'] as const)
export type EntityKind = (typeof ENTITY_KINDS)[number]
/** The logs: append-only, first write wins. */
export const LOG_KINDS = Object.freeze(['raceResults', 'operations'] as const)
export type LogKind = (typeof LOG_KINDS)[number]
export type SaveKind = EntityKind | LogKind

/** The order a pull walks the kinds: the account and what it owns first, then the operations, then race history. */
export const KIND_ORDER: readonly SaveKind[] = Object.freeze([
  'account', 'umas', 'cards', 'careers', 'bonds', 'operations', 'raceResults',
] as const)

export const isEntityKind = (value: unknown): value is EntityKind => (ENTITY_KINDS as readonly unknown[]).includes(value)
export const isLogKind = (value: unknown): value is LogKind => (LOG_KINDS as readonly unknown[]).includes(value)

/**
 * The bounds (T134): under Firestore's 1 MiB document and Cloud Run's response limits, with room for a stage's journal.
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
