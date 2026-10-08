// Credential-free retained Puzzle content compiler/publication gate (docs/technical/puzzle-content.md).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { assertPuzzleArtJoin, canonicalPuzzleJson, parsePuzzleAtlas, parsePuzzleCastSource, parsePuzzleContentCatalog,
  parsePuzzleContentPack, puzzleCastForContent, puzzleContentCoverage, PUZZLE_ATLAS_PATH, PUZZLE_CATALOG_PATH, PUZZLE_PACK_PATH,
  PUZZLE_PAGE_PATH, puzzleWebpMetadata, type ContentManifest, type ContentManifestFile, type PuzzleContentCatalog, type PuzzleContentPack } from '@racer/domain'
import { sha256 } from './pack'
import { readRpgManifest } from './rpg'

async function verified(dir: string, f: ContentManifestFile): Promise<Buffer> {
  if (![PUZZLE_PACK_PATH, PUZZLE_CATALOG_PATH, PUZZLE_ATLAS_PATH, PUZZLE_PAGE_PATH].some(p => p.test(f.path)) ||
    !f.path.includes(`.${f.sha256.slice(0, 8)}.`)) throw new Error('Unsafe Puzzle object')
  const bytes = await readFile(resolve(dir, f.path))
  if (bytes.length !== f.bytes || sha256(bytes) !== f.sha256) throw new Error('Puzzle object integrity failed')
  return bytes
}
async function json(dir: string, f: ContentManifestFile): Promise<unknown> { return JSON.parse((await verified(dir, f)).toString('utf8')) as unknown }
function reference(manifest: ContentManifest, file: ContentManifestFile): ContentManifestFile {
  const found = manifest.files.find(f => f.path === file.path && f.sha256 === file.sha256 && f.bytes === file.bytes)
  if (!found) throw new Error('Unretained Puzzle object')
  return found
}
async function validatePack(dir: string, manifest: ContentManifest, ref: ContentManifestFile & { version: string }) {
  const pack = parsePuzzleContentPack(await json(dir, ref))
  if (pack.version !== ref.version) throw new Error('Puzzle version mismatch')
  const atlas = parsePuzzleAtlas(await json(dir, reference(manifest, pack.atlas)))
  assertPuzzleArtJoin(pack, atlas)
  for (const page of atlas.pages) {
    const dimensions = puzzleWebpMetadata(await verified(dir, reference(manifest, page)))
    if (dimensions.width !== page.width || dimensions.height !== page.height) throw new Error('Puzzle atlas dimensions mismatch')
  }
  return { version: ref.version, contentHash: ref.sha256, atlasHash: pack.atlas.sha256, pages: atlas.pages.length,
    frames: atlas.frames.length, ...puzzleContentCoverage(puzzleCastForContent(pack, `puzzles-${ref.sha256}`)) }
}
export async function validatePuzzleContent(dir: string, provided?: ContentManifest) {
  const manifest = provided ?? await readRpgManifest(dir), catalogs = manifest.files.filter(f => PUZZLE_CATALOG_PATH.test(f.path))
  if (catalogs.length !== 1) throw new Error('Uma Puzzles content unavailable: one verified catalog required')
  const catalog = parsePuzzleContentCatalog(await json(dir, catalogs[0]!), manifest.files)
  if (manifest.files.filter(f => PUZZLE_PACK_PATH.test(f.path)).length !== catalog.packs.length) throw new Error('Uncatalogued Puzzle pack')
  const packs = []
  for (const ref of catalog.packs) packs.push(await validatePack(dir, manifest, ref))
  return { verifiedAt: new Date().toISOString(), manifestVersion: manifest.version, activeHash: catalog.activeHash, retainedPacks: packs.length, packs }
}
async function immutable(dir: string, file: ContentManifestFile, bytes: string, files: ContentManifestFile[]) {
  if (files.some(f => f.path === file.path && (f.sha256 !== file.sha256 || f.bytes !== file.bytes))) throw new Error('Puzzle filename collision')
  try { await writeFile(resolve(dir, file.path), bytes, { flag: 'wx' }) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if ((await readFile(resolve(dir, file.path), 'utf8')) !== bytes) throw new Error('Immutable Puzzle object corruption')
  }
  if (!files.some(f => f.path === file.path)) files.push({ path: file.path, sha256: file.sha256, bytes: file.bytes })
}
export async function importPuzzlePack(dir: string, raw: unknown, generatedAt = new Date().toISOString()) {
  const source = parsePuzzleCastSource(raw), previous = await readRpgManifest(dir)
  const pin = previous.source[`puzzles-atlas:${sha256(canonicalPuzzleJson(source))}`], atlasFile = previous.files.find(f => f.path === pin)
  if (!atlasFile || !PUZZLE_ATLAS_PATH.test(atlasFile.path)) throw new Error('Verified source atlas missing; run assets:puzzles:import first')
  const atlas = parsePuzzleAtlas(await json(dir, atlasFile))
  const pack: PuzzleContentPack = { schemaVersion: 1, version: source.version, provenanceRevision: source.provenanceRevision,
    capability: { engineVersion: 1, recipeVersion: 1 }, atlas: atlasFile,
    members: source.members.map(m => ({ ...m, art: { frameId: `frame-${m.art.sha256.slice(0, 32)}`, sourceHash: m.art.sha256, variant: m.art.variant } })) }
  parsePuzzleContentPack(pack); assertPuzzleArtJoin(pack, atlas)
  for (const page of atlas.pages) await verified(dir, reference(previous, page))
  const bytes = canonicalPuzzleJson(pack), digest = sha256(bytes)
  let catalog: PuzzleContentCatalog = { schemaVersion: 1, activeHash: digest, packs: [] }
  const old = previous.files.filter(f => PUZZLE_CATALOG_PATH.test(f.path))
  if (old.length > 1 || !old.length && previous.files.some(f => PUZZLE_PACK_PATH.test(f.path))) throw new Error('Ambiguous Puzzle retention')
  if (old[0]) { await validatePuzzleContent(dir, previous); catalog = parsePuzzleContentCatalog(await json(dir, old[0]), previous.files) }
  if (catalog.packs.some(p => p.version === pack.version && p.sha256 !== digest)) throw new Error('Immutable Puzzle version cannot be reauthored')
  const ref = { version: pack.version, path: `data/puzzles-cast.${digest.slice(0, 8)}.json`, sha256: digest, bytes: Buffer.byteLength(bytes) }
  catalog = { schemaVersion: 1, activeHash: digest, packs: [...catalog.packs.filter(p => p.sha256 !== digest), ref] }
  const files = previous.files.filter(f => !PUZZLE_CATALOG_PATH.test(f.path))
  await mkdir(resolve(dir, 'data'), { recursive: true })
  await immutable(dir, ref, bytes, files)
  catalog = parsePuzzleContentCatalog(catalog, files)
  const catalogBytes = canonicalPuzzleJson(catalog), catalogHash = sha256(catalogBytes)
  await immutable(dir, { path: `data/puzzles-catalog.${catalogHash.slice(0, 8)}.json`, bytes: Buffer.byteLength(catalogBytes), sha256: catalogHash }, catalogBytes, files)
  files.sort((a, b) => a.path < b.path ? -1 : 1)
  const next: ContentManifest = { ...previous, generatedAt, files, version: sha256(files.map(f => f.sha256).sort().join('')).slice(0, 12) }
  await validatePuzzleContent(dir, next)
  const target = resolve(dir, 'manifest.json'), temp = `${target}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(next)); await rename(temp, target)
  return validatePuzzleContent(dir)
}
