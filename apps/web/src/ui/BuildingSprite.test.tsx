// @vitest-environment jsdom
// A place's building in the DOM (docs/game/11-hub-and-places.md §10.3): the atlas frame where the pinned uma-art draws
// it, else the map's code placeholder as SVG in its page's palette, never an empty or white box.
import { placeById } from '@racer/domain/hub'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PALETTES } from '@luismlorenzana/uma-kit/hub'
import { BuildingSprite } from './BuildingSprite'

afterEach(cleanup)

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`

describe('BuildingSprite', () => {
  it('draws a released frame from the atlas, crisp at 2×', () => {
    const { container } = render(<BuildingSprite frame="stable" page="town" />)
    const sprite = container.querySelector<HTMLElement>('[data-sprite="stable"]')!
    expect(sprite.style.imageRendering).toBe('pixelated')
    expect(sprite.style.backgroundPosition).toMatch(/^-\d+px -\d+px$/)
  })

  it.each([['card-library'], ['gym'], ['racecourse'], ['trophy-hall']])('draws %s from the atlas since uma-art 2.6.0 (A01)', (frame) => {
    const place = placeById(frame)!
    const { container } = render(<BuildingSprite frame={place.frame} page={place.page} />)
    expect(container.querySelector(`[data-sprite="${frame}"]`)).not.toBeNull()
    expect(container.querySelector('svg[data-sprite="placeholder"]')).toBeNull()
  })

  it('never draws an empty box: an unknown frame or none is a house in the palette', () => {
    for (const frame of ['nowhere', null]) {
      const { container } = render(<BuildingSprite frame={frame} page="farm" />)
      const fills = [...container.querySelectorAll('svg [fill]')].map((shape) => shape.getAttribute('fill'))
      expect(fills).toContain(hex(PALETTES['farmlands']!.building.wall))
      cleanup()
    }
  })
})
