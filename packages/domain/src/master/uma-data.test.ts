// Re-architecture step 1.3 (docs/rearchitecture/08-phases.md): the platform's master-data package installs from
// GitHub Packages and reads a synthetic release. Phase 5's adapter (`@racer/domain/master`) builds on it.
import { createReleaseClient } from '@luismlorenzana/uma-data'
import { buildMemoryRelease, createMemorySource, syntheticMasterData } from '@luismlorenzana/uma-data/testing'
import { describe, expect, it } from 'vitest'

describe('@luismlorenzana/uma-data', () => {
  it('loads a synthetic release through the hash-checking client', async () => {
    const data = syntheticMasterData()
    const release = await buildMemoryRelease(data)
    const loaded = await createReleaseClient({ source: createMemorySource(release.objects) }).load()
    expect(loaded.manifest.version).toBe(release.manifest.version)
    expect(loaded.data.outfits.map(o => o.id)).toEqual(data.outfits.map(o => o.id))
  })
})
