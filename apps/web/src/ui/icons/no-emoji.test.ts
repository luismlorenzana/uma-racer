// No emoji in the product (T032, docs/design/visual-system.md#iconography): the original icon set carries every symbol.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../..', import.meta.url))
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u
// Symbol-font glyphs standing in for icons: technical, geometric, miscellaneous symbols, dingbats, and the single
// guillemets once used as chevrons. The star stays as text in ratings like "3★".
const GLYPH = /[\u2300-\u23ff\u25a0-\u25ff\u2600-\u2604\u2606-\u27bf\u2b00-\u2bff\u219d\u21e5\u2039\u203a]/u
const GLYPH_EXEMPT = ['ui/minigames/']

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === '__snapshots__' ? [] : sources(path)
    return /\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : []
  })
}

function offenders(pattern: RegExp, exempt: readonly string[] = []) {
  const found: string[] = []
  for (const file of sources(SRC)) {
    const name = relative(SRC, file)
    if (exempt.some((prefix) => name.startsWith(prefix))) continue
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      const match = line.match(pattern)
      if (match) found.push(`${name}:${index + 1} ${match[0]}`)
    })
  }
  return found
}

describe('no emoji', () => {
  it('finds no emoji anywhere in the app source', () => {
    expect(offenders(EMOJI)).toEqual([])
  })

  it('finds no symbol-font glyph standing in for an icon', () => {
    expect(offenders(GLYPH, GLYPH_EXEMPT)).toEqual([])
  })
})
