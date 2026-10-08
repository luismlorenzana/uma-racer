// Invented account for tests/rehearsal only; never loaded by the account runtime.
import { createPlayerProfile } from '../../save'
import { puzzleProtocolFixture } from './protocol-fixtures'
import { resolvePuzzlePreservation, type PuzzlePreservationRequest } from './preservation'
import { parseConstellationBankSave, type PuzzleStoredEntity } from './records'
import { syntheticSparkEncounter } from '../spark-rival/fixtures'
import { replaySparkRival } from '../spark-rival/engine'
import { legacySparkSeed, type LegacySparkProof } from './legacy-spark'
export function preservationSparkProof(terminal = false): LegacySparkProof {
  const encounter = syntheticSparkEncounter(); encounter.trainee.templateId = 'invented-0'
  const proof: LegacySparkProof = { id: 'spark-match:invented-0:1:0', outfitId: 'invented-0', tier: 1, attemptIndex: 0, seed: '',
    snapshot: { version: 1, contentVersion: 'invented-v1', source: 'fallback', encounter }, journal: { format: 1, engine: 'spark-rival-v1', actions: [] } }
  proof.seed = legacySparkSeed(1, proof)
  if (terminal) for (let i = 0; i < 180 && !replaySparkRival(encounter, proof.seed, proof.journal.actions).outcome; i++)
    proof.journal.actions.push({ type: 'drag', path: [{ row: 0, column: 0 }, { row: 0, column: 1 }], movementMs: 500 })
  return proof
}
export function preservationFixture(count = 5) {
  const f = puzzleProtocolFixture(), entities = new Map<string, PuzzleStoredEntity>()
  for (let i = 0; i < count; i++) {
    const original = f.entities.get('umas/invented-0')!, templateId = `invented-${i}`
    entities.set(`umas/${templateId}`, { ...structuredClone(original), id: templateId, data: { ...structuredClone(original.data), templateId } })
  }
  entities.set('profile/main', { kind: 'profile', id: 'main', version: 1, deleted: false, updatedAt: 1,
    data: { ...createPlayerProfile('invented-catalogue', 1), trainingExpBank: 251 } })
  entities.set('items/training:level-up-ticket', { kind: 'items', id: 'training:level-up-ticket', version: 1, deleted: false, updatedAt: 1,
    data: { itemId: 'training:level-up-ticket', quantity: 3, updatedAt: 1 } })
  const logs = new Map(f.logs), content = { catalogueVersion: f.sources[0]!.contentVersion, contentHash: 'a'.repeat(64),
    sources: new Map(Array.from({ length: count }, (_, i) => [`invented-${i}`, { ...structuredClone(f.sources[0]!), templateId: `invented-${i}` }])) }
  const request = (action: PuzzlePreservationRequest['action'] = 'advance'): PuzzlePreservationRequest => ({ schemaVersion: 2, cutoverId: 'invented-cutover',
    action, expectedBankRevision: parseConstellationBankSave(entities.get('constellationBank/main')?.data)?.revision ?? 0 })
  const apply = (req = request()) => {
    const result = resolvePuzzlePreservation({ enabled: true, now: 5, entities, logs, content }, req)
    result.writes.forEach(r => entities.set(`${r.kind}/${r.id}`, r)); result.appends.forEach(r => logs.set(`${r.kind}/${r.id}`, r))
    return result
  }
  return { entities, logs, content, request, apply }
}
