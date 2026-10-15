// The save's own small fetch (docs/rearchitecture/01-target-architecture.md §4.3, §6; docs/rearchitecture/07-data-
// reset.md §3–§4; T135's routes; T136), following today's `api/client.ts`: `VITE_API_BASE_URL` (empty in dev, where
// Vite proxies `/api`), a pluggable token provider, and the stamp on every call: query parameters for the GET, the body
// for the POSTs. Answers go through T134's parsers. A failure is one of seven kinds, never a status on a screen:
// - `offline`: no answer at all (no network, or no reply within a minute);
// - `auth` (401, 403), `upgrade` (426), `no-save` (409), `unavailable` (429, 502, 503, 504), `server` (anything else);
// - `invalid`: a 400, or an answer T134's parsers refuse.
// After a 426 the client asks nothing more until the app restarts: the server has moved on, and the update prompt
// brings the new app.
import {
  parsePurgeResponse, parseSaveSnapshotV2, parseSyncResponseV2, snapshotQuery, STAMP, type PurgeResponse, type SaveSnapshotV2, type SyncChange,
  type SyncRequestV2, type SyncResponseV2,
} from '@racer/domain/save-g2'

export type SaveFailure = 'offline' | 'auth' | 'upgrade' | 'no-save' | 'unavailable' | 'server' | 'invalid'

export class SaveApiError extends Error {
  constructor(readonly failure: SaveFailure) {
    super(`The save's request failed: ${failure}`)
    this.name = 'SaveApiError'
  }
}

export const failureOf = (error: unknown): SaveFailure => (error instanceof SaveApiError ? error.failure : 'server')

export interface SaveApi {
  /** `GET /api/save`: one page of the rows saved after `since`. */
  snapshot(since: number, cursor: string | null): Promise<SaveSnapshotV2>
  /** `POST /api/sync`: the outbox's batch, answered change by change. */
  sync(changes: readonly SyncChange[]): Promise<SyncResponseV2>
  /** `POST /api/legacy/purge`: today's save deleted once, server side (07 §3). */
  purge(): Promise<PurgeResponse>
}

let tokenProvider: () => Promise<string | null> = async () => null

/** Where the save's requests take their token (T143 points it at the signed-in owner's Firebase token). */
export function setSaveTokenProvider(provider: () => Promise<string | null>): void {
  tokenProvider = provider
}

/** No answer within a minute is offline: iOS can hold a request across a suspend, and the lane must not wait forever. */
const TIMEOUT_MS = 60_000

const statusFailure = (status: number): SaveFailure =>
  status === 401 || status === 403 ? 'auth'
    : status === 426 ? 'upgrade'
      : status === 409 ? 'no-save'
        : status === 400 ? 'invalid'
          : status === 429 || status === 502 || status === 503 || status === 504 ? 'unavailable'
            : 'server'

export interface SaveApiOptions {
  readonly base?: string
  readonly fetch?: typeof fetch
  readonly token?: () => Promise<string | null>
  readonly timeoutMs?: number
}

export function createSaveApi(options: SaveApiOptions = {}): SaveApi {
  const base = options.base ?? import.meta.env.VITE_API_BASE_URL ?? ''
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS
  let upgradeRequired = false

  async function call<T>(path: string, init: RequestInit, parse: (value: unknown) => T | string): Promise<T> {
    if (upgradeRequired) throw new SaveApiError('upgrade')
    const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
    const token = await (options.token ?? tokenProvider)().catch(() => null)
    const controller = typeof AbortController === 'undefined' ? null : new AbortController()
    const timer = controller === null ? null : setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await doFetch(`${base}${path}`, {
        ...init,
        ...(controller === null ? {} : { signal: controller.signal }),
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      })
    } catch {
      throw new SaveApiError('offline')
    } finally {
      if (timer !== null) clearTimeout(timer)
    }
    if (!response.ok) {
      const failure = statusFailure(response.status)
      if (failure === 'upgrade') upgradeRequired = true
      throw new SaveApiError(failure)
    }
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new SaveApiError('invalid')
    }
    const parsed = parse(body)
    if (typeof parsed === 'string') throw new SaveApiError('invalid')
    return parsed
  }

  return {
    snapshot: (since, cursor) => call(`/api/save?${new URLSearchParams(snapshotQuery(since, cursor)).toString()}`, { method: 'GET' }, parseSaveSnapshotV2),
    sync: (changes) => {
      const body: SyncRequestV2 = { ...STAMP, changes }
      return call('/api/sync', { method: 'POST', body: JSON.stringify(body) }, parseSyncResponseV2)
    },
    purge: () => call('/api/legacy/purge', { method: 'POST', body: JSON.stringify(STAMP) }, parsePurgeResponse),
  }
}
