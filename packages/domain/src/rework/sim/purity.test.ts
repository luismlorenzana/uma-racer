// The loop simulation is pure (docs/tasks/M033-rework-rules.md "Pure"): no clock, no randomness but the RNG it is
// handed, no I/O, and nothing live imports it.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { codeOnly } from '../../__fixtures__/code-only'
import { localDay, loopRng, LOOP_EPOCH, MS_PER_DAY } from './clock'
import { mulberry32 } from '../../__fixtures__/rework-races'

const HERE = fileURLToPath(new URL('.', import.meta.url))

it('reads no clock, rolls no dice of its own and does no I/O', () => {
  const sources = readdirSync(HERE).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  expect(sources.length).toBeGreaterThan(8)
  for (const file of sources) {
    const code = codeOnly(readFileSync(join(HERE, file), 'utf8'))
    for (const banned of [/Date\.now/, /new Date\b/, /Math\.random/, /from 'node:/, /\brequire\(/, /\bfetch\(/, /\bprocess\./, /\bconsole\./]) {
      expect(banned.test(code), `${file} uses ${banned}`).toBe(false)
    }
  }
})

it("rolls the race engine's mulberry32", () => {
  const ours = loopRng(132), engine = mulberry32(132)
  for (let i = 0; i < 100; i += 1) expect(ours.next()).toBe(engine.next())
})

it('names the local day from the timestamp alone', () => {
  expect(localDay(LOOP_EPOCH)).toBe('2027-01-04')
  expect(localDay(LOOP_EPOCH + MS_PER_DAY - 1)).toBe('2027-01-04')
  expect(localDay(LOOP_EPOCH + 59 * MS_PER_DAY)).toBe('2027-03-04')
  expect(localDay(LOOP_EPOCH + 365 * MS_PER_DAY)).toBe('2028-01-04')
  expect(localDay(Date.UTC(2028, 1, 29))).toBe('2028-02-29')
})
