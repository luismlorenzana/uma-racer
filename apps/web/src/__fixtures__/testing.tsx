// Test helpers for the shell (T137, T152): the real routes in a memory router, over a port the test chooses (usually the
// in-memory port on invented content, `memory.ts`).
import { KitArtProvider, MotionRoot } from '@luismlorenzana/uma-kit/ui'
import { render } from '@testing-library/react'
import { domMax, LazyMotion } from 'motion/react'
import { MemoryRouter, useLocation, useRoutes, type InitialEntry, type Location } from 'react-router'
import { vi } from 'vitest'
import { RACER_ART } from '../app/art'
import { ContentContext } from '../app/content'
import type { RacerGame, RacerRules } from '../app/game'
import { GameProvider } from '../app/GameProvider'
import { ROUTES } from '../app/router'
import { RULES } from '../app/rules'
import type { LoadedContent } from '../content/view'

/** An in-memory Storage: the runtime's own `localStorage` may be a stub without the Storage methods. */
export function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  }
}

/** Fresh device storage for one test. */
export function stubStorage(): void {
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
}

/** jsdom has no PointerEvent, so a fired one would lose its coordinates: a MouseEvent stands in for the Hub's swipes. */
export function stubPointerEvents(): void {
  if (typeof globalThis.PointerEvent === 'function') return
  vi.stubGlobal('PointerEvent', class PointerEvent extends MouseEvent {})
}

function Routes() {
  return useRoutes(ROUTES)
}

function Probe({ seen }: { seen: { current: Location | null } }) {
  seen.current = useLocation()
  return null
}

export interface RenderOptions {
  readonly rules?: RacerRules | null
  /** The private content the art and Account read; none by default. */
  readonly content?: LoadedContent | null
}

/**
 * The real routes in a declarative memory router (the data router's fetch `Request` refuses jsdom's AbortSignal under
 * Node), with the location read back after each render. `path` may carry navigation state, as a reload keeps it.
 */
export function renderRacer(path: InitialEntry, game: RacerGame, options: RenderOptions = {}) {
  const seen: { current: Location | null } = { current: null }
  const result = render(
    <MotionRoot>
      {/* The kit's root loads Motion's features lazily; tests draw with them from the first render. */}
      <LazyMotion features={domMax} strict>
        <KitArtProvider art={RACER_ART}>
          <ContentContext.Provider value={options.content ?? null}>
            <GameProvider game={game} rules={options.rules === undefined ? RULES : options.rules}>
              <MemoryRouter initialEntries={[path]}>
                <Routes />
                <Probe seen={seen} />
              </MemoryRouter>
            </GameProvider>
          </ContentContext.Provider>
        </KitArtProvider>
      </LazyMotion>
    </MotionRoot>,
  )
  const where = () => (seen.current === null ? '' : `${seen.current.pathname}${seen.current.search}`)
  const state = () => seen.current?.state as unknown
  return { ...result, where, state }
}
