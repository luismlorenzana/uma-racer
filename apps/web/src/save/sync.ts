// One sync lane (docs/game/architecture.md "The save and sync"; T136, T152): the create and the operations flush through
// one outbox in order, one run at a time, and a trigger during a run queues one more after it.
// - Triggers: a write (1.5 s after the last one); the app hidden (flush now, before iOS suspends it); visible or back
//   online (flush, then pull); the save opening (flush, then pull); and a flush that left rows behind (flush again).
// - A flush sends the first 100 rows by `seq`, so a create always leads. Its answer is applied in one transaction: the
//   returned rows by version, then every answered row out of the outbox. The store then refolds. A response that
//   doesn't answer every change, in order, applies nothing.
// - A pull reads every page since the last pull's `serverTime` less five minutes (a sync commits a moment after it
//   stamps its rows), and adopts rows by version; an empty database pulls from 0. Its place is kept in
//   `uma-racer:g3:pull`, so an interrupted pull resumes from its cursor.
// - Failures: offline waits for a trigger; auth, server, unavailable and invalid retry after 5 s, 30 s and 2 minutes,
//   then every 5 minutes while the app is visible and the outbox isn't empty; a 426 stops the lane until the app
//   restarts; a 409 drops the device's save and outbox, and it boots as a new device.
import {
  answersRequest, KIND_ORDER, SAVE_LIMITS, type EntityRow, type LogRow, type OperationEnv, type SaveKind, type SaveSnapshot, type SyncChange,
  type SyncResponse,
} from '@racer/domain/save'
import { failureOf, SaveApiError, type SaveApi, type SaveFailure } from './api'
import { UnreadableRow, type OutboxRow, type SaveDb } from './db'
import { refold, setSync, useSave, type Answered, type SaveNotice, type Serial } from './store'
import { failureWords, refusalWords, SAVE_WORDS } from './words'

/** A write flushes this long after the last one (uma-rpg's timing). */
export const DEBOUNCE_MS = 1_500
/**
 * A pull starts this long before the last one's `serverTime`: a sync stamps `savedAt` inside its transaction and
 * commits a moment later, so a row can land after a pull that read past its time. Re-reading a row changes nothing.
 */
export const PULL_OVERLAP_MS = 5 * 60_000
/** The retries after a failure that isn't offline, then every `RETRY_EVERY_MS` while visible with rows waiting. */
export const RETRY_DELAYS_MS = Object.freeze([5_000, 30_000, 120_000])
export const RETRY_EVERY_MS = 5 * 60_000
/** Where the pull keeps its place. */
export const PULL_KEY = 'uma-racer:g3:pull'

interface PullMark {
  /** The last complete pull's first `serverTime`. */
  readonly serverTime?: number
  /** A pull still in progress: where it started, its next page, its first `serverTime`, and whether the rule kinds are in. */
  readonly resume?: { readonly since: number; readonly cursor: string; readonly serverTime: number; readonly ready: boolean }
}

const isTime = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0

/** The kept place, or none: a mark that doesn't read back cleanly starts the pull from 0 again. */
function readMark(storage: Storage | null): PullMark {
  try {
    const value = JSON.parse(storage?.getItem(PULL_KEY) ?? '{}') as Record<string, unknown> | null
    if (typeof value !== 'object' || value === null) return {}
    const serverTime = isTime(value.serverTime) ? { serverTime: value.serverTime } : {}
    const resume = value.resume as Record<string, unknown> | undefined
    if (typeof resume !== 'object' || resume === null) return serverTime
    if (!isTime(resume.since) || typeof resume.cursor !== 'string' || !isTime(resume.serverTime) || typeof resume.ready !== 'boolean') return serverTime
    return { ...serverTime, resume: { since: resume.since, cursor: resume.cursor, serverTime: resume.serverTime, ready: resume.ready } }
  } catch {
    return {}
  }
}

function writeMark(storage: Storage | null, mark: PullMark | null): void {
  try {
    if (mark === null) storage?.removeItem(PULL_KEY)
    else storage?.setItem(PULL_KEY, JSON.stringify(mark))
  } catch {
    // The next pull then starts from 0 again: re-reading rows changes nothing.
  }
}

/** Where `operations` sits: a page with a row after it has brought every kind the rules read (`KIND_ORDER`). */
const RULE_KINDS_END = KIND_ORDER.indexOf('operations')
const isHistory = (kind: SaveKind): boolean => KIND_ORDER.indexOf(kind) > RULE_KINDS_END

/** What the lane listens to: the page's visibility and the network. */
export interface LaneSignals {
  visible(): boolean
  online(): boolean
  onVisibility(listener: (visible: boolean) => void): () => void
  onOnline(listener: () => void): () => void
}

export const browserSignals: LaneSignals = {
  visible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  onVisibility(listener) {
    if (typeof document === 'undefined') return () => {}
    const handler = () => listener(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  },
  onOnline(listener) {
    if (typeof window === 'undefined') return () => {}
    window.addEventListener('online', listener)
    return () => window.removeEventListener('online', listener)
  },
}

export interface LaneDeps {
  readonly db: SaveDb
  readonly api: SaveApi
  readonly env: OperationEnv
  readonly serial: Serial
  readonly storage: Storage | null
  readonly signals: LaneSignals
  readonly now: () => number
  /** A 409: drop the device's save and outbox (inside `serial`). */
  readonly dropSave: () => Promise<void>
  /** Then boot again as a new device. */
  readonly reopen: () => Promise<void>
}

type Sent = OutboxRow & { readonly seq: number }

interface BatchOutcome {
  readonly removed: number
  readonly pullAfter: boolean
  readonly fromZero: boolean
}

export interface InitialPull {
  readonly rows: number
  readonly failure?: SaveFailure
}

type Timer = ReturnType<typeof setTimeout>

/** A queued row's change as the wire carries it. */
const changeOf = (row: OutboxRow): SyncChange =>
  (row.change.type === 'create' ? { type: 'create', createdAt: row.change.createdAt } : { type: 'operation', operation: row.change.operation })

export class SyncLane {
  private readonly queue: Serial
  private scheduled: Promise<void> | null = null
  private wantPull = false
  private wantFromZero = false
  private debounce: Timer | null = null
  private retry: Timer | null = null
  private retryStep = 0
  private stopped = false
  private listening: (() => void)[] = []

  constructor(private readonly deps: LaneDeps, queue: Serial) {
    this.queue = queue
  }

  /** The save opened: listen, then flush and pull. */
  start(): void {
    if (this.stopped) return
    if (this.listening.length === 0) {
      this.listening = [
        this.deps.signals.onVisibility((visible) => {
          this.clearDebounce()
          void this.request({ pull: visible })
        }),
        this.deps.signals.onOnline(() => {
          void this.request({ pull: true })
        }),
      ]
    }
    void this.request({ pull: true })
  }

  stop(): void {
    this.stopped = true
    this.clearDebounce()
    if (this.retry !== null) clearTimeout(this.retry)
    this.retry = null
    for (const stop of this.listening) stop()
    this.listening = []
  }

  /** Whether the lane stopped for good: after a 426, or `stop`. */
  get halted(): boolean {
    return this.stopped
  }

  /** A write: flush 1.5 s after the last one. */
  wrote(): void {
    if (this.stopped) return
    this.clearDebounce()
    this.debounce = setTimeout(() => {
      this.debounce = null
      void this.request({ pull: false })
    }, DEBOUNCE_MS)
  }

  /** One more run: a flush, then a pull if asked. A request while one is queued joins it. */
  request(want: { readonly pull: boolean; readonly fromZero?: boolean }): Promise<void> {
    if (this.stopped) return Promise.resolve()
    if (want.pull) this.wantPull = true
    if (want.fromZero === true) this.wantFromZero = true
    if (this.scheduled !== null) return this.scheduled
    const scheduled = this.queue(async () => {
      this.scheduled = null
      const pull = this.wantPull
      const fromZero = this.wantFromZero
      this.wantPull = false
      this.wantFromZero = false
      await this.pass(pull, fromZero)
    })
    this.scheduled = scheduled
    return scheduled
  }

  /** Resolves once every run asked for so far has finished. */
  idle(): Promise<void> {
    return this.queue(async () => {})
  }

  /**
   * An empty device's first pull, from 0, as one run of the lane. `onReady` runs once the pages have brought every kind
   * the rules read; the rest of the history keeps loading after it.
   */
  initialPull(onReady: () => Promise<void>): Promise<InitialPull> {
    return this.queue(async () => {
      try {
        return { rows: await this.pullAll(true, onReady) }
      } catch (error) {
        if (error instanceof UnreadableRow) throw error
        const failure = failureOf(error)
        this.fail(failure)
        return { rows: 0, failure }
      }
    })
  }

  private clearDebounce(): void {
    if (this.debounce !== null) clearTimeout(this.debounce)
    this.debounce = null
  }

  private async pass(pull: boolean, fromZero: boolean): Promise<void> {
    if (this.stopped || !useSave.getState().signedIn || useSave.getState().lifecycle !== 'ready') return
    if (!this.deps.signals.online()) {
      setSync({ status: 'offline', words: SAVE_WORDS.offline })
      return
    }
    setSync({ status: 'syncing' })
    try {
      const flushed = await this.flushAll()
      if (pull || flushed.pullAfter || fromZero || flushed.fromZero) await this.pullAll(fromZero || flushed.fromZero)
      this.succeeded()
    } catch (error) {
      if (error instanceof UnreadableRow) {
        this.stop()
        useSave.setState({ lifecycle: 'error', words: SAVE_WORDS.unexpected })
        return
      }
      const failure = failureOf(error)
      if (failure === 'no-save') {
        // Only a deliberately deleted server save answers this; the taps it held were on that save.
        await this.deps.dropSave()
        void this.deps.reopen()
        return
      }
      this.fail(failure)
    }
  }

  private succeeded(): void {
    this.retryStep = 0
    if (this.retry !== null) clearTimeout(this.retry)
    this.retry = null
    const { pending } = useSave.getState().sync
    setSync({ status: pending > 0 ? 'pending' : 'idle', lastSuccessAt: this.deps.now(), words: null })
  }

  private fail(failure: SaveFailure): void {
    if (failure === 'offline') {
      setSync({ status: 'offline', words: failureWords('offline') })
      return
    }
    setSync({ status: 'error', words: failureWords(failure) })
    if (failure === 'upgrade') {
      // The server has moved on: nothing more until the app restarts with the update.
      this.stop()
      return
    }
    if (this.retry !== null) clearTimeout(this.retry)
    const step = this.retryStep
    this.retryStep += 1
    const delay = RETRY_DELAYS_MS[step] ?? RETRY_EVERY_MS
    this.retry = setTimeout(() => {
      this.retry = null
      void (async () => {
        if (step >= RETRY_DELAYS_MS.length && (!this.deps.signals.visible() || (await this.deps.db.outbox.count()) === 0)) return
        await this.request({ pull: true })
      })()
    }, delay)
  }

  // --- Flush ------------------------------------------------------------------------------------------------------

  private async flushAll(): Promise<Omit<BatchOutcome, 'removed'>> {
    let pullAfter = false
    let fromZero = false
    for (;;) {
      const batch = await this.deps.db.outbox.orderBy('seq').limit(SAVE_LIMITS.changes).toArray()
      if (batch.length === 0) break
      const outcome = await this.flushBatch(batch as Sent[])
      pullAfter ||= outcome.pullAfter
      fromZero ||= outcome.fromZero
      if (outcome.removed === 0) break
    }
    return { pullAfter, fromZero }
  }

  private async flushBatch(sent: readonly Sent[]): Promise<BatchOutcome> {
    const { db, api, serial } = this.deps
    const changes = sent.map(changeOf)
    const response = await api.sync(changes)
    // An answer that skips or reorders a change applies nothing.
    if (!answersRequest({ changes }, response)) throw new SaveApiError('invalid')
    return serial(async () => {
      const { outcome, answered } = await db.transaction('rw', db.allTables(), () => this.reconcile(sent, response))
      await refold(db, this.deps.env, answered)
      return outcome
    })
  }

  /** Inside the flush's transaction: rows by version, then the answered rows out of the outbox. */
  private async reconcile(sent: readonly Sent[], response: SyncResponse): Promise<{ outcome: BatchOutcome; answered: Answered }> {
    const { db } = this.deps
    const server: Record<string, unknown> = {}
    const dropped: string[] = []
    const notices: SaveNotice[] = []
    let pullAfter = false
    let fromZero = false
    for (const result of response.results) {
      if (result.type === 'create') {
        // The server already has this account's save: adopt it, and read it all from the start.
        if (result.status === 'exists') {
          fromZero = true
          pullAfter = true
        }
      } else if (result.status === 'applied' || result.status === 'repeated') {
        server[result.id] = result.receipt
        // A repeat writes nothing: the rows its first run wrote come with the next pull.
        if (result.status === 'repeated') pullAfter = true
      } else {
        dropped.push(result.id)
        notices.push({ id: result.id, text: result.status === 'refused' ? refusalWords(result.refusal) : SAVE_WORDS.unexpected })
      }
    }
    for (const row of response.entities) await this.adoptEntity(row)
    for (const row of response.logs) await db.table(row.kind).put(row)
    await db.outbox.bulkDelete(sent.map((row) => row.seq))
    return { outcome: { removed: sent.length, pullAfter, fromZero }, answered: { server, dropped, notices } }
  }

  /** Adopts a server row: an entity whose version is at least the local one. */
  private async adoptEntity(row: EntityRow): Promise<void> {
    const table = this.deps.db.table(row.kind)
    const local = (await table.get(row.id)) as { readonly version: number } | undefined
    if (local === undefined || row.version >= local.version) await table.put(row)
  }

  // --- Pull -------------------------------------------------------------------------------------------------------

  private async adoptPage(page: SaveSnapshot): Promise<void> {
    const { db } = this.deps
    await db.transaction('rw', db.allTables(), async () => {
      for (const row of page.entities) await this.adoptEntity(row)
      for (const row of page.logs as readonly LogRow[]) await db.table(row.kind).put(row)
    })
  }

  /** Every page since the last pull (from 0 when asked, or when the database is empty), adopted as it arrives. */
  private async pullAll(fromZero: boolean, onReady?: () => Promise<void>): Promise<number> {
    const { db, api, serial, storage, env } = this.deps
    const empty = (await db.account.count()) === 0
    const mark = readMark(storage)
    let since = 0
    let cursor: string | null = null
    let first: number | null = null
    let ready = false
    if (!fromZero && !empty) {
      if (mark.resume !== undefined) ({ since, cursor, serverTime: first, ready } = mark.resume)
      else {
        since = Math.max(0, (mark.serverTime ?? 0) - PULL_OVERLAP_MS)
        ready = true
      }
    }
    let open = onReady
    let rows = 0
    for (;;) {
      const page = await api.snapshot(since, cursor)
      first ??= page.serverTime
      const pageRows = [...page.entities, ...page.logs]
      rows += pageRows.length
      if (pageRows.length > 0) {
        await serial(async () => {
          await this.adoptPage(page)
          if (useSave.getState().lifecycle === 'ready' && pageRows.some((row) => !isHistory(row.kind))) await refold(db, env)
        })
      }
      ready ||= page.cursor === null || pageRows.some((row) => isHistory(row.kind))
      if (ready && open !== undefined && rows > 0) {
        const opening = open
        open = undefined
        await opening()
      }
      if (page.cursor === null) {
        writeMark(storage, { serverTime: first })
        return rows
      }
      writeMark(storage, { ...(mark.serverTime === undefined ? {} : { serverTime: mark.serverTime }), resume: { since, cursor: page.cursor, serverTime: first, ready } })
      cursor = page.cursor
    }
  }
}

/** Forgets the pull's place: a device that drops its save reads the server's from 0. */
export const forgetPull = (storage: Storage | null): void => writeMark(storage, null)
