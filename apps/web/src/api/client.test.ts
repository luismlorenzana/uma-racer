import { afterEach, describe, expect, it, vi } from 'vitest'
import { masterApi, setTokenProvider } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  setTokenProvider(async () => null)
})

describe('masterApi.read', () => {
  it('fetches protected bytes with the bearer token and an encoded content path', async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } }))
    vi.stubGlobal('fetch', fetcher)
    setTokenProvider(async () => 'synthetic-token')

    await expect(masterApi.read('master/files/art/a b.webp')).resolves.toEqual(new Uint8Array([1, 2, 3]))

    expect(fetcher).toHaveBeenCalledWith('/api/master/files/art/a%20b.webp',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer synthetic-token' }) }),
    )
  })
})
