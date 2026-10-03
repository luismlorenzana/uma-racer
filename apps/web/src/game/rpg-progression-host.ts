// Acknowledged safe-checkpoint tree/promotion commands (docs/design/uma-rpg.md, T096).
import { RPG_PRESET_COUNT, promoteRpgOutfit, rpgPresetId, rpgSkillKey, spendRpgTreePoint,
  parseRpgOutfitSave, validateRpgLoadout, type RpgCommandRequest, type RpgOutfitSaveV1, type RpgPresetSaveV1,
  type RpgCheckpointSaveV1, type RpgSkillRef, type RpgElement } from '@racer/domain'
import { db, type RacerDb, type VersionedRow, type PendingRpgCommandRow } from './db'
import { enqueueRpgCommand } from './rpg-sync'

export interface RpgProgressionView {
  outfit: VersionedRow<RpgOutfitSaveV1>
  presets: VersionedRow<RpgPresetSaveV1>[]
  checkpoints: VersionedRow<RpgCheckpointSaveV1>[]
  expected: RpgCommandRequest['expected']
  pending: PendingRpgCommandRow[]
  blocked: string | null
}
const data = (v: object) => v as unknown as Record<string, unknown>
export class RpgProgressionHost {
  constructor(readonly database: RacerDb = db, private readonly now: () => number = Date.now) {}

  async read(outfitId: string): Promise<RpgProgressionView> {
    const [outfit, presets, checkpoints, pending] = await Promise.all([this.database.rpgOutfits.get(outfitId),
      this.database.rpgPresets.toArray(), this.database.rpgCheckpoints.toArray(), this.database.pendingRpgCommands.toArray()])
    if (!outfit || !parseRpgOutfitSave(outfit.data)) throw new Error('Acknowledged RPG profile unavailable')
    // Expect all five membership rows, even absent ones; another party cannot enroll this outfit behind the editor.
    const expected: RpgCommandRequest['expected'] = [{ kind: 'rpgOutfits', id: outfitId, version: outfit.version },
      ...Array.from({ length: RPG_PRESET_COUNT }, (_, i) => ({ kind: 'rpgPresets' as const, id: rpgPresetId(i + 1),
        version: presets.find((p) => p.id === rpgPresetId(i + 1))?.version ?? 0 }))]
    const involved = presets.filter((p) => p.data.slots.some((s) => s?.outfitId === outfitId))
    const safeReads = checkpoints.filter((c) => involved.some((p) => p.id === c.data.presetId && p.data.foregroundChapterId === c.data.chapterId) ||
      ['in-battle', 'pending-result'].includes(c.data.status) && c.data.frozenEntry?.party.some((m) => m.outfitId === outfitId))
    for (const c of safeReads) expected.push({ kind: 'rpgCheckpoints', id: c.id, version: c.version })
    const related = pending.filter((p) => (p.body as RpgCommandRequest).upserts.some((u) => expected.some((e) => e.kind === u.kind && e.id === u.id)))
    const blocked = related.length ? 'RPG change pending or conflicted. Nothing provisional can fund skills or promotion.'
      : safeReads.some((c) => !['at-checkpoint', 'cleared'].includes(c.data.status))
        ? 'Finish and accept every open battle using this outfit before changing skills or promoting.' : null
    return { outfit, presets: involved, checkpoints: safeReads, expected, pending: related, blocked }
  }

  private async reserve(observed: RpgProgressionView, body: RpgCommandRequest): Promise<string> {
    if (observed.blocked) throw new Error(observed.blocked)
    await this.database.transaction('rw', [this.database.rpgOutfits, this.database.rpgPresets,
      this.database.rpgCheckpoints, this.database.pendingRpgCommands], async () => {
      const fresh = await this.read(observed.outfit.id)
      if (fresh.blocked || JSON.stringify(fresh.expected) !== JSON.stringify(observed.expected)) {
        throw new Error(fresh.blocked ?? 'Safe checkpoint or profile changed. Reload before spending.')
      }
      await enqueueRpgCommand(body, this.now(), null, this.database)
    })
    return body.commandId
  }

  async learn(observed: RpgProgressionView, ref: RpgSkillRef): Promise<string> {
    if (observed.blocked) throw new Error(observed.blocked)
    const next = { ...observed.outfit.data, profile: spendRpgTreePoint(observed.outfit.data.profile, ref),
      projectionRevision: observed.outfit.data.projectionRevision + 1 }
    const body: RpgCommandRequest = { schemaVersion: 1, commandId: `rpg-tree:${crypto.randomUUID()}`, action: 'edit-outfit',
      expected: observed.expected, upserts: [{ kind: 'rpgOutfits', id: observed.outfit.id, data: data(next) }], appends: [] }
    return this.reserve(observed, body)
  }

  async equip(observed: RpgProgressionView, presetId: string, signature: RpgElement, loadout: RpgSkillRef[]): Promise<string> {
    if (observed.blocked) throw new Error(observed.blocked)
    // UI choices are learned RpgSkills; the preset wire stores references, never their mutable skill levels.
    loadout = loadout.map(({ tier, weapon, element, depth, branch }) => ({ tier, weapon, element, depth, branch }))
    if (!validateRpgLoadout(observed.outfit.data.profile, signature, loadout)) throw new Error('Invalid signature, learned skills or active slots')
    const preset = observed.presets.find((p) => p.id === presetId)
    if (!preset) throw new Error('Add this outfit to the party before equipping its skills')
    const expected = [...observed.expected]
    for (const slot of preset.data.slots) if (slot && slot.outfitId !== observed.outfit.id) {
      const row = await this.database.rpgOutfits.get(slot.outfitId)
      if (!row) throw new Error('Party member unavailable')
      expected.push({ kind: 'rpgOutfits', id: row.id, version: row.version })
    }
    const slots = preset.data.slots.map((s) => s?.outfitId === observed.outfit.id ? { ...s, signature, loadout } : s)
    return this.reserve(observed, { schemaVersion: 1, commandId: `rpg-equip:${crypto.randomUUID()}`, action: 'edit-preset',
      expected, upserts: [{ kind: 'rpgPresets', id: presetId, data: data({ ...preset.data, slots }) }], appends: [] })
  }

  async promote(observed: RpgProgressionView, selectedLegacy: RpgSkillRef[], discardUnspent: boolean): Promise<string> {
    if (observed.blocked) throw new Error(observed.blocked)
    const before = observed.outfit.data
    const promoted = promoteRpgOutfit(before.profile, selectedLegacy, discardUnspent)
    const next = { ...before, profile: promoted.profile, projectionRevision: before.projectionRevision + 1 }
    const upserts: RpgCommandRequest['upserts'] = [{ kind: 'rpgOutfits', id: observed.outfit.id, data: data(next) }]
    const keys = new Set(promoted.profile.legacy.map(rpgSkillKey))
    for (const preset of observed.presets) {
      const slots = preset.data.slots.map((s) => s?.outfitId === observed.outfit.id
        ? { ...s, loadout: s.loadout.filter((ref) => keys.has(rpgSkillKey(ref))) } : s) as RpgPresetSaveV1['slots']
      if (JSON.stringify(slots) !== JSON.stringify(preset.data.slots)) upserts.push({ kind: 'rpgPresets', id: preset.id,
        data: data({ ...preset.data, slots }) })
    }
    const promotionId = `rpg-promote:${observed.outfit.id}:${before.profile.tier}`
    const createdAt = this.now()
    return this.reserve(observed, { schemaVersion: 1, commandId: promotionId, action: 'promote',
      expected: observed.expected, upserts, appends: [{ kind: 'rpgPromotions', id: promotionId, createdAt,
        data: { schemaVersion: 1, promotionId, outfitId: observed.outfit.id, fromTier: before.profile.tier,
          toTier: promoted.profile.tier, archive: promoted.archivedTier.tree, createdAt } }] })
  }
}
