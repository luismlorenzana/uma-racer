// The builds against the field's live blocks (T133): the four tables of rework/03 §9, /04 §8 and /05 §12 this area
// owns, rendered from the committed reports. docs/docs.test.ts checks each page against them.
import { describe, expect, it } from 'vitest'
import { AREA_BLOCKS } from '../docs/render'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual(['rework-buff-typical', 'rework-career-rates', 'rework-g1-rates', 'rework-ladder'])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(render()).toMatch(/^\| .+ \|\n\|---/)
      expect(render().split('\n')).toHaveLength(2 + 14)
      expect(AREA_BLOCKS[key]).toBe(render)
    }
  })

  it('state the pages\' numbers', () => {
    expect(LIVE_BLOCKS['rework-buff-typical']!()).toContain('| 1 | URA Finale | Foundation | 4.0% | 3.3% | **3.3%** |')
    expect(LIVE_BLOCKS['rework-buff-typical']!()).toContain('| 2 | Unity Cup | Team Spirit | 3.7% | 3.5% | 3.7% |')
    expect(LIVE_BLOCKS['rework-ladder']!()).toContain('| 1 | URA Finale | 165 · 561 · 561 · 759 · 1,014 · 1,200 | **Accepted (D350):** Extra Stats into stamina run 1,800 m; **Accepted (D350):** a Power card runs 2,400 m |')
    expect(LIVE_BLOCKS['rework-career-rates']!()).toContain('| 1 | URA Finale | 100 · 100 · 100 · 100 | 100 · 100 · 100 · 100 | 95 · 95 · 100 · 100 | met |')
    expect(LIVE_BLOCKS['rework-g1-rates']!()).toMatch(/^\| T \| Scenario \| Sprint 1,400 m \| Mile 1,600 m \| Medium 2,400 m \| Long 3,000 m \|/)
  })
})
