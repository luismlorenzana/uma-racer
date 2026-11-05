// Strict parsers for generation 3's rows (D381): exact keys, unknown keys refused, `T | null`. Each checks a row's id
// against its data. Receipts are checked as JSON objects within the row bound, not field by field. Pure: no clock, no
// I/O.
import { isEntityKind, isLogKind, isOperationId, isRowId, KIND_SCHEMA, SAVE_GENERATION, SAVE_LIMITS, type EntityKind, type LogKind } from './kinds'
import {
  bondId, careerId, parseAccountRecord, parseBondRecord, parseCareerRecord, parseRaceResultRecord, parseUnlockRecord, type OperationRecord,
} from './records'
import type { Refusal } from './registry'
import type { EntityData, EntityRow, LogData, LogRow } from './rows'

// --- Primitives -----------------------------------------------------------------------------------------------------

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every required key present, and nothing but the required and optional keys. A key holding `undefined` is absent, as
 * JSON reads it, so a value kept by structured clone (Dexie) parses as its JSON copy does.
 */
export function exactKeys(value: Record<string, unknown>, keys: readonly string[], optional: readonly string[] = []): boolean {
  const actual = Object.keys(value).filter((key) => value[key] !== undefined)
  return keys.every((key) => value[key] !== undefined && Object.hasOwn(value, key)) && actual.every((key) => keys.includes(key) || optional.includes(key))
}

export const isNonNegativeInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0
export const isPositiveInt = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0
export const isTimestamp = isNonNegativeInt
const isText = (value: unknown, max = 500): value is string => typeof value === 'string' && value.length > 0 && value.length <= max

/** Unique ids, each passing `check`, at most `max`. */
export function parseIds(value: unknown, max = Number.POSITIVE_INFINITY, check: (id: unknown) => boolean = isRowId): string[] | null {
  if (!Array.isArray(value) || value.length > max || !value.every(check)) return null
  return new Set(value).size === value.length ? [...(value as string[])] : null
}

/**
 * The UTF-8 bytes of `value` as JSON: what a row, an input or a request weighs against `SAVE_LIMITS`. Counted by hand,
 * so the module reads no platform encoder.
 */
export function jsonBytes(value: unknown): number {
  const text = JSON.stringify(value) ?? ''
  let bytes = 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      bytes += 4
      i += 1
    } else bytes += 3
  }
  return bytes
}

/** A JSON value: null, a boolean, a finite number, a string, or arrays and plain objects of them. */
export function isJson(value: unknown): boolean {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJson)
  // An object's `undefined` field is one JSON leaves out.
  if (isObject(value)) return Object.getPrototypeOf(value) === Object.prototype && Object.values(value).every((v) => v === undefined || isJson(v))
  return false
}

/** A receipt as stored: a JSON object within the row bound (receipts are not re-checked field by field). */
export const isReceipt = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && isJson(value) && jsonBytes(value) <= SAVE_LIMITS.rowBytes

// --- Shared shapes --------------------------------------------------------------------------------------------------

export function parseRefusal(value: unknown): Refusal | null {
  if (!isObject(value) || !exactKeys(value, ['refused', 'code', 'reason'], ['data'])) return null
  if (value.refused !== true || !isText(value.code, 80) || !isText(value.reason)) return null
  if (value.data !== undefined) {
    if (!isObject(value.data) || !Object.values(value.data).every((v) => typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))) return null
    return { refused: true, code: value.code, reason: value.reason, data: { ...(value.data as Record<string, string | number>) } }
  }
  return { refused: true, code: value.code, reason: value.reason }
}

// --- Rows -----------------------------------------------------------------------------------------------------------

export function parseOperationRecord(value: unknown): OperationRecord | null {
  if (!isObject(value) || !exactKeys(value, ['name', 'at', 'receipt'])) return null
  if (!isText(value.name, 80) || !isTimestamp(value.at) || !isReceipt(value.receipt)) return null
  return { name: value.name, at: value.at, receipt: value.receipt }
}

const ENTITY_PARSERS: { readonly [K in EntityKind]: (value: unknown) => EntityData[K] | null } = {
  account: parseAccountRecord,
  umas: parseUnlockRecord,
  cards: parseUnlockRecord,
  careers: parseCareerRecord,
  bonds: parseBondRecord,
}

const ENTITY_IDS: { readonly [K in EntityKind]: (id: string, data: EntityData[K]) => boolean } = {
  account: (id) => id === 'main',
  umas: (id) => isRowId(id),
  cards: (id) => isRowId(id),
  careers: (id, data) => id === careerId(data.umaId, data.T),
  bonds: (id, data) => id === bondId(data.umaId, data.tier, data.cardId),
}

const LOG_PARSERS: { readonly [K in LogKind]: (value: unknown) => LogData[K] | null } = {
  raceResults: parseRaceResultRecord,
  operations: parseOperationRecord,
}

/** A race result's id is its operation's, or `<opId>:<n>` when one operation ran several; an operation's is its id. */
const LOG_IDS: { readonly [K in LogKind]: (id: string, data: LogData[K]) => boolean } = {
  raceResults: (id) => isOperationId(id.split(':')[0]),
  operations: (id) => isOperationId(id),
}

export function logAt<K extends LogKind>(_kind: K, data: LogData[K]): number {
  return (data as { readonly at: number }).at
}

/** Whether `matches` holds, with an id helper that throws on an over-long id read as a mismatch. */
function idMatches<T>(matches: (id: string, data: T) => boolean, id: string, data: T): boolean {
  try {
    return matches(id, data)
  } catch {
    return false
  }
}

/** An entity's data of `kind`, checked against `id` when given; null when malformed. */
export function parseEntityData<K extends EntityKind>(kind: K, value: unknown, id?: string): EntityData[K] | null {
  if (!isEntityKind(kind)) return null
  const data = (ENTITY_PARSERS[kind] as (value: unknown) => EntityData[K] | null)(value)
  if (data === null || (id !== undefined && !idMatches(ENTITY_IDS[kind] as (id: string, data: EntityData[K]) => boolean, id, data))) return null
  return data
}

/** A log entry's data of `kind`, checked against `id` when given; null when malformed. */
export function parseLogData<K extends LogKind>(kind: K, value: unknown, id?: string): LogData[K] | null {
  if (!isLogKind(kind)) return null
  const data = (LOG_PARSERS[kind] as (value: unknown) => LogData[K] | null)(value)
  if (data === null || (id !== undefined && !idMatches(LOG_IDS[kind] as (id: string, data: LogData[K]) => boolean, id, data))) return null
  return data
}

const fitsRow = (value: unknown): boolean => jsonBytes(value) <= SAVE_LIMITS.rowBytes

/** A stored entity: generation 3, schema 1, a version from 1, its commit's time, and data that matches its id. */
export function parseEntityRow(value: unknown): EntityRow | null {
  if (!isObject(value) || !exactKeys(value, ['kind', 'id', 'generation', 'schema', 'version', 'savedAt', 'data'])) return null
  if (!isEntityKind(value.kind) || !isRowId(value.id) || value.generation !== SAVE_GENERATION || value.schema !== KIND_SCHEMA) return null
  if (!isPositiveInt(value.version) || !isTimestamp(value.savedAt) || !fitsRow(value)) return null
  const data = parseEntityData(value.kind, value.data, value.id)
  if (data === null) return null
  return { kind: value.kind, id: value.id, generation: SAVE_GENERATION, schema: KIND_SCHEMA, version: value.version, savedAt: value.savedAt, data } as EntityRow
}

/** A stored log row: generation 3, schema 1, `at` equal to its data's time, and data that matches its id. */
export function parseLogRow(value: unknown): LogRow | null {
  if (!isObject(value) || !exactKeys(value, ['kind', 'id', 'generation', 'schema', 'at', 'savedAt', 'data'])) return null
  if (!isLogKind(value.kind) || !isRowId(value.id) || value.generation !== SAVE_GENERATION || value.schema !== KIND_SCHEMA) return null
  if (!isTimestamp(value.at) || !isTimestamp(value.savedAt) || !fitsRow(value)) return null
  const data = parseLogData(value.kind, value.data, value.id)
  if (data === null || logAt(value.kind, data) !== value.at) return null
  return { kind: value.kind, id: value.id, generation: SAVE_GENERATION, schema: KIND_SCHEMA, at: value.at, savedAt: value.savedAt, data } as LogRow
}
