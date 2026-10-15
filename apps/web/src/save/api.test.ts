// The save's fetch (T136; T135's routes as built, rework/13 §6): the stamp on every call, the token, T134's parsers on
// every answer, and each failure as one of seven kinds. After a 426 it asks nothing more.
import { STAMP } from '@racer/domain/save'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSaveApi, failureOf, SaveApiError, setSaveTokenProvider, type SaveFailure } from './api'

const snapshot = { ...STAMP, serverTime: 5, entities: [], logs: [], cursor: null }
const answered = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

afterEach(() => {
  vi.useRealTimers()
  setSaveTokenProvider(async () => null)
})

describe('the save api', () => {
  it('stamps the GET in its query and each POST in its body, with the token', async () => {
    const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/api/save') ? snapshot
      : url.includes('purge') ? { ...STAMP, status: 'purged', at: 1, counts: { collections: 0, documents: 0 } }
        : { ...STAMP, serverTime: 5, results: [], entities: [], logs: [] }), { status: 200 }))
    const api = createSaveApi({ fetch: fetch as unknown as typeof globalThis.fetch, base: 'https://api.test', token: async () => 'abc' })
    expect(await api.snapshot(0, null)).toEqual(snapshot)
    await api.snapshot(1_000, 'umas~5~sim-uma-01')
    await api.sync([])
    await api.purge()
    const calls = fetch.mock.calls as unknown as [string, RequestInit][]
    expect(calls.map(([url]) => url)).toEqual([
      'https://api.test/api/save?protocol=2&generation=2&since=0',
      'https://api.test/api/save?protocol=2&generation=2&since=1000&cursor=umas%7E5%7Esim-uma-01',
      'https://api.test/api/sync',
      'https://api.test/api/legacy/purge',
    ])
    expect(calls.map(([, init]) => init.method)).toEqual(['GET', 'GET', 'POST', 'POST'])
    expect(JSON.parse(calls[2]![1].body as string)).toEqual({ protocol: 2, generation: 2, changes: [] })
    expect(JSON.parse(calls[3]![1].body as string)).toEqual({ protocol: 2, generation: 2 })
    expect(calls.every(([, init]) => (init.headers as Record<string, string>).Authorization === 'Bearer abc')).toBe(true)
  })

  it('takes its token from the provider, and sends none without one', async () => {
    const fetch = answered(200, snapshot)
    const api = createSaveApi({ fetch: fetch as unknown as typeof globalThis.fetch, base: '' })
    await api.snapshot(0, null)
    setSaveTokenProvider(async () => 'xyz')
    await api.snapshot(0, null)
    const headers = (fetch.mock.calls as unknown as [string, RequestInit][]).map(([, init]) => (init.headers as Record<string, string>).Authorization)
    expect(headers).toEqual([undefined, 'Bearer xyz'])
  })

  it.each([
    [401, 'auth'], [403, 'auth'], [426, 'upgrade'], [409, 'no-save'], [400, 'invalid'], [429, 'unavailable'], [502, 'unavailable'],
    [503, 'unavailable'], [504, 'unavailable'], [500, 'server'], [404, 'server'],
  ] as const)('reads a %i as %s', async (status, failure) => {
    const api = createSaveApi({ fetch: answered(status) as unknown as typeof globalThis.fetch, base: '' })
    await expect(api.sync([])).rejects.toEqual(new SaveApiError(failure))
  })

  it('reads no answer as offline, and an answer the parsers refuse as invalid', async () => {
    const offline = createSaveApi({ fetch: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof globalThis.fetch, base: '' })
    await expect(offline.snapshot(0, null)).rejects.toMatchObject({ failure: 'offline' })
    const old = createSaveApi({ fetch: answered(200, { protocol: 1, generation: 1, entities: [] }) as unknown as typeof globalThis.fetch, base: '' })
    await expect(old.snapshot(0, null)).rejects.toMatchObject({ failure: 'invalid' })
    const text = createSaveApi({ fetch: vi.fn(async () => new Response('<html>', { status: 200 })) as unknown as typeof globalThis.fetch, base: '' })
    await expect(text.purge()).rejects.toMatchObject({ failure: 'invalid' })
    expect(failureOf(new Error('anything'))).toBe<SaveFailure>('server')
  })

  it('gives up on a request with no answer within a minute', async () => {
    vi.useFakeTimers()
    const hanging = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    const api = createSaveApi({ fetch: hanging as unknown as typeof globalThis.fetch, base: '' })
    const pending = expect(api.sync([])).rejects.toMatchObject({ failure: 'offline' })
    await vi.advanceTimersByTimeAsync(60_000)
    await pending
  })

  it('asks nothing more after a 426, until the app restarts', async () => {
    const fetch = answered(426, { code: 'upgrade-required', ...STAMP })
    const api = createSaveApi({ fetch: fetch as unknown as typeof globalThis.fetch, base: '' })
    await expect(api.sync([])).rejects.toMatchObject({ failure: 'upgrade' })
    await expect(api.snapshot(0, null)).rejects.toMatchObject({ failure: 'upgrade' })
    await expect(api.purge()).rejects.toMatchObject({ failure: 'upgrade' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
