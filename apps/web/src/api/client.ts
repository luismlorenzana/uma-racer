// Fetch client for the private content, with a pluggable token provider (same pattern as uma-planner's api/client.ts).
// The save has its own small client (`save/api.ts`), on the same token.

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

export const masterApi = {
  read: async (path: string): Promise<Uint8Array> => {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/')
    const response = await requestResponse(`/api/${encodedPath}`)
    return new Uint8Array(await response.arrayBuffer())
  },
}
