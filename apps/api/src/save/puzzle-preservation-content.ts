// Server-side verified private content. Never log source rows, paths or extracted assets (implementation §8).
import { ContentService } from '../content/content.service'
import { createPuzzleSource } from './puzzle-domain/minigames/uma-puzzles/identity'
import { assertPuzzleArtJoin, parsePuzzleAtlas, parsePuzzleContentCatalog, parsePuzzleContentPack, puzzleWebpMetadata,
  PUZZLE_CATALOG_PATH } from './puzzle-domain/minigames/uma-puzzles/content'
import { puzzleArray, puzzleId, puzzleRecord } from './puzzle-domain/minigames/uma-puzzles/validation'
import type { VerifiedPuzzlePreservationContent } from './puzzles'

export async function verifiedPreservationContent(content: ContentService, frozenHash?: string): Promise<VerifiedPuzzlePreservationContent> {
  const manifest = await content.manifest(), catalogs = manifest.files.filter(f => PUZZLE_CATALOG_PATH.test(f.path)),
    umaFiles = manifest.files.filter(f => /^data\/umas\.[a-f0-9]{8}\.json$/.test(f.path))
  if (!manifest.version || catalogs.length !== 1 || umaFiles.length !== 1) throw new Error('Publish and verify compatible Puzzle and Uma packs before preparing')
  const read = async (f: { path: string; bytes: number; sha256: string }) => {
    if (!manifest.files.some(m => m.path === f.path && m.bytes === f.bytes && m.sha256 === f.sha256)) throw new Error('Required immutable content is not retained')
    return content.readVerifiedJson(f)
  }
  const catalog = parsePuzzleContentCatalog(await read(catalogs[0]!), manifest.files), ref = catalog.packs.find(p => p.sha256 === (frozenHash ?? catalog.activeHash))
  if (!ref) throw new Error('The frozen replacement pack is not retained; restore it before retrying')
  const pack = parsePuzzleContentPack(await read(ref)), atlas = parsePuzzleAtlas(await read(pack.atlas))
  if (pack.version !== ref.version) throw new Error('Compatible Puzzle pack version is unavailable')
  assertPuzzleArtJoin(pack, atlas)
  for (const page of atlas.pages) {
    if (!manifest.files.some(m => m.path === page.path && m.bytes === page.bytes && m.sha256 === page.sha256)) throw new Error('Required art is not retained')
    const dimensions = puzzleWebpMetadata(await content.readVerifiedBytes(page))
    if (dimensions.width !== page.width || dimensions.height !== page.height) throw new Error('Required art dimensions failed verification')
  }
  return { ...verifiedUmaSources(umaFiles[0]!, await read(umaFiles[0]!)), contentHash: ref.sha256 }
}

/**
 * The frozen original sources from the verified Uma pack. The importer's pack version joins source hashes with '+',
 * which is not id-safe, so the verified file's own SHA-256 names the exact catalogue instead (D291).
 */
export function verifiedUmaSources(file: { sha256: string }, umas: unknown): Omit<VerifiedPuzzlePreservationContent, 'contentHash'> {
  const catalogueVersion = file.sha256
  if (!puzzleRecord(umas) || typeof umas.version !== 'string' || !puzzleArray(umas.items, 8192) || !puzzleId(catalogueVersion)) {
    throw new Error('Uma catalogue failed verification')
  }
  const sources = new Map<string, ReturnType<typeof createPuzzleSource>>()
  for (const row of umas.items) {
    if (!puzzleRecord(row)) throw new Error('Uma source is malformed')
    const source = createPuzzleSource(row as unknown as Parameters<typeof createPuzzleSource>[0], catalogueVersion)
    if (sources.has(source.templateId)) throw new Error('Ambiguous original outfit source')
    sources.set(source.templateId, source)
  }
  return { catalogueVersion, sources }
}
