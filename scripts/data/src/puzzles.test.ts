// End-to-end private pipeline using invented rows and generated alpha pixels only.
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { syntheticPuzzleSource, syntheticPuzzleAtlas } from '@racer/domain/puzzles-content-fixtures'
import { canonicalPuzzleJson, parsePuzzleCastSource, parsePuzzleContentCatalog, type ContentManifest, type PuzzleSource } from '@racer/domain'
import { sha256, writeContentPacks } from './pack'
import { importPuzzlePack, validatePuzzleContent } from './puzzles'
import { publishContent } from './publish'
const dirs: string[] = []
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })
// Minimal alpha WebP header for object-reference tests; native decoding is tested in asset pipeline/client separately.
function syntheticWebp() {
  const b = Buffer.alloc(26); b.write('RIFF'); b.writeUInt32LE(18, 4); b.write('WEBP', 8); b.write('VP8L', 12); b.writeUInt32LE(5, 16)
  b[20] = 0x2f; b.writeUInt32LE(259 | 259 << 14 | 0x10000000, 21); return b
}
async function fixture() {
  const dir = await mkdtemp(resolve(tmpdir(), 'puzzle-pack-test-')); dirs.push(dir)
  await writeContentPacks({ contentDir: dir, packs: [], source: {} })
  const raw = parsePuzzleCastSource(syntheticPuzzleSource()), atlas = syntheticPuzzleAtlas(), image = syntheticWebp(), digest = sha256(image)
  atlas.frames[0]!.id = `frame-${raw.members[0]!.art.sha256.slice(0, 32)}`
  atlas.pages[0] = { ...atlas.pages[0]!, path: `atlases/puzzles-monsters-0.${digest.slice(0, 8)}.webp`, sha256: digest, bytes: image.length }
  const { mkdir } = await import('node:fs/promises'); await mkdir(resolve(dir, 'atlases'))
  await writeFile(resolve(dir, atlas.pages[0]!.path), image)
  const json = canonicalPuzzleJson(atlas), atlasHash = sha256(json), path = `atlases/puzzles-monsters.${atlasHash.slice(0, 8)}.json`
  await writeFile(resolve(dir, path), json)
  const manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8')) as ContentManifest
  manifest.files.push({ path, sha256: atlasHash, bytes: Buffer.byteLength(json) }, { path: atlas.pages[0]!.path, sha256: digest, bytes: image.length })
  async function pin(source: PuzzleSource) {
    manifest.source[`puzzles-atlas:${sha256(canonicalPuzzleJson(source))}`] = path
    manifest.version = createHash('sha256').update(manifest.files.map(f => f.sha256).sort().join('')).digest('hex').slice(0, 12)
    await writeFile(resolve(dir, 'manifest.json'), JSON.stringify(manifest))
  }
  await pin(raw)
  return { dir, raw, manifest, pin }
}
// Repeated full 364-node compilation plus disk round-trips competes with all packages on the two-core CI runner.
describe('immutable private Puzzle content compilation', { timeout: 30_000 }, () => {
  it('reruns deterministically, validates joins, retains old versions and survives normal data reimport', async () => {
    const f = await fixture(), first = await importPuzzlePack(f.dir, f.raw, '2026-10-07T00:00:00.000Z')
    expect(first.packs[0]).toMatchObject({ chapters: 14, encounters: 364, cast: 5, frames: 1, pages: 1 })
    const before = await readFile(resolve(f.dir, 'manifest.json'), 'utf8')
    const again = await importPuzzlePack(f.dir, f.raw, '2026-10-07T00:00:00.000Z')
    expect(again.activeHash).toBe(first.activeHash); expect(await readFile(resolve(f.dir, 'manifest.json'), 'utf8')).toBe(before)
    f.manifest = JSON.parse(before) as ContentManifest
    // Pin helper closes over the original manifest: explicitly append newly retained files first.
    const second = structuredClone(f.raw); second.version = 'invented-cast-v2'; second.members[0]!.name = 'Invented second creature'
    f.manifest.source[`puzzles-atlas:${sha256(canonicalPuzzleJson(second))}`] = f.manifest.source[`puzzles-atlas:${sha256(canonicalPuzzleJson(f.raw))}`]!
    await writeFile(resolve(f.dir, 'manifest.json'), JSON.stringify(f.manifest))
    const report = await importPuzzlePack(f.dir, second)
    expect(report.retainedPacks).toBe(2); expect(report.activeHash).not.toBe(first.activeHash)
    expect(report.packs.map(p => p.contentHash)).toContain(first.activeHash)
    await writeContentPacks({ contentDir: f.dir, packs: [{ name: 'umas', version: 'invented', items: [{ id: 'invented-outfit' }] }], source: {} })
    expect((await validatePuzzleContent(f.dir)).retainedPacks).toBe(2)
  })
  it('refuses immutable rewrites, missing pins and broken objects before replacing a working catalog', async () => {
    const f = await fixture(); await importPuzzlePack(f.dir, f.raw)
    const before = await readFile(resolve(f.dir, 'manifest.json'), 'utf8'), manifest = JSON.parse(before) as ContentManifest
    const changed = structuredClone(f.raw); changed.members[0]!.name = 'Invented changed name'
    await expect(importPuzzlePack(f.dir, changed)).rejects.toThrow(/atlas missing/)
    manifest.source[`puzzles-atlas:${sha256(canonicalPuzzleJson(changed))}`] = manifest.source[`puzzles-atlas:${sha256(canonicalPuzzleJson(f.raw))}`]!
    await writeFile(resolve(f.dir, 'manifest.json'), JSON.stringify(manifest))
    await expect(importPuzzlePack(f.dir, changed)).rejects.toThrow(/cannot be reauthored/)
    const catalogFile = manifest.files.find(f => f.path.startsWith('data/puzzles-catalog.'))!
    const catalog = parsePuzzleContentCatalog(JSON.parse(await readFile(resolve(f.dir, catalogFile.path), 'utf8')) as unknown, manifest.files)
    await writeFile(resolve(f.dir, catalog.packs[0]!.path), 'corrupt')
    await expect(validatePuzzleContent(f.dir)).rejects.toThrow(/integrity/)
  })
  it('blocks a present invalid Puzzle pack before any publisher storage access', async () => {
    const f = await fixture(); await importPuzzlePack(f.dir, f.raw)
    const manifest = JSON.parse(await readFile(resolve(f.dir, 'manifest.json'), 'utf8')) as ContentManifest
    const c = manifest.files.find(f => f.path.startsWith('data/puzzles-catalog.'))!
    const raw = { schemaVersion: 2, activeHash: 'a'.repeat(64), packs: [] }, bytes = JSON.stringify(raw), hash = sha256(bytes)
    const file = { path: `data/puzzles-catalog.${hash.slice(0, 8)}.json`, sha256: hash, bytes: Buffer.byteLength(bytes) }
    await writeFile(resolve(f.dir, file.path), bytes)
    manifest.files = [...manifest.files.filter(f => f.path !== c.path), file]
    manifest.version = sha256(manifest.files.map(f => f.sha256).sort().join('')).slice(0, 12)
    await writeFile(resolve(f.dir, 'manifest.json'), JSON.stringify(manifest))
    const storage = { readManifest: vi.fn(), objectState: vi.fn(), upload: vi.fn() }
    await expect(publishContent({ contentDir: f.dir, storage })).rejects.toThrow(/catalog/)
    expect(storage.readManifest).not.toHaveBeenCalled(); expect(storage.upload).not.toHaveBeenCalled()
  })
})
