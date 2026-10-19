// Synthetic full releases, invented bytes and in-memory persistent storage; no network or owner account.
import { createHash } from 'node:crypto'
import { syntheticMasterData, buildMemoryRelease } from '@luismlorenzana/uma-data/testing'
import { describe, expect, it, vi } from 'vitest'
import { MasterRuntime } from './master'
import { cacheKey, type ByteCache, type ContentTransport, type ManifestStore } from './cache'
import { ApiError } from '../api/client'
import type { ObjectUrlFactory } from './view'

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
class Store implements ManifestStore { value: string | null = null; get = () => this.value; set = (value: string) => { this.value = value }; clear = () => { this.value = null } }
class Cache implements ByteCache {
  values = new Map<string, Response>()
  match = async (key: string) => this.values.get(key)?.clone()
  put = async (key: string, response: Response) => { this.values.set(key, response.clone()) }
}
function objectUrls() { let n = 0; return { create: () => `blob:invented-${++n}`, revoke: vi.fn() } satisfies ObjectUrlFactory }
async function fixture() {
  const data = syntheticMasterData(), race = data.races[0]!, course = data.courses[0]!
  data.tracks = Array.from({ length: 10 }, (_, i) => ({ id: 10001 + i, name: `Invented Park ${i}`, courseIds: [990011 + i] }))
  data.races = data.tracks.map((track, i) => ({ ...race, id: 990101 + i, trackId: track.id, courseId: 990011 + i }))
  data.courses = data.tracks.map((track, i) => ({ ...course, id: 990011 + i, trackId: track.id }))
  data.outfits.push({ ...structuredClone(data.outfits[0]!), id: 900102 })
  const page = 'atlases/invented-page.webp', face = 'art/outfit-faces/invented-face.webp', other = 'art/outfit-faces/other-face.webp'
  const master = await buildMemoryRelease(data, { extraFiles: { [page]: new Uint8Array([1, 2]), [face]: new Uint8Array([3, 4]), [other]: new Uint8Array([5, 6]) },
    art: { atlases: { 'outfit-icons': { frameWidth: 128, frameHeight: 128, pages: [{ path: page, width: 264, height: 132 }],
      frames: { '900101': { page: 0, x: 2, y: 2, width: 128, height: 128 }, '900102': { page: 0, x: 134, y: 2, width: 128, height: 128 } } } },
      images: { 'outfit-faces': { '900101': { path: face, width: 192, height: 192 }, '900102': { path: other, width: 192, height: 192 } } } } })
  const bytes = encode({ schema: 1, flair: { version: 2, series: [], mainVenueKeys: data.tracks.map((track) => String(track.id)) }, cardFocus: {} })
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const index = { version: sha256.slice(0, 12), file: { path: `overlays/racer.${sha256.slice(0, 16)}.json`, bytes: bytes.length, sha256 } }
  const files = new Map([...master.objects].map(([path, value]) => [`master/${path}`, value]))
  files.set('content/overlay.json', encode(index)); files.set(`content/${index.file.path}`, bytes)
  const read = vi.fn(async (path: string) => { const bytes = files.get(path); if (bytes === undefined) throw new ApiError(path, 404, 'missing'); return bytes })
  return { master, files, read, face, other }
}

describe('release-backed racer runtime', () => {
  it('loads the pure view, maps scenario/card atlases, and distinguishes two outfits of one character', async () => {
    const F = await fixture(), urls = objectUrls()
    const runtime = new MasterRuntime({ read: F.read }, new Store(), urls, new Cache())
    const result = await runtime.load()
    if (result.status !== 'ready') throw new Error('expected ready')
    const content = result.content
    expect(content.umas.items.map((uma) => uma.id)).toEqual(['900101', '900102'])
    expect(content.art.has('face', '9001')).toBe(false)
    expect(content.art.has('face', '900101')).toBe(true)
    const a = await content.art.load('face', '900101'), b = await content.art.load('face', '900102')
    expect(a).not.toBe(b)
    expect(await content.art.load('face', 'unknown')).toBeNull()
    const release = content.art.hold!('face', '900101'); release(); release()
    runtime.clear()
    expect(urls.revoke).toHaveBeenCalledTimes(3) // Atlas and both faces.
  })

  it('cold-boots offline from the last fully verified release and reloads viewed art from persistent bytes', async () => {
    const F = await fixture(), store = new Store(), cache = new Cache()
    const first = new MasterRuntime({ read: F.read }, store, objectUrls(), cache)
    const ready = await first.load()
    if (ready.status !== 'ready') throw new Error('expected ready')
    await ready.content.art.load('face', '900101'); first.clear()
    const read = vi.fn(async () => { throw new TypeError('offline') })
    const second = new MasterRuntime({ read }, store, objectUrls(), cache)
    const result = await second.load()
    if (result.status !== 'ready') throw new Error('expected ready')
    expect(result.content.origin).toBe('offline-cache')
    expect(await result.content.art.load('face', '900101')).toMatch(/^blob:/)
    expect(read).toHaveBeenCalledTimes(2) // Only latest/index requests; verified files and the face use Cache Storage.
  })

  it('repairs corrupt cached files online, refuses corrupt network bytes and never accepts a partial boot', async () => {
    const F = await fixture(), store = new Store(), cache = new Cache()
    await new MasterRuntime({ read: F.read }, store, objectUrls(), cache).load()
    const file = F.master.manifest.files.find((file) => file.path === F.master.manifest.sets.outfits)!
    await cache.put(cacheKey(file.sha256), new Response('damaged'))
    const before = F.read.mock.calls.length
    expect((await new MasterRuntime({ read: F.read }, store, objectUrls(), cache).load()).status).toBe('ready')
    expect(F.read.mock.calls.length - before).toBe(4) // Latest channel, manifest, overlay index, and damaged file only.
    const empty = new Store()
    F.files.set(`master/files/${file.path}`, encode({ corrupt: true }))
    await expect(new MasterRuntime({ read: F.read }, empty, objectUrls(), new Cache()).load()).rejects.toThrow(/hash mismatch/)
    expect(empty.value).toBeNull()
  })

  it('does not fall back past a 401 or 403, and exposes missing required overlays instead of fake progression', async () => {
    const F = await fixture(), store = new Store(), cache = new Cache()
    await new MasterRuntime({ read: F.read }, store, objectUrls(), cache).load()
    for (const status of [401, 403]) {
      const transport: ContentTransport = { read: async () => { throw new ApiError('master/latest', status, 'no access') } }
      await expect(new MasterRuntime(transport, store, objectUrls(), cache).load()).rejects.toMatchObject({ status })
    }
    F.files.delete('content/overlay.json')
    await expect(new MasterRuntime({ read: F.read }, new Store(), objectUrls(), cache).load()).rejects.toMatchObject({ status: 404 })
  })

  it('cancels an unfinished load without installing it or keeping its object URLs', async () => {
    const F = await fixture(), urls = objectUrls(), store = new Store()
    let proceed = () => {}
    const wait = new Promise<void>((resolve) => { proceed = resolve })
    const runtime = new MasterRuntime({ read: async (path) => { if (path.includes('invented-page')) await wait; return F.read(path) } }, store, urls, null)
    const pending = runtime.load()
    runtime.clear(); proceed()
    await expect(pending).rejects.toThrow(/cancelled/)
    expect(store.value).toBeNull()
    expect(urls.revoke).toHaveBeenCalledTimes(1)
  })
})
