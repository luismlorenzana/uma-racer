// One sync lane (docs/rearchitecture/01-target-architecture.md §4.3; docs/game/02-check-ins-and-notifications.md §8–§9,
// §11; T136): entities, logs and operations flush through one outbox in order, one run at a time, and a trigger during
// a run queues one more after it.
// - Triggers: a write (1.5 s after the last one); the app hidden (flush now, before iOS suspends it); visible or back
//   online (flush, then pull); the save opening (flush, then pull); and a flush that left rows behind (flush again).
// - A flush sends the first 100 rows by `seq`, so a create always leads. Its answer is applied in one transaction: the
//   returned rows by version, a conflicted badge's server copy, then every answered row out of the outbox (unless a
//   badge was rewritten in flight). The store then refolds. A response that doesn't answer every change, in order,
//   applies nothing.
// - A pull reads every page since the last pull's `serverTime` less five minutes (a sync commits a moment after it
//   stamps its rows), and adopts rows by version; an empty database pulls from 0. Its place is kept in
//   `uma-racer:g2:pull`, so an interrupted pull resumes from its cursor.
// - Failures: offline waits for a trigger; auth, server, unavailable and invalid retry after 5 s, 30 s and 2 minutes,
//   then every 5 minutes while the app is visible and the outbox isn't empty; a 426 stops the lane until the app
//   restarts; a 409 drops the device's save and outbox, and it boots as a new device.
import {
  answersRequest, KIND_ORDER, parseLogRow, SAVE_LIMITS, type EntityRow, type LogRow, type OperationEnv, type SaveKind, type SaveSnapshotV2,
  type SyncChange, type SyncResponseV2,
} from '@racer/domain/save'
import { failureOf, SaveApiError, type SaveApi, type SaveFailure } from './api'
import { badgeKey, parseStoredEntity, UnreadableRow, type OutboxRow, type SaveDb } from './db'
import { refold, setSync, useSave, type Answered, type SaveNotice, type Serial } from './store'
import { failureWords, refusalWords, SAVE_WORDS, sentence, unexpectedWords } from './words'

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
export const PULL_KEY = 'uma-racer:g2:pull'

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

/** Where `operations` sits: a page with a row after it has brought every kind the rules read (T134's `KIND_ORDER`). */
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
  /** Back online: the purge's retry rides along. */
  readonly onOnline?: () => void
}

interface Sent {
  readonly row: OutboxRow & { readonly seq: number }
  readonly change: SyncChange
}

interface BatchOutcome {
  readonly removed: number
  /** Badges the server had lost, sent again as creates in the next batch. */
  readonly requeued: number
  readonly pullAfter: boolean
  readonly fromZero: boolean
}

export interface InitialPull {
  readonly rows: number
  readonly failure?: SaveFailure
}

type Timer = ReturnType<typeof setTimeout>

export class SyncLane {
  /** The outbox rows of the batch on the wire: a badge written meanwhile bumps its `queuedAt`. */
  readonly inFlight = new Set<number>()
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
          this.deps.onOnline?.()
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

  private async flushAll(): Promise<Omit<BatchOutcome, 'removed' | 'requeued'>> {
    let pullAfter = false
    let fromZero = false
    for (;;) {
      const batch = await this.deps.db.outbox.orderBy('seq').limit(SAVE_LIMITS.changes).toArray()
      if (batch.length === 0) break
      const outcome = await this.flushBatch(batch as (OutboxRow & { seq: number })[])
      pullAfter ||= outcome.pullAfter
      fromZero ||= outcome.fromZero
      // A batch that settled nothing (every row rewritten in flight) waits for the next trigger.
      if (outcome.removed === 0 && outcome.requeued === 0) break
    }
    return { pullAfter, fromZero }
  }

  /** A row's change, its badge or flair data read now; null when the row it names is gone. */
  private async changeOf(row: OutboxRow): Promise<SyncChange | null> {
    const change = row.change
    if (change.type === 'create' || change.type === 'operation') {
      return change.type === 'create' ? { type: 'create', createdAt: change.createdAt } : { type: 'operation', operation: change.operation }
    }
    if (change.type === 'upsert') {
      const stored = await this.deps.db.badges.get(change.id)
      if (stored === undefined) return null
      const badge = parseStoredEntity(stored)
      if (badge === null || badge.kind !== 'badges') throw new UnreadableRow('badges')
      return { type: 'upsert', kind: 'badges', id: change.id, baseVersion: badge.version, data: badge.data }
    }
    const stored = await this.deps.db.flairEvents.get(change.id)
    if (stored === undefined) return null
    const flair = parseLogRow(stored)
    if (flair === null || flair.kind !== 'flairEvents') throw new UnreadableRow('flairEvents')
    return { type: 'append', kind: 'flairEvents', id: change.id, at: flair.at, data: flair.data }
  }

  private async flushBatch(batch: readonly (OutboxRow & { seq: number })[]): Promise<BatchOutcome> {
    const { db, api, serial } = this.deps
    const sent: Sent[] = []
    const gone: number[] = []
    for (const row of batch) {
      const change = await this.changeOf(row)
      if (change === null) gone.push(row.seq)
      else sent.push({ row, change })
    }
    if (gone.length > 0) await serial(() => db.outbox.bulkDelete(gone))
    if (sent.length === 0) return { removed: gone.length, requeued: 0, pullAfter: false, fromZero: false }
    const changes = sent.map((entry) => entry.change)
    for (const entry of sent) this.inFlight.add(entry.row.seq)
    let response: SyncResponseV2
    try {
      response = await api.sync(changes)
      // Today's `acknowledgedSequences`: an answer that skips or reorders a change applies nothing.
      if (!answersRequest({ changes }, response)) throw new SaveApiError('invalid')
    } catch (error) {
      this.inFlight.clear()
      throw error
    }
    return serial(async () => {
      try {
        const { outcome, answered } = await db.transaction('rw', db.allTables(), () => this.reconcile(sent, response))
        await refold(db, this.deps.env, answered)
        return { ...outcome, removed: outcome.removed + gone.length }
      } finally {
        this.inFlight.clear()
      }
    })
  }

  /** Inside the flush's transaction: rows by version, conflicts' copies, then the answered rows out of the outbox. */
  private async reconcile(sent: readonly Sent[], response: SyncResponseV2): Promise<{ outcome: BatchOutcome; answered: Answered }> {
    const { db } = this.deps
    const server: Record<string, unknown> = {}
    const dropped: string[] = []
    const notices: SaveNotice[] = []
    const applied = new Map<string, { readonly sent: Sent; readonly version: number }>()
    const conflicts = new Map<string, Sent>()
    let pullAfter = false
    let fromZero = false
    response.results.forEach((result, i) => {
      const entry = sent[i]!
      if (result.type === 'create' && result.status === 'exists') {
        // The server already has this account's save: adopt it, and read it all from the start.
        fromZero = true
        pullAfter = true
      } else if (result.type === 'upsert') {
        if (result.status === 'applied') applied.set(result.id, { sent: entry, version: result.version })
        else conflicts.set(result.id, entry)
      } else if (result.type === 'operation') {
        if (result.status === 'applied' || result.status === 'repeated') {
          server[result.id] = result.receipt
          // A repeat writes nothing: the rows its first run wrote come with the next pull.
          if (result.status === 'repeated') pullAfter = true
        } else {
          const words = result.status === 'refused' ? refusalWords(result.refusal) : unexpectedWords()
          dropped.push(result.id)
          notices.push({ id: result.id, words, text: sentence(words) })
        }
      }
    })

    const waiting = new Map((await db.outbox.toArray()).map((row) => [row.key, row]))
    const rewritten = (entry: Sent): boolean => waiting.get(entry.row.key)?.queuedAt !== entry.row.queuedAt
    const copies = new Map<string, EntityRow>()

    // 1. Each returned entity whose version is at least the local one. A badge is settled by its own answer.
    for (const row of response.entities) {
      if (row.kind === 'badges') {
        if (conflicts.has(row.id)) {
          copies.set(row.id, row)
          continue
        }
        const answer = applied.get(row.id)
        if (answer !== undefined) {
          const local = await db.badges.get(row.id)
          await db.badges.put(rewritten(answer.sent) && local !== undefined ? { ...local, version: row.version, savedAt: row.savedAt } : row)
          applied.delete(row.id)
          continue
        }
        if (waiting.has(badgeKey(row.id))) continue
      }
      await this.adoptEntity(row)
    }
    // An applied badge whose row didn't come back still takes its new version.
    for (const [id, answer] of applied) {
      const local = await db.badges.get(id)
      if (local !== undefined) await db.badges.put({ ...local, version: answer.version })
    }
    for (const row of response.logs) await db.table(row.kind).put(row)

    // 2. A conflict takes the server's copy. With none, the server has no such row: the badge goes again as a create.
    const requeued = new Set<number>()
    for (const [id, entry] of conflicts) {
      const copy = copies.get(id)
      if (copy !== undefined) {
        await db.badges.put(copy as EntityRow<'badges'>)
        continue
      }
      const local = await db.badges.get(id)
      if (local === undefined) continue
      await db.badges.put({ ...local, version: 0, savedAt: 0 })
      const current = waiting.get(entry.row.key)
      if (current?.seq !== undefined) {
        await db.outbox.update(current.seq, { queuedAt: Math.max(this.deps.now(), current.queuedAt + 1) })
        requeued.add(current.seq)
      }
    }

    // 3. Every answered row leaves, unless it was written again while in flight.
    let removed = 0
    for (const entry of sent) {
      if (requeued.has(entry.row.seq) || rewritten(entry)) continue
      await db.outbox.delete(entry.row.seq)
      removed += 1
    }
    return { outcome: { removed, requeued: requeued.size, pullAfter, fromZero }, answered: { server, dropped, notices } }
  }

  /** Adopts a server row: an entity whose version is at least the local one (a badge with a write waiting excepted). */
  private async adoptEntity(row: EntityRow): Promise<void> {
    const table = this.deps.db.table(row.kind)
    const local = (await table.get(row.id)) as { readonly version: number } | undefined
    if (local === undefined || row.version >= local.version) await table.put(row)
  }

  // --- Pull -------------------------------------------------------------------------------------------------------

  private async adoptPage(page: SaveSnapshotV2): Promise<void> {
    const { db } = this.deps
    await db.transaction('rw', db.allTables(), async () => {
      const waiting = new Set((await db.outbox.toArray()).map((row) => row.key))
      for (const row of page.entities) {
        if (row.kind === 'badges' && waiting.has(badgeKey(row.id))) continue
        await this.adoptEntity(row)
      }
      for (const row of page.logs as readonly LogRow[]) await db.table(row.kind).put(row)
    })
  }

  /** Every page since the last pull (from 0 when asked, or when the database is empty), adopted as it arrives. */
  private async pullAll(fromZero: boolean, onReady?: () => Promise<void>): Promise<number> {
    const { db, api, serial, storage, env } = this.deps
    const empty = (await db.profile.count()) === 0
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
