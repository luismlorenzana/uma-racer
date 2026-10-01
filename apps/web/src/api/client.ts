// Fetch client with a pluggable token provider (same pattern as uma-planner's api/client.ts).

import type { RpgCommandRequest, SyncRequest } from '@racer/domain'

// Base URL: empty in dev (relative /api, proxied by Vite) or the Cloud Run URL in prod.
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

let tokenProvider: () => Promise<string | null> = async () => null
export function setTokenProvider(fn: () => Promise<string | null>) {
  tokenProvider = fn
}

export class ApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    detail: string,
  ) {
    super(`API ${status}: ${detail}`)
    this.name = 'ApiError'
  }
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
  if (!res.ok) throw new ApiError(path, res.status, await res.text().catch(() => res.statusText))
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

export const saveApi = {
  load: () => request<unknown>('/api/save'),
  sync: (body: SyncRequest) => request<unknown>('/api/sync', { method: 'POST', body: JSON.stringify(body) }),
  rpgCommand: (body: RpgCommandRequest) => request<unknown>('/api/rpg/command', { method: 'POST', body: JSON.stringify(body) }),
}
