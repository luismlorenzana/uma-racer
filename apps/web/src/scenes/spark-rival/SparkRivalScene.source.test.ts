import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('production Spark Rival scene boundary', () => {
  it('contains no synthetic encounter or proof automation', () => {
    const source = readFileSync(fileURLToPath(new URL('./SparkRivalScene.ts', import.meta.url)), 'utf8')
    expect(source).not.toMatch(/syntheticSparkEncounter|playBestAdjacentDemo|toggleHeldDemo|bestAdjacentAction|Proof reset/)
  })
})
