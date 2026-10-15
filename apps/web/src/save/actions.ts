// What a screen does to the save (docs/rework/02-check-ins-and-notifications.md §9; T136). A tap is one operation: it is
// checked against the store's state with the domain's rule (`recheck`, the stale-screen rule), applied at once and
// queued, and the server's answer reconciles it later.
// - `done`: one Dexie transaction adds `op:<id>` to the outbox; then the store takes the new state and the local
//   receipt, and the lane's debounce starts. The tap's state comes from `commitOperation`, the function the fold and
//   the server run, so a reload and the server's answer fold to the same account; `recheck` words the refusals.
// - `ask` or `say`: nothing is written, and the answer goes back to the screen.
// - While a `busyKey` is held, a second tap with it gets the first's answer: a double tap does nothing.
// Badges and flair events are the device's own rows, written with their outbox key in one transaction, as today. Logs
// other than the ledger's rule rows are never loaded into the store; the read helpers merge Dexie's rows with the
// queued operations' own.
// - A tap's `device` rows (T141's flair) are computed from the applied operation and the records (the badges, every race
//   result with the tap's own, every flair event) and written in the tap's transaction, behind its outbox row; a
//   callback that throws writes nothing, the tap included.
import type { BadgeStateV1, FlairEventV1 } from '@racer/domain'
import { recheck, type Answer, type OperationInput, type OperationName } from '@racer/domain/rework/check-in'
import type { LedgerEntry } from '@racer/domain/rework/tiers'
import {
  commitOperation, entityDraft, flairEventId, logDraft, parseEntityData, parseLogData, parseLogRow, stampEntity, stampLog, type ItemLedgerRow, type LogDraft,
  type Commit, type LogKind, type LogRow, type OperationEnv, type OperationEnvelope, type RaceResultRow, type SaveState,
} from '@racer/domain/save-g2'
import type { G2DeviceRows, G2Records, G2RunOptions } from '../app/game'
import { flairKeyOf } from '../app/game'
import { badgeKey, flairKey, operationKey, UnreadableRow, type SaveDb } from './db'
import { keepReceipts, outboxCounts, useSave, type SaveStore, type Serial } from './store'
import { unexpectedWords } from './words'

/** A tap's answer, with the operation's id so a sheet can find its receipt again. */
export type RunAnswer<N extends OperationName = OperationName> = Answer<N, SaveState> & { readonly id: string }

export interface ActionContext {
  readonly db: SaveDb
  readonly env: OperationEnv
  readonly serial: Serial
  readonly now: () => number
  readonly newId: () => string
  /** The lane: its debounce, and the rows on the wire. */
  readonly lane: { wrote(): void; readonly inFlight: ReadonlySet<number> }
}

export interface SaveActions {
  run<N extends OperationName>(name: N, input: OperationInput<N>, busyKey?: string, options?: G2RunOptions<N>): Promise<RunAnswer<N>>
  /** Badges and flair events written alone, each as `writeBadge` and `appendFlair` do (T141's Trophy Hall reconcile). */
  writeDevice(rows: G2DeviceRows): Promise<void>
  /** Every Uma's race results, by time, the queued ones included (T141). */
  allRaceResults(): Promise<RaceResultRow[]>
  /** The flair events, by time (T141). */
  flairEvents(): Promise<FlairEventV1[]>
  writeBadge(id: string, data: BadgeStateV1): Promise<void>
  /** False when the event was already written: the first write wins. */
  appendFlair(event: FlairEventV1): Promise<boolean>
  dismissNotice(id: string): void
  /** One Uma's race results, oldest first, the queued ones included. */
  raceResults(umaId: string): Promise<RaceResultRow[]>
  /** The whole ledger, by time and then id, the queued rows included. */
  ledgerRows(): Promise<LedgerEntry[]>
  /** The Warehouse's movements, by time and then id, the queued ones included. */
  itemLedgerRows(): Promise<ItemLedgerRow[]>
  /** An operation's receipt: the store's latest, else the server's in Dexie (the store keeps 100). */
  receipt(id: string): Promise<unknown>
}

/** A `done` tap's outbox count: waiting, unless the lane is already saying it is offline or failing. */
const queued = (sync: SaveStore['sync'], at: number, rows = 1): SaveStore['sync'] => ({
  ...sync,
  status: sync.status === 'offline' || sync.status === 'error' || sync.status === 'syncing' ? sync.status : 'pending',
  pending: sync.pending + rows,
  oldestQueuedAt: sync.oldestQueuedAt === null ? at : Math.min(sync.oldestQueuedAt, at),
})

const byAtThenId = <T extends { readonly at: number; readonly id: string }>(a: T, b: T): number =>
  a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function createActions(ctx: ActionContext): SaveActions {
  const { db, env, serial } = ctx
  const busy = new Map<string, Promise<RunAnswer>>()

  /** A badge row and its outbox key, inside the caller's transaction: true when a new outbox row was added. */
  async function putBadge(id: string, data: BadgeStateV1, at: number): Promise<boolean> {
    const current = await db.badges.get(id)
    await db.badges.put(stampEntity(entityDraft('badges', id, data), current?.version ?? 0, current?.savedAt ?? 0))
    const waiting = await db.outbox.where('key').equals(badgeKey(id)).first()
    if (waiting === undefined) {
      await db.outbox.add({ key: badgeKey(id), change: { type: 'upsert', kind: 'badges', id }, queuedAt: at })
      return true
    }
    // Written again while its row is on the wire: the answer leaves the row, so the newer data goes next.
    if (waiting.seq !== undefined && ctx.lane.inFlight.has(waiting.seq)) {
      await db.outbox.update(waiting.seq, { queuedAt: Math.max(at, waiting.queuedAt + 1) })
    }
    return false
  }

  /** A flair event and its outbox key, inside the caller's transaction, once: false when it was already written. */
  async function putFlair(id: string, event: FlairEventV1, at: number): Promise<boolean> {
    if ((await db.flairEvents.get(id)) !== undefined) return false
    await db.flairEvents.put(stampLog(logDraft('flairEvents', id, event.earnedAt, event), 0))
    await db.outbox.add({ key: flairKey(id), change: { type: 'append', kind: 'flairEvents', id }, queuedAt: at })
    return true
  }

  /** Device rows checked as the parsers will check them at flush; a malformed one is a caller's bug and throws. */
  function checkedRows(rows: G2DeviceRows) {
    const badges = Object.entries(rows.badges ?? {})
    for (const [id, data] of badges) if (parseEntityData('badges', data, id) === null) throw new RangeError(`Malformed badges/${id}`)
    const events = (rows.flairEvents ?? []).map((event) => ({ id: flairEventId(event.scope, event.umaId, event.awardKey, event.stage), event }))
    for (const { id, event } of events) if (parseLogData('flairEvents', event, id) === null) throw new RangeError(`Malformed flairEvents/${id}`)
    return { badges, events }
  }

  /** The records a `device` callback reads: the store's badges, every race result (the tap's own too) and flair event. */
  async function records(own: readonly LogDraft[]): Promise<G2Records> {
    const races = merged('raceResults', await db.raceResults.toArray(), () => true)
    for (const draft of own) if (draft.kind === 'raceResults') races.push(draft.data as RaceResultRow)
    const events = merged('flairEvents', await db.flairEvents.toArray(), () => true)
    return {
      badges: useSave.getState().badges,
      raceResults: Object.fromEntries(races.map((row) => [row.opId, row])),
      flairEvents: Object.fromEntries(events.map((event) => [flairKeyOf(event), event])),
    }
  }

  async function tap<N extends OperationName>(name: N, input: OperationInput<N>, options?: G2RunOptions<N>): Promise<RunAnswer<N>> {
    const { lifecycle, state } = useSave.getState()
    if (lifecycle !== 'ready' || state === null) throw new Error('The game is still opening.')
    const id = ctx.newId()
    const at = ctx.now()
    const envelope: OperationEnvelope<N> = { id, name, input, at }
    let commit: Commit<N>
    try {
      commit = commitOperation(state, envelope, env)
    } catch {
      // An input the server's own parser would refuse: answered here, and nothing is queued.
      return { kind: 'say', words: unexpectedWords(), id }
    }
    if (commit.status === 'refused') return { ...recheck(state, { id, name, input }, at, env), id }
    if (commit.status === 'applied') {
      const applied = commit
      const device = options?.device === undefined ? null : checkedRows(options.device({
        id, name, at, before: state, state: applied.state, receipt: applied.receipt, records: await records(applied.logs),
      }))
      const rows = await db.transaction('rw', [db.outbox, db.badges, db.flairEvents], async () => {
        await db.outbox.add({ key: operationKey(id), change: { type: 'operation', operation: envelope }, queuedAt: at })
        let added = 1
        for (const [badgeId, data] of device?.badges ?? []) if (await putBadge(badgeId, data, at)) added += 1
        for (const { id: eventId, event } of device?.events ?? []) if (await putFlair(eventId, event, at)) added += 1
        return added
      })
      useSave.setState((store) => ({
        state: applied.state,
        receipts: keepReceipts({ ...store.receipts, [id]: { local: applied.receipt } }),
        pendingLogs: [...store.pendingLogs, ...applied.logs],
        ...(device === null || device.badges.length === 0 ? {} : { badges: { ...store.badges, ...Object.fromEntries(device.badges) } }),
        sync: queued(store.sync, at, rows),
      }))
      ctx.lane.wrote()
    }
    return { kind: 'done', state: commit.state, receipt: commit.receipt, repeated: commit.status === 'repeated', id }
  }

  function run<N extends OperationName>(name: N, input: OperationInput<N>, busyKey?: string, options?: G2RunOptions<N>): Promise<RunAnswer<N>> {
    const held = busyKey === undefined ? undefined : busy.get(busyKey)
    if (held !== undefined) return held as Promise<RunAnswer<N>>
    const answer = serial(() => tap(name, input, options))
    if (busyKey !== undefined) {
      busy.set(busyKey, answer as Promise<RunAnswer>)
      void answer.finally(() => busy.delete(busyKey)).catch(() => {})
    }
    return answer
  }

  function writeBadge(id: string, data: BadgeStateV1): Promise<void> {
    if (parseEntityData('badges', data, id) === null) return Promise.reject(new RangeError(`Malformed badges/${id}`))
    return serial(async () => {
      const at = ctx.now()
      const added = await db.transaction('rw', db.badges, db.outbox, () => putBadge(id, data, at))
      useSave.setState((store) => ({ badges: { ...store.badges, [id]: data }, ...(added ? { sync: queued(store.sync, at) } : {}) }))
      ctx.lane.wrote()
    })
  }

  function appendFlair(event: FlairEventV1): Promise<boolean> {
    const id = flairEventId(event.scope, event.umaId, event.awardKey, event.stage)
    if (parseLogData('flairEvents', event, id) === null) return Promise.reject(new RangeError(`Malformed flairEvents/${id}`))
    return serial(async () => {
      const at = ctx.now()
      const added = await db.transaction('rw', db.flairEvents, db.outbox, () => putFlair(id, event, at))
      if (added) {
        useSave.setState((store) => ({ sync: queued(store.sync, at) }))
        ctx.lane.wrote()
      }
      return added
    })
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
        useSave.setState({ lifecycle: 'error', words: unexpectedWords().text })
        throw new UnreadableRow(kind)
      }
      rows.set(row.id, { at: row.at, id: row.id, data: row.data as LogRow<K>['data'] })
    }
    for (const draft of useSave.getState().pendingLogs) {
      if (draft.kind === kind && keep(draft) && !rows.has(draft.id)) rows.set(draft.id, { at: draft.at, id: draft.id, data: draft.data as LogRow<K>['data'] })
    }
    return [...rows.values()].sort(byAtThenId).map((row) => row.data)
  }

  async function writeDevice(rows: G2DeviceRows): Promise<void> {
    const { badges, events } = checkedRows(rows)
    for (const [id, data] of badges) await writeBadge(id, data)
    for (const { event } of events) await appendFlair(event)
  }

  return {
    run,
    writeBadge,
    appendFlair,
    writeDevice,
    allRaceResults: async () => merged('raceResults', await db.raceResults.toArray(), () => true),
    flairEvents: async () => merged('flairEvents', await db.flairEvents.toArray(), () => true),
    dismissNotice,
    raceResults: async (umaId) =>
      merged('raceResults', await db.raceResults.where('data.umaId').equals(umaId).toArray(), (draft) => (draft.data as RaceResultRow).umaId === umaId),
    ledgerRows: async () => merged('ledger', await db.ledger.toArray(), () => true),
    itemLedgerRows: async () => merged('itemLedger', await db.itemLedger.toArray(), () => true),
    receipt: async (id) => {
      const kept = useSave.getState().receipts[id]
      if (kept !== undefined) return kept.server ?? kept.local
      const row = await db.operations.get(id)
      const parsed = row === undefined ? null : parseLogRow(row)
      return parsed?.kind === 'operations' ? parsed.data.receipt : null
    },
  }
}
