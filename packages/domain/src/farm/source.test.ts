// Stable Farm domain rules stay pure and deterministic (docs/design/farm.md, T082).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function productionSources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return productionSources(path)
    return path.endsWith('.ts') && !path.endsWith('.test.ts') ? [path] : []
  })
}

describe('Farm domain source boundary', () => {
  it('contains no I/O, framework, browser, clock, or ambient randomness dependencies', () => {
    const root = fileURLToPath(new URL('.', import.meta.url))
    const dependencies = ['node:', 'react', 'dexie', 'pixi.js', 'zustand']
    const globals = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'Date.now', 'Math.random']
    for (const path of productionSources(root)) {
      const source = readFileSync(path, 'utf8')
      for (const dependency of dependencies) expect(source, path).not.toContain(`from '${dependency}`)
      // Whole identifiers: transport properties such as `documents` are not the browser's `document` global.
      for (const global of globals) expect(source, path).not.toMatch(new RegExp(`\\b${global.replaceAll('.', '\\.')}\\b`))
    }
  })
})
