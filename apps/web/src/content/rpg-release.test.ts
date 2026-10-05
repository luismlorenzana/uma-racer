import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { syntheticChapterJson } from '../../../../packages/domain/src/rpg/chapter.synthetic'
import { RpgContentLibrary } from './rpg'
import { verifyRpgRelease } from './rpg-release'
import type { LoadedContent } from './runtime'

function fixture(schemaVersion = 2, scenarioId = 'ura-finale') {
  const raw = syntheticChapterJson()
  const source = { characterId: 'invented', pageUrl: 'https://priconne-redive.jp/character/invented/',
    portraitUrl: 'https://images.microcms-assets.io/assets/invented.png', variant: 'Invented only', attribution: 'Synthetic fixture', verifiedAt: '2099-01-01T00:00:00.000Z' }
  const chapters = raw.chapters.slice(0, 1).map(c => ({ ...c, scenarioId }))
  const value = { ...raw, schemaVersion, chapters, actors: raw.actors.map(a => schemaVersion === 2 ? { ...a, source } : a) }
  const objects = new Map<string, ArrayBuffer>(), files: LoadedContent['manifest']['files'] = []
  const add = (prefix: string, data: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(data)).buffer as ArrayBuffer
    const sha256 = createHash('sha256').update(new Uint8Array(bytes)).digest('hex'), path = `${prefix}.${sha256.slice(0, 8)}.json`
    files.push({ path, bytes: bytes.byteLength, sha256 }); objects.set(path, bytes)
    return { path, sha256 }
  }
  const pack = add('data/rpg-chapters', value)
  const art = raw.actors.map(a => {
    const sha256 = 'b'.repeat(64), path = `art/priconne/${a.artKey}.${sha256.slice(0, 8)}.webp`
    files.push({ path, sha256, bytes: 1 }); return { key: a.artKey, path }
  })
  add('data/rpg-catalog', { schemaVersion: 1, activeHash: pack.sha256, packs: [{ ...pack, version: raw.version, art }] })
  const load = vi.fn(async (_kind: string, _id: string) => 'blob:invented-verified-portrait')
  const content = { manifest: { files }, art: { load } } as unknown as LoadedContent
  const file = vi.fn(async (path: string) => ({ bytes: objects.get(path)!, contentType: 'application/json' }))
  return { content, load, file, library: new RpgContentLibrary(content, { manifest: async () => null, file }), hash: pack.sha256 }
}
describe('RPG release gate', () => {
  it('does not request any content when the manifest is missing the publication', async () => {
    const f = fixture(); f.content.manifest.files = []
    expect(await verifyRpgRelease(f.content, f.library)).toMatchObject({ status: 'unavailable' })
    expect(f.file).not.toHaveBeenCalled(); expect(f.load).not.toHaveBeenCalled()
  })
  it('reads one cast member per character and verifies every portrait before entry', async () => {
    const f = fixture(), result = await verifyRpgRelease(f.content, f.library)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.cast.map((c) => c.id)).toEqual([...new Set(result.cast.map((c) => c.id))])
    expect(Object.keys(result.portraits)).toEqual(result.cast.map((c) => c.id))
    expect(f.load.mock.calls.every(([kind]) => kind === 'priconne')).toBe(true)
    expect(f.load).toHaveBeenCalledTimes(result.cast.length)
  })
  it('refuses a legacy pack without character sources', async () => {
    const f = fixture(1)
    expect((await f.library.load())?.schemaVersion).toBe(1)
    await expect(verifyRpgRelease(f.content, f.library)).rejects.toThrow(/provenance/)
  })
  it('refuses a missing or unverified portrait, with no fallback cast', async () => {
    const broken = fixture(); broken.load.mockRejectedValueOnce(new Error('Art hash mismatch'))
    await expect(verifyRpgRelease(broken.content, broken.library)).rejects.toThrow(/hash/)
    expect((await verifyRpgRelease(broken.content, broken.library)).status).toBe('ready')
  })
  it('an offline failure can retry the same hashed version, never a synthetic chapter', async () => {
    const f = fixture(); f.file.mockRejectedValueOnce(new Error('Offline'))
    await expect(verifyRpgRelease(f.content, f.library)).rejects.toThrow('Offline')
    expect((await verifyRpgRelease(f.content, f.library)).status).toBe('ready')
  })
})
