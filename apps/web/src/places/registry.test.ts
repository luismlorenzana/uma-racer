// The place registry (docs/game/11-hub-and-places.md §1, §6; T152): generation 3 starts with Account alone; every other
// place falls back to the not-ready Page until its part fills its slot. Sub-page patterns and full-screen flows resolve
// as T137 set them.
import { PLACE_IDS, PLACES } from '@racer/domain/hub'
import { describe, expect, it } from 'vitest'
import { isFullScreen, matchSubPage, PLACE_UI, type PlaceUi } from './registry'

describe('the place registry', () => {
  it('fills Account and Training Yard, each only with a Page: Account is hidden, so it has no Peek', () => {
    expect(Object.keys(PLACE_UI)).toEqual(['account', 'training-yard'])
    expect(PLACE_UI.account?.Page).toBeDefined()
    expect(PLACE_UI.account?.Peek).toBeUndefined()
    expect(PLACE_UI['training-yard']?.Page).toBeDefined()
    expect(PLACES.find((place) => place.id === 'account')?.hidden).toBe(true)
    for (const id of PLACE_IDS.filter((each) => each !== 'account' && each !== 'training-yard')) expect(PLACE_UI[id], id).toBeUndefined()
  })

  it('hides the bars on Training Yard alone: the game is full screen (T155)', () => {
    for (const place of PLACES) {
      for (const rest of ['', 'run', 'outfit/invented-uma-01']) expect(isFullScreen(place, rest)).toBe(place.id === 'training-yard')
    }
    expect(isFullScreen(undefined, 'run')).toBe(false)
  })

  it("matches a sub-page pattern against the place's rest, so one part can own another's sub-route", () => {
    const Profile = (() => null) as unknown as NonNullable<PlaceUi['subPages']>[string]
    const ui: PlaceUi = { subPages: { 'outfit/:umaId': Profile }, fullScreen: (rest) => rest === 'play' }
    expect(matchSubPage(ui, 'outfit/invented-uma-01')).toEqual({ Page: Profile, params: { umaId: 'invented-uma-01' } })
    expect(matchSubPage(ui, 'outfit/invented-uma-01/skills')).toBeNull()
    expect(matchSubPage(undefined, 'outfit/x')).toBeNull()
  })
})
