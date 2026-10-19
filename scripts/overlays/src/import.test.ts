import { describe, expect, it } from 'vitest'
import { overlayPublication } from './import'
import { parseOverlayIndex } from '@racer/domain/master'
describe('overlay publishing envelope', () => {
  it('names bytes immutably and deterministically, without carrying any master data', () => {
    const input = { schema: 1, flair: { version: 2, series: [], mainVenueKeys: [] }, cardFocus: {} }
    const a = overlayPublication(input), b = overlayPublication(input)
    expect(a).toEqual(b)
    expect(parseOverlayIndex(a.index)).toEqual(a.index)
    expect(JSON.parse(a.bytes.toString())).toEqual(input)
  })
})
