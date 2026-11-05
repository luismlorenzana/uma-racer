// The stages' live blocks (D384, D385): the grades, the games, the sim's bands, Training Yard's numbers and Furlong
// Hand's grade map, pay, numbers and abilities, each joined to the registry. docs/docs.test.ts checks the pages.
import { describe, expect, it } from 'vitest'
import { AREA_BLOCKS } from '../docs/render'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual([
      'furlong-abilities', 'furlong-grades', 'furlong-numbers', 'furlong-pay', 'stage-bands', 'stage-games', 'stage-grades', 'yard-ladder', 'yard-numbers',
    ])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(render()).toMatch(/^\| .+ \|\n\|---/)
      expect(AREA_BLOCKS[key]).toBe(render)
    }
  })

  it('names the ladders and the games', () => {
    expect(LIVE_BLOCKS['stage-grades']!()).toContain('| S | 1.2 or more, or A with every task | 1.2 |')
    expect(LIVE_BLOCKS['stage-grades']!()).toContain('| D | under 0.5 | 0.25 |')
    expect(LIVE_BLOCKS['stage-games']!()).toContain('| Furlong Hand | 1 | 25 Bond, 20 SP | yes |')
    expect(LIVE_BLOCKS['furlong-grades']!()).toContain('| 3rd | 0.75 | B |')
    expect(LIVE_BLOCKS['furlong-grades']!()).toContain('| 6th | 0.375 | D |')
    expect(LIVE_BLOCKS['furlong-pay']!()).toContain('| A | 25 | 20, and each Partner\'s SP Bonus the first time it plays |')
    expect(LIVE_BLOCKS['yard-ladder']!()).toContain('| Gold | merging three silver | 36 |')
  })
})
