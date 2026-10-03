// Account RPG enrollment and party editing (docs/design/uma-rpg.md, T093).
import {
  RPG_PARTY_SIZE, RPG_PRESET_COUNT, canUseRpgSignature, enrollRpgOutfit,
  parseRpgOutfitSave, parseRpgPresetSave, parseSaveSnapshotOrThrow, rpgPresetId, validateRpgLoadout,
  type RpgCommandRequest, type RpgElement, type RpgOutfitSaveV1,
  type RpgPresetSaveV1, type RpgPresetSlotV1, type RpgProfile,
  type RpgWeapon, type Strategy, type UmaTemplate,
} from '@racer/domain'
import { saveApi } from '../api/client'
import { db, type PendingRpgCommandRow, type VersionedRow } from './db'
import { enqueueRpgCommand } from './rpg-sync'

export interface RpgHubView {
  outfits: ReadonlyMap<string, VersionedRow<RpgOutfitSaveV1>>
  presets: readonly VersionedRow<RpgPresetSaveV1>[]
  pending: readonly PendingRpgCommandRow[]
}

export class RpgHubConflictError extends Error {
  constructor(message = 'RPG state changed on another screen or device. Reload before editing again.') {
    super(message)
    this.name = 'RpgHubConflictError'
  }
}

export function emptyRpgPreset(index: number): RpgPresetSaveV1 {
  return { schemaVersion: 1, presetId: rpgPresetId(index), name: `Party ${index}`,
    slots: [null, null, null, null, null], foregroundChapterId: null }
}

export async function readRpgHub(): Promise<RpgHubView> {
  const [outfits, saved, pending] = await Promise.all([
    db.rpgOutfits.toArray(), db.rpgPresets.toArray(), db.pendingRpgCommands.toArray(),
  ])
  const savedById = new Map(saved.map((row) => [row.id, row]))
  return {
    outfits: new Map(outfits.map((row) => [row.id, row])),
    presets: Array.from({ length: RPG_PRESET_COUNT }, (_, index) => {
      const id = rpgPresetId(index + 1)
      return savedById.get(id) ?? { id, version: 0, data: emptyRpgPreset(index + 1) }
    }),
    pending,
  }
}

/** Pull only acknowledged RPG setup rows; ordinary offline save writes must stay untouched. */
export async function refreshRpgHubFromCloud(): Promise<void> {
  const snapshot = parseSaveSnapshotOrThrow(await saveApi.load())
  await db.transaction('rw', [db.rpgOutfits, db.rpgPresets], async () => {
    for (const remote of snapshot.entities) {
      if (remote.kind !== 'rpgOutfits' && remote.kind !== 'rpgPresets') continue
      if (remote.kind === 'rpgOutfits') {
        const local = await db.rpgOutfits.get(remote.id)
        if (local && local.version >= remote.version) continue
        if (remote.deleted) await db.rpgOutfits.delete(remote.id)
        else {
          const data = parseRpgOutfitSave(remote.data)
          if (!data) throw new Error(`Invalid account RPG outfit ${remote.id}`)
          await db.rpgOutfits.put({ id: remote.id, version: remote.version, data })
        }
      } else {
        const local = await db.rpgPresets.get(remote.id)
        if (local && local.version >= remote.version) continue
        if (remote.deleted) await db.rpgPresets.delete(remote.id)
        else {
          const data = parseRpgPresetSave(remote.data)
          if (!data) throw new Error(`Invalid account RPG party ${remote.id}`)
          await db.rpgPresets.put({ id: remote.id, version: remote.version, data })
        }
      }
    }
  })
}

function requireNoPending(pending: readonly PendingRpgCommandRow[], action: RpgCommandRequest['action'], id: string): void {
  if (pending.some((row) => row.status === 'pending' && (row.body as RpgCommandRequest).action === action &&
    (row.body as RpgCommandRequest).upserts.some((upsert) => upsert.id === id))) {
    throw new RpgHubConflictError('This RPG change is pending sync. Wait for acknowledgement before editing it again.')
  }
}

function commandId(action: 'enroll' | 'edit-preset'): string {
  return `rpg-${action}:${crypto.randomUUID()}`
}

export async function enrollOwnedRpgOutfit(input: {
  template: UmaTemplate
  contentVersion: string
  style: Strategy
  weapon: RpgWeapon
  defaultSignature: RpgElement
  expectedUmaVersion: number
}): Promise<string> {
  const { template, contentVersion, style, weapon, defaultSignature, expectedUmaVersion } = input
  const profile = enrollRpgOutfit({ outfit: template, contentVersion, style, weapon, defaultSignature })
  const data: RpgOutfitSaveV1 = { schemaVersion: 1, profile, projectionRevision: 0 }
  const id = commandId('enroll')
  await db.transaction('rw', [db.umas, db.rpgOutfits, db.pendingRpgCommands, db.outbox], async () => {
    const owned = await db.umas.get(template.id)
    if (!owned || owned.version !== expectedUmaVersion || owned.version < 1) throw new RpgHubConflictError('Owned outfit changed; reload its RPG profile.')
    if (await db.outbox.where('[kind+id]').equals(['umas', template.id]).count()) {
      throw new RpgHubConflictError('This outfit is still syncing. Try enrollment after it finishes.')
    }
    if (await db.rpgOutfits.get(template.id)) throw new RpgHubConflictError('This outfit is already enrolled.')
    requireNoPending(await db.pendingRpgCommands.toArray(), 'enroll', template.id)
    await enqueueRpgCommand({ schemaVersion: 1, commandId: id, action: 'enroll',
      expected: [{ kind: 'umas', id: template.id, version: owned.version },
        { kind: 'rpgOutfits', id: template.id, version: 0 }],
      upserts: [{ kind: 'rpgOutfits', id: template.id, data: data as unknown as Record<string, unknown> }],
      appends: [],
    }, Date.now())
  })
  return id
}

export function validateRpgPresetSlots(slots: readonly (RpgPresetSlotV1 | null)[], profiles: ReadonlyMap<string, RpgProfile>): string | null {
  if (slots.length !== RPG_PARTY_SIZE) return 'A party has exactly five ordered slots.'
  const ids = slots.flatMap((slot) => slot ? [slot.outfitId] : [])
  if (new Set(ids).size !== ids.length) return 'An outfit can occupy only one slot in a party.'
  for (const slot of slots) {
    if (!slot) continue
    const profile = profiles.get(slot.outfitId)
    if (!profile) return 'A party slot needs an enrolled, owned outfit.'
    if (!canUseRpgSignature(profile, slot.signature) || !validateRpgLoadout(profile, slot.signature, slot.loadout)) {
      return 'A slot has an ineligible signature or RPG skill loadout.'
    }
  }
  return null
}

export async function saveRpgPreset(input: {
  preset: RpgPresetSaveV1
  expectedVersion: number
  /** Editor-observed revisions; a changed outfit cannot silently alter a stale loadout choice. */
  expectedOutfitVersions?: Readonly<Record<string, number>>
}): Promise<string> {
  const { preset, expectedVersion, expectedOutfitVersions } = input
  if (!parseRpgPresetSave(preset)) throw new Error('Party name or slots are invalid.')
  const id = commandId('edit-preset')
  await db.transaction('rw', [db.umas, db.rpgOutfits, db.rpgPresets, db.rpgCheckpoints, db.pendingRpgCommands], async () => {
    const current = await db.rpgPresets.get(preset.presetId)
    if ((current?.version ?? 0) !== expectedVersion) throw new RpgHubConflictError()
    requireNoPending(await db.pendingRpgCommands.toArray(), 'edit-preset', preset.presetId)
    const filled = preset.slots.flatMap((slot) => slot ? [slot] : [])
    const outfitRows = await Promise.all(filled.map((slot) => db.rpgOutfits.get(slot.outfitId)))
    const owned = await Promise.all(filled.map((slot) => db.umas.get(slot.outfitId)))
    const profiles = new Map<string, RpgProfile>()
    const expected: RpgCommandRequest['expected'] = [{ kind: 'rpgPresets', id: preset.presetId, version: expectedVersion }]
    const chapterId = current?.data.foregroundChapterId
    const checkpoint = chapterId ? await db.rpgCheckpoints.get(`${preset.presetId}:${chapterId}`) : undefined
    const loadoutChanged = preset.slots.some((slot) => {
      const previous = current?.data.slots.find((s) => s?.outfitId === slot?.outfitId)
      return slot && previous && (slot.signature !== previous.signature || JSON.stringify(slot.loadout) !== JSON.stringify(previous.loadout))
    })
    if (loadoutChanged && checkpoint) {
      const pending = await db.pendingRpgCommands.toArray()
      if (!['at-checkpoint', 'cleared'].includes(checkpoint.data.status) || pending.some((row) =>
        (row.body as RpgCommandRequest).upserts.some((upsert) => upsert.kind === 'rpgCheckpoints' && upsert.id === checkpoint.id))) {
        throw new RpgHubConflictError('Change skill loadouts only at an accepted safe checkpoint. The entered battle remains frozen.')
      }
      expected.push({ kind: 'rpgCheckpoints', id: checkpoint.id, version: checkpoint.version })
    }
    for (let index = 0; index < filled.length; index += 1) {
      const row = outfitRows[index]
      const slot = filled[index]!
      if (!row || !owned[index]) throw new RpgHubConflictError('A selected outfit is no longer owned or enrolled.')
      if (expectedOutfitVersions && row.version !== expectedOutfitVersions[slot.outfitId]) {
        throw new RpgHubConflictError('A selected outfit changed on another screen or device. Reload this party before saving.')
      }
      profiles.set(slot.outfitId, row.data.profile)
      expected.push({ kind: 'rpgOutfits', id: slot.outfitId, version: row.version })
    }
    const problem = validateRpgPresetSlots(preset.slots, profiles)
    if (problem) throw new Error(problem)
    await enqueueRpgCommand({ schemaVersion: 1, commandId: id, action: 'edit-preset', expected,
      upserts: [{ kind: 'rpgPresets', id: preset.presetId, data: preset as unknown as Record<string, unknown> }],
      appends: [],
    }, Date.now())
  })
  return id
}
