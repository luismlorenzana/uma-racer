// Synthetic HTTP only: no cloud credentials or network in tests.
import { describe, expect, it, vi } from 'vitest'
import { storageRequest } from './storage-request'

describe('conditional Storage maintenance retries', () => {
  const url = 'https://storage.test/object?ifGenerationMatch=42'
  it('retries a transient delete with exactly the same target, generation and authorization', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const wait = vi.fn(async () => {})
    const init = { method: 'DELETE', headers: { Authorization: 'Bearer synthetic-token' } }
    expect((await storageRequest(url, init, { fetch, wait })).status).toBe(204)
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [target, sent] of fetch.mock.calls) {
      expect(target).toBe(url)
      expect(sent).toMatchObject(init)
      expect(sent?.signal).toBeInstanceOf(AbortSignal)
    }
    expect(wait.mock.calls).toEqual([[250]])
  })
  it('accepts a missing already-deleted target without retry', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 404 }))
    expect((await storageRequest(url, { method: 'DELETE' }, { fetch })).status).toBe(404)
    expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([401, 403, 412])('never retries or bypasses a %s refusal', async (status) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response('{}', { status }))
    const wait = vi.fn(async () => {})
    await expect(storageRequest(url, { method: 'DELETE' }, { fetch, wait })).rejects.toThrow(`(${status})`)
    expect(fetch).toHaveBeenCalledOnce()
    expect(wait).not.toHaveBeenCalled()
  })
  it('bounds repeated server failures and network errors', async () => {
    for (const network of [false, true]) {
      const fetch = network ? vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('synthetic private details'))
        : vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Response('{}', { status: 503 }))
      const wait = vi.fn(async () => {})
      await expect(storageRequest(url, {}, { fetch, wait })).rejects.toThrow(network ? '(network)' : '(503)')
      expect(fetch).toHaveBeenCalledTimes(4)
      expect(wait.mock.calls).toEqual([[250], [500], [1000]])
    }
  })
})
