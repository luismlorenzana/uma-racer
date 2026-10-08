import { describe, expect, it } from 'vitest'
import { parseSaveSnapshotOrThrow, parseSyncRequest } from '../save'
import { enrollRpgOutfit, learnRpgNode } from './rules'
import { migrateRpgOutfitSave, migrateRpgPresetSave, parseRpgCheckpointSave, parseRpgOutfitSave, parseRpgPresetSave, rpgEncounterSeed } from './save'

const baseStats = { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 }
const growthRates = { speed: 0.1, stamina: 0, power: 0, guts: 0, wit: 0 }
const aptitudes = { surface: { turf: 'A', dirt: 'B' },
  distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'D', pace: 'A', late: 'B', end: 'C' } } as const
const profile = enrollRpgOutfit({ outfit: { id: 'synthetic-outfit', baseStats, growthRates, aptitudes },
  contentVersion: 'synthetic-v1', classId: 'mage', weapons: ['mage-staff', 'short-sword'] })
const outfit = { schemaVersion: 3, profile, projectionRevision: 0 }
/** A campaign-era (schema 2) row as production holds it before D282. */
const legacyOutfit = { schemaVersion: 2, projectionRevision: 4, profile: { outfitId: 'synthetic-outfit', sourceContentVersion: 'synthetic-v1',
  baseStats, growthRates, sourceAptitudes: aptitudes, affinities: { ice: 'A', light: 'A', fire: 'A', dark: 'A' }, style: 'pace',
  weapon: 'spear', defaultSignature: 'fire', tier: 1, level: 14, exp: 37,
  tree: [{ tier: 1, weapon: 'spear', element: 'fire', depth: 1, branch: 'foundation', level: 3 }], legacy: [] } }

describe('RPG save wire', () => {
  it('pins deterministic encounter identity and additive bounds (T090)', () => {
    expect(rpgEncounterSeed('account-1', 'party-1', 'chapter-1', 2, 'node-3')).toBe('190a9557')
    expect(parseRpgOutfitSave(outfit)).toEqual(outfit)
    expect(parseRpgOutfitSave({ ...outfit, schemaVersion: 2 })).toBeNull()
    expect(parseRpgOutfitSave({ ...outfit, profile: { ...profile, copied: true } })).toBeNull()
    expect(parseRpgOutfitSave({ ...outfit, profile: { ...profile, exp: Number.MAX_SAFE_INTEGER + 1 } })).toBeNull()
    expect(parseRpgOutfitSave({ ...outfit, profile: { ...profile, classId: 'brawler' } })).toBeNull()
    expect(parseRpgOutfitSave({ ...outfit, profile: { ...profile, tree: [{ tier: 1, id: 'greatsword.fire.1' }] } })).toBeNull()
    const learned = learnRpgNode(profile, 'short-sword.duel.1')
    expect(parseRpgOutfitSave({ ...outfit, profile: learned })?.profile.tree).toEqual([{ tier: 1, id: 'short-sword.duel.1' }])
  })

  it('migrates a schema-2 outfit once: class from running styles, levels kept, trees cleared (D282)', () => {
    const migrated = migrateRpgOutfitSave(legacyOutfit)!
    expect(migrated).toMatchObject({ schemaVersion: 3, projectionRevision: 5,
      profile: { classId: 'mage', weapons: ['mage-staff', 'arcane-staff'], tier: 1, level: 14, exp: 37, tree: [], legacy: [] } })
    expect(migrateRpgOutfitSave(migrated)).toEqual(migrated)
    expect(migrateRpgOutfitSave({ ...legacyOutfit, schemaVersion: 1 })?.profile).toMatchObject({ level: 1, exp: 0 })
  })

  it('migrates parties keeping members and chapter, clearing loadouts', () => {
    const preset = { schemaVersion: 2, presetId: 'party-1', name: 'Synthetic party', foregroundChapterId: 'ura-finale',
      slots: [{ outfitId: profile.outfitId, signature: 'fire', loadout: [{ tier: 1, weapon: 'spear', element: 'fire', depth: 1, branch: 'foundation' }] }, null, null, null, null] }
    const migrated = migrateRpgPresetSave(preset)!
    expect(migrated).toEqual({ schemaVersion: 3, presetId: 'party-1', name: 'Synthetic party', foregroundChapterId: 'ura-finale',
      slots: [{ outfitId: profile.outfitId, loadout: [], familiar: 'greatsword' }, null, null, null, null] })
    expect(parseRpgPresetSave(migrated)).toEqual(migrated)
  })

  it('rejects duplicate preset slots, malformed frozen entries and future rows', () => {
    const slot = { outfitId: profile.outfitId, loadout: [], familiar: 'axe' }
    const preset = { schemaVersion: 3, presetId: 'party-1', name: 'Synthetic party',
      slots: [slot, null, null, null, null], foregroundChapterId: null }
    expect(parseRpgPresetSave(preset)).toEqual(preset)
    expect(parseRpgPresetSave({ ...preset, slots: [slot, slot, null, null, null] })).toBeNull()
    expect(parseRpgPresetSave({ ...preset, slots: [{ ...slot, familiar: 'tome' }, null, null, null, null] })).toBeNull()
    expect(parseRpgPresetSave({ ...preset, slots: [{ ...slot, loadout: [{ tier: 1, id: 'short-sword.duel.1' }] }, null, null, null, null] })).toBeNull()
    const checkpoint = { schemaVersion: 1, presetId: 'party-1', chapterId: 'chapter-1',
      contentVersion: 'synthetic-v1', contentHash: 'a'.repeat(64), attemptIndex: 1,
      attemptId: 'rpg-attempt:party-1:chapter-1:1', lastClearedNodeId: null,
      selectedPath: [], status: 'at-checkpoint', revision: 0, frozenEntry: null }
    expect(parseRpgCheckpointSave(checkpoint)).toEqual(checkpoint)
    expect(parseRpgCheckpointSave({ ...checkpoint, selectedPath: Array(65).fill('n') })).toBeNull()
    expect(parseRpgCheckpointSave({ ...checkpoint, status: 'in-battle' })).toBeNull()
    expect(() => parseSaveSnapshotOrThrow({ entities: [{ kind: 'rpgOutfits', id: profile.outfitId,
      version: 1, data: { ...outfit, schemaVersion: 4 }, deleted: false, updatedAt: 1 }], logs: [], serverTime: 1 }))
      .toThrow(/App update required for RPG schema 4/)
  })

  it('loads synced RPG rows, migrating older ones, but refuses them through the domain sync parser', () => {
    const record = { kind: 'rpgOutfits', id: profile.outfitId, version: 1, data: legacyOutfit, deleted: false, updatedAt: 1 }
    const loaded = parseSaveSnapshotOrThrow({ entities: [record], logs: [], serverTime: 1 }).entities
    expect(loaded).toHaveLength(1)
    expect(loaded[0]!.data).toMatchObject({ schemaVersion: 3, profile: { classId: 'mage' } })
    expect(parseSyncRequest({ upserts: [{ kind: 'rpgOutfits', id: profile.outfitId,
      baseVersion: 0, data: outfit }] })).toMatch(/grouped command/)
  })
})
