import { describe, expect, it } from 'vitest'
import { ContentService } from './content.service'

describe('ContentService.safePath', () => {
  it('allows nested content paths', () => {
    expect(ContentService.safePath('atlases/umas.3f9a.webp')).toBe('atlases/umas.3f9a.webp')
    expect(ContentService.safePath('/data/cards.json')).toBe('data/cards.json')
  })

  it('rejects traversal, hidden files, and empty segments', () => {
    for (const bad of ['../secrets.json', 'data/../../x', '.env', 'data//x', '']) {
      expect(() => ContentService.safePath(bad)).toThrow()
    }
  })

  it('maps content types', () => {
    expect(ContentService.contentType('a/b.webp')).toBe('image/webp')
    expect(ContentService.contentType('cards.json')).toBe('application/json')
  })
})
