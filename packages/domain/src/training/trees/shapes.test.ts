// The re-authored silhouettes (docs/rework/05-training-hub.md §4) and the area's purity.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CONSTELLATION_SHAPES } from '../../constellation'
import { parseShapeArt } from '../../constellation-shapes'
import { TREE_ART, TREE_MOTIFS, TREE_SHAPES, treeShape } from './shapes'
import { treeCardNodesAt } from './sizes'

describe('silhouettes', () => {
  it("keep today's shape ids, one per scenario", () => {
    expect(TREE_SHAPES).toEqual(CONSTELLATION_SHAPES.map((def) => def.shape))
    expect(treeShape(1)).toBe('single-trunk')
    expect(treeShape(14)).toBe('counter')
    expect(() => treeShape(15)).toThrow(RangeError)
  })

  it('draw exactly each tree’s card nodes, D235’s tips gone', () => {
    for (const [i, art] of TREE_ART.entries()) expect(parseShapeArt(art).cells).toHaveLength(treeCardNodesAt(i + 1))
  })

  it('name every motif, the 15th included', () => {
    expect(TREE_MOTIFS).toHaveLength(15)
    expect(TREE_MOTIFS[5]).toBe('The arch: a lintel of 2 either side of the keystone root, two legs of 4')
    expect(TREE_MOTIFS[13]).toBe('A counter of 8 under the root, eight pendants alternating 1 and 3 long')
    expect(TREE_MOTIFS[14]).toMatch(/^Drawn when it ships/)
  })
})

function productionSources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : []
  })
}

describe('purity', () => {
  it('reads no clock, randomness, I/O or browser globals', () => {
    const sources = productionSources(fileURLToPath(new URL('.', import.meta.url)))
    expect(sources.length).toBeGreaterThan(4)
    for (const path of sources) {
      const source = readFileSync(path, 'utf8')
      expect(source, path).not.toMatch(/from 'node:|from 'react|from 'dexie/)
      for (const global of ['Date.now', 'Math.random', 'window', 'document', 'localStorage', 'fetch']) {
        expect(source, path).not.toMatch(new RegExp(`\\b${global.replace('.', '\\.')}\\b`))
      }
    }
  })
})
