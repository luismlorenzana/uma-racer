// The time factor has one home (docs/game/architecture.md#the-rework-modules "Durations are integer seconds", D338): outside
// state/time.ts, no rework area's source writes 1.2 as a number in its code. Everything else imports TIME_FACTOR.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { codeOnly } from '../__fixtures__/code-only'

const SRC = fileURLToPath(new URL('..', import.meta.url))
/** The rework's areas, the shared state among them. */
const AREAS = ['state', 'economy', 'tiers', 'items', 'work', 'farm', 'training', 'check-in', 'planner', 'sim', 'builds']

it('keeps 1.2 out of every rework source but time.ts', () => {
  const sources = AREAS.flatMap((area) => (readdirSync(join(SRC, area), { recursive: true }) as string[]).map((file) => join(area, file)))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts') && file !== join('state', 'time.ts'))
  expect(sources.length).toBeGreaterThan(3)
  const offenders = sources.filter((file) => /(?<![\w.])1\.20*(?![\d.\w])/.test(codeOnly(readFileSync(join(SRC, file), 'utf8'))))
  expect(offenders.map((file) => relative(SRC, join(SRC, file)))).toEqual([])
  expect(/(?<![\w.])1\.20*(?![\d.\w])/.test(codeOnly('const k = 1.2 // fine: 1.2 in a comment'))).toBe(true)
  expect(/(?<![\w.])1\.20*(?![\d.\w])/.test(codeOnly("const speed = 1.25; const s = '1.2'"))).toBe(false)
})
