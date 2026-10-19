import { describe, expect, it } from 'vitest'
import { MasterContent } from './master-content'
import { masterFixture } from './master.test-support'

describe('verified operation master content', () => {
  it('produces exactly the same pure adapter view as the device', async () => {
    const F = await masterFixture()
    const service = new MasterContent({ master: { read: async (path) => F.release.objects.get(path) ?? null }, overlay: { read: async (path) => F.overlays.get(path) ?? null } })
    expect(await service.load(await service.snapshot())).toEqual(F.adapted)
  })
  it('refuses missing or corrupt master and overlay bytes, never accepting partial data', async () => {
    const F = await masterFixture()
    const service = new MasterContent({ master: { read: async (path) => F.release.objects.get(path) ?? null }, overlay: { read: async (path) => F.overlays.get(path) ?? null } })
    const snapshot = await service.snapshot()
    F.overlays.set(F.index.file.path, new TextEncoder().encode('{}'))
    await expect(service.load(snapshot)).rejects.toThrow(/hash/)
    F.overlays.delete('overlay.json')
    await expect(service.snapshot()).rejects.toThrow(/missing/)
  })
})
