import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadImages } from './download'

const tempDirs: string[] = []
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>'

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('downloadImages', () => {
  it('downloads, reuses cache, and refreshes with bounded inputs', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'uma-racer-assets-cache-'))
    tempDirs.push(cacheDir)
    const fetcher = vi.fn(async () => new Response(SVG, { headers: { 'content-type': 'image/svg+xml' } }))
    const sources = [{ id: 'synthetic-1', url: 'https://example.test/one.svg' }]

    const first = await downloadImages(sources, { cacheDir, kind: 'uma-icons', fetcher })
    const second = await downloadImages(sources, { cacheDir, kind: 'uma-icons', fetcher })
    const third = await downloadImages(sources, { cacheDir, kind: 'uma-icons', fetcher, refresh: true })

    expect(first[0]).toMatchObject({ id: 'synthetic-1', cacheHit: false })
    expect(second[0]).toMatchObject({ id: 'synthetic-1', cacheHit: true })
    expect(third[0]).toMatchObject({ id: 'synthetic-1', cacheHit: false })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects non-images and unsafe ids', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'uma-racer-assets-cache-'))
    tempDirs.push(cacheDir)
    const textFetcher = vi.fn(async () => new Response('nope', { headers: { 'content-type': 'text/plain' } }))
    await expect(
      downloadImages([{ id: 'safe', url: 'https://example.test/nope' }], {
        cacheDir,
        kind: 'card-icons',
        fetcher: textFetcher,
      }),
    ).rejects.toThrow('expected an image')
    await expect(
      downloadImages([{ id: '../bad', url: 'https://example.test/nope' }], {
        cacheDir,
        kind: 'card-icons',
        fetcher: textFetcher,
      }),
    ).rejects.toThrow('Unsafe asset id')
  })
})
