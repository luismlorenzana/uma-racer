// @vitest-environment jsdom
// The live session (T143, SD4): the boot uma-kit's gates run waits for the content, opens the device save on it, finds
// the start page and follows sign-in; a boot that stops says why, and its button reloads the content or switches account.
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_BUCKET_CONTENT, diagnoseContentError } from '../content/diagnostics'
import type { ContentState } from '../content/ContentProvider'
import { ApiError } from '../api/client'

const auth = vi.hoisted(() => ({
  state: { ready: true, authRequired: true, user: { uid: 'owner', name: 'Owner', email: null } as { uid: string; name: string | null; email: string | null } | null, signIn: vi.fn(async () => {}), signOut: vi.fn(async () => {}) },
}))
const content = vi.hoisted(() => ({ state: { status: 'loading' } as unknown }))
const boot = vi.hoisted(() => ({ calls: [] as unknown[], setSignedIn: vi.fn(), status: 'ready' as 'ready' | 'error' }))

vi.mock('@luismlorenzana/uma-kit/auth', async (load) => ({ ...(await load<object>()), useAuth: () => auth.state }))
vi.mock('../content/ContentProvider', () => ({ useContent: () => content.state }))
vi.mock('./boot', () => ({
  bootSaveGame: vi.fn(async (loaded: unknown, account: unknown) => {
    boot.calls.push({ loaded, account })
    const snapshot = boot.status === 'ready'
      ? { status: 'ready', state: {}, env: {}, trainerName: '', sync: 'synced', receipts: {} }
      : { status: 'error', state: null, env: null, trainerName: '', sync: 'synced', receipts: {}, words: 'The save is damaged.' }
    const game = { subscribe: () => () => {}, getSnapshot: () => snapshot, now: () => 0, utcOffsetMin: () => 0, run: async () => { throw new Error('no') } }
    return { game, rules: { hubView: () => ({ umas: 0, needsATap: 0 }) }, save: { setSignedIn: boot.setSignedIn } }
  }),
}))

const { SessionProvider, useSessionGates } = await import('./session')

let gates: ReturnType<typeof useSessionGates> = null
function Probe() {
  gates = useSessionGates()
  return null
}
const view = () => render(<SessionProvider><Probe /></SessionProvider>)

beforeEach(() => {
  boot.calls = []
  boot.status = 'ready'
  boot.setSignedIn.mockClear()
  auth.state.signOut.mockClear()
})
afterEach(cleanup)

describe('the session', () => {
  it('boots the save once the content loads, finds the start page and follows sign-in', async () => {
    content.state = { status: 'loading' } satisfies ContentState
    const page = view()
    const booting = gates!.boot()
    const loaded = { manifest: { version: 'invented0001' } }
    content.state = { status: 'ready', content: loaded, diagnostic: EMPTY_BUCKET_CONTENT, retry: async () => {} } as unknown as ContentState
    page.rerender(<SessionProvider><Probe /></SessionProvider>)
    await expect(booting).resolves.toEqual({ firstLaunch: false })
    expect(boot.calls[0]).toMatchObject({ loaded, account: { signedIn: true } })
    expect(gates!.startPath()).toBe('/town/stable?tab=locked')
    await waitFor(() => expect(boot.setSignedIn).toHaveBeenLastCalledWith(true))
  })

  it("says the content's words when it can't load, and Try again reloads it", async () => {
    const retry = vi.fn(async () => {})
    content.state = { status: 'empty', diagnostic: EMPTY_BUCKET_CONTENT, retry } satisfies ContentState
    view()
    await expect(gates!.boot()).rejects.toThrow()
    await waitFor(() => expect(gates!.failure).toMatchObject({ retry: EMPTY_BUCKET_CONTENT.action!.label, then: 'retry' }))
    expect(gates!.failure!.words).toContain(EMPTY_BUCKET_CONTENT.title)
    await expect(gates!.boot()).rejects.toThrow()
    expect(retry).toHaveBeenCalledOnce()
  })

  it('switches account when the account is not the owner\'s', async () => {
    const diagnostic = diagnoseContentError(new ApiError('/api/content/manifest', 403, 'not authorized'))
    content.state = { status: 'error', error: new Error('403'), diagnostic, retry: async () => {} } satisfies ContentState
    view()
    await expect(gates!.boot()).rejects.toThrow()
    await waitFor(() => expect(gates!.failure?.then).toBe('sign-out'))
    await expect(gates!.boot()).rejects.toThrow()
    expect(auth.state.signOut).toHaveBeenCalledOnce()
  })

  it("says why a save couldn't open", async () => {
    boot.status = 'error'
    content.state = { status: 'ready', content: {}, diagnostic: EMPTY_BUCKET_CONTENT, retry: async () => {} } as unknown as ContentState
    view()
    await expect(gates!.boot()).rejects.toThrow()
    await waitFor(() => expect(gates!.failure).toMatchObject({ words: 'The save is damaged.', then: 'reload' }))
  })
})
