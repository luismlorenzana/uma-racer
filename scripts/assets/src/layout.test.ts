import { describe, expect, it } from 'vitest'
import { CELL_SIZE, CELLS_PER_PAGE, MAX_ATLAS_SIZE, layoutFrames } from './layout'

describe('layoutFrames', () => {
  it('sorts ids and places frames in bounded, non-overlapping pages', () => {
    const ids = Array.from({ length: CELLS_PER_PAGE + 2 }, (_, index) => String(CELLS_PER_PAGE + 2 - index))
    const layout = layoutFrames(ids)

    expect(layout.pages).toHaveLength(2)
    expect(layout.pages[0]!.width).toBeLessThanOrEqual(MAX_ATLAS_SIZE)
    expect(layout.pages[0]!.height).toBeLessThanOrEqual(MAX_ATLAS_SIZE)
    expect(layout.pages[1]).toMatchObject({ width: CELL_SIZE * 2, height: CELL_SIZE })
    expect(layout.pages.flatMap((page) => page.ids)).toEqual([...ids].sort())

    const occupied = new Set<string>()
    for (const [id, frame] of Object.entries(layout.frames)) {
      const key = `${frame.page}:${frame.x}:${frame.y}`
      expect(occupied.has(key), id).toBe(false)
      occupied.add(key)
      const page = layout.pages[frame.page]!
      expect(frame.x + frame.width).toBeLessThanOrEqual(page.width)
      expect(frame.y + frame.height).toBeLessThanOrEqual(page.height)
    }
  })

  it('rejects empty and duplicate ids', () => {
    expect(() => layoutFrames([])).toThrow('empty atlas')
    expect(() => layoutFrames(['1', '1'])).toThrow('unique')
  })
})
