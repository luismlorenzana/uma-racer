// Plain words (T136, T152; D157): every failure says one of two sentences, a refusal says its rule's own words, and no
// sentence in `save/` holds a banned word, a code or a status number.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SaveFailure } from './api'
import { failureWords, hasBannedWord, refusalWords, SAVE_WORDS } from './words'

const FAILURES: readonly SaveFailure[] = ['offline', 'auth', 'upgrade', 'no-save', 'unavailable', 'server', 'invalid']

const HERE = fileURLToPath(new URL('.', import.meta.url))

/** Every string literal of a source, with its `${…}` holes taken out. */
function literals(source: string): string[] {
  const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)]
    .map((match) => (match[1] ?? match[2] ?? match[3] ?? '').replace(/\$\{[^}]*\}/g, ''))
}

describe('plain words', () => {
  it('maps every failure to one of two sentences', () => {
    expect(failureWords('offline')).toBe("Saved on this phone. It'll sync when you're back online.")
    for (const failure of FAILURES.filter((kind) => kind !== 'offline')) expect(failureWords(failure)).toBe("That didn't work. Try again.")
    for (const failure of FAILURES) {
      expect(Object.values(SAVE_WORDS)).toContain(failureWords(failure))
      expect(hasBannedWord(failureWords(failure))).toBe(false)
    }
  })

  it("says a refusal in its rule's words", () => {
    expect(refusalWords({ refused: true, code: 'no-tickets', reason: 'You have no Uma Tickets left.' })).toBe('You have no Uma Tickets left.')
  })

  it('knows the banned words', () => {
    expect(['Sync failed.', 'A stale receipt.', 'Error 500.', 'Operation refused.'].map(hasBannedWord)).toEqual([true, true, true, true])
    expect(hasBannedWord('Saved on this phone.')).toBe(false)
  })

  it('holds no banned word, code or status number in any sentence of save/', () => {
    const sources = readdirSync(HERE).filter((file) => /\.tsx?$/.test(file) && !/\.test(-support)?\.tsx?$/.test(file))
    expect(sources).toEqual(expect.arrayContaining(['words.ts', 'sync.ts', 'boot.ts', 'actions.ts', 'index.ts']))
    const prose = sources.flatMap((file) => literals(readFileSync(`${HERE}${file}`, 'utf8')).filter((text) => /^[A-Z][^]* /.test(text)).map((text) => [file, text]))
    expect(prose.length).toBeGreaterThan(3)
    expect(prose.filter(([, text]) => hasBannedWord(text!))).toEqual([])
  })
})
