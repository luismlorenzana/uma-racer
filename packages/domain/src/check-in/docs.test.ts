// The operations' live block (docs/game/architecture.md#the-rework-modules "The live manual"): rework/13 §6's list,
// rendered from `OPERATIONS` and registered once. docs/docs.test.ts checks the block's body against the page.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { AREA_BLOCKS } from '../docs/render'
import { hasBannedWord } from './words'
import { LIVE_BLOCKS, OPERATION_DOCS } from './docs'
import { OPERATIONS } from './once'

const page = readFileSync(fileURLToPath(new URL('../../../../docs/rework/13-removals-and-plan-changes.md', import.meta.url)), 'utf8')

describe('the operations block', () => {
  it('renders 13 §6 in the page that states it, and joins the registry', () => {
    expect(Object.keys(LIVE_BLOCKS)).toEqual(['operations'])
    expect(page.includes('<!-- live:operations -->')).toBe(true)
    expect(AREA_BLOCKS.operations).toBe(LIVE_BLOCKS.operations)
  })

  it('lists every operation once, in table order, with its line', () => {
    const table = LIVE_BLOCKS.operations!()
    expect(Object.keys(OPERATION_DOCS)).toEqual(Object.keys(OPERATIONS))
    for (const name of Object.keys(OPERATIONS)) expect(table).toContain(`| \`${name}\` |`)
    expect(table).toContain("| `finish-race` | A race's commit: her finished unlocks, Racing EXP, goals, the gate's Shard, Prize Money and the purse | 09 §9, 01 §2 |")
    for (const [what] of Object.values(OPERATION_DOCS)) expect(hasBannedWord(what), what).toBe(false)
  })
})
