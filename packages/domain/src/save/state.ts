// The mapping between generation 3's rows and the rules' state (D381): one record map per entity kind, plus the
// operations the rules read for idempotency. No entity is ever deleted: an Uma, a card, a career or a bond track that
// left the state is a caller's bug.
import { isEntityKind, KIND_ORDER, type EntityKind } from './kinds'
import type { AccountRecord, BondRecord, CareerRecord, OperationRecord, UnlockRecord } from './records'
import { entityDraft, type EntityDraft, type EntityRef, type LogRef } from './rows'

/** The account as the rules hold it. */
export interface SaveState {
  readonly account: AccountRecord
  readonly umas: Readonly<Record<string, UnlockRecord>>
  readonly cards: Readonly<Record<string, UnlockRecord>>
  readonly careers: Readonly<Record<string, CareerRecord>>
  readonly bonds: Readonly<Record<string, BondRecord>>
  /** The operations already applied, by id: what a retried id answers with. */
  readonly operations?: Readonly<Record<string, OperationRecord>>
}

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

type MapKind = Exclude<EntityKind, 'account'>

/** The state the rows hold. `account/main` is required; `operations` holds the rows given (none, no key). */
export function toSaveState(entities: readonly EntityRef[], logs: readonly LogRef[]): SaveState {
  const account = entities.find((row): row is EntityRef<'account'> => row.kind === 'account' && row.id === 'main')
  if (account === undefined) throw new RangeError('A save needs account/main')
  const maps: { [K in MapKind]: Record<string, unknown> } = { umas: {}, cards: {}, careers: {}, bonds: {} }
  for (const row of entities) if (row.kind !== 'account') maps[row.kind][row.id] = row.data
  const operations: Record<string, OperationRecord> = {}
  for (const row of logs) if (row.kind === 'operations') operations[row.id] = row.data
  return {
    account: account.data,
    umas: maps.umas as SaveState['umas'],
    cards: maps.cards as SaveState['cards'],
    careers: maps.careers as SaveState['careers'],
    bonds: maps.bonds as SaveState['bonds'],
    ...(Object.keys(operations).length > 0 ? { operations } : {}),
  }
}

const sortedUnion = (a: object, b: object): string[] => [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()

/** Every entity whose data differs between two states, in `KIND_ORDER` and then by id. */
export function entityChanges(before: SaveState, after: SaveState): EntityDraft[] {
  const drafts: EntityDraft[] = []
  for (const kind of KIND_ORDER.filter(isEntityKind)) {
    if (kind === 'account') {
      if (!sameData(before.account, after.account)) drafts.push(entityDraft('account', 'main', after.account))
      continue
    }
    const was = before[kind] as Readonly<Record<string, unknown>>
    const now = after[kind] as Readonly<Record<string, unknown>>
    for (const id of sortedUnion(was, now)) {
      const next = now[id]
      if (next === undefined) throw new RangeError(`A ${kind} row never leaves the account: ${id}`)
      if (!sameData(was[id], next)) drafts.push(entityDraft(kind, id, next as never))
    }
  }
  return drafts
}
