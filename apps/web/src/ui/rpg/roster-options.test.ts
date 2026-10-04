import { describe, expect, it } from 'vitest'
import type { RpgPresetSaveV1 } from '@racer/domain'
import { releaseProofFixture } from '../../screens/rpg/release-proof-fixture'
import { orderRpgRoster, rpgPartyOptions } from './roster-options'

function fixture() {
  const { view } = releaseProofFixture()
  const first = view.outfits.get('test-outfit-0')!
  // Extra invented enrolled outfit, not assigned to any preset.
  const free = 'test-free'
  const outfits = new Map(view.outfits).set(free, { ...first, id: free,
    data: { ...first.data, profile: { ...first.data.profile, outfitId: free } } })
  return { view: { ...view, outfits }, free, ownedIds: [...outfits.keys()], draft: structuredClone(view.presets[1]!.data) }
}
const slot = (outfitId: string) => ({ outfitId, signature: 'fire' as const, loadout: [] })

describe('RPG roster and party availability', () => {
  it('groups enrolled outfits first, then sorts names with a stable id tie break without mutating input', () => {
    const ids = ['unenrolled-a', 'enrolled-z', 'enrolled-b', 'enrolled-a']
    const names: Record<string, string> = { 'unenrolled-a': 'A', 'enrolled-z': 'Z', 'enrolled-b': 'A', 'enrolled-a': 'A' }
    expect(orderRpgRoster(ids, new Set(ids.slice(1)), id => names[id]!))
      .toEqual(['enrolled-a', 'enrolled-b', 'enrolled-z', 'unenrolled-a'])
    expect(ids[0]).toBe('unenrolled-a')
  })

  it('offers only owned, enrolled outfits not used by any other saved party', () => {
    const f = fixture()
    expect(rpgPartyOptions(f.view, f.draft, 0, [...f.ownedIds, 'not-enrolled'])).toEqual([f.free])
    expect(rpgPartyOptions(f.view, f.draft, 0, f.ownedIds.filter(id => id !== f.free))).toEqual([])
  })

  it('excludes other draft slots, preserves the current value, and frees a removed member within the same draft', () => {
    const f = fixture()
    const draft = structuredClone(f.view.presets[0]!.data)
    expect(rpgPartyOptions(f.view, draft, 0, f.ownedIds)).toEqual(['test-outfit-0', f.free])
    draft.slots[1] = null
    expect(rpgPartyOptions(f.view, draft, 0, f.ownedIds)).toEqual(['test-outfit-0', 'test-outfit-1', f.free])
    expect(rpgPartyOptions(f.view, draft, 1, f.ownedIds)).toEqual(['test-outfit-1', f.free])
  })

  it('keeps old shared selections intact but never offers them as new choices in another slot', () => {
    const f = fixture()
    f.draft.slots[0] = slot('test-outfit-0')
    const before = JSON.stringify(f.view)
    expect(rpgPartyOptions(f.view, f.draft, 0, f.ownedIds)).toEqual(['test-outfit-0', f.free])
    expect(rpgPartyOptions(f.view, f.draft, 1, f.ownedIds)).toEqual([f.free])
    expect(JSON.stringify(f.view)).toBe(before)
  })

  it('reserves queued additions while saved members remain assigned until removal is acknowledged', () => {
    const f = fixture()
    const queued: RpgPresetSaveV1 = { ...structuredClone(f.view.presets[0]!.data), slots: [slot(f.free), null, null, null, null] }
    f.view.pending = [{ id: 'invented-edit', status: 'pending', queuedAt: 1, conflict: null,
      body: { action: 'edit-preset', upserts: [{ kind: 'rpgPresets', data: queued }] } }]
    expect(rpgPartyOptions(f.view, f.draft, 0, f.ownedIds)).toEqual([])
    f.view.pending[0]!.status = 'conflict'
    expect(rpgPartyOptions(f.view, f.draft, 0, f.ownedIds)).toEqual([f.free])
    f.view.presets = f.view.presets.map(row => row.id === queued.presetId ? { ...row, data: { ...queued, slots: [null, null, null, null, null] } } : row)
    expect(rpgPartyOptions(f.view, f.draft, 0, f.ownedIds)).toEqual(f.ownedIds)
  })

  it('ignores unrelated or malformed queued commands without throwing or fabricating a selection', () => {
    const f = fixture()
    f.view.pending = [null, { action: 'battle-result', upserts: [] }, { action: 'edit-preset', upserts: [null, { kind: 'rpgPresets', data: {} }] }]
      .map((body, index) => ({ id: `invented-${index}`, status: 'pending', queuedAt: 1, conflict: null, body }))
    expect(rpgPartyOptions(f.view, f.draft, 0, f.ownedIds)).toEqual([f.free])
  })
})
