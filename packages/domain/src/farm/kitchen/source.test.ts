// Lazy boundary regression: new catalogue must not reach existing startup/live barrels.
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('exposes kitchen only through its explicit package entry, not the root or live Farm barrel', () => {
  const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  expect(source('../../index.ts')).not.toMatch(/from ['"].*farm\/kitchen/)
  expect(source('../index.ts')).not.toMatch(/from ['"].*kitchen/)
  const exports = JSON.parse(source('../../../package.json')).exports as Record<string, { default: { default: string } }>
  expect(exports['./farm/kitchen']?.default.default).toBe('./src/farm/kitchen/index.ts')
})
