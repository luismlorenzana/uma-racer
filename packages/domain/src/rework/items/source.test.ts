// The item rules stay pure data (docs/tasks/M033-rework-rules.md "Pure", "Art ids"): no I/O, clock, randomness or
// framework, and only tests read the art package, so it never reaches the built package.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const SOURCES = readdirSync(ROOT).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts')).map((name) => join(ROOT, name))

it('imports nothing impure and never the art package outside tests', () => {
  expect(SOURCES.length).toBeGreaterThan(5)
  for (const path of SOURCES) {
    const source = readFileSync(path, 'utf8')
    for (const banned of ['node:', 'react', 'dexie', '@luismlorenzana/uma-art']) expect(source, path).not.toContain(`from '${banned}`)
    for (const global of ['window', 'document', 'localStorage', 'Date.now', 'Math.random']) {
      expect(source, path).not.toMatch(new RegExp(`\\b${global.replaceAll('.', '\\.')}\\b`))
    }
    // Imports stay inside rework/items, plus the time conversion and today's stat types.
    for (const [, from] of source.matchAll(/from '([^']+)'/g)) {
      expect(['../time', '../../types'].includes(from!) || from!.startsWith('./'), `${path}: ${from}`).toBe(true)
    }
  }
})
