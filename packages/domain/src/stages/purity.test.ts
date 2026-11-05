// The stages are pure (D384): no clock, no dice of their own, no I/O, no browser global, and none of the maths that
// can differ between JavaScriptCore and V8 (`Math.pow`, `**`, `Math.sin` and kin), so a play replays alike on the phone
// and on the server. A seeded play repeats itself exactly and never writes into its inputs.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { codeOnly } from '../__fixtures__/code-only'
import { deepFreeze } from '../__fixtures__/g3'
import { yardConfig } from '../__fixtures__/stages'
import { playBot } from './sim'
import { YARD_RULES } from './yard'

const HERE = fileURLToPath(new URL('.', import.meta.url))

const sources = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name)
  if (statSync(path).isDirectory()) return sources(path)
  return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : []
})

describe('purity', () => {
  it('reads no clock, rolls no dice, does no I/O, touches no browser global and keeps to + − × ÷', () => {
    const files = sources(HERE)
    expect(files.length).toBeGreaterThanOrEqual(11)
    for (const file of files) {
      const code = codeOnly(readFileSync(file, 'utf8'))
      for (const banned of [/Date\.now/, /\bDate\b/, /Math\.random/, /performance\./, /from 'node:/, /\brequire\(/, /\bfetch\(/, /localStorage/,
        /indexedDB/, /\bwindow\./, /\bdocument\./, /\bnavigator\./, /\bcrypto\./, /\bprocess\./, /\bconsole\./, /setTimeout/, /setInterval/,
        /Math\.(pow|sin|cos|tan|exp|log|sqrt|cbrt|atan|asin|acos|hypot)/, /\*\*/]) {
        expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
      }
    }
  })

  it('repeats a play exactly, and never writes into its config or states', () => {
    const run = () => {
      const config = deepFreeze(yardConfig({ seed: 77 }))
      let state = deepFreeze(YARD_RULES.init(config))
      const { inputs } = playBot(YARD_RULES, config, 'expert', 3)
      for (const input of inputs) state = deepFreeze(YARD_RULES.step(state, input)!)
      return { inputs, state }
    }
    expect(run()).toEqual(run())
  })
})
