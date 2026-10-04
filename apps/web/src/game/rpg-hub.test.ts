import 'fake-indexeddb/auto'
import { createUmaSave, enrollRpgOutfit, type RpgCommandRequest, type RpgPresetSaveV1, type UmaTemplate } from '@racer/domain'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseRpgCommandRequest, resolveRpgCommand } from '../../../api/src/save/rpg-command'
import { saveApi } from '../api/client'
import { db } from './db'
import { emptyRpgPreset, enrollOwnedRpgOutfit, readRpgHub, refreshRpgHubFromCloud,
  saveRpgPreset, validateRpgPresetSlots } from './rpg-hub'
import { flushOneRpgCommand } from './rpg-sync'

const aptitudes = { surface: { turf: 'A', dirt: 'B' }, distance: { sprint: 'B', mile: 'A', medium: 'A', long: 'C' },
  strategy: { front: 'A', pace: 'A', late: 'B', end: 'C' } } as const
function outfit(index: number, noA = false): UmaTemplate {
  return { id: `invented-${index}`, charaId: `invented-character-${index}`, name: `Invented ${index}`,
    outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: false,
    baseStats: { speed: 100, stamina: 90, power: 80, guts: 70, wit: 60 },
    growthRates: { speed: 0.2, stamina: 0.1, power: 0, guts: 0, wit: 0.3 },
    aptitudes: { ...aptitudes, strategy: noA ? { front: 'B', pace: 'B', late: 'C', end: 'C' } : aptitudes.strategy },
    uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: null, signatureRaceFamilyIds: [],
    imageSource: 'https://invalid.test/invented.png' }
}
type ServerEntity = Parameters<typeof resolveRpgCommand>[2] extends Map<string, infer T> ? T : never
type ServerLog = Parameters<typeof resolveRpgCommand>[3] extends Map<string, infer T> ? T : never
const serverEntities = new Map<string, ServerEntity>()
const serverLogs = new Map<string, ServerLog>()
let serverTime = 100

async function own(template: UmaTemplate) {
  const save = createUmaSave(template)
  await db.umas.put({ id: template.id, version: 1, data: save })
  serverEntities.set(`umas/${template.id}`, { kind: 'umas', id: template.id, version: 1,
    data: save as unknown as Record<string, unknown>, deleted: false, updatedAt: 1 })
}

async function enroll(template: UmaTemplate, style: 'front' | 'pace' = 'pace') {
  await enrollOwnedRpgOutfit({ template, contentVersion: 'invented-v1', style,
    weapon: style === 'front' ? 'greatsword' : 'spear', defaultSignature: 'fire', expectedUmaVersion: 1 })
}

describe('RPG hub enrollment and party commands', () => {
  beforeEach(async () => {
    db.close(); await db.delete(); await db.open()
    serverEntities.clear(); serverLogs.clear(); serverTime = 100
    vi.spyOn(saveApi, 'rpgCommand').mockImplementation(async (body: RpgCommandRequest) => {
      const parsed = parseRpgCommandRequest(body)
      if (typeof parsed === 'string') return { status: 'rejected', reason: parsed }
      const resolved = resolveRpgCommand('invented-account', parsed, serverEntities, serverLogs, ++serverTime)
      for (const row of resolved.writes) serverEntities.set(`${row.kind}/${row.id}`, row)
      for (const row of resolved.appends) serverLogs.set(`${row.kind}/${row.id}`, row)
      return resolved.response
    })
    vi.spyOn(saveApi, 'load').mockImplementation(async () => ({ entities: [...serverEntities.values()],
      logs: [...serverLogs.values()], serverTime }))
  })
  afterEach(() => { vi.restoreAllMocks(); db.close() })

  it('shows five empty named presets without inventing synchronized rows', async () => {
    const view = await readRpgHub()
    expect(view.presets.map((row) => [row.id, row.version, row.data.name]))
      .toEqual(Array.from({ length: 5 }, (_, i) => [`party-${i + 1}`, 0, `Party ${i + 1}`]))
    expect(await db.rpgPresets.count()).toBe(0)
  })

  it('freezes a dual-A outfit only after acknowledgement; reload preserves its locked choice', async () => {
    const template = outfit(1)
    await own(template)
    await enroll(template, 'front')
    expect((await readRpgHub()).outfits.size).toBe(0)
    await expect(enroll(template)).rejects.toThrow(/pending sync/)
    expect(await flushOneRpgCommand()).toBe(true)
    const profile = (await readRpgHub()).outfits.get(template.id)?.data.profile
    expect(profile).toMatchObject({ style: 'front', weapon: 'greatsword', defaultSignature: 'fire', tier: 1, level: 1 })
    template.baseStats.speed = 999
    expect(profile?.baseStats.speed).toBe(100)
    await expect(enroll(template)).rejects.toThrow(/already enrolled/)
    db.close(); await db.open()
    expect((await readRpgHub()).outfits.get(template.id)?.data.profile.style).toBe('front')
  })

  it('refuses missing ownership, no-A and style/weapon mismatches without queuing', async () => {
    const template = outfit(2)
    await expect(enroll(template)).rejects.toThrow(/Owned outfit changed/)
    await own(template)
    await expect(enrollOwnedRpgOutfit({ template, contentVersion: 'invented-v1', style: 'late',
      weapon: 'wizard-staff', defaultSignature: 'fire', expectedUmaVersion: 1 })).rejects.toThrow(/Style/)
    await expect(enrollOwnedRpgOutfit({ template, contentVersion: 'invented-v1', style: 'front',
      weapon: 'tome', defaultSignature: 'fire', expectedUmaVersion: 1 })).rejects.toThrow(/Weapon/)
    const barred = outfit(3, true)
    await own(barred)
    await expect(enroll(barred)).rejects.toThrow(/no A/)
    expect(await db.pendingRpgCommands.count()).toBe(0)
  })

  it('persists five ordered distinct slots and a changed active signature through cloud acknowledgement', async () => {
    const templates = Array.from({ length: 5 }, (_, index) => outfit(index))
    for (const template of templates) { await own(template); await enroll(template); expect(await flushOneRpgCommand()).toBe(true) }
    const preset: RpgPresetSaveV1 = { ...emptyRpgPreset(1), name: 'Invented team', slots: templates.map((template) => ({
      outfitId: template.id, signature: 'fire' as const, loadout: [],
    })) as unknown as RpgPresetSaveV1['slots'] }
    await saveRpgPreset({ preset, expectedVersion: 0 })
    expect((await readRpgHub()).presets[0]?.version).toBe(0)
    await expect(saveRpgPreset({ preset, expectedVersion: 0 })).rejects.toThrow(/pending sync/)
    expect(await flushOneRpgCommand()).toBe(true)
    expect((await readRpgHub()).presets[0]?.data.slots.map((slot) => slot?.outfitId))
      .toEqual(templates.map((template) => template.id))
    const changed = { ...preset, slots: [...preset.slots] as RpgPresetSaveV1['slots'] }
    changed.slots[2] = { outfitId: templates[2]!.id, signature: 'ice', loadout: [] }
    await saveRpgPreset({ preset: changed, expectedVersion: 1 })
    expect(await flushOneRpgCommand()).toBe(true)
    db.close(); await db.open()
    expect((await readRpgHub()).presets[0]).toMatchObject({ version: 2,
      data: { name: 'Invented team', slots: [ {}, {}, { signature: 'ice' }, {}, {} ] } })
    await expect(saveRpgPreset({ preset, expectedVersion: 1 })).rejects.toThrow(/changed/)
  })

  it('rejects a duplicate outfit and an ineligible signature even in an editable partial preset', async () => {
    const template = outfit(4)
    await own(template); await enroll(template); await flushOneRpgCommand()
    const profile = (await readRpgHub()).outfits.get(template.id)!.data.profile
    const slot = { outfitId: template.id, signature: 'fire' as const, loadout: [] }
    const profiles = new Map([[template.id, profile]])
    expect(validateRpgPresetSlots([slot, slot, null, null, null], profiles)).toMatch(/only one/)
    expect(validateRpgPresetSlots([{ ...slot, signature: 'lightning' }, null, null, null, null], profiles)).toMatch(/ineligible/)
    expect(validateRpgPresetSlots([{ ...slot, signature: 'ice' }, null, null, null, null], profiles)).toBeNull()
    expect(validateRpgPresetSlots([{ ...slot, signature: 'dark' }, null, null, null, null], profiles)).toBeNull()
    const invalid = { ...slot, signature: 'not-an-element' as typeof slot.signature }
    expect(validateRpgPresetSlots([invalid, null, null, null, null], profiles)).toMatch(/ineligible/)
    await expect(saveRpgPreset({ preset: { ...emptyRpgPreset(1), slots: [slot, slot, null, null, null] }, expectedVersion: 0 })).rejects.toThrow(/invalid/)
  })

  it('keeps a stale cloud edit unprojected and exposes the conflict instead of overwriting', async () => {
    const first = { ...emptyRpgPreset(1), name: 'My team' }
    await saveRpgPreset({ preset: first, expectedVersion: 0 })
    const remote = { ...serverEntities.get('rpgPresets/party-1'), kind: 'rpgPresets' as const,
      id: 'party-1', data: { ...first, name: 'Other device' } as unknown as Record<string, unknown>,
      version: 1, deleted: false, updatedAt: 101 }
    serverEntities.set('rpgPresets/party-1', remote)
    expect(await flushOneRpgCommand()).toBe(false)
    expect((await readRpgHub()).pending[0]?.status).toBe('conflict')
    expect((await readRpgHub()).presets[0]?.data.name).toBe('Party 1')
    await refreshRpgHubFromCloud()
    expect((await readRpgHub()).presets[0]).toMatchObject({ version: 1, data: { name: 'Other device' } })
    expect((await readRpgHub()).pending[0]?.status).toBe('conflict')
  })

  it('refreshes saved chapter resumes without erasing device actions or unrelated pending writes', async () => {
    const checkpoint = { schemaVersion: 1 as const, presetId: 'party-1', chapterId: 'invented-chapter', contentVersion: 'invented-v1',
      contentHash: 'a'.repeat(64), attemptIndex: 1, attemptId: 'rpg-attempt:party-1:invented-chapter:1', lastClearedNodeId: 'fork',
      selectedPath: ['fork'], status: 'at-checkpoint' as const, revision: 2, frozenEntry: null }
    serverEntities.set('rpgCheckpoints/party-1:invented-chapter', { kind: 'rpgCheckpoints', id: 'party-1:invented-chapter',
      data: checkpoint as unknown as Record<string, unknown>, version: 2, deleted: false, updatedAt: 100 })
    await db.rpgCheckpoints.put({ id: 'party-1:invented-chapter', version: 1, data: { ...checkpoint, selectedPath: [] } })
    await db.rpgBattleJournals.put({ id: 'invented-journal', entryId: 'invented-entry', retryOrdinal: 0, engineVersion: 1,
      frozenHash: 'b'.repeat(64), actions: [], stateHash: 'c'.repeat(64), terminal: 'open', commitStatus: 'none', createdAt: 1, updatedAt: 1 })
    await saveRpgPreset({ preset: emptyRpgPreset(2), expectedVersion: 0 })
    await db.outbox.add({ kind: 'items', id: 'invented-item', op: 'upsert', queuedAt: 1 })
    const pending = await db.pendingRpgCommands.toArray(), ordinary = await db.outbox.toArray(), journals = await db.rpgBattleJournals.toArray()
    await refreshRpgHubFromCloud()
    expect((await readRpgHub()).checkpoints).toMatchObject([{ version: 2, data: { selectedPath: ['fork'] } }])
    expect(await db.pendingRpgCommands.toArray()).toEqual(pending)
    expect(await db.outbox.toArray()).toEqual(ordinary)
    expect(await db.rpgBattleJournals.toArray()).toEqual(journals)
    serverEntities.get('rpgCheckpoints/party-1:invented-chapter')!.version = 1
    await refreshRpgHubFromCloud()
    expect((await readRpgHub()).checkpoints[0]?.version).toBe(2)
  })

  it('refuses a party draft if an enrolled outfit revision changed after the editor opened', async () => {
    const template = outfit(8)
    await own(template); await enroll(template); await flushOneRpgCommand()
    const preset = { ...emptyRpgPreset(1), slots: [
      { outfitId: template.id, signature: 'fire' as const, loadout: [] }, null, null, null, null,
    ] as RpgPresetSaveV1['slots'] }
    const row = await db.rpgOutfits.get(template.id)
    expect(row?.version).toBe(1)
    await db.rpgOutfits.update(template.id, { version: 2 })
    await expect(saveRpgPreset({ preset, expectedVersion: 0,
      expectedOutfitVersions: { [template.id]: 1 } })).rejects.toThrow(/selected outfit changed/)
    expect(await db.pendingRpgCommands.count()).toBe(0)
  })
  it('allows signature/loadout edits only at an accepted safe checkpoint and versions that dependency', async () => {
    const template = outfit(9)
    await own(template); await enroll(template); await flushOneRpgCommand()
    const preset: RpgPresetSaveV1 = { ...emptyRpgPreset(1), foregroundChapterId: 'test-chapter', slots: [
      { outfitId: template.id, signature: 'fire', loadout: [] }, null, null, null, null] }
    await db.rpgPresets.put({ id: preset.presetId, version: 1, data: preset })
    const checkpoint = { schemaVersion: 1 as const, presetId: 'party-1', chapterId: 'test-chapter', contentVersion: 'invented-v1',
      contentHash: 'a'.repeat(64), attemptIndex: 1, attemptId: 'rpg-attempt:party-1:test-chapter:1', lastClearedNodeId: null,
      selectedPath: [], status: 'pending-result' as const, revision: 1, frozenEntry: null }
    await db.rpgCheckpoints.put({ id: 'party-1:test-chapter', version: 2, data: checkpoint })
    const changed = structuredClone(preset)
    changed.slots[0]!.signature = 'ice'
    await expect(saveRpgPreset({ preset: changed, expectedVersion: 1 })).rejects.toThrow(/accepted safe checkpoint/)
    await db.rpgCheckpoints.put({ id: 'party-1:test-chapter', version: 3, data: { ...checkpoint, status: 'at-checkpoint' } })
    await saveRpgPreset({ preset: changed, expectedVersion: 1 })
    const command = (await db.pendingRpgCommands.toArray())[0]!.body as RpgCommandRequest
    expect(command.expected).toContainEqual({ kind: 'rpgCheckpoints', id: 'party-1:test-chapter', version: 3 })
  })
})
