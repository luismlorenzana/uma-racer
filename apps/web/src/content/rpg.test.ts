import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { syntheticChapterJson } from '../../../../packages/domain/src/rpg/chapter.synthetic'
import { loadRpgChapterPack } from './rpg'
import type { LoadedContent } from './runtime'
const bytes = new TextEncoder().encode(JSON.stringify(syntheticChapterJson())).buffer as ArrayBuffer
const sha256 = createHash('sha256').update(new Uint8Array(bytes)).digest('hex')
const file = { path: `data/rpg-chapters.${sha256.slice(0, 8)}.json`, sha256, bytes: bytes.byteLength }
const content = { manifest: { files: [file, ...['test-scout', 'test-elite', 'test-captain', 'test-wall'].map((id) => ({
  path: `art/priconne/${id}.12345678.webp`, sha256: 'b'.repeat(64), bytes: 1 }))] } } as LoadedContent
const transport = { manifest: async () => null, file: async () => ({ bytes, contentType: 'application/json' }) }
describe('lazy private RPG content', () => {
  it('returns unavailable, not a synthetic fallback, when the manifest has no chapter pack', async () => {
    expect(await loadRpgChapterPack({ manifest: { files: [] } } as unknown as LoadedContent, transport)).toBeNull()
  })
  it('verifies bytes/hash and binds chapter and portrait references', async () => {
    expect((await loadRpgChapterPack(content, transport))?.chapters[0]?.contentHash).toBe(sha256)
  })
  it('rejects drifted bytes, missing art and ambiguous packs', async () => {
    await expect(loadRpgChapterPack(content, { ...transport, file: async () => ({ bytes: new Uint8Array(bytes.byteLength).buffer, contentType: 'application/json' }) })).rejects.toThrow(/hash/)
    await expect(loadRpgChapterPack({ ...content, manifest: { ...content.manifest, files: [file] } }, transport)).rejects.toThrow(/art/)
    await expect(loadRpgChapterPack({ ...content, manifest: { ...content.manifest, files: [file, file] } }, transport)).rejects.toThrow(/ambiguous/)
  })
})
