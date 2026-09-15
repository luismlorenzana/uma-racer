import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DATASET_NAMES, GAMETORA_MANIFEST_URL, loadGameToraData, type FetchJson } from './gametora'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('loadGameToraData', () => {
  it('caches datasets and refreshes them only when requested', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'uma-racer-cache-'))
    tempDirs.push(cacheDir)
    const calls: string[] = []
    const manifest = Object.fromEntries(DATASET_NAMES.map((name) => [name, `synthetic-${name}`]))
    const fetcher: FetchJson = async (url) => {
      calls.push(url)
      return {
        ok: true,
        status: 200,
        json: async () => (url === GAMETORA_MANIFEST_URL ? manifest : [{ source: url }]),
      }
    }

    const first = await loadGameToraData({ cacheDir, fetcher })
    expect(first.manifest).toEqual(manifest)
    expect(calls).toHaveLength(DATASET_NAMES.length + 1)

    calls.length = 0
    await loadGameToraData({ cacheDir, fetcher })
    expect(calls).toEqual([GAMETORA_MANIFEST_URL])

    calls.length = 0
    await loadGameToraData({ cacheDir, fetcher, refresh: true })
    expect(calls).toHaveLength(DATASET_NAMES.length + 1)
  })
})
