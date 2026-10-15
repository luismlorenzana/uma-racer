// Plain words (T136; docs/rework/02-check-ins-and-notifications.md §9): every failure says one of 02 §9's sentences, a
// refusal says its rule's own words, and no sentence in `g2/save` holds a banned word, a code or a status number.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CHECK_IN_WORDS, fill, hasBannedWord, say } from '@racer/domain/rework/check-in'
import { describe, expect, it } from 'vitest'
import type { SaveFailure } from './api'
import { failureWords, refusalWords, SAVE_WORDS, sentence, unexpectedWords } from './words'

const FAILURES: readonly SaveFailure[] = ['offline', 'auth', 'upgrade', 'no-save', 'unavailable', 'server', 'invalid']
/** 02 §9's sentences, as the check-in's table holds them. */
const SECTION_9 = [CHECK_IN_WORDS.offline, CHECK_IN_WORDS.unexpected, CHECK_IN_WORDS['already-collected']]

const HERE = fileURLToPath(new URL('.', import.meta.url))

/** Every string literal of a source, with its `${…}` holes taken out. */
function literals(source: string): string[] {
  const code = source.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  return [...code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)]
    .map((match) => (match[1] ?? match[2] ?? match[3] ?? '').replace(/\$\{[^}]*\}/g, ''))
}

describe('plain words', () => {
  it("maps every failure to one of 02 §9's sentences", () => {
    expect(failureWords('offline')).toBe("Saved on this phone. It'll sync when you're back online.")
    for (const failure of FAILURES.filter((kind) => kind !== 'offline')) expect(failureWords(failure)).toBe("That didn't work. Try again.")
    for (const failure of FAILURES) {
      expect(SECTION_9).toContain(failureWords(failure))
      expect(hasBannedWord(failureWords(failure))).toBe(false)
    }
    expect(Object.values(SAVE_WORDS).sort()).toEqual([...SECTION_9].sort())
    expect(sentence(unexpectedWords())).toBe(CHECK_IN_WORDS.unexpected)
  })

  it("says a refusal in its rule's words, filled from its data", () => {
    const words = refusalWords({ refused: true, code: 'busy', reason: '{uma} is busy until {time}.', data: { uma: 'Kitasan Black', time: '18:30' } })
    expect(words).toEqual(say('{uma} is busy until {time}.', { uma: 'Kitasan Black', time: '18:30' }))
    expect(sentence(words)).toBe(fill(words))
    expect(sentence(words)).toBe('Kitasan Black is busy until 18:30.')
  })

  it('holds no banned word, code or status number in any sentence of g2/save', () => {
    const sources = readdirSync(HERE).filter((file) => /\.tsx?$/.test(file) && !/\.test(-support)?\.tsx?$/.test(file))
    expect(sources).toEqual(expect.arrayContaining(['words.ts', 'sync.ts', 'boot.ts', 'actions.ts', 'index.ts']))
    const prose = sources.flatMap((file) => literals(readFileSync(`${HERE}${file}`, 'utf8')).filter((text) => /^[A-Z][^]* /.test(text)).map((text) => [file, text]))
    expect(prose.length).toBeGreaterThan(3)
    expect(prose.filter(([, text]) => hasBannedWord(text!))).toEqual([])
  })
})
