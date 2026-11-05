// @vitest-environment jsdom
// The Hub's Furlong Hand place (T156): `/career/furlong-hand` opens the stage host full screen, with no bars, as practice
// (pays nothing) on her running career's next race, and leaving goes back to the Career page.
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { atPhoneSize, furlongGame } from '../../stages/__fixtures__/stages'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the Furlong Hand place', () => {
  it('opens the race full screen as practice on her career\'s next race, and leaves to the Career page', async () => {
    const { where } = renderRacer('/career/furlong-hand', furlongGame())
    expect(await screen.findByText('Race')).toBeTruthy()
    expect(document.querySelector('[data-stage="furlong-hand"]')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Practice (pays nothing)' }))
    expect(await screen.findByRole('list', { name: 'The field, first to last' })).toBeTruthy()
    expect(screen.getByLabelText('Practice: pays nothing')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Leave Furlong Hand' }))
    await waitFor(() => expect(where()).toBe('/career'))
  })
})
