import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ART_FAMILIES, artSources, bustCrop, deriveArtUrl, encodeArt, encodeBust } from './art'

const umaIcon = 'https://example.invalid/images/umamusume/characters/thumb/chara_stand_1002_100201.png'
const cardIcon = 'https://example.invalid/images/umamusume/supports/support_card_s_30028.png'

describe('private art sources', () => {
  it('derives the larger image beside each icon', () => {
    expect(deriveArtUrl('uma-portrait', umaIcon))
      .toBe('https://example.invalid/images/umamusume/characters/chara_stand_1002_100201.png')
    expect(deriveArtUrl('card-art', cardIcon))
      .toBe('https://example.invalid/images/umamusume/supports/tex_support_card_30028.png')
  })

  it('fails loudly on an unexpected icon URL instead of importing nothing', () => {
    expect(() => deriveArtUrl('uma-portrait', 'https://example.invalid/other.png')).toThrow()
    expect(() => deriveArtUrl('card-art', 'https://example.invalid/support_card_30028.png')).toThrow()
  })

  it('keeps ids while rewriting urls', () => {
    expect(artSources('card-art', [{ id: '30028', url: cardIcon }]))
      .toEqual([{ id: '30028', url: 'https://example.invalid/images/umamusume/supports/tex_support_card_30028.png' }])
  })
})

describe('art encoding', () => {
  it('fits inside the family size without cropping, and keeps portrait transparency', async () => {
    const source = await sharp({
      create: { width: 900, height: 1200, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0 } },
    }).png().toBuffer()

    const portrait = await encodeArt(ART_FAMILIES['uma-portrait'], { id: 'u1', bytes: source, cacheHit: false })
    expect(portrait.width).toBe(384)
    expect(portrait.height).toBe(512)
    expect((await sharp(portrait.bytes).metadata()).hasAlpha).toBe(true)

    const card = await encodeArt(ART_FAMILIES['card-art'], { id: 'c1', bytes: source, cacheHit: false })
    expect(card.height).toBe(600)
    // Card art is a full illustration, so it is flattened rather than carrying a useless alpha channel.
    expect((await sharp(card.bytes).metadata()).hasAlpha).toBe(false)
  })

  it('never enlarges a small source', async () => {
    const small = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } }).png().toBuffer()
    const encoded = await encodeArt(ART_FAMILIES['uma-portrait'], { id: 'u2', bytes: small, cacheHit: false })
    expect(encoded.width).toBe(64)
  })
})

describe('busts', () => {
  // A 100×100 cut-out whose head (rows 15–40) sits right of centre, around x = 70.
  const portrait = (headX: number) => {
    const rgba = new Uint8Array(100 * 100 * 4)
    for (let y = 0; y < 100; y += 1) {
      for (let x = 0; x < 100; x += 1) {
        const inHead = y >= 10 && y < 45 && Math.abs(x - headX) <= 12
        const inBody = y >= 45 && x >= 20 && x < 80
        if (inHead || inBody) rgba[(y * 100 + x) * 4 + 3] = 255
      }
    }
    return rgba
  }

  it('centres a 60% square on the head band, just below the top', () => {
    expect(bustCrop(portrait(70), 100, 100)).toEqual({ left: 40, top: 2, size: 60 })
  })

  it('stays inside the portrait when the head sits near an edge', () => {
    expect(bustCrop(portrait(90), 100, 100).left).toBe(40)
    expect(bustCrop(portrait(8), 100, 100).left).toBe(0)
  })

  it('honours a pinned crop for portraits the centroid misreads', () => {
    expect(bustCrop(portrait(70), 100, 100, { cx: 0.5, size: 0.5, top: 0.1 })).toEqual({ left: 25, top: 10, size: 50 })
  })

  it('encodes a square, transparent bust at the family size', async () => {
    const source = await sharp({
      create: { width: 600, height: 600, channels: 4, background: { r: 200, g: 100, b: 50, alpha: 0.5 } },
    }).png().toBuffer()
    const bust = await encodeBust(ART_FAMILIES['uma-bust'], { id: 'u1', bytes: source, cacheHit: false })
    expect([bust.width, bust.height]).toEqual([256, 256])
    expect((await sharp(bust.bytes).metadata()).hasAlpha).toBe(true)
  })
})
