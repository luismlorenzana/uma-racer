import { describe, expect, it } from 'vitest'
import { parseSaveSnapshotOrThrow, parseSyncRequest } from '../save'
import { enrollRpgOutfit } from './rules'
import { parseRpgCheckpointSave, parseRpgOutfitSave, parseRpgPresetSave, rpgEncounterSeed } from './save'

const baseStats = { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 }
const growthRates = { speed: 0.1, stamina: 0, power: 0, guts: 0, wit: 0 }
const aptitudes = { surface: { turf: 'A', dirt: 'B' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' } } as const
const profile = enrollRpgOutfit({ outfit: { id: 'synthetic-outfit', baseStats, growthRates, aptitudes },
  contentVersion: 'synthetic-v1', style: 'pace', weapon: 'spear', defaultSignature: 'fire' })
const outfit = { schemaVersion: 1, profile, projectionRevision: 0 }

describe('RPG save wire', () => {
  it('pins deterministic encounter identity and additive bounds (T090)', () => {
    expect(rpgEncounterSeed('account-1', 'party-1', 'chapter-1', 2, 'node-3')).toBe('190a9557')
    expect(parseRpgOutfitSave(outfit)).toEqual(outfit)
    expect(parseRpgOutfitSave({ ...outfit, schemaVersion: 2 })).toBeNull()
    expect(parseRpgOutfitSave({ ...outfit, profile: { ...profile, copied: true } })).toBeNull()
    expect(parseRpgOutfitSave({ ...outfit, profile: { ...profile, exp: Number.MAX_SAFE_INTEGER + 1 } })).toBeNull()
  })

  it('rejects duplicate preset slots, malformed frozen entries and future rows', () => {
    const slot = { outfitId: profile.outfitId, signature: 'fire', loadout: [] }
    const preset = { schemaVersion: 1, presetId: 'party-1', name: 'Synthetic party',
      slots: [slot, null, null, null, null], foregroundChapterId: null }
    expect(parseRpgPresetSave(preset)).toEqual(preset)
    expect(parseRpgPresetSave({ ...preset, slots: [slot, slot, null, null, null] })).toBeNull()
    const checkpoint = { schemaVersion: 1, presetId: 'party-1', chapterId: 'chapter-1',
      contentVersion: 'synthetic-v1', contentHash: 'a'.repeat(64), attemptIndex: 1,
      attemptId: 'rpg-attempt:party-1:chapter-1:1', lastClearedNodeId: null,
      selectedPath: [], status: 'at-checkpoint', revision: 0, frozenEntry: null }
    expect(parseRpgCheckpointSave(checkpoint)).toEqual(checkpoint)
    expect(parseRpgCheckpointSave({ ...checkpoint, selectedPath: Array(65).fill('n') })).toBeNull()
    expect(parseRpgCheckpointSave({ ...checkpoint, status: 'in-battle' })).toBeNull()
    expect(() => parseSaveSnapshotOrThrow({ entities: [{ kind: 'rpgOutfits', id: profile.outfitId,
      version: 1, data: { ...outfit, schemaVersion: 2 }, deleted: false, updatedAt: 1 }], logs: [], serverTime: 1 }))
      .toThrow(/App update required for RPG schema 2/)
  })

  it('loads synced RPG rows but refuses them through ordinary sync', () => {
    const record = { kind: 'rpgOutfits', id: profile.outfitId, version: 1, data: outfit,
      deleted: false, updatedAt: 1 }
    expect(parseSaveSnapshotOrThrow({ entities: [record], logs: [], serverTime: 1 }).entities).toHaveLength(1)
    expect(parseSyncRequest({ upserts: [{ kind: 'rpgOutfits', id: profile.outfitId,
      baseVersion: 0, data: outfit }] })).toMatch(/grouped command/)
  })
})
