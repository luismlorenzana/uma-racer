// The place registry (docs/game/11-hub-and-places.md §1, §6; T152, T155–T158): every place has its Page, the Stable,
// the Card Library and Careers a Peek too; the hidden Account has none. Sub-page patterns and full-screen flows resolve
// as T137 set them: the two games, and a career's plays and race runs.
import { PLACE_IDS, PLACES } from '@racer/domain/hub'
import { describe, expect, it } from 'vitest'
import { isFullScreen, matchSubPage, PLACE_UI, type PlaceUi } from './registry'

describe('the place registry', () => {
  it('fills every place with a Page; the Stable, the Card Library and Careers with a Peek; the hidden Account with none', () => {
    expect(Object.keys(PLACE_UI)).toEqual(['stable', 'card-library', 'account', 'careers', 'training-yard', 'furlong-hand'])
    for (const id of PLACE_IDS) expect(PLACE_UI[id]?.Page, id).toBeDefined()
    expect(PLACE_IDS.filter((id) => PLACE_UI[id]?.Peek !== undefined)).toEqual(['stable', 'card-library', 'careers'])
    expect(PLACES.find((place) => place.id === 'account')?.hidden).toBe(true)
  })

  it('hides the bars on the two games, and on a career\'s plays and race runs (T155, T156, T158)', () => {
    for (const place of PLACES) {
      for (const rest of ['', 'run', 'outfit/invented-uma-01']) expect(isFullScreen(place, rest)).toBe(place.id === 'training-yard' || place.id === 'furlong-hand')
    }
    const careers = PLACES.find((place) => place.id === 'careers')!
    expect(['sim-uma-0:1/play/training-yard', 'sim-uma-0:1/race/op-1'].map((rest) => isFullScreen(careers, rest))).toEqual([true, true])
    expect(['sim-uma-0:1', 'sim-uma-0:1/upgrade', 'sim-uma-0:1/play', 'x/play/a/b'].map((rest) => isFullScreen(careers, rest))).toEqual([false, false, false, false])
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
