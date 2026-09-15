// Fetch client with a pluggable token provider (same pattern as uma-planner's api/client.ts).

// Base URL: empty in dev (relative /api, proxied by Vite) or the Cloud Run URL in prod.
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

let tokenProvider: () => Promise<string | null> = async () => null
export function setTokenProvider(fn: () => Promise<string | null>) {
  tokenProvider = fn
}

async function requestResponse(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await tokenProvider()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().catch(() => res.statusText)}`)
  return res
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await requestResponse(path, init)).json() as Promise<T>
}

export const contentApi = {
  manifest: () => request<unknown>('/api/content/manifest'),
  file: async (path: string) => {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/')
    const response = await requestResponse(`/api/content/files/${encodedPath}`)
    return { bytes: await response.arrayBuffer(), contentType: response.headers.get('content-type') ?? '' }
  },
}

export interface SyncUpsert {
  kind: 'profile' | 'umas' | 'cards' | 'badges'
  id: string
  baseVersion: number
  data: Record<string, unknown>
  deleted?: boolean
}
export interface SyncAppend {
  kind: 'raceResults' | 'ledger'
  id: string
  data: Record<string, unknown>
  createdAt: number
}

export const saveApi = {
  load: () => request<{ entities: unknown[]; logs: unknown[]; serverTime: number }>('/api/save'),
  sync: (body: { upserts: SyncUpsert[]; appends: SyncAppend[] }) =>
    request<{
      applied: { kind: string; id: string; version: number }[]
      conflicts: unknown[]
      appended: number
      serverTime: number
    }>('/api/sync', { method: 'POST', body: JSON.stringify(body) }),
}
