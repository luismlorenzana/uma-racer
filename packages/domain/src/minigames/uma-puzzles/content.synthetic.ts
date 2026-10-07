// Invented identities/URLs only; no production fallback or extracted rows.
import { PUZZLE_ELEMENTS } from './types'
import { PUZZLE_FOE_ROLES } from './campaign/rules'
import type { PuzzleSource, PuzzleAtlas, PuzzleContentPack } from './content'
export function syntheticPuzzleSource(): PuzzleSource {
  return { schemaVersion: 1, version: 'invented-cast-v1', provenanceRevision: 'invented-review-v1',
    members: PUZZLE_ELEMENTS.map((element, i) => ({ id: `invented-${element}`, name: `Invented creature ${i + 1}`, family: `invented-family-${i}`,
      variant: 'base', elements: [element], roles: [...PUZZLE_FOE_ROLES],
      source: { access: 'public', reference: `https://example.org/creatures/${i}`, revision: 'invented-source-v1', verifiedAt: '2026-10-07T00:00:00.000Z' },
      art: { location: `https://example.org/art/${i}.png`, sha256: '0'.repeat(64), variant: 'base-art', mimeType: 'image/png' } })) }
}
export function syntheticPuzzleAtlas(): PuzzleAtlas {
  return { schemaVersion: 1, kind: 'puzzles-monsters', frameSize: 256, gutter: 2,
    pages: [{ path: `atlases/puzzles-monsters-0.${'2'.repeat(8)}.webp`, sha256: '2'.repeat(64), bytes: 26, width: 260, height: 260 }],
    frames: [{ id: 'frame-invented', page: 0, x: 2, y: 2, width: 256, height: 256 }] }
}
export function syntheticPuzzlePack(): PuzzleContentPack {
  const s = syntheticPuzzleSource()
  return { ...s, capability: { engineVersion: 1, recipeVersion: 1 },
    atlas: { path: `atlases/puzzles-monsters.${'1'.repeat(8)}.json`, sha256: '1'.repeat(64), bytes: 100 },
    members: s.members.map(m => ({ ...m, art: { frameId: 'frame-invented', sourceHash: m.art.sha256, variant: m.art.variant } })) }
}
