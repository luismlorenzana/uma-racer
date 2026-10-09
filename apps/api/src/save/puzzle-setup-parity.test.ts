// Same synthetic setup boundaries through the standalone API mirror, never cloud/private data.
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSyncRequest } from './save.types'
import { parsePuzzlePresetSave, parsePuzzleCheckpointSave, parsePuzzleOutfitSave, puzzleOperationReferences, resolvePuzzleOperations,
  createPuzzleOperation, parsePuzzleOperationBatch, type PuzzlePayload, type PuzzleOperationV1, type PuzzleStoredEntity, type PuzzleStoredLog } from './puzzles'
import { parsePuzzleBattleInput } from './puzzle-domain/minigames/uma-puzzles/battle-parse'
import { createPuzzleCheckpoint, parsePuzzleCheckpoint, puzzleChapterStatus } from './puzzle-domain/minigames/uma-puzzles/campaign/progress'
import { parsePuzzleCampaignId } from './puzzle-domain/minigames/uma-puzzles/campaign/identity'
import { puzzleChapter } from './puzzle-domain/minigames/uma-puzzles/campaign/chapters'
interface Fixture {
  entities: Map<string, PuzzleStoredEntity>; logs: Map<string, PuzzleStoredLog>
  operation(payload: PuzzlePayload, id?: string): PuzzleOperationV1
  reserve(): PuzzleOperationV1
}
async function fixture(ten = false): Promise<Fixture> {
  const path = resolve(process.cwd(), '../../packages/domain/src/minigames/uma-puzzles/protocol-fixtures.ts')
  const module: { puzzleProtocolFixture(): Fixture; puzzleTenPartyFixture(): Fixture } = await import(path)
  return ten ? module.puzzleTenPartyFixture() : module.puzzleProtocolFixture()
}
const request = (ops: PuzzleOperationV1[]) => ({ upserts: [], appends: [], puzzleProtocolVersion: 1, puzzleOperations: ops })
describe('API ten-party setup boundaries', () => {
  it('accepts 10 and rejects 0/11 in every party parser without changing the schema', async () => {
    const f = await fixture(), p = parsePuzzlePresetSave(f.entities.get('puzzlePresets/puzzle-party-1')!.data)!
    const reserve = f.reserve(); if (reserve.payload.kind !== 'reserve') throw new Error('Fixture')
    const input = reserve.payload.encounter.input, chapter = puzzleChapter('ura-finale')
    for (const n of [5, 10, 0, 11]) {
      const partyId = `puzzle-party-${n}`, checkpointId = `pzp:${partyId}:ura-finale`, battleId = `pzb:${partyId}:ura-finale:o1a:0`, ok = n === 5 || n === 10
      expect(Boolean(parsePuzzlePresetSave({ ...p, partyId }))).toBe(ok)
      const progress = { schemaVersion: 1, chapterId: chapter.id, partyId, cleared: [], attempts: [] }
      expect(Boolean(parsePuzzleCheckpoint(progress, chapter))).toBe(ok)
      expect(Boolean(parsePuzzleCampaignId(checkpointId))).toBe(ok)
      expect(Boolean(parsePuzzleCampaignId(battleId))).toBe(ok)
      expect(Boolean(parsePuzzleBattleInput({ ...input, partyId, checkpointId, battleId }))).toBe(ok)
      if (ok) expect(parsePuzzleCheckpointSave({ schemaVersion: 1, checkpointId, scenarioId: 'ura-finale', progress: createPuzzleCheckpoint(chapter, partyId),
        reached: puzzleChapterStatus(chapter, createPuzzleCheckpoint(chapter, partyId)).reached, open: null, revision: 1 })).not.toBeNull()
    }
  })
  for (const kind of ['correct', 'equip-outfit'] as const) it(`${kind} + save-party reads 53 documents with fifty enrolled members`, async () => {
    const f = await fixture(true), o = parsePuzzleOutfitSave(f.entities.get('puzzleOutfits/invented-0')!.data)!
    const p = parsePuzzlePresetSave(f.entities.get('puzzlePresets/puzzle-party-10')!.data)!
    const ops = [f.operation(kind === 'correct' ? { kind, outfitId: o.outfitId, element: 'water' } : { kind, outfitId: o.outfitId, kit: o.kit }, 'edit'),
      f.operation({ kind: 'save-party', party: { ...p, name: 'Invented tenth' } }, 'save')]
    expect(new Set(ops.flatMap(op => { const refs = puzzleOperationReferences(op); return [...refs.entities, ...refs.logs] })).size).toBe(53)
    expect(parsePuzzleOperationBatch(ops)).not.toBeNull(); expect(parseSyncRequest(request(ops))).not.toBeNull()
    const result = resolvePuzzleOperations({ enabled: true, accountSeed: 'invented-cutover', now: 20, entities: f.entities, logs: f.logs }, ops)
    expect(result.responses.map(r => r.status)).toEqual(['applied', 'applied'])
    const omitted = createPuzzleOperation({ ...ops[0]!, operationId: 'missing-locks', expected: ops[0]!.expected.filter(r => r.kind !== 'puzzleCheckpoints') })
    const rejection = resolvePuzzleOperations({ enabled: true, accountSeed: 'invented-cutover', now: 20, entities: f.entities, logs: f.logs }, [omitted])
    expect(rejection.responses[0]).toMatchObject({ status: 'rejected', reason: expect.stringMatching(/membership changed/) })
  })
  it('retains bounded transfer validation and its empty-destination guard', async () => {
    const f = await fixture(true), op = f.operation({ kind: 'transfer', outfitId: 'invented-0', fromPartyId: 'puzzle-party-1', toPartyId: 'puzzle-party-10', slot: 0 })
    const refs = puzzleOperationReferences(op)
    expect(refs.entities.length + refs.logs.length).toBe(42)
    expect(parseSyncRequest(request([op]))).not.toBeNull()
    expect(resolvePuzzleOperations({ enabled: true, accountSeed: 'invented-cutover', now: 20, entities: f.entities, logs: f.logs }, [op]).responses[0]!.status).toBe('rejected')
    const row = f.entities.get('puzzlePresets/puzzle-party-10')!, party = parsePuzzlePresetSave(row.data)!
    f.entities.set('puzzlePresets/puzzle-party-10', { ...row, data: { ...party, slots: [null, ...party.slots.slice(1)] } })
    expect(resolvePuzzleOperations({ enabled: true, accountSeed: 'invented-cutover', now: 20, entities: f.entities, logs: f.logs }, [op]).responses[0]!.status).toBe('applied')
  })
})
