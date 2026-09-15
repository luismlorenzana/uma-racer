import { afterEach, describe, expect, it, vi } from 'vitest'
import { contentApi, setTokenProvider } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  setTokenProvider(async () => null)
})

describe('contentApi.file', () => {
  it('fetches protected bytes with the bearer token and an encoded content path', async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } }))
    vi.stubGlobal('fetch', fetcher)
    setTokenProvider(async () => 'synthetic-token')

    await expect(contentApi.file('atlases/a b.webp')).resolves.toMatchObject({ contentType: 'image/webp' })

    expect(fetcher).toHaveBeenCalledWith('/api/content/files/atlases/a%20b.webp',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer synthetic-token' }) }),
    )
  })
})
