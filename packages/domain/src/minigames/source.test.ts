// Pure minigame engines must stay independent of rendering, persistence and browser runtimes (D185).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return path.endsWith('.ts') && !path.endsWith('source.test.ts') ? [path] : []
  })
}

describe('minigame domain boundary', () => {
  it('does not import UI, storage, or browser runtime dependencies', () => {
    const root = fileURLToPath(new URL('.', import.meta.url))
    const packages = ['re' + 'act', 'pixi' + 'js', 'dex' + 'ie']
    const globals = ['win' + 'dow', 'docu' + 'ment', 'navi' + 'gator', 'local' + 'Storage', 'session' + 'Storage']

    for (const path of sourceFiles(root)) {
      const source = readFileSync(path, 'utf8')
      for (const dependency of packages) {
        expect(source, path).not.toMatch(new RegExp(`(?:from\\s+|import\\s*(?:\\(\\s*)?)['\"]${dependency.replace('.', '\\.')}`))
      }
      for (const global of globals) expect(source, path).not.toMatch(new RegExp(`\\b${global}\\b`))
    }
  })
})
