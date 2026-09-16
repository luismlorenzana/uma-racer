import { describe, expect, it } from 'vitest'
import { atlasImageStyle } from './AtlasSprite'

describe('atlas sprite math', () => {
  it('scales and offsets a managed page to one clipped frame', () => {
    expect(
      atlasImageStyle({
        url: 'blob:synthetic',
        pageWidth: 512,
        pageHeight: 256,
        frame: { page: 0, x: 256, y: 128, width: 128, height: 128 },
      }),
    ).toMatchObject({ width: '400%', height: '200%', left: '-200%', top: '-100%', maxWidth: 'none' })
  })
})
