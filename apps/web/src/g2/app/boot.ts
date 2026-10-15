// Creates the game port lazily (T137, T136). Everything it loads, the port and the rules alike, stays out of the entry
// chunk.
// - `bootSaveGame` is the new game's own boot, which T143's entry calls with today's content: the device save
//   (`g2/save`) with the first-boot wipe and the purge call. It is the only caller that wipes.
// - `bootGame` is the dev mount's: the in-memory port over `rework/sim`'s synthetic seeds, picked by `?seed=`. The device
//   save is opt-in there, so opening `/dev/g2/` never touches a developer's data: `?save=device` boots it on the seeds'
//   content (kept for the tab until a `?seed=` asks for seeds again), and only `&wipe` adds the wipe and the purge.
// A page holds one device save: one database connection and one sync lane. A second boot (StrictMode runs the
// provider's effect twice in development) gets the first one's port.
import type { G2Game, G2Rules } from './game'
import type { SaveBootOptions } from '../save/boot'
import type { OperationContent } from '../save/env'

export interface G2Boot {
  readonly game: G2Game
  readonly rules: G2Rules
}

let device: Promise<G2Boot> | null = null

function bootDevice(options: () => Promise<SaveBootOptions>): Promise<G2Boot> {
  device ??= (async () => {
    const [{ createSaveGame }, { RULES }, made] = await Promise.all([import('../save'), import('./rules'), options()])
    const game = createSaveGame(made)
    // Dev builds expose the port, as they expose `__raceScene`: taps and the Sync chip's states from the console.
    if (import.meta.env.DEV) (globalThis as { __g2Save?: typeof game }).__g2Save = game
    return { game, rules: RULES }
  })()
  return device
}

export function bootSaveGame(content: OperationContent): Promise<G2Boot> {
  return bootDevice(async () => ({ env: (await import('../save')).operationEnv(content), wipe: true, purge: true }))
}

const DEV_SAVE_KEY = 'uma-racer:g2:dev-save'

/** Whether the dev mount boots the device save: asked by `?save=device`, remembered for the tab, undone by `?seed=`. */
function devSaveAsked(params: URLSearchParams): boolean {
  try {
    if (params.get('save') === 'device') globalThis.sessionStorage?.setItem(DEV_SAVE_KEY, '1')
    else if (params.has('seed')) globalThis.sessionStorage?.removeItem(DEV_SAVE_KEY)
    return globalThis.sessionStorage?.getItem(DEV_SAVE_KEY) === '1'
  } catch {
    return params.get('save') === 'device'
  }
}

export async function bootGame(search: string): Promise<G2Boot> {
  const params = new URLSearchParams(search)
  if (devSaveAsked(params)) {
    const wipe = params.has('wipe')
    return bootDevice(async () => ({ env: (await import('../dev/seed')).SEED_ENV, wipe, purge: wipe }))
  }
  const [{ createMemoryGame }, { seedFor }, { RULES }] = await Promise.all([import('../dev/memory'), import('../dev/seed'), import('./rules')])
  return { game: createMemoryGame(seedFor(search)), rules: RULES }
}

/** Forgets the page's device save (tests boot several pages in one file). */
export function forgetDeviceBoot(): void {
  device = null
}
