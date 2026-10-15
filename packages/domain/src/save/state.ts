// The mapping between generation 2's rows and the rework's state (docs/rework/13-removals-and-plan-changes.md §6;
// docs/game/07-farm.md §12; T134). `SaveState` is the work engine's state with the full profile: what every operation
// reads and returns. Rows map onto it one kind to one part; the ledger keeps only the rows a rule reads. No row is ever
// deleted: a work row that empties is written as an empty row, and an item used up as a count of 0, so versions never
// restart and a promoted Uma's dropped work row still syncs.
import { BUILDING_IDS, INITIAL_BUILDINGS, type BuildingId, type BuildingLevel } from '../farm/buildings'
import type { LedgerEntry, LedgerReason, OperationRecord, UmaState } from '../state/types'
import { emptyRow } from '../work/state'
import type { WorkRow, WorkState } from '../work/types'
import { isEntityKind, KIND_ORDER, type EntityKind } from './kinds'
import { entityDraft, type EntityDraft, type EntityRef, type LogRef } from './rows'

/** The account as the rules hold it: `WorkState`, whose profile is the whole `profile/main`. */
export type SaveState = WorkState

/**
 * The ledger reasons a rule reads: unlocks and once-only payments (`hasLedgerEntry`, `payOnce`) and the Shard exchange's
 * sequence. They grow with the roster, not with play time, so the state holds only these.
 */
export const RULE_LEDGER_REASONS = Object.freeze([
  'initial-uma-tickets', 'unlock-uma', 'uma-gate-shard', 'uma-shard-exchange', 'promotion-uma-ticket',
] as const satisfies readonly LedgerReason[])

export const isRuleLedgerRow = (row: Pick<LedgerEntry, 'reason'>): boolean => (RULE_LEDGER_REASONS as readonly string[]).includes(row.reason)

/** A work row that holds nothing at all: what `withRow` leaves out, and what an emptied row is written as. */
const isIdle = (row: WorkRow): boolean => row.entries.length === 0 && row.queue.length === 0 && row.last === null && row.dropped === null

/** Equal as JSON data: key order doesn't matter, and an `undefined` field is an absent one. */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    const other = b as readonly unknown[]
    return a.length === other.length && a.every((item, i) => sameData(item, other[i]))
  }
  const left = Object.entries(a).filter(([, v]) => v !== undefined)
  const right = b as Record<string, unknown>
  const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined)
  return left.length === rightKeys.length && left.every(([key, v]) => Object.hasOwn(right, key) && sameData(v, right[key]))
}

const byAtThenId = (a: LedgerEntry, b: LedgerEntry): number => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * The state the rows hold. `profile/main` is required. Absent buildings are Lv 1; idle work rows and zero item counts
 * are left out; the ledger keeps only the rule rows, by `at`, then id; `operations` holds the rows given (none, no
 * key). Badges and the other logs are not part of the rules' state.
 */
export function toSaveState(entities: readonly EntityRef[], logs: readonly LogRef[]): SaveState {
  const profile = entities.find((row): row is EntityRef<'profile'> => row.kind === 'profile' && row.id === 'main')
  if (profile === undefined) throw new RangeError('A save needs profile/main')
  const umas: Record<string, UmaState> = {}
  const buildings: Record<BuildingId, { readonly level: BuildingLevel }> = { ...INITIAL_BUILDINGS }
  const work: Record<string, WorkRow> = {}
  const items: Record<string, number> = {}
  for (const row of entities) {
    if (row.kind === 'umas') umas[row.id] = row.data
    else if (row.kind === 'buildings') buildings[row.id as BuildingId] = { level: row.data.level }
    else if (row.kind === 'work' && !isIdle(row.data)) work[row.id] = row.data
    else if (row.kind === 'items' && row.data.count > 0) items[row.id] = row.data.count
  }
  const ledger: LedgerEntry[] = []
  const operations: Record<string, OperationRecord> = {}
  for (const row of logs) {
    if (row.kind === 'ledger' && isRuleLedgerRow(row.data)) ledger.push(row.data)
    else if (row.kind === 'operations') operations[row.id] = row.data
  }
  ledger.sort(byAtThenId)
  return {
    profile: profile.data, umas, work, ledger, items, buildings,
    ...(Object.keys(operations).length > 0 ? { operations } : {}),
  }
}

const sortedUnion = (a: object, b: object): string[] => [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()

/**
 * Every entity whose data differs between two states, by deep equality, in `KIND_ORDER` and then by id. A work row that
 * left the state is written as `emptyRow`, an item that left with count 0, and a building is compared at Lv 1 when
 * absent. An Uma never leaves the account: one that did is a caller's bug and throws.
 */
export function entityChanges(before: SaveState, after: SaveState): EntityDraft[] {
  const drafts: { [K in EntityKind]: EntityDraft<K>[] } = { profile: [], umas: [], buildings: [], work: [], items: [], badges: [] }
  if (!sameData(before.profile, after.profile)) drafts.profile.push(entityDraft('profile', 'main', after.profile))
  for (const id of sortedUnion(before.umas, after.umas)) {
    const next = after.umas[id]
    if (next === undefined) throw new RangeError(`An Uma never leaves the account: ${id}`)
    if (!sameData(before.umas[id], next)) drafts.umas.push(entityDraft('umas', id, next))
  }
  for (const id of BUILDING_IDS) {
    const level = after.buildings[id]?.level ?? 1
    if ((before.buildings[id]?.level ?? 1) !== level) drafts.buildings.push(entityDraft('buildings', id, { level }))
  }
  for (const id of sortedUnion(before.work, after.work)) {
    const next = after.work[id] ?? emptyRow(id)
    if (!sameData(before.work[id] ?? emptyRow(id), next)) drafts.work.push(entityDraft('work', id, next))
  }
  for (const id of sortedUnion(before.items, after.items)) {
    const count = after.items[id] ?? 0
    if ((before.items[id] ?? 0) !== count) drafts.items.push(entityDraft('items', id, { count }))
  }
  return KIND_ORDER.filter(isEntityKind).flatMap((kind) => drafts[kind] as EntityDraft[])
}
