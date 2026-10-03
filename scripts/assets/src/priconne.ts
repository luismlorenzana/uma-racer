// Curated official-site portrait adapter; all source evidence/art stays private (T097).
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { parseRpgChapterPack, type ContentManifest, type RpgChapterPack } from '@racer/domain'
import { downloadImages } from './download'

export interface RpgPageEvidence { pageUrl: string; portraitUrls: string[] }
export function verifyRpgSources(raw: unknown, evidence: unknown): RpgChapterPack {
  if (typeof raw !== 'object' || raw === null || !('version' in raw) || !('actors' in raw) || !Array.isArray(raw.actors)) throw new Error('Invalid private RPG source')
  const keys = raw.actors.flatMap((a: unknown) => typeof a === 'object' && a !== null && 'artKey' in a && typeof a.artKey === 'string' ? [a.artKey] : [])
  const pack = parseRpgChapterPack(raw, { version: String(raw.version), contentHash: '0'.repeat(64), artKeys: keys })
  if (pack.schemaVersion !== 2 || typeof evidence !== 'object' || evidence === null || !('schemaVersion' in evidence) || evidence.schemaVersion !== 1 ||
    !('pages' in evidence) || !Array.isArray(evidence.pages) || evidence.pages.length > 500 || evidence.pages.some((p: unknown) =>
      typeof p !== 'object' || p === null || !('pageUrl' in p) || typeof p.pageUrl !== 'string' || !('portraitUrls' in p) ||
      !Array.isArray(p.portraitUrls) || p.portraitUrls.length > 50 || p.portraitUrls.some((u: unknown) => typeof u !== 'string' || u.length > 2048))) throw new Error('Verified official-page evidence is required')
  for (const actor of pack.actors) {
    if (!/^[A-Za-z0-9_-]{1,24}$/.test(actor.artKey)) throw new Error('Invalid private portrait key')
    const source = actor.source!
    if (!evidence.pages.some((p: unknown) => typeof p === 'object' && p !== null && 'pageUrl' in p && p.pageUrl === source.pageUrl &&
      'portraitUrls' in p && Array.isArray(p.portraitUrls) && p.portraitUrls.includes(source.portraitUrl))) throw new Error('Portrait variant was not verified on its official character page')
  }
  for (const key of new Set(keys)) if (new Set(pack.actors.filter(a => a.artKey === key).map(a => a.source!.portraitUrl)).size !== 1) throw new Error('Conflicting portrait sources')
  return pack
}

export async function importRpgPortraits(options: { contentDir: string; cacheDir: string; raw: unknown; evidence: unknown; offline?: boolean; fetcher?: typeof fetch; generatedAt?: string }) {
  const pack = verifyRpgSources(options.raw, options.evidence)
  const actors = [...new Map(pack.actors.map(a => [a.artKey, a])).values()]
  const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
  const sources = actors.map(a => ({ id: digest(a.source!.portraitUrl), url: a.source!.portraitUrl }))
  const fetcher = options.offline ? async (): Promise<Response> => { throw new Error('Private source image is not cached; offline import never accesses the network') } : options.fetcher ?? fetch
  const downloaded = await downloadImages(sources, { cacheDir: options.cacheDir, kind: 'priconne', fetcher, concurrency: 4 })
  const images = await Promise.all(actors.map(async a => {
    const bytes = downloaded.images.find(i => i.id === digest(a.source!.portraitUrl))!.bytes
    // Native decoding rejects error pages. Keep a small square phone portrait; no source combat data is imported.
    const image = await sharp(bytes, { limitInputPixels: 16_777_216 }).rotate().resize(256, 256, { fit: 'cover', position: 'attention' }).webp({ quality: 85 }).toBuffer()
    return { key: a.artKey, bytes: image, hash: digest(image) }
  }))
  let previous: ContentManifest
  try { previous = JSON.parse(await readFile(resolve(options.contentDir, 'manifest.json'), 'utf8')) as ContentManifest }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
    previous = { version: digest('').slice(0, 12), generatedAt: '', source: {}, files: [] }
  }
  if (!Array.isArray(previous.files) || typeof previous.source !== 'object' || !previous.source ||
    new Set(previous.files.map(f => f.path)).size !== previous.files.length ||
    previous.version !== digest(previous.files.map(f => f.sha256).sort().join('')).slice(0, 12)) throw new Error('Invalid private content manifest')
  const target = resolve(options.contentDir, 'art/priconne'); await mkdir(target, { recursive: true })
  const files = [...previous.files], source = { ...previous.source }
  for (const image of images) {
    const path = `art/priconne/${image.key}.${image.hash.slice(0, 8)}.webp`
    if (files.some(f => f.path === path && f.sha256 !== image.hash)) throw new Error('Private portrait filename hash collision')
    await writeFile(resolve(options.contentDir, path), image.bytes)
    if (!files.some(f => f.path === path)) files.push({ path, sha256: image.hash, bytes: image.bytes.length })
    source[`rpg-art:${image.key}`] = path
  }
  files.sort((a, b) => a.path.localeCompare(b.path))
  const manifest: ContentManifest = { version: digest(files.map(f => f.sha256).sort().join('')).slice(0, 12),
    generatedAt: options.generatedAt ?? new Date().toISOString(), source, files }
  const manifestPath = resolve(options.contentDir, 'manifest.json'), temp = `${manifestPath}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(manifest)); await rename(temp, manifestPath)
  return { portraits: images.length, cacheHits: downloaded.images.filter(i => i.cacheHit).length,
    bytes: images.reduce((sum, image) => sum + image.bytes.length, 0), unresolvedReferences: 0 }
}
