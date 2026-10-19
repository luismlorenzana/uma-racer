// Invented image descriptors/bytes; hold-aware windows must never revoke visible or just-returned images (SE1).
import type { ArtIndex } from '@luismlorenzana/uma-data'
import { describe, expect, it, vi } from 'vitest'
import { releaseArt } from './art'

const art: ArtIndex = { atlases: {}, images: { 'support-card-art': Object.fromEntries(Array.from({ length: 26 }, (_, i) => [String(i), { path: `art/invented-${i}.webp`, width: 1, height: 1 }])) } }
function urls() { let n = 0; return { create: () => `blob:test-${++n}`, revoke: vi.fn() } }
describe('release image lifetime', () => {
  it('deduplicates a concurrent load and disposes each created URL once', async () => {
    const objects = urls(), load = vi.fn(async () => new Uint8Array([1]))
    const runtime = releaseArt(art, load, objects)
    const both = await Promise.all([runtime.loader.load('card', '0'), runtime.loader.load('card', '0')])
    expect(both).toEqual(['blob:test-1', 'blob:test-1']); expect(load).toHaveBeenCalledOnce()
    runtime.dispose(); runtime.dispose()
    expect(objects.revoke).toHaveBeenCalledTimes(1)
  })
  it('preserves held images and the newest image; trims excess once a hold releases', async () => {
    const objects = urls(), runtime = releaseArt(art, async () => new Uint8Array([1]), objects)
    const releases = Array.from({ length: 24 }, (_, i) => runtime.loader.hold!('card', String(i)))
    for (let i = 0; i < 24; i += 1) await runtime.loader.load('card', String(i))
    const newest = await runtime.loader.load('card', '24')
    expect(objects.revoke).not.toHaveBeenCalledWith(newest)
    expect(objects.revoke).not.toHaveBeenCalled()
    releases[0]!(); releases[0]!()
    expect(objects.revoke).toHaveBeenCalledExactlyOnceWith('blob:test-1')
    runtime.dispose()
    expect(new Set(objects.revoke.mock.calls.flat())).toHaveProperty('size', 25)
  })
  it('does not create an object URL after disposal during an in-flight image load', async () => {
    const objects = urls(); let finish!: (bytes: Uint8Array) => void
    const runtime = releaseArt(art, () => new Promise((resolve) => { finish = resolve }), objects)
    const pending = runtime.loader.load('card', '0'); runtime.dispose(); finish(new Uint8Array([1]))
    expect(await pending).toBeNull(); expect(objects.revoke).not.toHaveBeenCalled()
  })
})
