import { describe, expect, it } from 'vitest'
import { PUZZLE_LEADERS, SCENARIOS, createPuzzleBattle, puzzlePartyStats, resolvePuzzleEncounter } from '@racer/domain'
import { puzzleUiProofData, proofCast } from '../../screens/puzzles/ui-proof-data'
import { parsePuzzleCheckpointSave, parsePuzzleOutfitSave, parsePuzzlePresetSave, parseConstellationBankSave } from '@racer/domain'
import { createPuzzleNavigation } from './navigation'
import { openPuzzleNode, puzzleMapStatus, puzzleNodeName, puzzlePartyMembers, puzzlePartySummary, puzzlePartyCandidates, puzzleRewardEstimate,
  puzzleRoster, replacePuzzleSlot, suggestedPuzzleElement } from './presentation'
import type { PuzzleAccount } from './host'
function fixture() {
  const f = puzzleUiProofData()
  const account: PuzzleAccount = { readiness: 'active', bank: parseConstellationBankSave(f.rows.find(r => r.kind === 'constellationBank')!.data),
    parties: f.rows.filter(r => r.kind === 'puzzlePresets').map(r => parsePuzzlePresetSave(r.data)!), outfits: f.rows.filter(r => r.kind === 'puzzleOutfits').map(r => parsePuzzleOutfitSave(r.data)!),
    checkpoints: f.rows.filter(r => r.kind === 'puzzleCheckpoints').map(r => parsePuzzleCheckpointSave(r.data)!), stocks: {}, umas: [], materialOperations: [] }
  return { ...f, account }
}
describe('Puzzle account presentation', () => {
  it('uses only owned outfits, enrolled first, stable name/id order, and keeps no-A visible', () => {
    const f = fixture(), owned = f.sources.map(s => s.templateId)
    const roster = puzzleRoster(owned.slice(1), f.content.umas.byId, f.account, 'invented-v2')
    expect(roster).toHaveLength(11); expect(roster.some(r => r.id === owned[0])).toBe(false)
    expect(roster.slice(0, 9).every(r => r.outfit)).toBe(true); expect(roster[10]!.unavailable).toMatch(/No original A/)
    expect(roster[0]!.source!.contentVersion).toBe('invented-ui-source-v1')
    const unknown = puzzleRoster(['invented-unpublished'], f.content.umas.byId, f.account, 'v1')[0]!
    expect(unknown.unavailable).toMatch(/unavailable/)
    const held = f.account.outfits[0]!, unavailable = puzzleRoster([held.outfitId], new Map(), f.account, 'v2')[0]!
    expect(unavailable.outfit).toBe(held); expect(unavailable.source).toBe(held.enrollment.source)
    expect(unavailable.unavailable).toMatch(/Saved enrollment is unchanged/)
  })
  it('filters selected enrolled colour / original A style without borrowing S or improved racing preferences', () => {
    const f = fixture(), owned = f.sources.map(s => s.templateId)
    expect(puzzleRoster(owned, f.content.umas.byId, f.account, 'v1', 'light').every(r => r.outfit ? r.outfit.enrollment.element === 'light' : r.elements.includes('light'))).toBe(true)
    expect(puzzleRoster(owned, f.content.umas.byId, f.account, 'v1', 'all', 'end').every(r => r.source?.aptitudes.strategy.end === 'A')).toBe(true)
    expect(suggestedPuzzleElement(['fire', 'water', 'wood'], f.account)).toBe('fire')
  })
  it('shows partial parties, unlocked kit and slot 1 leader; projection matches real battle totals for every leader', () => {
    const f = fixture(), party = f.account.parties[0]!, frozen = f.account.checkpoints[1]!.open!.input
    for (const l of PUZZLE_LEADERS) {
      const current = { ...party, leaderId: l.id }
      expect(puzzlePartySummary(current, f.account).totals).toEqual(puzzlePartyStats({ ...frozen, entrants: puzzlePartyMembers(current, f.account), leaderId: l.id }))
    }
    expect(puzzlePartySummary(party, f.account).full).toBe(true)
    const partial = replacePuzzleSlot(party, 0, null)
    expect(puzzlePartySummary(partial, f.account)).toMatchObject({ full: false, leader: null })
    expect(() => replacePuzzleSlot(party, 1, f.account.outfits[0]!)).toThrow(/two slots/)
    const moved = { ...party, slots: [party.slots[1]!, party.slots[0]!, ...party.slots.slice(2)] }
    expect(puzzlePartySummary(moved, f.account).leader).toBe(party.slots[1]!.outfitId)
  })
  it('picker excludes every party, including its own slots and party 10, then sorts level/name/id', () => {
    const f = fixture(), name = (id: string) => f.content.umas.byId.get(id)?.name ?? id
    expect(puzzlePartyCandidates(f.account, name)).toEqual([])
    f.account.parties[0]!.slots[0] = null; f.account.parties[0]!.slots[1] = null
    f.account.parties[2]!.slots[0] = null
    expect(puzzlePartyCandidates(f.account, name).map(o => o.outfitId)).toEqual(['invented-ui-0', 'invented-ui-1', 'invented-ui-5'])
    f.account.parties[9]!.slots[0] = { outfitId: 'invented-ui-0', kit: f.account.outfits[0]!.kit }
    f.account.outfits[5]!.enrollment.level = 20
    expect(puzzlePartyCandidates(f.account, name).map(o => o.outfitId)).toEqual(['invented-ui-5', 'invented-ui-1'])
    expect(puzzlePartyCandidates(f.account, name, ['invented-ui-1']).map(o => o.outfitId)).toEqual(['invented-ui-1'])
    expect(puzzlePartyCandidates(f.account, () => 'Same name').map(o => o.outfitId)).toEqual(['invented-ui-5', 'invented-ui-1'])
    f.account.outfits[1]!.enrollment.level = 20
    expect(puzzlePartyCandidates(f.account, () => 'Same name').map(o => o.outfitId)).toEqual(['invented-ui-1', 'invented-ui-5'])
    const swapped = replacePuzzleSlot(f.account.parties[0]!, 0, f.account.outfits[5]!)
    expect(swapped.slots[0]).toEqual({ outfitId: 'invented-ui-5', kit: f.account.outfits[5]!.kit })
    expect(swapped.slots.slice(1)).toEqual(f.account.parties[0]!.slots.slice(1))
  })
  it('roster groups enrollment, sorts PL before name, uses stable name/id ties and puts unavailable last', () => {
    const f = fixture(), owned = f.sources.map(s => s.templateId)
    f.account.outfits[9]!.enrollment.level = 30
    const entries = puzzleRoster(owned, f.content.umas.byId, f.account, 'invented-v1')
    expect(entries[0]!.id).toBe('invented-ui-9')
    expect(entries.slice(1, 6).map(e => e.name)).toEqual(['Amber Ribbon', 'Blue Bell', 'Cedar Step', 'Dawn Runner', 'Evening Star'])
    expect(entries.slice(-2).map(e => e.id)).toEqual(['invented-ui-10', 'invented-ui-11'])
    const sameName = new Map(f.content.umas.byId)
    sameName.set('invented-ui-1', { ...sameName.get('invented-ui-1')!, name: 'Amber Ribbon' })
    expect(puzzleRoster(['invented-ui-1', 'invented-ui-0'], sameName, f.account, 'v1').map(e => e.id)).toEqual(['invented-ui-0', 'invented-ui-1'])
  })
  it('all 14 scenario bands are independent and all three guardians precede Finals', () => {
    const f = fixture()
    for (const s of SCENARIOS) {
      const status = puzzleMapStatus(f.account, 'puzzle-party-2', s.id)
      expect(status.chapter.levelStart).toBe((s.tier - 1) * 10 + 1); expect(status.chapter.levelEnd).toBe(s.tier * 10)
      expect(status.chapter.nodes).toHaveLength(26); expect(status.reached).toHaveLength(2); expect(status.complete).toBe(false)
      expect(status.chapter.nodes.filter(n => n.kind === 'champion').every(n => n.requires.length === 3)).toBe(true)
    }
    const visited = puzzleMapStatus(f.account, 'puzzle-party-1', 'ura-finale')
    expect(visited.reached.filter(id => id.includes(':c-'))).toHaveLength(5); expect(visited.full).toBe(false)
  })
  it('Dark variant explicitly determines fixed drops, while gross repayment/net stays separate', () => {
    const f = fixture(), status = puzzleMapStatus(f.account, 'puzzle-party-1', 'ura-finale'), dark = status.chapter.nodes.find(n => n.localId === 'c-dark')!
    expect(() => resolvePuzzleEncounter(status.chapter, dark.id, proofCast)).toThrow(/Dark/)
    expect(puzzleRewardEstimate(dark, 'ura-finale', f.account, 'pace')).toMatchObject([{ style: 'pace', gross: 12, repaid: 0, net: 12 }])
    expect(puzzleRewardEstimate(dark, 'ura-finale', f.account, 'late')).toMatchObject([{ style: 'late', gross: 12 }])
    const fire = status.chapter.nodes.find(n => n.localId === 'c-fire')!
    expect(puzzleRewardEstimate(fire, 'ura-finale', f.account, null)).toMatchObject([{ style: 'front', gross: 12, repaid: 7, net: 5 }])
    expect(puzzleNodeName(openPuzzleNode(f.account.checkpoints[1]!)!)).toBe('Debut · Stage 1')
    expect(createPuzzleBattle(f.account.checkpoints[1]!.open!.input).input.rewards).toEqual(f.account.checkpoints[1]!.open!.input.rewards)
  })
})
describe('device-only navigation memory', () => {
  it('keeps selected party/chapter and independent per-map position without release control', () => {
    let data = ''; const storage = { getItem: () => data, setItem: (_: string, value: string) => { data = value } }
    const memory = createPuzzleNavigation('invented-nav', storage), node = 'pzn:ura-finale:g1'
    memory.choose('puzzle-party-10', 'unity-cup'); memory.position('puzzle-party-1', 'ura-finale', node)
    const fresh = createPuzzleNavigation('invented-nav', storage).read()
    expect(fresh).toMatchObject({ partyId: 'puzzle-party-10', scenarioId: 'unity-cup', positions: { 'puzzle-party-1/ura-finale': node } })
    memory.choose('unknown', 'unknown'); memory.position('puzzle-party-1', 'ura-finale', 'bad'); expect(memory.read()).toEqual(fresh)
    expect(data).not.toMatch(/enabled|seed|reward/)
  })
  it('invalid or blocked storage is non-blocking, and untrusted map selections are dropped', () => {
    const memory = createPuzzleNavigation('bad', { getItem: () => '{', setItem: () => { throw new Error('blocked') } })
    memory.choose('puzzle-party-3', 'ura-finale'); expect(memory.read().partyId).toBe('puzzle-party-3')
    expect(createPuzzleNavigation('unknown', { getItem: () => '{"positions":{"puzzle-party-1/ura-finale":"forged"}}', setItem: () => {} }).read().positions).toEqual({})
  })
})
