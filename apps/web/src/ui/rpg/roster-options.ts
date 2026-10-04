// Read-only roster/picker preferences (docs/design/uma-rpg.md#phone-presentation).
import { parseRpgPresetSave, type RpgPresetSaveV1 } from '@racer/domain'
import type { RpgHubView } from '../../game/rpg-hub'

export function orderRpgRoster(ids: readonly string[], enrolled: ReadonlySet<string>, name: (id: string) => string): string[] {
  return [...ids].sort((a, b) => Number(enrolled.has(b)) - Number(enrolled.has(a)) || name(a).localeCompare(name(b)) || a.localeCompare(b))
}

/** Saved other parties and their queued additions reserve outfits until acknowledged.
 * The current draft replaces its saved membership, so an outfit can move between its slots.
 * Existing selections remain visible, including old shared presets; this never rewrites saves.
 */
export function rpgPartyOptions(view: RpgHubView, draft: RpgPresetSaveV1, index: number, ownedIds: readonly string[]): string[] {
  const assigned = new Set(view.presets.filter(row => row.id !== draft.presetId)
    .flatMap(row => row.data.slots.flatMap(slot => slot ? [slot.outfitId] : [])))
  for (const pending of view.pending) {
    if (pending.status !== 'pending' || typeof pending.body !== 'object' || pending.body === null) continue
    const body = pending.body as Record<string, unknown>
    if (body.action !== 'edit-preset' || !Array.isArray(body.upserts)) continue
    for (const row of body.upserts as unknown[]) {
      if (typeof row !== 'object' || row === null || !('kind' in row) || row.kind !== 'rpgPresets' || !('data' in row)) continue
      const preset = parseRpgPresetSave(row.data)
      if (preset && preset.presetId !== draft.presetId) {
        for (const slot of preset.slots) if (slot) assigned.add(slot.outfitId)
      }
    }
  }
  draft.slots.forEach((slot, slotIndex) => { if (slot && slotIndex !== index) assigned.add(slot.outfitId) })
  const current = draft.slots[index]?.outfitId
  return ownedIds.filter(id => view.outfits.has(id) && (id === current || !assigned.has(id)))
}
