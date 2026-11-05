// @vitest-environment jsdom
// Account (docs/game/11-hub-and-places.md §3.1; T152, T157, D386) at 390 × 844 on invented accounts: the wallet's two
// tickets, Appearance, the sync row and Sync now, this phone's settings, the dev section's ticket grants (dev builds,
// as the tests run), App build and Content, and Sign out where somebody signs in. No check-in times and no rows for
// generation 2's systems.
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { memoryGame } from '../../__fixtures__/memory'
import { renderRacer, stubPointerEvents, stubStorage } from '../../__fixtures__/testing'
import { APP_BUILD_ID } from '../../app/build'
import { atPhoneSize } from '../../stages/__fixtures__/stages'

beforeEach(() => {
  stubStorage()
  stubPointerEvents()
  atPhoneSize()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Account (T157)', () => {
  it('shows the tickets, Appearance, sync, this phone, App build and Content, and nothing retired', async () => {
    renderRacer('/town/account', memoryGame())
    expect(await screen.findByRole('heading', { level: 1, name: 'Account' })).toBeTruthy()
    const wallet = await screen.findByLabelText('Wallet')
    expect(wallet.textContent).toContain('20Uma Tickets')
    expect(wallet.textContent).toContain('24Card Tickets')
    expect(screen.getByRole('tablist', { name: 'Appearance' })).toBeTruthy()
    expect(screen.getByText('Synced. Everything on this phone is saved to your account.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Sync now' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByRole('switch')).toBeTruthy()
    const about = screen.getByLabelText('About')
    expect(within(about).getByText('App build')).toBeTruthy()
    expect(within(about).getByText(APP_BUILD_ID)).toBeTruthy()
    expect(within(about).getByText('Not loaded here')).toBeTruthy()
    expect(screen.queryByText(/check-in|Check-in|Prize Money|Speed Ticket|Playtesting/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  })

  it("grants tickets from the dev section, and the wallet and the top bar follow", async () => {
    const game = memoryGame()
    renderRacer('/town/account', game)
    const dev = await screen.findByLabelText('Dev')
    fireEvent.click(within(dev).getByRole('button', { name: '+5 Uma Tickets' }))
    expect(await within(dev).findByRole('status')).toHaveProperty('textContent', 'Granted.')
    expect(game.applied).toEqual(['dev-grant'])
    await waitFor(() => expect(screen.getByLabelText('Wallet').textContent).toContain('25Uma Tickets'))
    expect(screen.getByRole('link', { name: 'Uma Tickets 25. Open the Stable.' })).toBeTruthy()
  })

  it('signs out where the port signs in', async () => {
    const signOut = vi.fn(async () => {})
    renderRacer('/town/account', { ...memoryGame(), signOut })
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
  })

  it('opens at the sync row from the Sync chip', async () => {
    renderRacer('/town/account?row=sync', memoryGame({ sync: 'offline' }))
    expect(await screen.findByText("Offline. Saved on this phone; it'll sync when you're back online.")).toBeTruthy()
    expect(document.querySelector('[data-row="sync"]')).not.toBeNull()
  })
})
