// What a screen does to the save (docs/game/architecture.md "The save and sync"; T136, T152). A tap is one operation:
// its id is chosen before anything is written, it runs through `commitOperation` (the function the fold and the server
// run) at the device's time, it is applied at once and queued, and the server's answer reconciles it later.
// - Applied: one Dexie transaction adds `op:<id>` to the outbox; then the store takes the new state and the local
//   receipt, and the lane's debounce starts.
// - Refused: nothing is written, and the rule's own words go back to the screen. An input the parser refuses is
//   answered "That didn't work. Try again." and queues nothing.
// - While a `busyKey` is held, a second tap with it gets the first's answer: a double tap does nothing.
// Logs are never loaded into the store; the read helpers merge Dexie's rows with the queued operations' own.
import {
  commitOperation, parseLogRow, type Commit, type LogDraft, type LogKind, type LogRow, type OperationEnv, type OperationEnvelope,
  type OperationRecord, type RaceResultRecord,
} from '@racer/domain/save'
import type { RacerAnswer } from '../app/game'
import { operationKey, UnreadableRow, type SaveDb } from './db'
import { keepReceipts, useSave, type SaveStore, type Serial } from './store'
import { refusalWords, SAVE_WORDS } from './words'

export interface ActionContext {
  readonly db: SaveDb
  readonly env: OperationEnv
  readonly serial: Serial
  readonly now: () => number
  readonly newId: () => string
  /** The lane's debounce. */
  readonly lane: { wrote(): void }
}

export interface SaveActions {
  run<R = unknown>(name: string, input: unknown, busyKey?: string): Promise<RacerAnswer<R>>
  dismissNotice(id: string): void
  /** One Uma's race results, by time, the queued ones included. */
  raceResults(umaId: string): Promise<RaceResultRecord[]>
  /** An operation's receipt: the store's latest, else the server's in Dexie (the store keeps 100). */
  receipt(id: string): Promise<unknown>
  /** An operation's log row: the queued tap's pending one, else the confirmed one in Dexie; null when neither. */
  operation(id: string): Promise<OperationRecord | null>
}

/** An applied tap's outbox count: waiting, unless the lane is already saying it is offline or failing. */
const queued = (sync: SaveStore['sync'], at: number): SaveStore['sync'] => ({
  ...sync,
  status: sync.status === 'offline' || sync.status === 'error' || sync.status === 'syncing' ? sync.status : 'pending',
  pending: sync.pending + 1,
  oldestQueuedAt: sync.oldestQueuedAt === null ? at : Math.min(sync.oldestQueuedAt, at),
})

const byAtThenId = <T extends { readonly at: number; readonly id: string }>(a: T, b: T): number =>
  a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function createActions(ctx: ActionContext): SaveActions {
  const { db, env, serial } = ctx
  const busy = new Map<string, Promise<RacerAnswer>>()

  async function tap(name: string, input: unknown): Promise<RacerAnswer> {
    const { lifecycle, state } = useSave.getState()
    if (lifecycle !== 'ready' || state === null) throw new Error('The game is still opening.')
    const id = ctx.newId()
    const at = ctx.now()
    const envelope: OperationEnvelope = { id, name, input, at }
    let commit: Commit
    try {
      commit = commitOperation(state, envelope, env)
    } catch {
      // An input the server's own parser would refuse: answered here, and nothing is queued.
      return { kind: 'refused', id, code: 'invalid', text: SAVE_WORDS.unexpected }
    }
    if (commit.status === 'refused') return { kind: 'refused', id, code: commit.refusal.code, text: refusalWords(commit.refusal) }
    if (commit.status === 'applied') {
      const applied = commit
      await db.transaction('rw', db.outbox, () =>
        db.outbox.add({ key: operationKey(id), change: { type: 'operation', operation: envelope }, queuedAt: at }))
      useSave.setState((store) => ({
        state: applied.state,
        receipts: keepReceipts({ ...store.receipts, [id]: { local: applied.receipt } }),
        pendingLogs: [...store.pendingLogs, ...applied.logs],
        sync: queued(store.sync, at),
      }))
      ctx.lane.wrote()
    }
    return { kind: 'done', id, state: commit.state, receipt: commit.receipt, repeated: commit.status === 'repeated' }
  }

  function run<R = unknown>(name: string, input: unknown, busyKey?: string): Promise<RacerAnswer<R>> {
    const held = busyKey === undefined ? undefined : busy.get(busyKey)
    if (held !== undefined) return held as Promise<RacerAnswer<R>>
    const answer = serial(() => tap(name, input))
    if (busyKey !== undefined) {
      busy.set(busyKey, answer)
      void answer.finally(() => busy.delete(busyKey)).catch(() => {})
    }
    return answer as Promise<RacerAnswer<R>>
  }

  function dismissNotice(id: string): void {
    useSave.setState((store) => ({ notices: store.notices.filter((notice) => notice.id !== id) }))
  }

  /** Dexie's rows of a log, parsed, with the queued operations' own; Dexie's copy wins a shared id. */
  function merged<K extends LogKind>(kind: K, stored: readonly unknown[], keep: (draft: LogDraft) => boolean): LogRow<K>['data'][] {
    const rows = new Map<string, { readonly at: number; readonly id: string; readonly data: LogRow<K>['data'] }>()
    for (const value of stored) {
      const row = parseLogRow(value)
      if (row === null || row.kind !== kind) {
        useSave.setState({ lifecycle: 'error', words: SAVE_WORDS.unexpected })
        throw new UnreadableRow(kind)
      }
      rows.set(row.id, { at: row.at, id: row.id, data: row.data as LogRow<K>['data'] })
    }
    for (const draft of useSave.getState().pendingLogs) {
      if (draft.kind === kind && keep(draft) && !rows.has(draft.id)) rows.set(draft.id, { at: draft.at, id: draft.id, data: draft.data as LogRow<K>['data'] })
    }
    return [...rows.values()].sort(byAtThenId).map((row) => row.data)
  }

  return {
    run,
    dismissNotice,
    raceResults: async (umaId) =>
      merged('raceResults', await db.raceResults.where('data.umaId').equals(umaId).toArray(), (draft) => (draft.data as RaceResultRecord).umaId === umaId),
    receipt: async (id) => {
      const kept = useSave.getState().receipts[id]
      if (kept !== undefined) return kept.server ?? kept.local
      const row = await db.operations.get(id)
      const parsed = row === undefined ? null : parseLogRow(row)
      return parsed?.kind === 'operations' ? parsed.data.receipt : null
    },
    operation: async (id): Promise<OperationRecord | null> => {
      const pending = useSave.getState().pendingLogs.find((draft) => draft.kind === 'operations' && draft.id === id)
      if (pending !== undefined) return pending.data as OperationRecord
      const row = await db.operations.get(id)
      const parsed = row === undefined ? null : parseLogRow(row)
      return parsed?.kind === 'operations' ? parsed.data : null
    },
  }
}
