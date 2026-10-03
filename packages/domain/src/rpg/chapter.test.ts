import { describe, expect, it } from 'vitest'
import { parseRpgChapterPack, rpgChapterFightCounts, rpgChapterChoices, assertRpgChapterCheckpoint, rpgAcceptSafeNode } from './chapter'
import { syntheticChapterJson, syntheticChapterPack, SYNTHETIC_CHAPTER_HASH } from './chapter.synthetic'
import type { RpgCheckpointSaveV1 } from './save'
const source = { version: 'invented-map-v1', contentHash: SYNTHETIC_CHAPTER_HASH, artKeys: ['test-scout', 'test-elite', 'test-captain', 'test-wall'] }
const cp: RpgCheckpointSaveV1 = { schemaVersion: 1, presetId: 'party-1', chapterId: 'test-chapter', contentVersion: source.version,
  contentHash: source.contentHash, attemptIndex: 1, attemptId: 'rpg-attempt:party-1:test-chapter:1', selectedPath: [], lastClearedNodeId: null,
  status: 'at-checkpoint', revision: 0, frozenEntry: null }
describe('immutable RPG chapter graphs', () => {
  it('accepts legacy unrewarded nodes and bounded explicit EXP, never rewards a safe node', () => {
    const raw = syntheticChapterJson(), node = raw.chapters[0]!.nodes[0]!
    expect(parseRpgChapterPack(raw, source).chapters[0]!.nodes[0]!.baseExp).toBe(1549)
    delete node.baseExp
    expect(parseRpgChapterPack(raw, source).chapters[0]!.nodes[0]!.baseExp).toBeUndefined()
    for (const invalid of [-1, 1.5, 1_000_001, NaN]) {
      node.baseExp = invalid
      expect(() => parseRpgChapterPack(raw, source)).toThrow(/reward/)
    }
    node.baseExp = 1_000_000
    expect(parseRpgChapterPack(raw, source).chapters[0]!.nodes[0]!.baseExp).toBe(1_000_000)
    raw.chapters[0]!.nodes.find((n) => n.kind === 'recovery')!.baseExp = 1
    expect(() => parseRpgChapterPack(raw, source)).toThrow(/reward/)
  })
  it('has two/three fights, a fork/rejoin and phase boss without choosing production length', () => {
    const chapter = syntheticChapterPack().chapters[0]!
    expect(rpgChapterFightCounts(chapter)).toEqual([2, 3])
    expect(rpgChapterChoices(chapter, cp).map((n) => n.id)).toEqual(['opening'])
    const afterOpening = { ...cp, selectedPath: ['opening'], lastClearedNodeId: 'opening' }
    const fork = rpgAcceptSafeNode(chapter, afterOpening, 'fork')
    expect(rpgChapterChoices(chapter, fork).map((n) => n.id)).toEqual(['rest', 'elite'])
    expect(() => rpgAcceptSafeNode(chapter, fork, 'boss')).toThrow()
    expect(() => assertRpgChapterCheckpoint(chapter, { ...fork, contentHash: 'b'.repeat(64) })).toThrow(/hash/)
  })
  it.each(['edge', 'cycle', 'unreachable', 'dead-end', 'duplicate', 'boss', 'actor', 'art', 'skill', 'scenario', 'version', 'hash', 'oversize'] as const)('rejects %s corruption', (kind) => {
    const raw = syntheticChapterJson()
    const c = raw.chapters[0]!, n = c.nodes[0]!
    let context = source
    if (kind === 'edge') n.exits = ['absent']
    if (kind === 'cycle') n.exits = ['opening']
    if (kind === 'unreachable') c.nodes.push({ ...n, id: 'orphan', exits: ['boss'] })
    if (kind === 'dead-end') n.exits = []
    if (kind === 'duplicate') c.nodes.push({ ...n })
    if (kind === 'boss') c.bossNodeId = 'absent'
    if (kind === 'actor') n.enemies = ['absent']
    if (kind === 'art') context = { ...source, artKeys: [] }
    if (kind === 'skill') raw.actors[0]!.combat.moves[0]!.kind = 'invalid' as 'damage'
    if (kind === 'scenario') c.scenarioId = 'absent'
    if (kind === 'version') c.contentVersion = 'other'
    if (kind === 'hash') context = { ...source, contentHash: 'bad' }
    if (kind === 'oversize') c.nodes = Array.from({ length: 65 }, () => n)
    expect(() => parseRpgChapterPack(raw, context)).toThrow(/Invalid RPG chapter/)
  })
  it('rejects a skipped saved edge and keeps pending results from revealing a path', () => {
    const chapter = syntheticChapterPack().chapters[0]!
    expect(() => assertRpgChapterCheckpoint(chapter, { ...cp, selectedPath: ['elite'], lastClearedNodeId: 'elite' })).toThrow()
    expect(rpgChapterChoices(chapter, { ...cp, status: 'pending-result' })).toEqual([])
  })
})
