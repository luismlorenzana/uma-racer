// Entirely invented shared storage fixtures. Imported only by tests, never the runtime/adapter generator.
import fixture from './protocol.synthetic.json'
import { parsePuzzleSource, enrollPuzzleOutfit } from './identity'
import { defaultPuzzleKit } from './catalogue'
import { puzzleStats } from './progression'
import { puzzleChapter } from './campaign/chapters'
import { createPuzzleCheckpoint } from './campaign/progress'
import { freezePuzzleEncounter } from './campaign/encounters'
import { PUZZLE_ELEMENTS } from './types'
import { PUZZLE_FOE_ROLES } from './campaign/rules'
import { createBattle, applyBattleAction } from './battle'
import { puzzleBotAction } from './bots'
import { puzzleBattleResult } from './replay'
import { createPuzzleOperation, puzzleOperationReferences, puzzleOutfitCheckpointReferences, resolvePuzzleOperations, type PuzzlePayload } from './operations'
import { puzzleData, puzzlePayloadHash, parsePuzzleOutfitSave, parsePuzzleCheckpointSave, parsePuzzlePresetSave, type PuzzleStoredEntity, type PuzzleStoredLog, type PuzzleOutfitSaveV1, type PuzzlePresetSaveV1 } from './records'
import { SCENARIOS } from '../../scenarios'
import { PUZZLE_PARTY_IDS } from './records'
import { puzzleChapterStatus } from './campaign/progress'

export function puzzleProtocolFixture(stock = 2, debt = 0) {
  const entities = new Map<string, PuzzleStoredEntity>(), logs = new Map<string, PuzzleStoredLog>()
  const put = (kind: string, id: string, data: object, version = 1) => entities.set(`${kind}/${id}`, { kind, id, data: puzzleData(data), version, deleted: false, updatedAt: 1 })
  const sources = Array.from({ length: 5 }, (_, i) => parsePuzzleSource({ ...fixture.source, templateId: `invented-${i}` })!)
  for (const source of sources) {
    put('umas', source.templateId, { ...structuredClone(fixture.uma), templateId: source.templateId })
    const outfit: PuzzleOutfitSaveV1 = { schemaVersion: 1, outfitId: source.templateId, enrollment: enrollPuzzleOutfit(source, 'fire'), kit: defaultPuzzleKit(source)!, revision: 1 }
    put('puzzleOutfits', source.templateId, outfit)
  }
  put('constellationBank', 'main', { schemaVersion: 1, cutoverVersion: 1, cutoverId: 'invented-cutover', phase: 'active',
    cohortCount: debt ? 1 : 0, completedCount: debt ? 1 : 0, debitLimits: debt ? { 'constellation:ura-finale:front': debt } : {},
    balances: debt ? { 'constellation:ura-finale:front': -debt } : {}, openingClears: [], revision: 1 })
  put('items', 'constellation:ura-finale:front', { itemId: 'constellation:ura-finale:front', quantity: stock, updatedAt: 1 })
  const party: PuzzlePresetSaveV1 = { schemaVersion: 1, partyId: 'puzzle-party-1', name: 'Invented party', slots: sources.map(s => ({ outfitId: s.templateId, kit: defaultPuzzleKit(s)! })),
    leaderId: 'puzzle:combo-leader', foregroundChapter: null, revision: 1 }
  put('puzzlePresets', party.partyId, party)
  const chapter = puzzleChapter('ura-finale')
  const operation = (payload: PuzzlePayload, id = 'invented-operation', dependencies: string[] = []) => {
    const provisional = createPuzzleOperation({ schemaVersion: 1, operationId: id, dependencies, expected: [], payload })
    const refs = puzzleOperationReferences(provisional).entities
    refs.push(...puzzleOutfitCheckpointReferences(payload, [...entities.values()].flatMap(row => {
      const party = row.kind === 'puzzlePresets' && !row.deleted ? parsePuzzlePresetSave(row.data) : null
      return party ? [party] : []
    })))
    if (payload.kind === 'settle') for (const s of sources) refs.push(`puzzleOutfits/${s.templateId}`, `umas/${s.templateId}`)
    return createPuzzleOperation({ schemaVersion: 1, operationId: id, dependencies,
      expected: [...new Set(refs)].map(k => { const [kind, rowId] = k.split('/'); return { kind: kind!, id: rowId!, version: entities.get(k)?.version ?? 0 } }), payload })
  }
  const reserve = (id = 'invented-reserve') => {
    const currentParty = parsePuzzlePresetSave(entities.get(`puzzlePresets/${party.partyId}`)!.data)!
    const checkpoint = parsePuzzleCheckpointSave(entities.get(`puzzleCheckpoints/pzp:${party.partyId}:${chapter.scenarioId}`)?.data)?.progress ?? createPuzzleCheckpoint(chapter, party.partyId)
    const input = freezePuzzleEncounter({ chapter, checkpoint, nodeId: chapter.nodes[0]!.id,
      entrants: currentParty.slots.map(slot => { const s = parsePuzzleOutfitSave(entities.get(`puzzleOutfits/${slot!.outfitId}`)!.data)!.enrollment;
        return { outfitId: s.source.templateId, source: s.source, level: s.level, element: s.element, stats: puzzleStats(s.source, s.level), kit: slot!.kit } }),
      leaderId: currentParty.leaderId, cast: { schemaVersion: 1, manifestVersion: `puzzles-${'a'.repeat(64)}`, members: [{ id: 'invented-foe', elements: [...PUZZLE_ELEMENTS], roles: [...PUZZLE_FOE_ROLES] }] },
      accountSeed: 'invented-cutover', ownerEpoch: 0, darkVariant: null })
    return operation({ kind: 'reserve', encounter: { schemaVersion: 1, deviceId: 'invented-device', ownerEpoch: 0, input,
      inputHash: puzzlePayloadHash(input), content: { version: 'invented-pack-v1', contentHash: 'a'.repeat(64) } } }, id)
  }
  const apply = (op: ReturnType<typeof operation>, now = 10) => {
    const r = resolvePuzzleOperations({ accountSeed: 'invented-cutover', enabled: true, now, entities, logs }, [op])
    r.writes.forEach(w => entities.set(`${w.kind}/${w.id}`, w)); r.appends.forEach(l => logs.set(`${l.kind}/${l.id}`, l)); return r
  }
  const win = (op: ReturnType<typeof operation>): PuzzlePayload => {
    if (op.payload.kind !== 'reserve') throw new Error('Fixture needs reservation')
    let state = createBattle(op.payload.encounter.input)
    for (let i = 0; i < 181 && state.outcome === 'active'; i++) state = applyBattleAction(state, puzzleBotAction(state, 'competent')).state
    if (state.outcome !== 'win') throw new Error('Invented fixture bot did not win')
    return { kind: 'settle', checkpointId: state.input.checkpointId, inputHash: op.payload.encounter.inputHash, result: puzzleBattleResult(state) }
  }
  return { entities, logs, sources, party, chapter, operation, reserve, apply, put, win }
}

/** Worst-case setup test only: ten full parties and every chapter checkpoint, all invented. */
export function puzzleTenPartyFixture() {
  const f = puzzleProtocolFixture()
  for (const [i, partyId] of PUZZLE_PARTY_IDS.entries()) {
    const slots = f.sources.map((base, slot) => {
      const outfitId = `invented-${i * 5 + slot}`, source = { ...base, templateId: outfitId }
      f.put('umas', outfitId, { ...structuredClone(fixture.uma), templateId: outfitId })
      const outfit: PuzzleOutfitSaveV1 = { schemaVersion: 1, outfitId, enrollment: enrollPuzzleOutfit(source, 'fire'), kit: defaultPuzzleKit(source)!, revision: 1 }
      f.put('puzzleOutfits', outfitId, outfit)
      return { outfitId, kit: outfit.kit }
    })
    f.put('puzzlePresets', partyId, { ...f.party, partyId, name: `Invented party ${i + 1}`, slots })
    for (const scenario of SCENARIOS) {
      const chapter = puzzleChapter(scenario.id), progress = createPuzzleCheckpoint(chapter, partyId)
      const checkpointId = `pzp:${partyId}:${scenario.id}`
      f.put('puzzleCheckpoints', checkpointId, { schemaVersion: 1, checkpointId, scenarioId: scenario.id, progress,
        reached: puzzleChapterStatus(chapter, progress).reached, open: null, revision: 1 })
    }
  }
  return f
}
