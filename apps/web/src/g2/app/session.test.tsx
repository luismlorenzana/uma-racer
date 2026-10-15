// @vitest-environment jsdom
// The live session (T143): before the save opens, a signed-out phone or content that can't load gets one panel with its
// way on; while the content loads, the shell's quiet frame; once the content is ready, the device save boots on it and
// sync follows the auth state.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_BUCKET_CONTENT, SIGNED_OUT_CONTENT } from '../../content/diagnostics'
import type { ContentState } from '../../content/ContentProvider'
import { useGame } from './game'

const auth = vi.hoisted(() => ({
  state: { ready: true, authRequired: true, user: null as { name: string | null; email: string | null } | null, signIn: vi.fn(async () => {}), signOut: vi.fn(async () => {}) },
}))
const content = vi.hoisted(() => ({ state: { status: 'loading' } as unknown }))
const boot = vi.hoisted(() => ({ calls: [] as unknown[], setSignedIn: vi.fn() }))

vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => auth.state }))
vi.mock('../../content/ContentProvider', () => ({ useContent: () => content.state }))
vi.mock('./boot', async () => {
  const { errorGame } = await import('./game')
  return {
    bootSaveGame: vi.fn(async (loaded: unknown, account: unknown) => {
      boot.calls.push({ loaded, account })
      return { game: errorGame('booted'), rules: null, save: { setSignedIn: boot.setSignedIn } }
    }),
  }
})

const { SessionProvider } = await import('./session')

function Probe() {
  const words = useGame((snapshot) => snapshot.words ?? snapshot.status)
  return <p data-testid="probe">{words}</p>
}

beforeEach(() => {
  auth.state = { ...auth.state, ready: true, authRequired: true, user: null }
  auth.state.signIn.mockClear()
  boot.calls = []
  boot.setSignedIn.mockClear()
})
afterEach(cleanup)

describe('the session', () => {
  it('asks a signed-out phone to sign in, with the provider\'s sign-in', () => {
    content.state = { status: 'signed-out', diagnostic: SIGNED_OUT_CONTENT } satisfies ContentState
    render(<SessionProvider><Probe /></SessionProvider>)
    expect(screen.queryByTestId('probe')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: SIGNED_OUT_CONTENT.action!.label }))
    expect(auth.state.signIn).toHaveBeenCalledOnce()
  })

  it('offers Check again when no content is published, and retries it', () => {
    const retry = vi.fn(async () => {})
    content.state = { status: 'empty', diagnostic: EMPTY_BUCKET_CONTENT, retry } satisfies ContentState
    render(<SessionProvider><Probe /></SessionProvider>)
    fireEvent.click(screen.getByRole('button', { name: EMPTY_BUCKET_CONTENT.action!.label }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('shows the quiet frame while the content loads, then boots the save on it and follows sign-in', async () => {
    auth.state = { ...auth.state, user: { name: 'Owner', email: null } }
    content.state = { status: 'loading' } satisfies ContentState
    const view = render(<SessionProvider><Probe /></SessionProvider>)
    expect(screen.getByTestId('probe').textContent).toBe('booting')
    const loaded = { manifest: { version: 'invented0001' } }
    content.state = { status: 'ready', content: loaded, diagnostic: SIGNED_OUT_CONTENT, retry: async () => {} } as unknown as ContentState
    view.rerender(<SessionProvider><Probe /></SessionProvider>)
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('booted'))
    expect(boot.calls).toHaveLength(1)
    expect(boot.calls[0]).toMatchObject({ loaded, account: { signedIn: true } })
    expect(boot.setSignedIn).toHaveBeenLastCalledWith(true)
    auth.state = { ...auth.state, user: null }
    content.state = { status: 'signed-out', diagnostic: SIGNED_OUT_CONTENT } satisfies ContentState
    view.rerender(<SessionProvider><Probe /></SessionProvider>)
    expect(boot.setSignedIn).toHaveBeenLastCalledWith(false)
    // Once the save has opened, signing out keeps the game on screen: sync pauses, play goes on.
    expect(screen.getByTestId('probe').textContent).toBe('booted')
  })
})
