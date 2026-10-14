// The re-authored trees' live blocks in docs/rework/05-training-hub.md §4: the table keeps 05's sizes and caps, and
// every drawing is shown. The live manual's check (src/docs/docs.test.ts) compares the page itself with them.
import { describe, expect, it } from 'vitest'
import { LIVE_BLOCKS } from './docs'

describe('live blocks', () => {
  it('render 05 §4’s tree table with its sizes and caps', () => {
    const rows = LIVE_BLOCKS['constellation-trees']!().split('\n')
    expect(rows[0]).toBe('| # | Scenario | Tier · scenario | Nodes | Per-card cap | How the motif adapts |')
    expect(rows).toHaveLength(2 + 15)
    const cells = rows.slice(2).map((row) => row.split(' | ').slice(0, 5).join(' | '))
    expect(cells).toEqual([
      '| 1 | URA Finale | 1 · 1 | 12 | 3',
      '| 2 | Unity Cup | 1 · 2 | 16 | 4',
      '| 3 | Trackblazer | 1 · 3 | 20 | 5',
      '| 4 | Our Grand Concert | 1 · 4 | 24 | 5',
      '| 5 | Grand Masters | 1 · 5 | 28 | 6',
      "| 6 | Project L'Arc | 2 · 1 | 12 | 3",
      '| 7 | U.A.F. Ready GO! | 2 · 2 | 16 | 4',
      '| 8 | Great Food Festival | 2 · 3 | 20 | 5',
      '| 9 | Run! Mecha Umamusume | 2 · 4 | 24 | 5',
      '| 10 | The Twinkle Legends | 2 · 5 | 28 | 6',
      '| 11 | Design Your Island | 3 · 1 | 12 | 3',
      '| 12 | Yukoma Hot Springs | 3 · 2 | 16 | 4',
      '| 13 | Beyond Dreams | 3 · 3 | 20 | 5',
      '| 14 | Tracen Diner | 3 · 4 | 24 | 5',
      "| 15 | Japan's 15th scenario | 3 · 5 | 28 | 6",
    ])
  })

  it('render every drawing as a fenced block under its scenario', () => {
    const art = LIVE_BLOCKS['constellation-art']!()
    expect(art.match(/```text\n/g)).toHaveLength(14)
    expect(art.startsWith('**1 · URA Finale** · 12 card nodes\n\n```text\n  R\n')).toBe(true)
    expect(art).toContain('**14 · Tracen Diner** · 24 card nodes')
    expect(art).not.toMatch(/<!-- \/live -->/)
  })
})
