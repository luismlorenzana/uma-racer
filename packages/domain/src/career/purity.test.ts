// The career's rules are pure (D383): no clock, no dice of their own, no I/O and no browser globals. Races take their
// randomness from the seeded RNG and the engine the caller hands in.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { codeOnly } from '../__fixtures__/code-only'

const HERE = fileURLToPath(new URL('.', import.meta.url))

describe('purity', () => {
  it('reads no clock, rolls no dice, does no I/O and touches no browser global', () => {
    const sources = readdirSync(HERE).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    expect(sources.length).toBeGreaterThanOrEqual(9)
    for (const file of sources) {
      const code = codeOnly(readFileSync(join(HERE, file), 'utf8'))
      for (const banned of [/Date\.now/, /\bDate\b/, /Math\.random/, /performance\./, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/,
        /indexedDB/, /\bwindow\./, /\bdocument\./, /\bnavigator\./, /\bcrypto\./, /\bprocess\./, /\bconsole\./, /setTimeout/, /setInterval/]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })
})
