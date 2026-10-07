import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Puzzle pure source boundary', () => {
  it('does not depend on randomness, time, rendering, networking or persistence', () => {
    for (const name of ['rules', 'validation', 'types', 'identity', 'progression', 'materials', 'bank', 'legacy', 'index']) {
      const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), 'utf8')
      expect(source).not.toMatch(/Math\.random|Date\.now|new Date\(|performance\.now|\bfetch\(|\bdocument\.|\bwindow\./)
      expect(source).not.toMatch(/from ['"](?:react|dexie|pixi\.js|zustand|node:|.*apps\/)/)
    }
  })
})
