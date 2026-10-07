// Generated pixels and invented source URLs only; tests never contact a public server.
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import { syntheticPuzzleSource } from '@racer/domain/puzzles-content-fixtures'
import { parsePuzzleAtlas, puzzleWebpMetadata, type ContentManifest } from '@racer/domain'
import { importPuzzleAtlas, verifyPuzzleSources } from './puzzles'
const dirs: string[] = []
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }) })
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
async function fixture(count = 5) {
  const dir = await mkdtemp(resolve(tmpdir(), 'puzzle-art-test-')); dirs.push(dir)
  const raw = syntheticPuzzleSource(), pixels = Buffer.alloc(16 * 16 * 4)
  for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 100; pixels[i + 1] = 80; pixels[i + 2] = 220; pixels[i + 3] = i < 128 ? 0 : 255 }
  const png = await sharp(pixels, { raw: { width: 16, height: 16, channels: 4 } }).png().toBuffer()
  for (let i = 5; i < count; i++) raw.members.push({ ...structuredClone(raw.members[i % 5]!), id: `invented-${i}`, family: `invented-${i}` })
  raw.members.forEach(m => { m.art.sha256 = hash(png) })
  const evidence = () => ({ schemaVersion: 1, revision: raw.provenanceRevision, entries: raw.members.map(m => ({ id: m.id, reference: m.source.reference,
    artHash: m.art.sha256, artLocation: m.art.location, artVariant: m.art.variant, verifiedAt: m.source.verifiedAt })) })
  let calls = 0
  const fetcher: typeof fetch = async () => { calls++; return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } }) }
  return { dir, raw, png, evidence, fetcher, calls: () => calls, contentDir: resolve(dir, 'content'), cacheDir: resolve(dir, 'cache') }
}
// Native multi-page codecs and full chapter checks are bounded integration work, not a five-second unit test.
describe('private Puzzle atlas import', { timeout: 30_000 }, () => {
  it('normalizes grayscale-alpha originals to RGBA before transparency checks and composition', async () => {
    const f = await fixture(), image = await sharp(f.png).toColourspace('b-w').png().toBuffer()
    expect((await sharp(image).metadata()).channels).toBe(2)
    f.raw.members.forEach(m => { m.art.sha256 = hash(image) })
    expect(await importPuzzleAtlas({ ...f, evidence: f.evidence(), fetcher: async () =>
      new Response(new Uint8Array(image), { headers: { 'content-type': 'image/png' } }) })).toMatchObject({ frames: 1, pages: 1 })
  })
  it('imports permitted owner exports without network and rejects symlink escapes', async () => {
    const f = await fixture(), path = resolve(f.contentDir, 'originals')
    await mkdir(path, { recursive: true }); await writeFile(resolve(path, 'invented.png'), f.png)
    f.raw.members.forEach(m => { m.source.access = 'owner-export'; m.source.reference = 'https://pad.fandom.com/wiki/Invented_owner_export'; m.art.location = 'originals/invented.png' })
    expect(await importPuzzleAtlas({ ...f, evidence: f.evidence(), offline: true, fetcher: async () => { throw new Error('Network forbidden') } })).toMatchObject({ frames: 1 })
    const escaped = await fixture(); await mkdir(resolve(escaped.contentDir, 'originals'), { recursive: true })
    await writeFile(resolve(escaped.dir, 'outside.png'), escaped.png); await symlink(resolve(escaped.dir, 'outside.png'), resolve(escaped.contentDir, 'originals/invented.png'))
    escaped.raw.members.forEach(m => { m.source.access = 'owner-export'; m.art.location = 'originals/invented.png' })
    await expect(importPuzzleAtlas({ ...escaped, evidence: escaped.evidence(), offline: true })).rejects.toThrow(/escapes/)
  })
  it('does not follow redirects or retry authorization failures, and bounds declared downloads', async () => {
    const f = await fixture(), opts = { ...f, evidence: f.evidence() }; let calls = 0
    await expect(importPuzzleAtlas({ ...opts, fetcher: async (_input, init) => { calls++; expect(init?.redirect).toBe('error')
      return new Response('', { status: 403 }) } })).rejects.toThrow(/fetch failed/)
    expect(calls).toBe(1)
    await expect(importPuzzleAtlas({ ...opts, fetcher: async () => new Response(new Uint8Array(f.png), { headers: { 'content-type': 'image/png', 'content-length': '8388609' } }) })).rejects.toThrow(/fetch failed/)
  })
  it('verifies exact reviewed variants, provenance and duplicate evidence', async () => {
    const f = await fixture()
    expect(verifyPuzzleSources(f.raw, f.evidence()).members).toHaveLength(5)
    const evidence = f.evidence(); evidence.entries[0]!.artVariant = 'unreviewed'
    expect(() => verifyPuzzleSources(f.raw, evidence)).toThrow(/Unverified/)
    evidence.entries[0] = evidence.entries[1]!
    expect(() => verifyPuzzleSources(f.raw, evidence)).toThrow()
  })
  it('deduplicates source bytes, preserves alpha/gutters, reruns identically offline, retains other families', async () => {
    const f = await fixture(), options = { ...f, evidence: f.evidence(), generatedAt: '2026-10-07T00:00:00.000Z' }
    const report = await importPuzzleAtlas(options)
    expect(report).toMatchObject({ members: 5, frames: 1, pages: 1, cacheHits: 0 }); expect(f.calls()).toBe(1)
    const before = await readFile(resolve(f.contentDir, 'manifest.json'), 'utf8'), manifest = JSON.parse(before) as ContentManifest
    const atlasFile = manifest.files.find(f => f.path.endsWith('.json'))!, atlas = parsePuzzleAtlas(JSON.parse(await readFile(resolve(f.contentDir, atlasFile.path), 'utf8')) as unknown)
    const bytes = await readFile(resolve(f.contentDir, atlas.pages[0]!.path)), { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect(puzzleWebpMetadata(bytes)).toEqual({ width: 260, height: 260 })
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (x < 2 || y < 2 || x >= 258 || y >= 258) expect(data[(y * info.width + x) * 4 + 3]).toBe(0)
    expect(await importPuzzleAtlas({ ...options, offline: true, fetcher: async () => { throw new Error('Network forbidden') } })).toMatchObject({ cacheHits: 1, atlasHash: report.atlasHash })
    expect(await readFile(resolve(f.contentDir, 'manifest.json'), 'utf8')).toBe(before)
    manifest.files.push({ path: 'art/priconne/invented.aaaaaaaa.webp', sha256: 'a'.repeat(64), bytes: 5 })
    manifest.version = createHash('sha256').update(manifest.files.map(f => f.sha256).sort().join('')).digest('hex').slice(0, 12)
    await writeFile(resolve(f.contentDir, 'manifest.json'), JSON.stringify(manifest))
    await importPuzzleAtlas(options)
    expect((JSON.parse(await readFile(resolve(f.contentDir, 'manifest.json'), 'utf8')) as ContentManifest).files).toContainEqual(manifest.files.at(-1))
  })
  it('fails closed on corrupt caches, hash/MIME mismatch, absent sources and opaque images without swapping manifest', async () => {
    const f = await fixture(), opts = { ...f, evidence: f.evidence() }
    await expect(importPuzzleAtlas({ ...opts, offline: true })).rejects.toThrow(/offline/)
    await expect(importPuzzleAtlas({ ...opts, fetcher: async () => new Response('not pixels', { headers: { 'content-type': 'image/png' } }) })).rejects.toThrow(/integrity/)
    await expect(importPuzzleAtlas({ ...opts, fetcher: async () => new Response(new Uint8Array(f.png), { headers: { 'content-type': 'text/html' } }) })).rejects.toThrow(/fetch/)
    await importPuzzleAtlas(opts)
    const before = await readFile(resolve(f.contentDir, 'manifest.json'), 'utf8')
    await writeFile(resolve(f.cacheDir, `${hash(f.png)}.source`), 'corrupt')
    await expect(importPuzzleAtlas(opts)).rejects.toThrow(/Corrupt/)
    expect(await readFile(resolve(f.contentDir, 'manifest.json'), 'utf8')).toBe(before)
    const opaque = await sharp({ create: { width: 8, height: 8, channels: 4, background: '#123456' } }).png().toBuffer()
    const other = await fixture(); other.raw.members.forEach(m => { m.art.sha256 = hash(opaque) })
    await expect(importPuzzleAtlas({ ...other, evidence: other.evidence(), fetcher: async () => new Response(new Uint8Array(opaque), { headers: { 'content-type': 'image/png' } }) })).rejects.toThrow(/transparent/)
  })
  it('uses deterministic multi-page rectangles and bounded transient retries', async () => {
    const f = await fixture(50), urls = new Map<string, Buffer>()
    for (let i = 0; i < f.raw.members.length; i++) {
      const image = await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: i, g: 50, b: 80, alpha: 0 } } })
        .composite([{ input: await sharp({ create: { width: 2, height: 2, channels: 4, background: { r: i, g: 50, b: 80, alpha: 1 } } }).png().toBuffer(), left: 1, top: 1 }]).png().toBuffer()
      const m = f.raw.members[i]!; m.art.sha256 = hash(image); m.art.location = `https://example.org/art/invented-${i}.png`; urls.set(m.art.location, image)
    }
    let calls = 0
    const report = await importPuzzleAtlas({ ...f, evidence: f.evidence(), fetcher: async input => { calls++
      return calls === 1 ? new Response('', { status: 503 }) : new Response(new Uint8Array(urls.get(String(input))!), { headers: { 'content-type': 'image/png' } }) } })
    expect(report).toMatchObject({ frames: 50, pages: 2 }); expect(calls).toBe(51)
    const manifest = JSON.parse(await readFile(resolve(f.contentDir, 'manifest.json'), 'utf8')) as ContentManifest
    const atlas = parsePuzzleAtlas(JSON.parse(await readFile(resolve(f.contentDir, manifest.files.find(f => f.path.endsWith('.json'))!.path), 'utf8')) as unknown)
    expect(atlas.frames[49]).toMatchObject({ page: 1, x: 2, y: 2 })
  })
})
