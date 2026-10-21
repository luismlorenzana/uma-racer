// @vitest-environment jsdom
// A04: every tonic uses its published frame at row, chip and shelf sizes (game/11 §10.3).
import { cleanup, render, screen } from '@testing-library/react'
import { TONICS } from '@racer/domain/items'
import { afterEach, describe, expect, it } from 'vitest'
import { ItemIcon, itemFrame } from './ItemIcon'

afterEach(cleanup)

describe('published tonic icons', () => {
  it.each([0.5, 0.75, 1, 2] as const)('draws every grade at scale %s, with its own frame and accessible name', (scale) => {
    const positions = new Set<string>()
    for (const tonic of TONICS) {
      const frame = itemFrame(tonic)
      expect(frame?.atlas).toBe('items')
      render(<ItemIcon item={tonic.id} scale={scale} />)
      const icon = screen.getByRole('img', { name: `${tonic.name}, grade ${tonic.grade}` })
      expect(icon.getAttribute('data-sprite')).toBe('items')
      expect(icon.style.width).toBe(`${32 * scale}px`)
      expect(icon.style.height).toBe(`${32 * scale}px`)
      expect(icon.style.backgroundPosition).toBe(`${-frame!.x * scale}px ${-frame!.y * scale}px`)
      expect(icon.style.imageRendering).toBe('pixelated')
      positions.add(icon.style.backgroundPosition)
      cleanup()
    }
    expect(positions.size).toBe(10)
  })

  it('hides decorative icons from VoiceOver while preserving the sprite', () => {
    const { container } = render(<ItemIcon item="tonic-1" decorative />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
    expect(container.firstElementChild?.getAttribute('data-sprite')).toBe('items')
  })
})
