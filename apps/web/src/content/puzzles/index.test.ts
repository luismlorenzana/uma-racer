import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { syntheticPuzzlePack, syntheticPuzzleAtlas } from '../../../../../packages/domain/src/minigames/uma-puzzles/content.synthetic'
import { canonicalPuzzleJson, type ContentManifest, type ContentManifestFile } from '@racer/domain'
import { PuzzleContentLibrary, puzzleContentDiagnostic } from './index'
import { hasPuzzleContentFiles } from './discovery'
import { setTokenProvider } from '../../api/client'
function fixture(versions = 2, future = false) {
  const files: ContentManifestFile[] = [], objects = new Map<string, ArrayBuffer>(), refs: (ContentManifestFile & { version: string })[] = []
  const add = (prefix: string, value: unknown, extension = 'json') => {
    const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(canonicalPuzzleJson(value))
    const hash = createHash('sha256').update(bytes).digest('hex'), file = { path: `${prefix}.${hash.slice(0, 8)}.${extension}`, sha256: hash, bytes: bytes.length }
    files.push(file); objects.set(file.path, Uint8Array.from(bytes).buffer); return file
  }
  for (let i = 0; i < versions; i++) {
    const image = new Uint8Array(26), view = new DataView(image.buffer), ascii = (at: number, text: string) => image.set(new TextEncoder().encode(text), at)
    ascii(0, 'RIFF'); view.setUint32(4, 18, true); ascii(8, 'WEBP'); ascii(12, 'VP8L'); view.setUint32(16, 5, true)
    image[20] = 0x2f; view.setUint32(21, 259 | 259 << 14 | 0x10000000, true); image[25] = i
    const page = add(`atlases/puzzles-monsters-${i}`, image, 'webp'), atlas = syntheticPuzzleAtlas()
    atlas.pages[0] = { ...atlas.pages[0]!, ...page }
    const atlasFile = add('atlases/puzzles-monsters', atlas), pack = syntheticPuzzlePack()
    pack.version = `invented-${i}`; pack.members[0]!.name = `Invented name ${i}`; pack.atlas = atlasFile
    refs.push({ ...add('data/puzzles-cast', future ? { ...pack, capability: { engineVersion: 2, recipeVersion: 1 } } : pack), version: pack.version })
  }
  const catalog = add('data/puzzles-catalog', { schemaVersion: 1, activeHash: refs.at(-1)!.sha256, packs: refs })
  const manifest: ContentManifest = { version: 'a'.repeat(12), generatedAt: '', source: {}, files }
  let nextUrl = 0
  const requests: string[] = [], revoke = vi.fn(), create = vi.fn(() => `blob:invented-${++nextUrl}`)
  let offline = false
  const transport = { manifest: async () => manifest, file: async (path: string) => {
    requests.push(path); if (offline) throw new Error('Offline without cache')
    const bytes = objects.get(path); if (!bytes) throw new Error('Missing object')
    return { bytes, contentType: path.endsWith('.webp') ? 'image/webp' : 'application/json' }
  } }
  return { manifest, objects, refs, catalog, requests, revoke, create, transport, offline: () => { offline = true } }
}
// Retained-version/lease tests verify many full chapter packs while sibling packages share the CI runner.
describe('lazy authenticated Puzzle content', { timeout: 30_000 }, () => {
  it('uses only the existing bearer-authenticated API for every pack and image', async () => {
    const f = fixture(1), fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toMatch(/^\/api\/content\/files\//)
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer invented-token' })
      const path = String(url).split('/api/content/files/')[1]!, value = await f.transport.file(path)
      return new Response(value.bytes, { headers: { 'content-type': value.contentType } })
    })
    setTokenProvider(async () => 'invented-token'); vi.stubGlobal('fetch', fetcher)
    try { const lease = await new PuzzleContentLibrary(f.manifest, undefined, f, async () => undefined).acquire(); lease.release(); expect(fetcher).toHaveBeenCalledTimes(4) }
    finally { setTokenProvider(async () => null); vi.unstubAllGlobals() }
  })
  it('discovers cheaply but only declares readiness after compatible pack/atlas/art verification', async () => {
    const f = fixture(), decode = vi.fn(async () => undefined), library = new PuzzleContentLibrary(f.manifest, f.transport, f, decode)
    expect(hasPuzzleContentFiles(f.manifest)).toBe(true); expect(f.requests).toEqual([])
    const [a, b] = await Promise.all([library.acquire(), library.acquire()])
    expect(a.pack.version).toBe('invented-1'); expect(a.cast.manifestVersion).toBe(`puzzles-${a.identity.contentHash}`)
    expect(f.requests.filter(p => p === f.catalog.path)).toHaveLength(1); expect(decode).toHaveBeenCalledTimes(1)
    expect(a.pageUrls).toEqual(b.pageUrls); a.release(); library.clear(); expect(f.revoke).not.toHaveBeenCalled()
    b.release(); library.clear(); expect(f.revoke).toHaveBeenCalledTimes(1)
  })
  it('restores an exact retained pack after a manifest update and refuses unavailable identities', async () => {
    const f = fixture(), library = new PuzzleContentLibrary(f.manifest, f.transport, f, async () => undefined)
    const old = { version: f.refs[0]!.version, contentHash: f.refs[0]!.sha256 }, lease = await library.acquire(old)
    expect(lease.pack.members.find(m => m.id === 'invented-fire')!.name).toBe('Invented name 0')
    const active = await library.acquire(); expect(active.pack.members.find(m => m.id === 'invented-fire')!.name).toBe('Invented name 1')
    expect(lease.pageUrls).not.toEqual(active.pageUrls)
    await expect(library.load({ ...old, version: 'wrong' })).rejects.toThrow(/not retained/)
    await expect(library.load({ ...old, contentHash: 'f'.repeat(64) })).rejects.toThrow(/not retained/)
    f.offline(); const cached = await library.acquire(old); expect(cached.pageUrls).toEqual(lease.pageUrls)
    lease.release(); active.release(); cached.release()
  })
  it('uses verified service-worker/cache transport offline in a fresh loader', async () => {
    const f = fixture(), cache = new Map<string, Awaited<ReturnType<typeof f.transport.file>>>()
    const transport = { ...f.transport, file: async (p: string) => { const cached = cache.get(p); if (cached) return cached
      const value = await f.transport.file(p); cache.set(p, value); return value } }
    const first = await new PuzzleContentLibrary(f.manifest, transport, f, async () => undefined).acquire(); first.release(); f.offline()
    const restored = await new PuzzleContentLibrary(f.manifest, transport, f, async () => undefined).acquire(first.identity)
    expect(restored.identity).toEqual(first.identity); restored.release()
  })
  it('rejects missing/future packs, corrupt bytes, wrong MIME, and missing or undecodable art without fallback', async () => {
    const f = fixture()
    await expect(new PuzzleContentLibrary({ ...f.manifest, files: [] }, f.transport, f, async () => undefined).acquire()).rejects.toThrow(/absent/)
    const file = f.refs.at(-1)!, bytes = f.objects.get(file.path)!
    f.objects.set(file.path, new Uint8Array(bytes.byteLength).buffer)
    const retry = new PuzzleContentLibrary(f.manifest, f.transport, f, async () => undefined)
    await expect(retry.acquire()).rejects.toThrow(/integrity/); f.objects.set(file.path, bytes)
    const lease = await retry.acquire(); lease.release()
    await expect(new PuzzleContentLibrary(f.manifest, { ...f.transport, file: async p => ({ ...await f.transport.file(p), contentType: 'text/html' }) }, f, async () => undefined).acquire()).rejects.toThrow(/type/)
    await expect(new PuzzleContentLibrary(f.manifest, f.transport, f, async () => { throw new Error('Decode failed') }).acquire()).rejects.toThrow(/art unavailable/)
    const future = fixture(1, true)
    const error = await new PuzzleContentLibrary(future.manifest, future.transport, future, async () => undefined).acquire().catch(e => e as unknown)
    expect(puzzleContentDiagnostic(error)).toBe('This content needs a compatible app version.')
    const page = f.manifest.files.find(f => f.path.endsWith('.webp'))!; f.objects.delete(page.path)
    await expect(new PuzzleContentLibrary(f.manifest, f.transport, f, async () => undefined).acquire({ version: f.refs[0]!.version, contentHash: f.refs[0]!.sha256 })).rejects.toThrow(/unavailable/)
  })
  it('never revokes leased pages even when the bounded cache overflows', async () => {
    const f = fixture(10), library = new PuzzleContentLibrary(f.manifest, f.transport, f, async () => undefined), leases = []
    for (const ref of f.refs) leases.push(await library.acquire({ version: ref.version, contentHash: ref.sha256 }))
    expect(f.revoke).not.toHaveBeenCalled()
    leases[0]!.release(); expect(f.revoke).toHaveBeenCalledWith(leases[0]!.pageUrls[0])
    leases[1]!.release(); expect(f.revoke).toHaveBeenCalledTimes(2)
    leases.slice(2).forEach(l => l.release()); library.clear(); expect(f.revoke).toHaveBeenCalledTimes(10)
  })
})
