import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Spark Rival deterministic source boundary', () => {
  it('contains no ambient random calls in the engine or simulator', () => {
    const sources = [
      'board.ts', 'combat.ts', 'engine.ts', 'fixtures.ts', 'rng.ts', 'types.ts',
    ].map((name) => readFileSync(new URL(name, import.meta.url), 'utf8'))
    sources.push(readFileSync(new URL('../../../../../../scripts/sim/spark-balance.ts', import.meta.url), 'utf8'))
    const banned = ['Math', 'random'].join('.')
    for (const source of sources) expect(source).not.toContain(banned)
  })
})
