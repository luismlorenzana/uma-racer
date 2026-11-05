// The build's live blocks (docs/game/architecture.md "The live manual"): the tables docs/game/05-the-build.md and
// 06-cards-and-bonds.md show. docs/docs.test.ts checks the pages against them.
import { describe, expect, it } from 'vitest'
import { AREA_BLOCKS } from '../docs/render'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual([
      'build-deck-bands', 'build-dropped-uniques', 'build-facilities', 'build-hint-discounts', 'build-pip-costs', 'build-rules',
    ])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(AREA_BLOCKS[key]).toBe(render)
      if (key !== 'build-dropped-uniques') expect(render()).toMatch(/^\| .+ \|\n\|---/)
    }
  })

  it('names the rules\' numbers', () => {
    expect(LIVE_BLOCKS['build-facilities']!()).toContain('| **Speed** | 1 | 11 | | 6 | | | 4 |')
    expect(LIVE_BLOCKS['build-facilities']!()).toContain('| | 5 | 4 | | | | 14 | 5 |')
    expect(LIVE_BLOCKS['build-pip-costs']!()).toContain('| 5 | 28 drills | 112 drills |')
    expect(LIVE_BLOCKS['build-hint-discounts']!()).toContain('| 5 | 40% | 60 SP |')
    expect(LIVE_BLOCKS['build-rules']!()).toContain('| The scale s(T) | T1: 1 |')
    expect(LIVE_BLOCKS['build-deck-bands']!()).toContain('| Median, bonded | 55%–77% | 3,300–4,620 |')
  })
})
