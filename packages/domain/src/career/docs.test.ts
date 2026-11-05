// The career's live blocks (D383): the calendar, the seasons, the URA Finals, the rewards, the pay, the targets and the
// rivals by season, each joined to the registry. docs/docs.test.ts checks the pages against them.
import { describe, expect, it } from 'vitest'
import { AREA_BLOCKS } from '../docs/render'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual([
      'career-calendar', 'career-finale', 'career-pay', 'career-rewards', 'career-seasons', 'career-targets', 'rival-seasons',
    ])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(render()).toMatch(/^\| .+ \|\n\|---/)
      expect(AREA_BLOCKS[key]).toBe(render)
    }
  })

  it('names the calendar, the rounds and the pay', () => {
    expect(LIVE_BLOCKS['career-calendar']!()).toContain('| 5 (cherry blossom) | Spring |')
    expect(LIVE_BLOCKS['career-seasons']!()).toContain('| Finale | 12 | (Furlong Hand only) |')
    expect(LIVE_BLOCKS['career-finale']!()).toContain('| URA Finals Final | G1 | 10% |')
    expect(LIVE_BLOCKS['career-pay']!()).toContain('| Training Yard | 200 | | 30 |')
    expect(LIVE_BLOCKS['rival-seasons']!()).toContain('| Finale | 1.000 | 559 |')
  })
})
