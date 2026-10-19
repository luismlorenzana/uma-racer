import { describe, expect, it } from 'vitest'
import { retiredMasterObject } from './retired'
describe('SE1 exact-target retirement', () => {
  it('includes only the old master-generated namespace', () => {
    for (const path of ['manifest.json', 'data/umas.a1234567.json', 'atlases/uma-icons.a1234567.json', 'atlases/card-icons-0.a1234567.webp', 'atlases/type-icons.a1234567.json', 'art/face/9999.a1234567.webp']) expect(retiredMasterObject(path), path).toBe(true)
    for (const path of ['overlay.json', 'overlays/racer.aaaaaaaaaaaaaaaa.json', 'overrides/flair.json', 'saves/u1.json', 'data/unknown.a1234567.json', 'art/original/foo.a1234567.webp', '../manifest.json', 'art/face/../secret.webp']) expect(retiredMasterObject(path), path).toBe(false)
  })
})
