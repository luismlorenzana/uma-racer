// Cache and refusal behavior retained while switching the source to platform releases (SE1).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { masterFixture } from '../master/master.test-support'
import { ContentUnavailable, MANIFEST_TTL_MS, OperationContent } from './operation-content'

afterEach(() => { delete process.env.DEV_OPERATIONS })
describe('operation content snapshots', () => {
  it('loads once concurrently, caches by both versions, refreshes pointers and applies the dev switch only on demand', async () => {
    const F = await masterFixture()
    let now = 100, version = F.index.version
    const source = { snapshot: vi.fn(async () => ({ manifest: F.release.manifest, overlay: { ...F.index, version } })), load: vi.fn(async () => F.adapted) }
    const loader = new OperationContent(source, () => now)
    const values = await Promise.all([loader.env(), loader.env(), loader.env()])
    expect(new Set(values.map((env) => env.content)).size).toBe(1)
    expect(source.load).toHaveBeenCalledTimes(1)
    now += MANIFEST_TTL_MS
    await loader.env()
    expect(source.snapshot).toHaveBeenCalledTimes(2)
    expect(source.load).toHaveBeenCalledTimes(1)
    version = 'b'.repeat(12); now += MANIFEST_TTL_MS
    await loader.env()
    expect(source.load).toHaveBeenCalledTimes(2)
    process.env.DEV_OPERATIONS = 'true'
    expect((await loader.env()).dev).toBe(true)
  })
  it('returns the generic 503 cause and retries repaired publications immediately', async () => {
    const F = await masterFixture()
    let fail = true
    const source = { snapshot: async () => ({ manifest: F.release.manifest, overlay: F.index }), load: async () => {
      if (fail) throw new Error('private/path/example.json')
      return F.adapted
    } }
    const loader = new OperationContent(source)
    await expect(loader.env()).rejects.toEqual(new ContentUnavailable())
    fail = false
    expect((await loader.env()).content.umas.size).toBe(1)
  })
})
