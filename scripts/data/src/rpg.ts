// Offline private campaign compiler and publication gate (docs/technical/rpg-chapter-content.md).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { assertProductionRpgPack, isRpgBattleNode, parseRpgChapterPack, parseRpgContentCatalog,
  rpgChapterFightCounts, type ContentManifest, type ContentManifestFile, type RpgChapterPack,
  type RpgContentCatalog } from '@racer/domain'
import { sha256 } from './pack'

export const RPG_PACK_PATH = /^data\/rpg-chapters\.[a-f0-9]{8}\.json$/
export const RPG_CATALOG_PATH = /^data\/rpg-catalog\.[a-f0-9]{8}\.json$/
const ART_PATH = /^art\/priconne\/([A-Za-z0-9_-]{1,24})\.[a-f0-9]{8}\.webp$/
export function canonicalRpgJson(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : typeof v === 'object' && v !== null
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, child]) => [k, sort(child)])) : v
  return JSON.stringify(sort(value))
}
export function rpgCoverage(pack: RpgChapterPack) {
  return { version: pack.version, contentHash: pack.contentHash, chapters: pack.chapters.length,
    actors: pack.actors.length, characters: new Set(pack.actors.map(a => a.source?.characterId)).size,
    nodes: pack.chapters.reduce((sum, c) => sum + c.nodes.length, 0),
    fights: pack.chapters.reduce((sum, c) => sum + c.nodes.filter(isRpgBattleNode).length, 0),
    actions: pack.actors.reduce((sum, a) => sum + a.combat.moves.length + (a.combat.phaseTwo?.moves.length ?? 0), 0),
    phaseActors: pack.actors.filter(a => a.combat.phaseTwo).length,
    portraits: new Set(pack.actors.map(a => a.artKey)).size,
    routeFightCounts: pack.chapters.map(rpgChapterFightCounts), unresolvedReferences: 0 }
}
export async function readRpgManifest(contentDir: string): Promise<ContentManifest> {
  const raw = JSON.parse(await readFile(resolve(contentDir, 'manifest.json'), 'utf8')) as ContentManifest
  if (!Array.isArray(raw.files) || new Set(raw.files.map(f => f.path)).size !== raw.files.length ||
    raw.version !== sha256(raw.files.map(f => f.sha256).sort().join('')).slice(0, 12)) throw new Error('Invalid private content manifest')
  return raw
}
async function verified(contentDir: string, file: ContentManifestFile): Promise<Buffer> {
  if (!/^(data|art\/priconne)\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(file.path) || file.path.includes('..')) throw new Error('Unsafe RPG content path')
  const bytes = await readFile(resolve(contentDir, file.path))
  if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error('Private RPG object integrity failed')
  if (ART_PATH.test(file.path)) verifyPortraitHeader(bytes)
  return bytes
}
/** Native decoding happens in the asset importer; the offline publication gate also checks format/dimensions. */
function verifyPortraitHeader(bytes: Buffer): void {
  const fail = (): never => { throw new Error('Private RPG portrait is not a 256px WebP') }
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' ||
    bytes.readUInt32LE(4) + 8 !== bytes.length) fail()
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), data = offset + 8
    if (data + size > bytes.length) fail()
    let width = 0, height = 0
    if (kind === 'VP8X' && size >= 10) { width = bytes.readUIntLE(data + 4, 3) + 1; height = bytes.readUIntLE(data + 7, 3) + 1 }
    if (kind === 'VP8 ' && size >= 10 && bytes.toString('hex', data + 3, data + 6) === '9d012a') {
      width = bytes.readUInt16LE(data + 6) & 0x3fff; height = bytes.readUInt16LE(data + 8) & 0x3fff
    }
    if (kind === 'VP8L' && size >= 5 && bytes[data] === 0x2f) {
      const bits = bytes.readUInt32LE(data + 1); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1
    }
    if (width || height) { if (width !== 256 || height !== 256) fail(); return }
    offset = data + size + size % 2
  }
  fail()
}
export async function validateRpgContent(contentDir: string, provided?: ContentManifest) {
  const manifest = provided ?? await readRpgManifest(contentDir)
  const files = manifest.files.filter(f => RPG_CATALOG_PATH.test(f.path))
  if (files.length !== 1) throw new Error('Private RPG content requires exactly one catalog')
  const catalog = parseRpgContentCatalog(JSON.parse((await verified(contentDir, files[0]!)).toString('utf8')) as unknown, manifest.files)
  if (manifest.files.filter(f => RPG_PACK_PATH.test(f.path)).length !== catalog.packs.length) throw new Error('Uncatalogued RPG pack in manifest')
  const reports = []
  for (const reference of catalog.packs) {
    for (const art of reference.art) await verified(contentDir, manifest.files.find(f => f.path === art.path)!)
    const file = manifest.files.find(f => f.path === reference.path)!
    const pack = parseRpgChapterPack(JSON.parse((await verified(contentDir, file)).toString('utf8')) as unknown,
      { version: reference.version, contentHash: reference.sha256, artKeys: reference.art.map(a => a.key) })
    assertProductionRpgPack(pack)
    reports.push(rpgCoverage(pack))
  }
  return { manifestVersion: manifest.version, activeHash: catalog.activeHash, retainedPacks: catalog.packs.length, packs: reports }
}
export async function writeRpgManifest(contentDir: string, previous: ContentManifest, files: ContentManifestFile[], generatedAt: string) {
  files.sort((a, b) => a.path.localeCompare(b.path))
  const manifest = { ...previous, version: sha256(files.map(f => f.sha256).sort().join('')).slice(0, 12), generatedAt, files }
  const target = resolve(contentDir, 'manifest.json'), temp = `${target}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(manifest)); await rename(temp, target)
  return manifest
}
export async function importRpgPack(contentDir: string, raw: unknown, generatedAt = new Date().toISOString()) {
  const previous = await readRpgManifest(contentDir)
  const version = typeof raw === 'object' && raw !== null && 'version' in raw && typeof raw.version === 'string' ? raw.version : ''
  const json = canonicalRpgJson(raw), hash = sha256(json)
  const arts = previous.files.filter(f => ART_PATH.test(f.path))
  const pack = parseRpgChapterPack(raw, { version, contentHash: hash, artKeys: arts.map(f => ART_PATH.exec(f.path)![1]!) })
  assertProductionRpgPack(pack)
  // Never silently pick one of two old/current images with the same key. Source imports pin their exact hash.
  const art = [...new Set(pack.actors.map(a => a.artKey))].map(key => {
    const sources = pack.actors.filter(a => a.artKey === key).map(a => a.source!.portraitUrl)
    if (new Set(sources).size !== 1) throw new Error('One art key refers to multiple portrait sources')
    const pins = previous.source[`rpg-art:${key}`]
    const file = arts.find(f => f.path === pins)
    if (!file) throw new Error('RPG art source pin is missing; run assets:rpg:import first')
    return { key, path: file.path }
  })
  // A broken newly imported portrait must not displace the last known-good catalog.
  for (const entry of art) await verified(contentDir, previous.files.find(f => f.path === entry.path)!)
  let catalog: RpgContentCatalog = { schemaVersion: 1, activeHash: hash, packs: [] }
  const catalogs = previous.files.filter(f => RPG_CATALOG_PATH.test(f.path))
  if (catalogs.length > 1) throw new Error('Ambiguous existing RPG catalog')
  if (!catalogs.length && previous.files.some(f => RPG_PACK_PATH.test(f.path))) throw new Error('Uncatalogued legacy RPG pack: review retention before importing')
  if (catalogs[0]) {
    await validateRpgContent(contentDir, previous)
    catalog = parseRpgContentCatalog(JSON.parse((await verified(contentDir, catalogs[0])).toString('utf8')) as unknown, previous.files)
    if (catalog.packs.some(p => p.version === version && p.sha256 !== hash)) throw new Error('An immutable RPG version cannot be reauthored; use a new version')
  }
  const path = `data/rpg-chapters.${hash.slice(0, 8)}.json`
  if (previous.files.some(f => f.path === path && f.sha256 !== hash)) throw new Error('RPG pack filename hash collision')
  const retained = catalog.packs.find(p => p.sha256 === hash)
  if (retained && canonicalRpgJson(retained.art) !== canonicalRpgJson(art)) throw new Error('An immutable RPG portrait mapping cannot change; use a new pack version')
  const reference = { version, sha256: hash, path, art }
  catalog = { ...catalog, activeHash: hash, packs: [...catalog.packs.filter(p => p.sha256 !== hash), reference] }
  const files = previous.files.filter(f => !RPG_CATALOG_PATH.test(f.path) && f.path !== path)
  files.push({ path, sha256: hash, bytes: Buffer.byteLength(json) })
  parseRpgContentCatalog(catalog, files)
  await mkdir(resolve(contentDir, 'data'), { recursive: true })
  await writeFile(resolve(contentDir, path), json)
  const catalogJson = canonicalRpgJson(catalog), catalogHash = sha256(catalogJson)
  const catalogPath = `data/rpg-catalog.${catalogHash.slice(0, 8)}.json`
  if (previous.files.some(f => f.path === catalogPath && f.sha256 !== catalogHash)) throw new Error('RPG catalog filename hash collision')
  await writeFile(resolve(contentDir, catalogPath), catalogJson)
  files.push({ path: catalogPath, sha256: catalogHash, bytes: Buffer.byteLength(catalogJson) })
  // Old immutable packs and their portraits stay both on disk and in the manifest. No implicit pruning.
  await writeRpgManifest(contentDir, previous, files, generatedAt)
  return validateRpgContent(contentDir)
}
