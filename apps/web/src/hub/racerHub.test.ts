// The Town Hall plaza's crowd (docs/game/11-hub-and-places.md §5, SA7; T152): the owned Umas, newest unlock first, five
// at most, read from the hub view.
import { initialSave, type SaveState } from '@racer/domain/save'
import { hubView } from '@racer/domain/hub'
import { describe, expect, it } from 'vitest'
import { PLAZA_CROWD, plazaCrowd } from './racerHub'

const owning = (unlocks: Readonly<Record<string, number>>): SaveState => ({
  ...initialSave(0).state,
  umas: Object.fromEntries(Object.entries(unlocks).map(([id, unlockedAt]) => [id, { unlockedAt }])),
})

describe('the plaza crowd (SA7)', () => {
  it('stands the owned Umas newest unlock first, five at most', () => {
    const view = hubView(owning({ a: 1, b: 6, c: 3, d: 5, e: 2, f: 4 }))
    expect(PLAZA_CROWD).toBe(5)
    expect(plazaCrowd(view.owned)).toEqual(['b', 'd', 'f', 'c', 'e'])
  })

  it('stands fewer when fewer are owned, and nobody on a new account', () => {
    expect(plazaCrowd(hubView(owning({ b: 2, f: 2 })).owned)).toEqual(['b', 'f'])
    expect(plazaCrowd(hubView(initialSave(0).state).owned)).toEqual([])
  })
})
