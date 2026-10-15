// A stand-in API for the save layer's tests (T136): T135's own pure `resolveSync` and `snapshotPage` behind a fake
// `fetch`, with its stamps and statuses (426, 400, 409, 200), so the device is tested against the server's real rules.
// Knobs make the network misbehave: a request that never reaches it, an answer lost after the server applied it, an
// answer that skips a change, a held answer, and a save deleted underneath the device. Synthetic content only.
import {
  encodeCursor, NO_SAVE, resolveSync, selectReadSet, snapshotPage, syncReadSet, type SaveRow,
} from '../../../../api/src/save/resolve'
import type { BadgeStateV1, FlairEventV1 } from '@racer/domain'
import { SIM_CONTENT, SIM_UMAS } from '@racer/domain/sim'
import {
  entityChanges, flairEventId, initialSave, isCurrentStamp, logDraft, parsePurgeRequest, parseSnapshotQuery, parseSyncRequestV2, rowKey, STAMP,
  stampEntity, stampLog, type OperationEnv, type SaveState, type SyncChange, type SyncRequestV2,
} from '@racer/domain/save'
import { vi } from 'vitest'
import { createSaveApi } from '../api'
import { bootSave, type SaveBootOptions, type SaveSession } from '../boot'
import { SaveDb } from '../db'
import type { LaneSignals } from '../sync'
import type { WipeDeps } from '../wipe'

/** The rework sim's invented content; `dev` so `dev-grant` runs (M034's dev builds). */
export const ENV: OperationEnv = Object.freeze({ content: SIM_CONTENT, dev: true })
export const umaId = (n: number): string => SIM_UMAS[n - 1]!.id

/** A failure the next request meets: no network, or an HTTP status. */
export type Outcome = 'offline' | number

interface Request {
  readonly method: string
  readonly path: string
  readonly query: Readonly<Record<string, string>>
  readonly body: unknown
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export class FakeServer {
  readonly rows = new Map<string, SaveRow>()
  readonly requests: Request[] = []
  purgeMarker: { readonly at: number } | null = null
  /** Rows per pulled page, below T134's 1,000, to test paging. */
  pageRows: number | null = null
  private failures: Outcome[] = []
  private always: Outcome | null = null
  private loseNext = false
  private skipNext = false
  private holding: { resolve: () => void; promise: Promise<void> } | null = null

  constructor(private readonly env: OperationEnv = ENV, private readonly now: () => number = () => Date.now()) {}

  readonly fetch = vi.fn(async (input: string | URL | globalThis.Request, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input), 'http://save.test')
    const request: Request = {
      method: init.method ?? 'GET',
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    this.requests.push(request)
    const failure = this.failures.shift() ?? this.always
    if (failure === 'offline') throw new TypeError('Failed to fetch')
    if (typeof failure === 'number') return json(failure, { code: 'failure' })
    if (request.path === '/api/save' && request.method === 'GET') return this.snapshot(request)
    if (request.path === '/api/sync' && request.method === 'POST') return this.sync(request)
    if (request.path === '/api/legacy/purge' && request.method === 'POST') return this.purge(request)
    return json(404, { code: 'not-found' })
  })

  /** The next requests fail, one outcome each. */
  failNext(...outcomes: Outcome[]): void {
    this.failures.push(...outcomes)
  }

  /** Every request fails so until cleared with null. */
  failAlways(outcome: Outcome | null): void {
    this.always = outcome
  }

  /** The next sync is applied, but its answer never reaches the device. */
  loseNextAnswer(): void {
    this.loseNext = true
  }

  /** The next sync's answer leaves out its last change. */
  skipNextResult(): void {
    this.skipNext = true
  }

  /** Holds the next sync's answer until `release`. */
  hold(): () => void {
    let resolve = () => {}
    const promise = new Promise<void>((done) => (resolve = done))
    this.holding = { resolve, promise }
    return resolve
  }

  /**
   * An account the server already holds, built by the rules elsewhere (a state no tap on this device could reach, such
   * as a completed Expedition run): a new account's rows at `at`, every entity `state` changes, and its ledger.
   */
  holdAccount(state: SaveState, at: number): void {
    const initial = initialSave(at)
    for (const draft of [...initial.entities, ...entityChanges(initial.state, state)]) this.rows.set(rowKey(draft), stampEntity(draft, 1, at))
    for (const entry of state.ledger) {
      const row = stampLog(logDraft('ledger', entry.id, entry.at, entry), at)
      this.rows.set(rowKey(row), row)
    }
  }

  /** The server's save is deleted underneath the device (a dev reset): its next sync is a 409. */
  dropSave(): void {
    this.rows.clear()
  }

  /** Another device's sync, straight to the server. */
  otherDevice(changes: readonly SyncChange[]): unknown {
    const resolved = resolveSync(selectReadSet(this.rows.values(), syncReadSet({ changes })), { ...STAMP, changes }, this.now(), this.env)
    if (resolved === NO_SAVE) throw new Error('no save')
    this.write(resolved)
    return resolved.response
  }

  syncs(): SyncRequestV2[] {
    return this.requests.filter((r) => r.path === '/api/sync').map((r) => r.body as SyncRequestV2)
  }

  count(path: string): number {
    return this.requests.filter((r) => r.path === path).length
  }

  row<T = unknown>(key: string): T | undefined {
    return this.rows.get(key) as T | undefined
  }

  private write(resolved: { readonly entities: readonly SaveRow[]; readonly logs: readonly SaveRow[] }): void {
    for (const row of [...resolved.entities, ...resolved.logs]) this.rows.set(rowKey(row), row)
  }

  private snapshot(request: Request): Response {
    const query = parseSnapshotQuery(request.query)
    if (query === undefined) return json(426, { code: 'upgrade-required', ...STAMP })
    if (typeof query === 'string') return json(400, { message: query })
    const page = snapshotPage(this.rows.values(), query.since, query.cursor, this.now())
    if (this.pageRows === null) return json(200, page)
    // A page lists its rows in pull order, and every entity kind comes before every log kind in `KIND_ORDER`.
    const rows = [...page.entities, ...page.logs] as SaveRow[]
    if (rows.length <= this.pageRows) return json(200, page)
    const kept = rows.slice(0, this.pageRows)
    const last = kept.at(-1)!
    return json(200, {
      ...page,
      entities: kept.filter((row) => page.entities.includes(row as never)),
      logs: kept.filter((row) => page.logs.includes(row as never)),
      cursor: encodeCursor({ kind: last.kind, savedAt: last.savedAt, id: last.id }),
    })
  }

  private async sync(request: Request): Promise<Response> {
    if (!isCurrentStamp(request.body)) return json(426, { code: 'upgrade-required', ...STAMP })
    const parsed = parseSyncRequestV2(request.body)
    if (typeof parsed === 'string') return json(400, { message: parsed })
    const resolved = resolveSync(selectReadSet(this.rows.values(), syncReadSet(parsed)), parsed, this.now(), this.env)
    if (resolved === NO_SAVE) return json(409, { code: 'no-save' })
    this.write(resolved)
    if (this.holding !== null) {
      const { promise } = this.holding
      this.holding = null
      await promise
    }
    if (this.loseNext) {
      this.loseNext = false
      throw new TypeError('The network went away')
    }
    if (this.skipNext) {
      this.skipNext = false
      return json(200, { ...resolved.response, results: resolved.response.results.slice(0, -1) })
    }
    return json(200, resolved.response)
  }

  private purge(request: Request): Response {
    if (!isCurrentStamp(request.body)) return json(426, { code: 'upgrade-required', ...STAMP })
    if (typeof parsePurgeRequest(request.body) === 'string') return json(400, { message: 'bad purge' })
    if (this.purgeMarker !== null) return json(200, { ...STAMP, status: 'already', at: this.purgeMarker.at, counts: { collections: 3, documents: 12 } })
    this.purgeMarker = { at: this.now() }
    return json(200, { ...STAMP, status: 'purged', at: this.purgeMarker.at, counts: { collections: 3, documents: 12 } })
  }
}

/** Storage in memory. */
export function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  }
}

/** The page's visibility and the network, moved by the test. */
export function fakeSignals() {
  let visible = true
  let online = true
  const onVisibility = new Set<(visible: boolean) => void>()
  const onOnline = new Set<() => void>()
  const signals: LaneSignals = {
    visible: () => visible,
    online: () => online,
    onVisibility(listener) {
      onVisibility.add(listener)
      return () => onVisibility.delete(listener)
    },
    onOnline(listener) {
      onOnline.add(listener)
      return () => onOnline.delete(listener)
    },
  }
  return {
    signals,
    hide() {
      visible = false
      for (const listener of [...onVisibility]) listener(false)
    },
    show() {
      visible = true
      for (const listener of [...onVisibility]) listener(true)
    },
    /** Hidden, without the event: only what reads `visible()` notices. */
    hideQuietly() {
      visible = false
    },
    offline() {
      online = false
    },
    online() {
      online = true
      for (const listener of [...onOnline]) listener()
    },
  }
}

/** Wipe deps that touch nothing: the boot tests that aren't about the wipe. */
export const noWipe: WipeDeps = {
  storage: null,
  deleteDatabase: async () => {},
  databaseNames: async () => [],
  caches: null,
  dev: false,
  now: () => 0,
}

/** A trainer badge row's data, as `createTrainerBadgeState` makes it, with a name. */
export function trainerBadge(name = 'Hana', at = 0): BadgeStateV1 {
  return {
    version: 1,
    scope: 'trainer',
    catalogVersion: 1,
    evaluatorVersion: 0,
    trackingStartedAt: at,
    sourceWatermarks: { contributors: 0, contentVersion: null },
    aggregates: [],
    records: [],
    awards: { achievements: [] },
    preferences: {
      activeTitleId: null, showcaseGroups: [{ id: 'default', name: null, awardRefs: [] }], savedViews: [], displayName: name, pinnedUmaIds: [],
    },
  } as unknown as BadgeStateV1
}

/** A trainer's flair event, numbered. */
export function flairEvent(n: number, at = 0): FlairEventV1 {
  return {
    version: 1, scope: 'trainer', umaId: null, kind: 'trainer-achievement', awardKey: `achievement-${n}`, stage: 'one-off', earnedAt: at,
    source: { kind: 'collection', id: null, tier: null }, retroactive: false,
  }
}

export const flairId = (event: FlairEventV1): string => flairEventId(event.scope, event.umaId, event.awardKey, event.stage)

// --- Devices ----------------------------------------------------------------------------------------------------

let databases = 0
let operations = 0

/** A database of its own for each device a test boots. */
export const freshDb = (): SaveDb => new SaveDb(`uma-racer-g2-test-${(databases += 1)}`)

/** Operation ids of the right shape, unique across every device a test file boots. */
export const nextId = (): string => `op-${String((operations += 1)).padStart(5, '0')}`

export interface Device {
  readonly session: SaveSession
  readonly db: SaveDb
  readonly storage: Storage
  readonly net: ReturnType<typeof fakeSignals>
  readonly server: FakeServer
}

export type DeviceOptions = Partial<SaveBootOptions> & { readonly net?: ReturnType<typeof fakeSignals>; readonly storage?: Storage }

/** Boots a device on `server`, with no wipe and no purge unless asked. */
export function device(server: FakeServer, options: DeviceOptions = {}): Device {
  const db = options.db ?? freshDb()
  const storage = options.storage ?? memoryStorage()
  const net = options.net ?? fakeSignals()
  const session = bootSave({
    env: ENV, wipe: false, purge: false, wipeDeps: noWipe, newId: nextId,
    api: createSaveApi({ fetch: server.fetch as unknown as typeof fetch, base: '', token: async () => 'token' }),
    ...options, db, storage, signals: net.signals,
  })
  return { session, db, storage, net, server }
}

/** A real turn of the event loop: Dexie's fake IndexedDB runs on `setImmediate`, which the fake timers leave alone. */
export const turn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

/** Until the device's boot, its lane and anything they queued have finished. */
export async function settle(target: Device): Promise<void> {
  await target.session.opened
  for (let i = 0; i < 6; i += 1) {
    await target.session.lane.idle()
    await turn()
  }
}

/** Fake timers for the clock and the lane's timers; the event loop's own `setImmediate` stays real. */
export function useClock(at = Date.UTC(2026, 9, 15, 8)): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(at)
}
