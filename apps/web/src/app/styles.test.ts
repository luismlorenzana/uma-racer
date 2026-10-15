// The new game's styles (docs/game/11-hub-and-places.md §4, §12; CLAUDE.md "Conventions"): only transform and opacity
// move, a HUD number slides by a transition (never a spring), and reduced motion, from the system or Account's switch,
// stills the Ready pip's bounce and the numbers' slide.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(fileURLToPath(new URL('./g2.css', import.meta.url)), 'utf8')

describe('g2.css', () => {
  it('animates transform and opacity only', () => {
    expect(css).toContain('@keyframes g2-pip-bounce')
    for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)) {
      for (const [, property] of body!.matchAll(/^\s*([\w-]+)\s*:/gm)) expect(['transform', 'opacity']).toContain(property)
    }
    for (const [, list] of css.matchAll(/transition:\s*([\s\S]*?);/g)) {
      for (const part of list!.split(',').map((entry) => entry.trim().split(/\s+/)[0])) expect(['transform', 'opacity', 'none']).toContain(part)
    }
  })

  it('stills the bounce and the slide under reduced motion, from the device switch and the system alike', () => {
    expect(css).toMatch(/\[data-reduced-motion\] \.g2-pip-ready \{\s*animation: none;/)
    expect(css).toMatch(/\[data-reduced-motion\] \.g2-number,[\s\S]*?\{\s*transform: none;\s*opacity: 1;\s*transition: none;/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.g2-pip-ready \{\s*animation: none;/)
  })
})
