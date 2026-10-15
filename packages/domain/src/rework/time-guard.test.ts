// The time factor has one home (docs/game/architecture.md#the-rework-modules "Durations are integer seconds", D338): outside
// rework/time.ts, no rework source writes 1.2 as a number in its code. Everything else imports TIME_FACTOR.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { codeOnly } from '../__fixtures__/code-only'

const REWORK = fileURLToPath(new URL('.', import.meta.url))

it('keeps 1.2 out of every rework source but time.ts', () => {
  const sources = (readdirSync(REWORK, { recursive: true }) as string[])
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && file !== 'time.ts')
  expect(sources.length).toBeGreaterThan(3)
  const offenders = sources.filter((file) => /(?<![\w.])1\.20*(?![\d.\w])/.test(codeOnly(readFileSync(join(REWORK, file), 'utf8'))))
  expect(offenders.map((file) => relative(REWORK, join(REWORK, file)))).toEqual([])
  expect(/(?<![\w.])1\.20*(?![\d.\w])/.test(codeOnly('const k = 1.2 // fine: 1.2 in a comment'))).toBe(true)
  expect(/(?<![\w.])1\.20*(?![\d.\w])/.test(codeOnly("const speed = 1.25; const s = '1.2'"))).toBe(false)
})
