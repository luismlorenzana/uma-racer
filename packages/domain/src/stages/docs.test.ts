// The stages' live blocks (D384): the grades, the games, the sim's bands and Training Yard's numbers, each joined to the
// registry. docs/docs.test.ts checks the pages against them.
import { describe, expect, it } from 'vitest'
import { AREA_BLOCKS } from '../docs/render'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual(['stage-bands', 'stage-games', 'stage-grades', 'yard-ladder', 'yard-numbers'])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(render()).toMatch(/^\| .+ \|\n\|---/)
      expect(AREA_BLOCKS[key]).toBe(render)
    }
  })

  it('names the ladders and the games', () => {
    expect(LIVE_BLOCKS['stage-grades']!()).toContain('| S | 1.2 or more, or A with every task | 1.2 |')
    expect(LIVE_BLOCKS['stage-grades']!()).toContain('| D | under 0.5 | 0.25 |')
    expect(LIVE_BLOCKS['stage-games']!()).toContain('| Furlong Hand | | 25 Bond, 20 SP | not yet |')
    expect(LIVE_BLOCKS['yard-ladder']!()).toContain('| Gold | merging three silver | 36 |')
  })
})
