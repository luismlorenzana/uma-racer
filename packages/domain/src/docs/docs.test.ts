// Keeps the live manual (docs/game/, D337) true to the rules: every `<!-- live:<key> -->` block must equal what
// `render.ts` makes of the code today. When a rule changes, run `pnpm docs:update` (UPDATE_DOCS=1) to rewrite the blocks.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { loopReport } from '../sim/report'
import { renderBlock, type PackageJson } from './render'

// The loop simulation's blocks read one run per worker (T132); make it before the tests, not inside one's timeout.
beforeAll(() => { loopReport() }, 120_000)

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
// The manual: its own pages and the rework pages moved into it as built (T143).
const DOCS = join(ROOT, 'docs', 'game')
// What stays of the rework's folder: Expeditions (phase 9) and the plan, whose §6 lists the operations live.
const REWORK = join(ROOT, 'docs', 'rework')
const BLOCK = /<!-- live:([a-z0-9-]+) -->\n[\s\S]*?<!-- \/live -->/g
const PACKAGES = ['package.json', 'apps/web/package.json', 'apps/api/package.json', 'packages/domain/package.json', 'packages/race/package.json']
const packages = PACKAGES.map((path) => ({ path, json: JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as PackageJson }))

/** A page with every live block rendered fresh; unknown keys are reported. */
function refresh(text: string, unknown: string[]): string {
  return text.replace(BLOCK, (_, key: string) => {
    const body = renderBlock(key, { packages })
    if (body === null) { unknown.push(key); return `<!-- live:${key} -->\n<!-- /live -->` }
    return `<!-- live:${key} -->\n${body}\n<!-- /live -->`
  })
}

describe('live manual (D337)', () => {
  const pages = (dir: string) => readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => join(dir, f))
  const files = [...pages(DOCS), ...pages(REWORK)]

  it.each([['docs/game', DOCS], ['docs/rework', REWORK]])('%s has pages with live blocks', (_, dir) => {
    expect(pages(dir).length).toBeGreaterThan(2)
    expect(pages(dir).some((f) => readFileSync(f, 'utf8').includes('<!-- live:'))).toBe(true)
  })

  it.each(files.map((f) => [relative(ROOT, f), f]))('%s matches the rules (run `pnpm docs:update` to update)', (_, file) => {
    const text = readFileSync(file, 'utf8')
    const unknown: string[] = []
    const fresh = refresh(text, unknown)
    expect(unknown, 'unknown live blocks').toEqual([])
    if (process.env.UPDATE_DOCS && fresh !== text) writeFileSync(file, fresh)
    else expect(fresh === text, `${relative(ROOT, file)} is stale: run \`pnpm docs:update\``).toBe(true)
  })
})
