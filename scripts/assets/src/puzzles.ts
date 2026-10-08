// Permitted private PAD source → alpha-safe retained atlas (docs/technical/puzzle-content.md).
import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import sharp from 'sharp'
import { canonicalPuzzleJson, parsePuzzleAtlas, parsePuzzleCastSource, PUZZLE_CONTENT_LIMITS as L,
  puzzleSourceUrl, type ContentManifest, type ContentManifestFile, type PuzzleAtlas, type PuzzleSourceMember } from '@racer/domain'

const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
export function verifyPuzzleSources(raw: unknown, evidence: unknown) {
  const source = parsePuzzleCastSource(raw)
  if (typeof evidence !== 'object' || evidence === null || !('schemaVersion' in evidence) || evidence.schemaVersion !== 1 ||
    !('revision' in evidence) || evidence.revision !== source.provenanceRevision || !('entries' in evidence) || !Array.isArray(evidence.entries) ||
    evidence.entries.length !== source.members.length || Object.keys(evidence).sort().join() !== 'entries,revision,schemaVersion') throw new Error('Reviewed source evidence required')
  const ids = new Set<string>()
  for (const entry of evidence.entries as unknown[]) {
    if (typeof entry !== 'object' || entry === null || !('id' in entry) || typeof entry.id !== 'string' || ids.has(entry.id) ||
      Object.keys(entry).sort().join() !== 'artHash,artLocation,artVariant,id,reference,verifiedAt') throw new Error('Ambiguous source evidence')
    ids.add(entry.id)
    const member = source.members.find(m => m.id === entry.id)
    if (!member || !('reference' in entry) || entry.reference !== member.source.reference ||
      !('artHash' in entry) || entry.artHash !== member.art.sha256 || !('artVariant' in entry) || entry.artVariant !== member.art.variant ||
      !('artLocation' in entry) || entry.artLocation !== member.art.location || !('verifiedAt' in entry) || entry.verifiedAt !== member.source.verifiedAt) throw new Error('Unverified source variant')
  }
  return source
}
async function decode(bytes: Buffer, member: PuzzleSourceMember): Promise<Buffer> {
  if (!bytes.length || bytes.length > L.imageBytes || hash(bytes) !== member.art.sha256) throw new Error('Source image integrity failed')
  const image = sharp(bytes, { limitInputPixels: L.inputPixels, animated: false, failOn: 'warning' }), meta = await image.metadata()
  if (meta.format !== member.art.mimeType.slice(6) || !meta.width || !meta.height || meta.width > 4096 || meta.height > 4096 ||
    !meta.hasAlpha || (meta.pages ?? 1) !== 1) throw new Error('Source image type/dimensions/alpha invalid')
  const { data, info } = await image.toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let transparent = false, visible = false
  for (let i = 3; i < data.length; i += info.channels) { transparent ||= data[i] === 0; visible ||= data[i]! > 0 }
  if (!transparent || !visible) throw new Error('Source image requires visible art and transparent background')
  return sharp(bytes, { limitInputPixels: L.inputPixels }).rotate().resize(L.frame, L.frame, { fit: 'contain', withoutEnlargement: true,
    background: { r: 0, g: 0, b: 0, alpha: 0 } }).toColourspace('srgb').ensureAlpha().raw().toBuffer()
}
async function network(member: PuzzleSourceMember, fetcher: typeof fetch): Promise<Buffer> {
  puzzleSourceUrl(member.art.location)
  for (let attempt = 0; attempt < L.attempts; attempt++) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), L.timeoutMs)
    try {
      const response = await fetcher(member.art.location, { redirect: 'error', signal: controller.signal,
        headers: { 'User-Agent': 'Uma-Racer-private-asset-importer/1.0' } })
      if (response.status >= 500 && attempt + 1 < L.attempts) { await response.body?.cancel(); continue }
      if (!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim() !== member.art.mimeType) throw new Error('Source image response invalid')
      const length = response.headers.get('content-length')
      if (length && (!/^\d+$/.test(length) || Number(length) > L.imageBytes)) throw new Error('Source image exceeds byte bound')
      const reader = response.body?.getReader(); if (!reader) throw new Error('Source image empty')
      const chunks: Uint8Array[] = []; let total = 0
      try { for (;;) { const part = await reader.read(); if (part.done) break
        total += part.value.byteLength; if (total > L.imageBytes) throw new Error('Source image exceeds byte bound'); chunks.push(part.value)
      } } finally { await reader.cancel().catch(() => undefined) }
      return Buffer.concat(chunks)
    } catch (error) {
      if (attempt + 1 === L.attempts || !(error instanceof TypeError)) throw new Error('Permitted source fetch failed')
    } finally { clearTimeout(timer) }
  }
  throw new Error('Permitted source fetch failed')
}
async function original(member: PuzzleSourceMember, options: { contentDir: string; cacheDir: string; offline?: boolean; fetcher?: typeof fetch }) {
  const cache = resolve(options.cacheDir, `${member.art.sha256}.source`)
  try { const bytes = await readFile(cache); return { frame: await decode(bytes, member), cacheHit: true } }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Corrupt source cache; restore reviewed original bytes') }
  let bytes: Buffer
  if (member.source.access === 'owner-export' || member.source.access === 'original-placeholder') {
    const root = await realpath(resolve(options.contentDir, 'originals')), path = await realpath(resolve(options.contentDir, member.art.location))
    if (!path.startsWith(root + sep)) throw new Error('Source export escapes originals directory')
    bytes = await readFile(path)
  } else {
    if (options.offline) throw new Error('Reviewed source not cached; offline mode never fetches')
    bytes = await network(member, options.fetcher ?? fetch)
  }
  const frame = await decode(bytes, member)
  await mkdir(options.cacheDir, { recursive: true }); await writeImmutable(cache, bytes)
  return { frame, cacheHit: false }
}
export async function writeImmutable(path: string, bytes: string | Buffer): Promise<void> {
  try { await writeFile(path, bytes, { flag: 'wx' }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if (!(await readFile(path)).equals(Buffer.from(bytes))) throw new Error('Immutable object collision/corruption')
  }
}
export async function importPuzzleAtlas(options: { contentDir: string; cacheDir: string; raw: unknown; evidence: unknown;
  offline?: boolean; fetcher?: typeof fetch; generatedAt?: string }) {
  const source = verifyPuzzleSources(options.raw, options.evidence), sourceHash = hash(canonicalPuzzleJson(source))
  const unique = [...new Map(source.members.map(m => [m.art.sha256, m])).values()].sort((a, b) => a.art.sha256 < b.art.sha256 ? -1 : 1)
  // Bounded sequential downloads: no uncontrolled decode/download Promise.all over a private catalogue.
  const images = []
  for (const member of unique) images.push({ hash: member.art.sha256, ...await original(member, options) })
  const stride = L.frame + 2 * L.gutter, columns = Math.floor(L.page / stride), perPage = columns * columns
  const atlas: PuzzleAtlas = { schemaVersion: 1, kind: 'puzzles-monsters', frameSize: 256, gutter: 2, pages: [], frames: [] }
  const objects: { file: ContentManifestFile; bytes: Buffer | string }[] = []
  for (let start = 0; start < images.length; start += perPage) {
    const group = images.slice(start, start + perPage), index = atlas.pages.length
    const width = Math.min(columns, group.length) * stride, height = Math.ceil(group.length / columns) * stride
    const composites = group.map((image, n) => {
      const x = (n % columns) * stride + L.gutter, y = Math.floor(n / columns) * stride + L.gutter
      atlas.frames.push({ id: `frame-${image.hash.slice(0, 32)}`, page: index, x, y, width: 256, height: 256 })
      return { input: image.frame, raw: { width: L.frame, height: L.frame, channels: 4 as const }, left: x, top: y }
    })
    const bytes = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(composites).webp({ lossless: true, effort: 4 }).toBuffer(), sha256 = hash(bytes)
    const file = { path: `atlases/puzzles-monsters-${index}.${sha256.slice(0, 8)}.webp`, sha256, bytes: bytes.length }
    atlas.pages.push({ ...file, width, height }); objects.push({ file, bytes })
  }
  parsePuzzleAtlas(atlas)
  const json = canonicalPuzzleJson(atlas), digest = hash(json), descriptor = { path: `atlases/puzzles-monsters.${digest.slice(0, 8)}.json`, sha256: digest, bytes: Buffer.byteLength(json) }
  objects.push({ file: descriptor, bytes: json })
  let previous: ContentManifest
  try { previous = JSON.parse(await readFile(resolve(options.contentDir, 'manifest.json'), 'utf8')) as ContentManifest }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    previous = { version: hash('').slice(0, 12), generatedAt: '', source: {}, files: [] }
  }
  if (!Array.isArray(previous.files) || new Set(previous.files.map(f => f.path)).size !== previous.files.length ||
    previous.version !== hash(previous.files.map(f => f.sha256).sort().join('')).slice(0, 12)) throw new Error('Invalid content manifest')
  await mkdir(resolve(options.contentDir, 'atlases'), { recursive: true })
  const files = [...previous.files]
  for (const object of objects) {
    if (files.some(f => f.path === object.file.path && (f.sha256 !== object.file.sha256 || f.bytes !== object.file.bytes))) throw new Error('Immutable atlas collision')
    await writeImmutable(resolve(options.contentDir, object.file.path), object.bytes)
    if (!files.some(f => f.path === object.file.path)) files.push(object.file)
  }
  files.sort((a, b) => a.path < b.path ? -1 : 1)
  const manifest: ContentManifest = { ...previous, generatedAt: options.generatedAt ?? new Date().toISOString(), files,
    version: hash(files.map(f => f.sha256).sort().join('')).slice(0, 12), source: { ...previous.source, [`puzzles-atlas:${sourceHash}`]: descriptor.path } }
  const target = resolve(options.contentDir, 'manifest.json'), temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(manifest)); await rename(temporary, target)
  return { frames: images.length, members: source.members.length, pages: atlas.pages.length, cacheHits: images.filter(i => i.cacheHit).length, sourceHash, atlasHash: digest }
}
