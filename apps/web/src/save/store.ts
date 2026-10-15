// One Zustand store over the rework state (docs/rearchitecture/01-target-architecture.md §4.2; T136): `useSave`, read
// through selectors. No other store holds game state. It publishes only after Dexie commits (today's rule): a tap's
// outbox row, a flush's answer and a pull's page are written first, and the store refolds or takes the tap's result
// after. Every change to it runs through the session's one `serial` queue, so a tap and a reconcile never interleave.
import type { BadgeStateV1 } from '@racer/domain'
import type { Words } from '@racer/domain/rework/check-in'
import type { EntityRow, LogDraft, OperationEnv, SaveState } from '@racer/domain/save-g2'
import { create } from 'zustand'
import { readConfirmed, readOutbox, type OutboxRow, type SaveDb } from './db'
import { fold } from './fold'

export type Lifecycle = 'booting' | 'ready' | 'error'
export type SyncStatus = 'idle' | 'pending' | 'syncing' | 'offline' | 'error'

export interface SaveSync {
  readonly status: SyncStatus
  /** Outbox rows waiting for an answer. */
  readonly pending: number
  /** The oldest waiting row's time: the Sync chip turns amber once it is over a day old (02 §9, D157). */
  readonly oldestQueuedAt: number | null
  readonly lastSuccessAt: number | null
  /** The chip's sentence, in 02 §9's words; null when there is nothing to say. */
  readonly words: string | null
}

/** A tap's receipt on this device, and the server's once it answers (02 §9: the summary compares them). */
export interface SaveReceipt {
  readonly local: unknown
  readonly server?: unknown
}

/** A refused or failed tap, in plain words, until the screen dismisses it (09 §8: "rolls back with a notice"). */
export interface SaveNotice {
  /** The tap's own id, so the sheet that sent it can find its notice. */
  readonly id: string
  readonly words: Words
  readonly text: string
}

export interface SaveStore {
  readonly lifecycle: Lifecycle
  /** Why the save can't open, in plain words, when `lifecycle` is `error`. */
  readonly words: string | null
  readonly state: SaveState | null
  /** The badge rows' data, by row id (`trainer`, `uma:<outfitId>`). */
  readonly badges: Readonly<Record<string, BadgeStateV1>>
  /** The latest 100 operations' receipts, by operation id. */
  readonly receipts: Readonly<Record<string, SaveReceipt>>
  /** The log rows the queued operations made, until the server's rows replace them. */
  readonly pendingLogs: readonly LogDraft[]
  readonly notices: readonly SaveNotice[]
  /** Whether sync may run: signed in (T143 wires the auth provider). The chip says "Sync paused" otherwise (D353). */
  readonly signedIn: boolean
  readonly sync: SaveSync
}

/** The store keeps this many receipts; older ones stay in Dexie's `operations` table. */
export const RECEIPTS_KEPT = 100

const INITIAL: SaveStore = Object.freeze({
  lifecycle: 'booting',
  words: null,
  state: null,
  badges: {},
  receipts: {},
  pendingLogs: [],
  notices: [],
  signedIn: true,
  sync: Object.freeze({ status: 'idle', pending: 0, oldestQueuedAt: null, lastSuccessAt: null, words: null }),
})

export const useSave = create<SaveStore>(() => INITIAL)

/** Back to a booting store (tests, and a device that boots again as new after a 409). */
export const resetSave = (keep: Partial<Pick<SaveStore, 'signedIn'>> = {}): void => useSave.setState({ ...INITIAL, ...keep }, true)

export const selectLifecycle = (store: SaveStore): Lifecycle => store.lifecycle
export const selectState = (store: SaveStore): SaveState | null => store.state
export const selectSync = (store: SaveStore): SaveSync => store.sync
export const selectReceipts = (store: SaveStore): SaveStore['receipts'] => store.receipts
export const selectNotices = (store: SaveStore): SaveStore['notices'] => store.notices

export const setSync = (sync: Partial<SaveSync>): void => useSave.setState((store) => ({ sync: { ...store.sync, ...sync } }))

/** One queue for everything that writes the save and publishes: taps, reconciles, pulls and the 409 reset. */
export type Serial = <T>(work: () => Promise<T>) => Promise<T>

export function createSerial(): Serial {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(work: () => Promise<T>) => {
    const run = tail.then(work, work)
    tail = run.catch(() => {})
    return run
  }
}

/** The latest receipts, at most 100, oldest first. */
export function keepReceipts(receipts: Readonly<Record<string, SaveReceipt>>): Record<string, SaveReceipt> {
  const ids = Object.keys(receipts)
  return Object.fromEntries(ids.slice(-RECEIPTS_KEPT).map((id) => [id, receipts[id]!]))
}

/** What an answer changes besides the rows: the server's receipts, the taps that came to nothing, and their notices. */
export interface Answered {
  readonly server?: Readonly<Record<string, unknown>>
  readonly dropped?: readonly string[]
  readonly notices?: readonly SaveNotice[]
}

const badgeData = (entities: readonly EntityRow[]): Record<string, BadgeStateV1> =>
  Object.fromEntries(entities.flatMap((row) => (row.kind === 'badges' ? [[row.id, row.data] as const] : [])))

export function outboxCounts(outbox: readonly OutboxRow[]): Pick<SaveSync, 'pending' | 'oldestQueuedAt'> {
  return { pending: outbox.length, oldestQueuedAt: outbox.length === 0 ? null : Math.min(...outbox.map((row) => row.queuedAt)) }
}

/**
 * Reads the confirmed rows and the outbox, folds, and publishes: the state, the badges, the receipts (the server's
 * replacing none of the local ones it answers, a dropped tap's removed, each still-queued tap's local one kept from its
 * tap), the pending logs and the outbox counts. Called inside `serial`, after the transaction that changed the rows.
 * Throws `UnreadableRow` when a row doesn't parse.
 */
export async function refold(db: SaveDb, env: OperationEnv, answered: Answered = {}): Promise<boolean> {
  const outbox = await readOutbox(db)
  const ids = outbox.flatMap((row) => (row.change.type === 'operation' ? [row.change.operation.id] : []))
  const rows = await readConfirmed(db, ids)
  const result = fold(rows, outbox, env)
  useSave.setState((store) => {
    const receipts: Record<string, SaveReceipt> = { ...store.receipts }
    for (const id of answered.dropped ?? []) delete receipts[id]
    for (const [id, receipt] of Object.entries(answered.server ?? {})) receipts[id] = { local: receipts[id]?.local ?? receipt, server: receipt }
    for (const [id, receipt] of Object.entries(result.receipts)) receipts[id] ??= { local: receipt }
    return {
      state: result.state,
      badges: badgeData(rows.entities),
      receipts: keepReceipts(receipts),
      pendingLogs: result.pendingLogs,
      notices: answered.notices === undefined || answered.notices.length === 0 ? store.notices : [...store.notices, ...answered.notices],
      sync: { ...store.sync, ...outboxCounts(outbox) },
    }
  })
  return result.state !== null
}
