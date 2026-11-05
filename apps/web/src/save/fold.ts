// The store is a fold of the outbox over what the server confirmed (docs/game/architecture.md "The save and sync";
// T136, T152). Pure: the same rows, outbox and content give the same state after a reload, and a refused or changed
// answer rolls a tap back by folding again, with a notice.
// 1. It starts from `toSaveState` of the confirmed entities and the confirmed `operations` rows whose ids are still
//    queued, so an operation the server already ran, whose answer was lost, folds as `repeated` and is never applied
//    twice. With no account row and a create leading the outbox, it starts from the new account.
// 2. It applies each queued operation with `commitOperation`, at the envelope's own time.
// 3. An operation that refuses or throws here is skipped and stays queued: the server is the authority, and its
//    answer settles the tap.
// 4. The log rows the queued operations made (an offline race's result, say) come back as `pendingLogs`.
import {
  commitOperation, initialSave, toSaveState, type EntityRow, type LogDraft, type OperationEnv, type SaveState,
} from '@racer/domain/save'
import type { ConfirmedRows, OutboxRow } from './db'

export interface FoldResult {
  /** Null when the device holds no save: no account row and no create. */
  readonly state: SaveState | null
  /** Each applied or repeated queued operation's receipt, in outbox order. */
  readonly receipts: Readonly<Record<string, unknown>>
  readonly pendingLogs: readonly LogDraft[]
  /** The queued operations that refused or threw here; they stay queued for the server's answer. */
  readonly skipped: readonly string[]
}

const isAccount = (row: EntityRow): boolean => row.kind === 'account' && row.id === 'main'

export function fold(rows: ConfirmedRows, outbox: readonly OutboxRow[], env: OperationEnv): FoldResult {
  const queued = new Set(outbox.flatMap((row) => (row.change.type === 'operation' ? [row.change.operation.id] : [])))
  const first = outbox[0]?.change
  let state: SaveState
  if (rows.entities.some(isAccount)) {
    state = toSaveState(rows.entities, rows.logs.filter((row) => row.kind !== 'operations' || queued.has(row.id)))
  } else if (first?.type === 'create') {
    state = initialSave(first.createdAt).state
  } else {
    return { state: null, receipts: {}, pendingLogs: [], skipped: [] }
  }
  const receipts: Record<string, unknown> = {}
  const pendingLogs: LogDraft[] = []
  const skipped: string[] = []
  for (const row of outbox) {
    if (row.change.type !== 'operation') continue
    const envelope = row.change.operation
    try {
      const commit = commitOperation(state, envelope, env)
      if (commit.status === 'refused') {
        skipped.push(envelope.id)
        continue
      }
      state = commit.state
      receipts[envelope.id] = commit.receipt
      pendingLogs.push(...commit.logs)
    } catch {
      skipped.push(envelope.id)
    }
  }
  return { state, receipts, pendingLogs, skipped }
}
