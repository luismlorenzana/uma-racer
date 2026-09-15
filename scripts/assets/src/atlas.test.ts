import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { buildAtlas } from './atlas'
import type { DownloadedImage } from './download'

function svg(color: string, width: number, height: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`,
  )
}

describe('buildAtlas', () => {
  it('normalizes synthetic images and emits a deterministic WebP page', async () => {
    const images: DownloadedImage[] = [
      { id: '2', bytes: svg('blue', 4, 8), cacheHit: false },
      { id: '1', bytes: svg('red', 8, 4), cacheHit: false },
    ]
    const first = await buildAtlas(images)
    const second = await buildAtlas([...images].reverse())

    expect(first.frames).toEqual(second.frames)
    expect(first.pages[0]!.bytes.equals(second.pages[0]!.bytes)).toBe(true)
    expect(first.pages[0]).toMatchObject({ width: 264, height: 132 })
    expect(first.frames['1']).toMatchObject({ page: 0, x: 2, y: 2, width: 128, height: 128 })
    expect(first.frames['2']).toMatchObject({ page: 0, x: 134, y: 2, width: 128, height: 128 })
    await expect(sharp(first.pages[0]!.bytes).metadata()).resolves.toMatchObject({ format: 'webp', width: 264, height: 132 })
    const rgba = await sharp(first.pages[0]!.bytes).ensureAlpha().raw().toBuffer()
    const pixel = (x: number, y: number) => {
      const offset = (y * 264 + x) * 4
      return [...rgba.subarray(offset, offset + 4)]
    }
    expect(pixel(0, 0)[3]).toBe(0) // frame padding stays transparent
    expect(pixel(3, 3)[3]).toBe(0) // the wide red source is contained with transparent letterboxing
    expect(pixel(66, 66)[0]).toBeGreaterThan(200)
    expect(pixel(66, 66)[3]).toBeGreaterThan(240)
  })

  it('identifies an invalid source without writing output', async () => {
    await expect(buildAtlas([{ id: 'invented', bytes: Buffer.from('not an image'), cacheHit: false }])).rejects.toThrow(
      'Failed to decode image invented',
    )
  })
})
