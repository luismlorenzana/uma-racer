import { describe, expect, it } from 'vitest'
import { friendshipTrainingHref, safeReturnPath } from './bond-links'

describe('bond links', () => {
  it('names the card, the scenario, the Uma and the way back', () => {
    const href = friendshipTrainingHref({ cardId: '30019', tier: 2, umaId: '100101', returnTo: '/constellation/100101/cards' })
    const url = new URL(href, 'https://app.test')
    expect(url.pathname).toBe('/minigames/friendship-training/30019')
    expect(url.searchParams.get('tier')).toBe('2')
    expect(url.searchParams.get('uma')).toBe('100101')
    expect(url.searchParams.get('return')).toBe('/constellation/100101/cards')
  })

  it('only follows in-app paths back', () => {
    expect(safeReturnPath('/cards/30019', '/cards')).toBe('/cards/30019')
    expect(safeReturnPath('https://example.com', '/cards')).toBe('/cards')
    expect(safeReturnPath('//example.com', '/cards')).toBe('/cards')
    expect(safeReturnPath('/\\example.com', '/cards')).toBe('/cards')
    expect(safeReturnPath(null, '/cards')).toBe('/cards')
  })
})
