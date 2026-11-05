// @vitest-environment jsdom
// The app end to end on invented content (T152): uma-kit's boot gates run the session's boot (the content, then the
// device save on generation 3, after the wipe of generation 2), `/` opens Town Hall with the new account's tickets on the
// top bar, and the trainer button opens Account: its sync row, Appearance, App build and Content, and the dev section's
// `dev-grant`. No network: every save request answers offline, so the device creates the account itself.
import 'fake-indexeddb/auto'
import { KitArtProvider, MotionRoot } from '@luismlorenzana/uma-kit/ui'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Dexie from 'dexie'
import { domMax, LazyMotion } from 'motion/react'
import { MemoryRouter, useLocation, useRoutes, type Location } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { syntheticContent, SYNTH_MANIFEST } from '../__fixtures__/content'
import { memoryStorage, stubPointerEvents } from '../__fixtures__/testing'
import type { ContentState } from '../content/ContentProvider'
import { EMPTY_BUCKET_CONTENT } from '../content/diagnostics'
import type { SaveGame } from '../save'
import { SAVE_DB_NAME, WIPED_KEY } from '../save/db'
import { RACER_ART } from './art'
import { forgetDeviceBoot } from './boot'
import { LiveGates } from './gates'
import { ROUTES } from './router'
import { SessionProvider } from './session'

const auth = vi.hoisted(() => ({
  // Auth off, as local dev runs: the provider is ready with its local user, and nobody signs in.
  state: { ready: true, authRequired: false, user: { uid: 'local-dev', name: null, email: null }, signIn: async () => {}, signOut: async () => {} },
}))
vi.mock('@luismlorenzana/uma-kit/auth', async (load) => ({ ...(await load<object>()), useAuth: () => auth.state }))

const content = vi.hoisted(() => ({ state: null as unknown }))
vi.mock('../content/ContentProvider', () => ({ useContent: () => content.state }))

// The kit's lazy Phaser game: a stand-in, since jsdom draws no canvas.
vi.mock('../../node_modules/@luismlorenzana/uma-kit/dist/hub/scene/createHubGame.js', () => ({
  createHubGame: async () => ({ update: () => {}, setPaused: () => {}, destroy: () => {} }),
}))

class Observer {
  observe() {}
  disconnect() {}
}

const offline = vi.fn(async () => Promise.reject(new TypeError('no network in tests')))

beforeEach(async () => {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
  vi.stubGlobal('fetch', offline)
  vi.stubGlobal('ResizeObserver', Observer)
  stubPointerEvents()
  forgetDeviceBoot()
  await Dexie.delete(SAVE_DB_NAME)
  content.state = { status: 'ready', content: syntheticContent(), diagnostic: EMPTY_BUCKET_CONTENT, retry: async () => {} } satisfies ContentState
})
afterEach(() => {
  cleanup()
  ;(globalThis as { __racerSave?: SaveGame }).__racerSave?.stop()
  vi.unstubAllGlobals()
})

function App({ seen }: { seen: { current: Location | null } }) {
  seen.current = useLocation()
  return useRoutes([{ element: <LiveGates />, children: ROUTES }])
}

function renderApp() {
  const seen: { current: Location | null } = { current: null }
  render(
    <MotionRoot>
      <LazyMotion features={domMax} strict>
        <KitArtProvider art={RACER_ART}>
          <SessionProvider>
            <MemoryRouter initialEntries={['/']}>
              <App seen={seen} />
            </MemoryRouter>
          </SessionProvider>
        </KitArtProvider>
      </LazyMotion>
    </MotionRoot>,
  )
  return { where: () => (seen.current === null ? '' : `${seen.current.pathname}${seen.current.search}`) }
}

describe('the app', () => {
  it('boots to Town Hall on a new generation-3 account, then opens Account', async () => {
    localStorage.setItem('uma-racer:g2:lastPage', 'farm')
    const { where } = renderApp()
    // The gates' boot, then the start rule: Town Hall the first time.
    await waitFor(() => expect(where()).toBe('/town'), { timeout: 5_000 })
    expect(await screen.findByLabelText('Town Hall map')).toBeTruthy()
    expect(localStorage.getItem('uma-racer:g2:lastPage')).toBeNull()
    expect(localStorage.getItem(WIPED_KEY)).not.toBeNull()
    const bar = (await screen.findAllByRole('banner'))[0]!
    await within(bar).findByRole('link', { name: 'Uma Tickets 20. Open the Stable.' })
    within(bar).getByRole('link', { name: 'Card Tickets 24. Open the Card Library.' })
    expect(await screen.findByRole('link', { name: 'Stable. 20 Uma Tickets.' })).toBeTruthy()

    // The trainer button opens Account.
    fireEvent.click(within(bar).getByRole('link', { name: 'Account: Trainer' }))
    await waitFor(() => expect(where()).toBe('/town/account'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Account' })).toBeTruthy()
    const sync = await screen.findByRole('region', { name: 'Sync' })
    await waitFor(() => expect(within(sync).getByText(/^Offline\. Saved on this phone/)).toBeTruthy())
    expect(screen.getByText('Appearance')).toBeTruthy()
    expect(screen.getByText('App build')).toBeTruthy()
    expect(screen.getByText(`${SYNTH_MANIFEST} · network`)).toBeTruthy()
    expect(screen.queryByText(/Check-in times/)).toBeNull()
    // Auth off: nobody signs out.
    expect(screen.queryByRole('button', { name: /Sign out/ })).toBeNull()

    // Dev builds only: the dev section grants tickets through `dev-grant`.
    const dev = screen.getByLabelText('Dev')
    await act(async () => { fireEvent.click(within(dev).getByRole('button', { name: '+5 Uma Tickets' })) })
    expect(await within(dev).findByRole('status')).toHaveProperty('textContent', 'Granted.')
    await within(bar).findByRole('link', { name: 'Uma Tickets 25. Open the Stable.' })
    within(bar).getByRole('link', { name: 'Card Tickets 24. Open the Card Library.' })
  })
})
