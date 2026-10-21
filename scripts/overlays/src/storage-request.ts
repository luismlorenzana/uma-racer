// SE1 maintenance: retry transient Storage failures without changing conditional requests or hiding refusals.
const TRANSIENT = new Set([429, 500, 502, 503, 504])
const ATTEMPTS = 4
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

export async function storageRequest(url: string, init: RequestInit, dependencies: {
  readonly fetch?: typeof fetch
  readonly wait?: (ms: number) => Promise<void>
} = {}): Promise<Response> {
  const doFetch = dependencies.fetch ?? globalThis.fetch
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    let response: Response | undefined
    try {
      response = await doFetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
    } catch {
      if (attempt === ATTEMPTS - 1) throw new Error('Storage request failed (network)')
    }
    if (response !== undefined) {
      if (response.ok || response.status === 404) return response
      const status = response.status
      await response.body?.cancel()
      if (!TRANSIENT.has(status) || attempt === ATTEMPTS - 1) throw new Error(`Storage ${init.method ?? 'GET'} request failed (${status})`)
    }
    await (dependencies.wait ?? sleep)(250 * 2 ** attempt)
  }
  throw new Error('Storage retries exhausted')
}
