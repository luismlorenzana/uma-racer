// Page swipes (docs/game/11-hub-and-places.md §1; uma-rpg's `hub/swipe.test.ts`): more than 60 px, mostly sideways,
// in the bottom bar's order, stopping at either end.
import { describe, expect, it } from 'vitest'
import { neighbourPage, swipeDirection } from './swipe'

describe('hub swipes', () => {
  it('needs a drag of more than 60 px, mostly horizontal', () => {
    expect(swipeDirection({ x: 200, y: 300 }, { x: 120, y: 310 })).toBe(1)
    expect(swipeDirection({ x: 100, y: 300 }, { x: 180, y: 290 })).toBe(-1)
    expect(swipeDirection({ x: 200, y: 300 }, { x: 140, y: 300 })).toBe(0)
    expect(swipeDirection({ x: 200, y: 300 }, { x: 139, y: 300 })).toBe(1)
    expect(swipeDirection({ x: 200, y: 300 }, { x: 110, y: 380 })).toBe(0)
    expect(swipeDirection({ x: Number.NaN, y: 300 }, { x: 110, y: 300 })).toBe(0)
  })

  it('moves in the bar order and stops at the first and last pages', () => {
    expect(neighbourPage('town', -1)).toBeNull()
    expect(neighbourPage('town', 1)).toBe('training')
    expect(neighbourPage('training', 1)).toBe('racing')
    expect(neighbourPage('racing', 1)).toBe('farm')
    expect(neighbourPage('farm', 1)).toBeNull()
    expect(neighbourPage('farm', -1)).toBe('racing')
  })
})
