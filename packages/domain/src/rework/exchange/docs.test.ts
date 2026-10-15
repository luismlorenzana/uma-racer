// The Exchange's live blocks (docs/game/architecture.md#the-rework-modules): the four tables of rework/09 this area owns.
// docs/docs.test.ts checks the page against them.
import { describe, expect, it } from 'vitest'
import { REWORK_BLOCKS } from '../../docs/rework'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render the four tables this area owns, and join the registry', () => {
    expect(Object.keys(LIVE_BLOCKS).sort()).toEqual(['exchange-prices', 'prize-table', 'purse-bands', 'sell-values'])
    for (const [key, render] of Object.entries(LIVE_BLOCKS)) {
      expect(render()).toMatch(/^\| .+ \|\n\|---/)
      expect(REWORK_BLOCKS[key]).toBe(render)
    }
  })

  it('render 09 §2.1, §3.3, §5.3 and §6 as the page states them', () => {
    expect(LIVE_BLOCKS['prize-table']!()).toContain('| Debut, Maiden | 60 | 24 | 12 | 6 | 3 | 0 |')
    expect(LIVE_BLOCKS['prize-table']!()).toContain('| G3 | 150 | 60 | 30 | 15 | 7 | 0 |')
    expect(LIVE_BLOCKS['purse-bands']!()).toContain('| Tired | 4,500 – 12,000 | 25% |')
    expect(LIVE_BLOCKS['exchange-prices']!()).toContain('| Price | 108 | 114 | 120 | 126 | 132 | 138 | 144 | 150 | 156 | 162 |')
    expect(LIVE_BLOCKS['sell-values']!()).toContain('| 4 | 126 | 42 | 157.5 | 52 | 1,096.5 | 365 |')
  })
})
