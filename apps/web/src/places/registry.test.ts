// The slot registry (docs/rework/11-hub-and-places.md §1, §6): every place has a Page and, unless it is `direct` or
// `hidden`, a Peek, except the `PENDING` slots each place task empties as it lands (T143 requires none). Full-screen
// flows and sub-page patterns resolve as T137 sets them.
import { PLACE_IDS, PLACES } from '@racer/domain/hub'
import { describe, expect, it } from 'vitest'
import { FLOW_UI, isFullScreen, matchSubPage, PENDING, PLACE_UI, SHEET_UI, TOWN_PLAZA, type PlaceUi, type SlotId } from './registry'

const filled = (slot: SlotId): boolean => {
  switch (slot) {
    case 'sheet:check-in': return SHEET_UI['check-in'] !== undefined
    case 'sheet:featured': return SHEET_UI.featured !== undefined
    case 'plaza': return TOWN_PLAZA.Card !== undefined
    case 'flow:reveal': return FLOW_UI.reveal !== undefined
    default: {
      const place = PLACES.find((entry) => entry.id === slot)!
      const ui = PLACE_UI[place.id]
      return ui?.Page !== undefined && (place.direct || place.hidden || ui.Peek !== undefined)
    }
  }
}

describe('the slot registry', () => {
  it('fills every place, sheet, the plaza and the reveal, except what is still pending', () => {
    const slots: SlotId[] = [...PLACE_IDS, 'sheet:check-in', 'sheet:featured', 'plaza', 'flow:reveal']
    for (const slot of slots) expect(filled(slot) || PENDING.includes(slot), `${slot} has no slot and isn't pending`).toBe(true)
  })

  it('lists only real slots as pending, once each, and none already filled: a task empties its own as it lands', () => {
    expect(new Set(PENDING).size).toBe(PENDING.length)
    for (const slot of PENDING) {
      expect([...PLACE_IDS, 'sheet:check-in', 'sheet:featured', 'plaza', 'flow:reveal']).toContain(slot)
      expect(filled(slot), `${slot} is filled: take it off PENDING`).toBe(false)
    }
  })

  it("hides both bars on §6's flows inside place routes, and nowhere else", () => {
    const place = (id: string) => PLACES.find((entry) => entry.id === id)
    expect(isFullScreen(place('racecourse'), 'run')).toBe(true)
    expect(isFullScreen(place('racecourse'), 'run/result')).toBe(true)
    expect(isFullScreen(place('racecourse'), '')).toBe(false)
    expect(isFullScreen(place('observatory'), 'sim-uma-01')).toBe(true)
    expect(isFullScreen(place('gym'), 'sim-uma-01')).toBe(true)
    expect(isFullScreen(place('gym'), '')).toBe(false)
    expect(isFullScreen(place('dojo'), 'sim-uma-01')).toBe(false)
    expect(isFullScreen(place('stable'), 'outfit/sim-uma-01')).toBe(false)
    expect(isFullScreen(undefined, 'run')).toBe(false)
  })

  it("matches a sub-page pattern against the place's rest, so one task can own another's sub-route", () => {
    const Needs = (() => null) as unknown as NonNullable<PlaceUi['subPages']>[string]
    const ui: PlaceUi = { subPages: { needs: Needs, 'outfit/:umaId/needs': Needs } }
    expect(matchSubPage(ui, 'needs')).toEqual({ Page: Needs, params: {} })
    expect(matchSubPage(ui, 'outfit/sim-uma-01/needs')).toEqual({ Page: Needs, params: { umaId: 'sim-uma-01' } })
    expect(matchSubPage(ui, 'outfit/sim-uma-01')).toBeNull()
    expect(matchSubPage(undefined, 'needs')).toBeNull()
  })
})
