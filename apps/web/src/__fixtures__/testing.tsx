// Test helpers for the new game (T137): the real routes in a memory router, over a port the test chooses. Synthetic
// seeds only; the port's clock is held at the seed's time so every count is fixed.
import { render } from '@testing-library/react'
import { domMax } from 'motion/react'
import { MemoryRouter, useLocation, useRoutes, type InitialEntry, type Location } from 'react-router'
import { vi } from 'vitest'
import type { G2Game, G2Rules } from '../app/game'
import { GameProvider } from '../app/GameProvider'
import { MotionRoot } from '../app/motion'
import { G2_ROUTES } from '../app/router'
import { RULES } from '../app/rules'
import { createMemoryGame } from '../dev/memory'
import { SEEDS, type G2Seed } from '../dev/seed'

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

const made = new Map<string, G2Seed>()

/** A seed, built once per test file: the loop takes a moment. */
export function seed(name: string): G2Seed {
  let found = made.get(name)
  if (found === undefined) {
    found = SEEDS[name]!()
    made.set(name, found)
  }
  return found
}

/**
 * The names of the taps a port has applied, oldest first, read as the device save offers them: the snapshot's receipts
 * name the taps, and `logs.operation` reads each one's log row (the rules' state never holds a confirmed one).
 */
export async function appliedNames(game: G2Game): Promise<string[]> {
  const ids = Object.keys(game.getSnapshot().receipts)
  const rows = await Promise.all(ids.map((id) => game.logs!.operation(id)))
  return rows.map((row, i) => row?.name ?? `missing:${ids[i]!}`)
}

/** The in-memory port on a seed, its clock held at the seed's time. */
export const seedGame = (name: string, changes: Partial<G2Seed> = {}): G2Game => createMemoryGame({ ...seed(name), ...changes }, () => 0)

function Routes() {
  return useRoutes(G2_ROUTES)
}

function Probe({ seen }: { seen: { current: Location | null } }) {
  seen.current = useLocation()
  return null
}

/**
 * The real routes in a declarative memory router (the data router's fetch `Request` refuses jsdom's AbortSignal under
 * Node), with the location read back after each render. `path` may carry navigation state, as a reload keeps it.
 */
export function renderG2(path: InitialEntry, game: G2Game, rules: G2Rules | null = RULES) {
  const seen: { current: Location | null } = { current: null }
  const result = render(
    <MotionRoot features={domMax}>
      <GameProvider game={game} rules={rules}>
        <MemoryRouter initialEntries={[path]}>
          <Routes />
          <Probe seen={seen} />
        </MemoryRouter>
      </GameProvider>
    </MotionRoot>,
  )
  const where = () => (seen.current === null ? '' : `${seen.current.pathname}${seen.current.search}`)
  const state = () => seen.current?.state as unknown
  return { ...result, where, state }
}
