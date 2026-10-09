// Setup/transport coverage with fifty invented outfits; no original-game content.
import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../../scenarios'
import { puzzleProtocolFixture, puzzleTenPartyFixture } from './protocol-fixtures'
import { parsePuzzlePresetSave, parsePuzzleCheckpointSave, parsePuzzleOutfitSave } from './records'
import { parsePuzzleBattleInput } from './battle-parse'
import { createPuzzleCheckpoint, parsePuzzleCheckpoint } from './campaign/progress'
import { parsePuzzleCampaignId, puzzleCampaignId } from './campaign/identity'
import { createPuzzleOperation, parsePuzzleOperationBatch, puzzleOperationReferences, PUZZLE_SYNC_LIMITS } from './operations'
describe('ten-party setup contract', () => {
  it('accepts party 10 in presets, checkpoints, identities and battle inputs; rejects 0 and 11', () => {
    const f = puzzleProtocolFixture(), reserve = f.reserve()
    if (reserve.payload.kind !== 'reserve') throw new Error('Fixture')
    const original = reserve.payload.encounter.input
    for (const number of [5, 10, 0, 11]) {
      const partyId = `puzzle-party-${number}`, checkpointId = `pzp:${partyId}:ura-finale`, battleId = `pzb:${partyId}:ura-finale:o1a:0`
      const expected = number === 5 || number === 10
      expect(Boolean(parsePuzzlePresetSave({ ...f.party, partyId }))).toBe(expected)
      expect(Boolean(parsePuzzleCheckpoint({ schemaVersion: 1, chapterId: f.chapter.id, partyId, cleared: [], attempts: [] }, f.chapter))).toBe(expected)
      expect(Boolean(parsePuzzleCampaignId(checkpointId))).toBe(expected)
      expect(Boolean(parsePuzzleCampaignId(battleId))).toBe(expected)
      expect(Boolean(parsePuzzleBattleInput({ ...original, partyId, checkpointId, battleId }))).toBe(expected)
      if (expected) {
        const progress = createPuzzleCheckpoint(f.chapter, partyId)
        expect(parsePuzzleCheckpointSave({ schemaVersion: 1, checkpointId, scenarioId: 'ura-finale', progress, reached: f.chapter.nodes.slice(0, 2).map(n => n.id), open: null, revision: 1 })).not.toBeNull()
        expect(puzzleCampaignId({ kind: 'checkpoint', partyId, scenarioId: 'ura-finale' })).toBe(checkpointId)
      }
    }
  })
  for (const kind of ['correct', 'equip-outfit'] as const) it(`${kind} beside a full-party save stays bounded and applies`, () => {
    const f = puzzleTenPartyFixture(), outfit = parsePuzzleOutfitSave(f.entities.get('puzzleOutfits/invented-0')!.data)!
    const party = parsePuzzlePresetSave(f.entities.get('puzzlePresets/puzzle-party-10')!.data)!
    const edit = f.operation(kind === 'correct' ? { kind, outfitId: outfit.outfitId, element: 'water' } : { kind, outfitId: outfit.outfitId, kit: outfit.kit }, 'edit')
    const save = f.operation({ kind: 'save-party', party: { ...party, name: 'Invented renamed tenth' } }, 'save')
    const refs = new Set([edit, save].flatMap(o => { const r = puzzleOperationReferences(o); return [...r.entities, ...r.logs] }))
    expect(refs.size).toBe(53); expect(refs.size).toBeLessThanOrEqual(PUZZLE_SYNC_LIMITS.documents)
    expect(parsePuzzleOperationBatch([edit, save])).not.toBeNull()
    expect(f.apply(edit).responses[0]!.status).toBe('applied')
    expect(f.apply(save).responses[0]!.status).toBe('applied')
  })
  it('keeps the two-party transfer protocol bounded, even with ten full parties', () => {
    const f = puzzleTenPartyFixture(), op = f.operation({ kind: 'transfer', outfitId: 'invented-0', fromPartyId: 'puzzle-party-1', toPartyId: 'puzzle-party-10', slot: 0 })
    const refs = puzzleOperationReferences(op)
    expect(refs.entities.length + refs.logs.length).toBe(42)
    expect(parsePuzzleOperationBatch([op])).not.toBeNull()
    // Transfer still requires an empty destination, it is not a swap primitive.
    expect(f.apply(op).responses[0]!.status).toBe('rejected')
    const party = parsePuzzlePresetSave(f.entities.get('puzzlePresets/puzzle-party-10')!.data)!
    f.put('puzzlePresets', party.partyId, { ...party, slots: [null, ...party.slots.slice(1)] })
    expect(f.apply(op).responses[0]!.status).toBe('applied')
  })
  it('rejects omitted holder locks and membership moved after an edit was authored', () => {
    const f = puzzleTenPartyFixture(), op = f.operation({ kind: 'correct', outfitId: 'invented-0', element: 'water' })
    const omitted = createPuzzleOperation({ ...op, expected: op.expected.filter(e => e.kind !== 'puzzleCheckpoints') })
    expect(f.apply(omitted).responses[0]).toMatchObject({ status: 'rejected', reason: expect.stringMatching(/membership changed/) })
    const from = parsePuzzlePresetSave(f.entities.get('puzzlePresets/puzzle-party-1')!.data)!
    const to = parsePuzzlePresetSave(f.entities.get('puzzlePresets/puzzle-party-10')!.data)!
    f.put('puzzlePresets', from.partyId, { ...from, slots: [null, ...from.slots.slice(1)] })
    f.put('puzzlePresets', to.partyId, { ...to, slots: [from.slots[0]!, ...to.slots.slice(1)] })
    expect(f.apply(op).responses[0]).toMatchObject({ status: 'rejected', reason: expect.stringMatching(/membership changed/) })
    expect(f.apply(f.operation(op.payload, 'refreshed')).responses[0]!.status).toBe('applied')
  })
  it('old five-party read sets and idempotent receipts still parse and replay unchanged', () => {
    const f = puzzleProtocolFixture(), op = f.operation({ kind: 'equip-outfit', outfitId: 'invented-0', kit: f.party.slots[0]!.kit })
    const expected = op.expected.filter(e => e.kind !== 'puzzlePresets' || Number(e.id.slice('puzzle-party-'.length)) <= 5)
    for (let i = 2; i <= 5; i++) for (const s of SCENARIOS) {
      const id = `pzp:puzzle-party-${i}:${s.id}`
      if (!expected.some(e => e.id === id)) expected.push({ kind: 'puzzleCheckpoints', id, version: 0 })
    }
    const old = createPuzzleOperation({ ...op, expected })
    expect(parsePuzzleOperationBatch([old])).not.toBeNull()
    expect(f.apply(old).responses[0]!.status).toBe('applied')
    expect(f.apply(old).responses[0]!.status).toBe('duplicate')
  })
})
