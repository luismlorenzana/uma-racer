// @vitest-environment jsdom
// A place's building in the DOM (docs/game/11-hub-and-places.md §10.3): the atlas frame where the pinned uma-art draws
// it, else the map's code placeholder as SVG in its page's palette, never an empty or white box.
import { AWAITING_ART, placeById } from '@racer/domain/hub'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PALETTES } from '../hub/scene/palettes'
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

  it.each(AWAITING_ART.map((frame) => [frame]))("draws %s, which the pinned art lacks, as its placeholder in its page's palette", (frame) => {
    const place = placeById(frame)!
    const { container } = render(<BuildingSprite frame={place.frame} page={place.page} />)
    const svg = container.querySelector('svg[data-sprite="placeholder"]')!
    expect(svg.getAttribute('data-frame')).toBe(frame)
    const fills = [...svg.querySelectorAll('[fill]')].map((shape) => shape.getAttribute('fill'))
    expect(fills.length).toBeGreaterThan(10)
    const { wall, roof } = PALETTES[place.page].building
    expect(fills).toContain(hex(wall))
    expect(fills).toContain(hex(roof))
    expect(new Set(fills).size).toBeGreaterThan(3)
  })

  it('never draws an empty box: an unknown frame or none is a house in the palette', () => {
    for (const frame of ['nowhere', null]) {
      const { container } = render(<BuildingSprite frame={frame} page="farm" />)
      const fills = [...container.querySelectorAll('svg [fill]')].map((shape) => shape.getAttribute('fill'))
      expect(fills).toContain(hex(PALETTES.farm.building.wall))
      cleanup()
    }
  })
})
