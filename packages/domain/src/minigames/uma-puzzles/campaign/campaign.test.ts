import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../../../scenarios'
import { puzzleCampaign, puzzleChapter } from './chapters'
import { parsePuzzleCampaignId, puzzleCampaignId } from './identity'
import { applyPuzzleTerminal, createPuzzleCheckpoint, parsePuzzleChapter, parsePuzzleCheckpoint, parsePuzzleClearFact,
  puzzleChapterStatus, puzzleEntryEligibility, puzzleExchangeOpeningClears, upgradePuzzleCheckpoint } from './progress'
import { PUZZLE_SQUAD_MIXES } from './rules'
import { acceptedFact, reachedFinals } from './test-helpers'

describe('code-authored Puzzle campaign', () => {
  it.each(SCENARIOS.map(s => [s.id, s.tier] as const))('generates %s at tier%s as a reachable 26-node stage line (D301)', (id, tier) => {
    const chapter = puzzleChapter(id), ids = new Set(chapter.nodes.map(n => n.id))
    expect(chapter.levelStart).toBe(10 * (tier - 1) + 1); expect(chapter.levelEnd).toBe(10 * tier)
    expect(chapter.nodes).toHaveLength(26); expect(ids.size).toBe(26)
    expect(chapter.nodes.filter(n => n.kind === 'ordinary')).toHaveLength(18)
    expect(chapter.nodes.filter(n => n.kind === 'guardian')).toHaveLength(3)
    expect(chapter.nodes.filter(n => n.kind === 'champion')).toHaveLength(5)
    expect(new Set(chapter.nodes.filter(n => n.kind === 'ordinary').map(n => n.elements.join('/')))).toEqual(new Set(PUZZLE_SQUAD_MIXES.map(m => m.join('/'))))
    for (const n of chapter.nodes) for (const exit of n.exits) {
      const target = chapter.nodes.find(t => t.id === exit)!
      expect(ids.has(exit)).toBe(true); expect(target.row).toBeGreaterThan(n.row)
      expect(target.requires.some(group => group.includes(n.id))).toBe(true)
    }
    let progress = createPuzzleCheckpoint(chapter, 'puzzle-party-1')
    for (const n of chapter.nodes) {
      expect(puzzleChapterStatus(chapter, progress).reached).toContain(n.id)
      progress = applyPuzzleTerminal(chapter, progress, acceptedFact(chapter, progress, n.localId))
    }
    expect(puzzleChapterStatus(chapter, progress)).toMatchObject({ full: true, complete: true })
    expect(parsePuzzleCheckpoint(JSON.parse(JSON.stringify(progress)), chapter)).toEqual(progress)
  })
  it('runs six stages per section, two per level, each section closed by its Guardian', () => {
    const c = puzzleChapter(SCENARIOS[0]!.id), line = c.nodes.filter(n => n.kind !== 'champion')
    expect(line.map(n => `${n.sector}:${n.kind === 'guardian' ? 'G' : n.level}`)).toEqual(['0:1', '0:1', '0:2', '0:2', '0:3', '0:3', '0:G',
      '1:4', '1:4', '1:5', '1:5', '1:6', '1:6', '1:G', '2:7', '2:7', '2:8', '2:8', '2:9', '2:9', '2:G'])
    expect(c.nodes.filter(n => n.kind === 'guardian').map(n => n.level)).toEqual([3, 6, 9])
    for (const lane of ['a', 'b']) expect(new Set(c.nodes.filter(n => n.kind === 'ordinary' && n.localId.endsWith(lane)).map(n => n.elements.join('/'))).size).toBe(6)
    // Each stage needs the one before it; the Champions need every Guardian.
    line.slice(1).forEach((n, i) => expect(n.requires).toEqual([[line[i]!.id]]))
  })
  it('opens stages in order with no level/racing/composition lock; won stages stay replayable', () => {
    const c = puzzleChapter(SCENARIOS[0]!.id), start = createPuzzleCheckpoint(c, 'puzzle-party-1')
    expect(puzzleChapterStatus(c, start).reached).toEqual([c.nodes[0]!.id])
    const second = applyPuzzleTerminal(c, start, acceptedFact(c, start, 'o1a'))
    expect(puzzleChapterStatus(c, second).reached).toEqual(c.nodes.slice(0, 2).map(n => n.id))
    expect(puzzleEntryEligibility(c, second, c.nodes[1]!.id, [1, 1, 1, 1, 1]).warning).toBe(null)
    expect(puzzleEntryEligibility(c, second, c.nodes[0]!.id, [200, 200, 200, 200, 200]).warning).toBe(null)
    expect(() => puzzleEntryEligibility(c, second, c.nodes[1]!.id, [1, 1, 1, 1])).toThrow('Five')
    expect(() => puzzleEntryEligibility(c, second, 'invented-missing', [1, 1, 1, 1, 1])).toThrow('Unknown')
    expect(() => puzzleEntryEligibility(c, second, c.nodes[2]!.id, [200, 200, 200, 200, 200])).toThrow('not reached')
  })
  it('preserves clears, increments every terminal attempt and rejects duplicate/out-of-order terminals', () => {
    const c = puzzleChapter(SCENARIOS[0]!.id), start = createPuzzleCheckpoint(c, 'puzzle-party-1'), fact = acceptedFact(c, start, 'o1a')
    const one = applyPuzzleTerminal(c, start, fact)
    expect(() => applyPuzzleTerminal(c, one, fact)).toThrow('already accepted')
    let progress = one
    for (const outcome of ['loss', 'abandon', 'win'] as const) progress = applyPuzzleTerminal(c, progress, acceptedFact(c, progress, 'o1a', outcome))
    expect(progress.cleared).toEqual(one.cleared); expect(progress.attempts[0]!.next).toBe(4)
    expect(start.cleared).toEqual([]); expect(start.attempts).toEqual([])
    expect(() => applyPuzzleTerminal(c, one, { ...acceptedFact(c, one, 'o1a'), partyId: 'puzzle-party-2' })).toThrow()
  })
  it('requires all guardians, distinguishes primary/full completion and keeps Dark as one node', () => {
    const c = puzzleChapter(SCENARIOS[0]!.id), finals = reachedFinals(c)
    expect(finals.cleared).toHaveLength(21); expect(puzzleChapterStatus(c, finals).complete).toBe(false)
    expect(puzzleChapterStatus(c, finals).reached).toHaveLength(26)
    const won = applyPuzzleTerminal(c, finals, acceptedFact(c, finals, 'c-dark'))
    expect(won.cleared).toHaveLength(22); expect(puzzleChapterStatus(c, won)).toMatchObject({ complete: true, full: false })
  })
  it('supports the invented fifteenth registry entry and cosmetic chapter renaming without new IDs', () => {
    const registry = [...SCENARIOS, { id: 'invented-next', tier: 15, name: 'Invented Next' }]
    const map = puzzleCampaign(registry), c = map[14]!
    expect(map).toHaveLength(15); expect([c.levelStart, c.levelEnd]).toEqual([141, 150])
    expect(parsePuzzleChapter(c, registry)).toEqual(c)
    const renamed = puzzleChapter(c.scenarioId, registry.map(s => ({ ...s, name: 'Cosmetic heading' })))
    expect(renamed.nodes).toEqual(c.nodes); expect(renamed.id).toBe(c.id)
  })
  it('derives account edges only from accepted higher Opening wins, including a different party', () => {
    const first = puzzleChapter(SCENARIOS[0]!.id), higher = puzzleChapter(SCENARIOS[1]!.id)
    const p = createPuzzleCheckpoint(higher, 'puzzle-party-4'), lower = createPuzzleCheckpoint(first, 'puzzle-party-1')
    const facts = [acceptedFact(first, lower, 'g1'), acceptedFact(higher, p, 'g2'), acceptedFact(higher, p, 'g1', 'loss')]
    expect(puzzleExchangeOpeningClears(facts)).toEqual([])
    facts.push(acceptedFact(higher, p, 'g1'))
    expect(puzzleExchangeOpeningClears([...facts, ...facts])).toEqual([higher.scenarioId])
    expect(() => puzzleExchangeOpeningClears([{ ...facts[0]!, nodeId: 'claimed-ui-edge' }])).toThrow()
  })
  it("keeps D271's two-lane v1 map for fights frozen under it", () => {
    const v1 = puzzleChapter(SCENARIOS[0]!.id, SCENARIOS, 1)
    expect(v1.nodes).toHaveLength(28); expect(parsePuzzleChapter(v1)).toEqual(v1)
    expect(v1.nodes.filter(n => n.kind === 'ordinary' && n.column === 0).map(n => n.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 9])
    const start = createPuzzleCheckpoint(v1, 'puzzle-party-1'), second = applyPuzzleTerminal(v1, start, acceptedFact(v1, start, 'o1b'))
    expect(puzzleChapterStatus(v1, second).reached).toEqual(v1.nodes.slice(0, 4).map(n => n.id))
  })
  it('reads a v1 checkpoint on the v2 line: retired stages dropped, skipped lanes counted as won, nothing else changed', () => {
    const v1 = puzzleChapter(SCENARIOS[0]!.id, SCENARIOS, 1), v2 = puzzleChapter(SCENARIOS[0]!.id)
    const play = (ids: string[]) => ids.reduce((p, localId) => applyPuzzleTerminal(v1, p, acceptedFact(v1, p, localId)), createPuzzleCheckpoint(v1, 'puzzle-party-3'))
    const debutClassic = ['o1a', 'o1b', 'o2a', 'o2b', 'o3a', 'o3b', 'g1', 'o4a', 'o4b', 'o5a', 'o5b', 'o6a', 'o6b', 'g2']
    const id = (localId: string) => `pzn:${v2.scenarioId}:${localId}`
    // Halfway through Senior having skipped o7a: o7a now counts as won (no attempt yet), o8b is next.
    const midSenior = play([...debutClassic, 'o7b', 'o8a'])
    expect(parsePuzzleCheckpoint(midSenior, v2)).toBeNull()
    const up = upgradePuzzleCheckpoint(midSenior, v2, null)!
    expect(up.cleared).toEqual([...debutClassic, 'o7a', 'o7b', 'o8a'].map(id))
    expect(up.attempts.find(a => a.nodeId === id('o7a'))).toEqual({ nodeId: id('o7a'), next: 1 })
    expect(up.attempts.find(a => a.nodeId === id('o8a'))).toEqual({ nodeId: id('o8a'), next: 1 })
    expect(puzzleChapterStatus(v2, up).reached.at(-1)).toBe(id('o8b'))
    // A win on a retired tenth-pair stage is dropped; the Guardian it opened stays won.
    const done = play([...debutClassic, 'o7a', 'o8a', 'o9b', 'o10a', 'g3', 'c-fire'])
    const upDone = upgradePuzzleCheckpoint(done, v2, null)!
    expect(upDone.cleared).not.toContain(id('o10a')); expect(upDone.cleared).toContain(id('g3'))
    expect(upDone.cleared).toHaveLength(22); expect(puzzleChapterStatus(v2, upDone).complete).toBe(true)
    // A fight left open on o7b counts every stage before it as won, so it can still settle.
    const open = upgradePuzzleCheckpoint(play(debutClassic), v2, id('o7b'))!
    expect(open.cleared.at(-1)).toBe(id('o7a')); expect(puzzleChapterStatus(v2, open).reached).toContain(id('o7b'))
    expect(upgradePuzzleCheckpoint({ ...midSenior, cleared: [id('g3')] }, v2, null)).toBeNull()
  })
  it('rejects forged maps, future clears, sparse/prototype arrays, duplicate rows and extra fields', () => {
    expect(() => puzzleCampaign(new Array(1))).toThrow('registry')
    const c = puzzleChapter(SCENARIOS[0]!.id), p = createPuzzleCheckpoint(c, 'puzzle-party-1')
    expect(parsePuzzleChapter({ ...c, nodes: c.nodes.map((n, i) => i ? n : { ...n, level: 900 }) })).toBeNull()
    expect(parsePuzzleChapter({ ...c, extra: 1 })).toBeNull()
    expect(parsePuzzleChapter({ ...c, nodes: new Array(28) })).toBeNull()
    const row = { nodeId: c.nodes[0]!.id, next: 1 }
    for (const v of [{ ...p, extra: true }, { ...p, attempts: [row, row] }, { ...p, cleared: [row.nodeId] },
      { ...p, cleared: [c.nodes.at(-1)!.id], attempts: [{ nodeId: c.nodes.at(-1)!.id, next: 1 }] },
      { ...p, attempts: [{ ...row, next: 0 }] }, { ...p, attempts: new Array(1) },
      { ...p, attempts: [{ ...row, surprise: true }] }, { ...p, cleared: [row.nodeId, row.nodeId], attempts: [row] }])
      expect(parsePuzzleCheckpoint(v, c)).toBeNull()
    const fact = acceptedFact(c, p, 'o1a')
    for (const v of [{ ...fact, attempt: 1 }, { ...fact, outcome: 'active' }, { ...fact, extra: true }, { ...fact, scenarioId: SCENARIOS[1]!.id }])
      expect(parsePuzzleClearFact(v)).toBeNull()
  })
  it('has canonical, delimiter-safe chapter/node/checkpoint/attempt identities', () => {
    const scenarioId = SCENARIOS[0]!.id
    for (const identity of [{ kind: 'chapter', scenarioId }, { kind: 'node', scenarioId, localId: 'o10b' },
      { kind: 'checkpoint', scenarioId, partyId: 'puzzle-party-5' },
      { kind: 'battle', scenarioId, partyId: 'puzzle-party-5', localId: 'c-dark', attempt: Number.MAX_SAFE_INTEGER }] as const)
      expect(parsePuzzleCampaignId(puzzleCampaignId(identity))).toEqual(identity)
    for (const id of ['pzb:puzzle-party-1:ura-finale:o1a:01', 'pzb:puzzle-party-1:ura-finale:o1a:-1', 'pzn:ura-finale:c-sixth',
      'pzp:puzzle-party-11:ura-finale', 'pzc:missing', 'pzc:ura-finale:extra']) expect(parsePuzzleCampaignId(id)).toBeNull()
  })
})
