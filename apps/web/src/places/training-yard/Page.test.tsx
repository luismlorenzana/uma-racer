// @vitest-environment jsdom
// The Hub's Training Yard place (T155): `/career/training-yard` opens the stage host full screen, with no bars, as
// practice (pays nothing) on her running career's deck, and leaving goes back to the Career page.
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { atPhoneSize, careerGame } from '../../stages/__fixtures__/stages'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the Training Yard place', () => {
  it('opens the Yard full screen as practice, and leaves to the Career page', async () => {
    const { where } = renderRacer('/career/training-yard', careerGame())
    expect(await screen.findByText('Merge')).toBeTruthy()
    expect(document.querySelector('[data-stage="training-yard"]')).toBeTruthy()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Practice (pays nothing)' }))
    expect(await screen.findByRole('group', { name: 'The yard' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Leave Training Yard' }))
    await waitFor(() => expect(where()).toBe('/career'))
  })
})
