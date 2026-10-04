// Invented, read-only hub projection. Imported only by component tests and the DEV proof.
import type { RpgCheckpointSaveV1, RpgPresetSaveV1 } from '@racer/domain'
import { syntheticChapterPack, syntheticChapterProfiles } from '../../../../../packages/domain/src/rpg/chapter.synthetic'
import type { RpgRelease } from '../../content/rpg-release'
import type { RpgHubView } from '../../game/rpg-hub'
export const releaseProofNames = { 'test-outfit-0': 'Ember', 'test-outfit-1': 'Rill', 'test-outfit-2': 'Beacon', 'test-outfit-3': 'Dawn', 'test-outfit-4': 'Volt' }
export function releaseProofFixture(status: RpgCheckpointSaveV1['status'] = 'at-checkpoint'): { view: RpgHubView; release: RpgRelease } {
  const profiles = syntheticChapterProfiles()
  const presets = Array.from({ length: 5 }, (_, i) => {
    const id = `party-${i + 1}`
    const data: RpgPresetSaveV1 = { schemaVersion: 1, presetId: id, name: i === 0 ? 'Crossroads party' : `Party ${i + 1}`,
      foregroundChapterId: i === 0 ? 'test-chapter' : null, slots: i === 0 ? profiles.map(p => ({ outfitId: p.outfitId,
        signature: p.defaultSignature, loadout: p.tree.map(({ level: _level, ...ref }) => ref) })) as RpgPresetSaveV1['slots'] : [null, null, null, null, null] }
    return { id, version: i === 0 ? 1 : 0, data }
  })
  const checkpoint: RpgCheckpointSaveV1 = { schemaVersion: 1, presetId: 'party-1', chapterId: 'test-chapter',
    contentVersion: 'invented-map-v1', contentHash: 'a'.repeat(64), attemptIndex: 1, attemptId: 'rpg-attempt:party-1:test-chapter:1',
    lastClearedNodeId: 'opening', selectedPath: ['opening', 'fork'], status, revision: 1, frozenEntry: null }
  return { view: { presets, pending: [], checkpoints: [{ id: 'party-1:test-chapter', version: 1, data: checkpoint }],
    outfits: new Map(profiles.map(profile => [profile.outfitId, { id: profile.outfitId, version: 1,
      data: { schemaVersion: 1, profile, projectionRevision: 0 } }])) },
    release: { status: 'ready', pack: syntheticChapterPack(), chapterId: 'test-chapter' } }
}
