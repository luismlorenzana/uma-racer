import { describe, expect, it } from 'vitest'
import { assertPuzzleArtJoin, canonicalPuzzleJson, parsePuzzleAtlas, parsePuzzleCastSource, parsePuzzleContentCatalog,
  parsePuzzleContentPack, puzzleCastForContent, puzzleContentCoverage, puzzleSourceUrl, puzzleUsesPlaceholderArt, PUZZLE_CONTENT_LIMITS } from './content'
import { syntheticPuzzleAtlas, syntheticPuzzlePack, syntheticPuzzleSource } from './content.synthetic'
import { puzzleChapter } from './campaign/chapters'
import { createPuzzleCheckpoint } from './campaign/progress'
import { syntheticPuzzleEntrants } from './campaign/fixtures'
import { freezePuzzleEncounter } from './campaign/encounters'
import { createBattle } from './battle'
import { battleStateHash } from './replay'
// Full generated-chapter coverage is deliberately repeated across source/pack variants; keep all joins on slow CI.
describe('Puzzle private presentation contract', { timeout: 30_000 }, () => {
  it('explicitly labels original placeholders; never fabricates PAD provenance or mixes cast modes', () => {
    const s = syntheticPuzzleSource()
    s.members.forEach(m => { m.name = 'Invented original placeholder'; m.source.access = 'original-placeholder'; m.source.reference = 'repo:scripts/assets/src/puzzle-placeholder-art.ts'; m.art.location = 'originals/invented.png' })
    expect(puzzleUsesPlaceholderArt(parsePuzzleCastSource(s))).toBe(true)
    s.members[0]!.name = 'Unlabelled enemy'; expect(() => parsePuzzleCastSource(s)).toThrow(/placeholder must be named/)
    s.members[0]!.name = 'Named placeholder'; s.members[0]!.source.reference = 'https://example.org/fake-provenance'
    expect(() => parsePuzzleCastSource(s)).toThrow(/placeholder provenance/)
    s.members[0]!.source.access = 'owner-export'; expect(() => parsePuzzleCastSource(s)).toThrow(/mixed/)
    expect(puzzleUsesPlaceholderArt(parsePuzzleContentPack(syntheticPuzzlePack()))).toBe(false)
  })
  it('keeps semantic replay hash/seed unchanged when pack names/art identities change', () => {
    const chapter = puzzleChapter('ura-finale'), pack = syntheticPuzzlePack(), changed = structuredClone(pack)
    changed.version = 'invented-v2'; changed.members.forEach(m => { m.name = 'Invented new name'; m.art.sourceHash = 'f'.repeat(64) })
    const entry = { chapter, checkpoint: createPuzzleCheckpoint(chapter, 'puzzle-party-1'), nodeId: chapter.nodes[0]!.id,
      entrants: syntheticPuzzleEntrants(1), leaderId: 'puzzle:combo-leader' as const, accountSeed: 'invented-account', ownerEpoch: 0, darkVariant: null }
    const a = freezePuzzleEncounter({ ...entry, cast: puzzleCastForContent(pack, 'puzzles-old') }),
      b = freezePuzzleEncounter({ ...entry, cast: puzzleCastForContent(changed, 'puzzles-new') })
    expect(a.seed).toBe(b.seed); expect(a.enemies).toEqual(b.enemies)
    expect(battleStateHash(createBattle(a))).toBe(battleStateHash(createBattle(b)))
  })
  it('normalizes order and verifies all chapter/element/recipe joins without source combat data', () => {
    const source = syntheticPuzzleSource(), reversed = structuredClone(source); reversed.members.reverse(); reversed.members.forEach(m => m.roles.reverse())
    expect(canonicalPuzzleJson(parsePuzzleCastSource(source))).toBe(canonicalPuzzleJson(parsePuzzleCastSource(reversed)))
    expect(puzzleContentCoverage(puzzleCastForContent(parsePuzzleContentPack(syntheticPuzzlePack()), 'invented'))).toMatchObject({ chapters: 14, encounters: 392, unresolvedReferences: 0 })
    expect(() => parsePuzzleCastSource({ ...source, stats: [] })).toThrow()
  })
  it.each(['duplicate', 'variant', 'colour', 'role', 'future', 'overflow', 'provenance'] as const)('rejects %s source', kind => {
    const s = syntheticPuzzleSource()
    if (kind === 'duplicate') s.members.push(s.members[0]!)
    if (kind === 'variant') { s.members[1]!.family = s.members[0]!.family; s.members[1]!.variant = s.members[0]!.variant }
    if (kind === 'colour') s.members = s.members.filter(m => !m.elements.includes('dark'))
    if (kind === 'role') s.members.forEach(m => { m.roles = m.roles.filter(r => r !== 'champion') })
    if (kind === 'provenance') s.members[0]!.source.verifiedAt = 'not-reviewed'
    expect(() => parsePuzzleCastSource(kind === 'future' ? { ...s, schemaVersion: 2 } : kind === 'overflow' ? { ...s, members: Array(PUZZLE_CONTENT_LIMITS.members + 1).fill(s.members[0]) } : s)).toThrow()
  })
  it('rejects unpermitted sources and credential/traversal variants', () => {
    for (const url of ['https://pad.fandom.com/art.png', 'https://sanbon.me/art.png', 'https://a.wikia.com/art.png', 'http://example.org/a',
      'https://user:pass@example.org/a', 'https://127.0.0.1/a', 'https://example.org/a?token=secret']) expect(() => puzzleSourceUrl(url)).toThrow()
    const s = syntheticPuzzleSource(); s.members[0]!.source.access = 'owner-export'; s.members[0]!.art.location = '../secret.png'
    expect(() => parsePuzzleCastSource(s)).toThrow()
  })
  it('rejects future capabilities, unknown art and invalid/gutter-overlapping rectangles', () => {
    const p = syntheticPuzzlePack(), a = syntheticPuzzleAtlas()
    expect(() => parsePuzzleContentPack({ ...p, capability: { engineVersion: 2, recipeVersion: 1 } })).toThrow()
    p.members[0]!.art.frameId = 'missing'
    expect(() => assertPuzzleArtJoin(p, a)).toThrow()
    for (const change of [{ x: 0 }, { x: 3 }, { page: 1 }, { width: 255 }]) expect(() => parsePuzzleAtlas({ ...a, frames: [{ ...a.frames[0], ...change }] })).toThrow()
    expect(() => parsePuzzleAtlas({ ...a, frames: [a.frames[0], { ...a.frames[0], id: 'another' }] })).toThrow()
    expect(parsePuzzleAtlas(a)).toEqual(a)
  })
  it('retains exact catalog identities and rejects ambiguity/missing files/hash prefixes', () => {
    const hash = 'a'.repeat(64), file = { path: `data/puzzles-cast.${hash.slice(0, 8)}.json`, sha256: hash, bytes: 100 }, ref = { ...file, version: 'invented-v1' }
    const c = { schemaVersion: 1, activeHash: hash, packs: [ref] }
    expect(parsePuzzleContentCatalog(c, [file]).packs).toEqual([ref])
    expect(() => parsePuzzleContentCatalog(c, [])).toThrow()
    expect(() => parsePuzzleContentCatalog({ ...c, packs: [ref, ref] }, [file])).toThrow()
    expect(() => parsePuzzleContentCatalog({ ...c, activeHash: 'b'.repeat(64) }, [file])).toThrow()
  })
})
