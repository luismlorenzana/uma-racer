// The seeds' boot (T137, T136; dev builds only, `dev/main.tsx`): the in-memory port over `@racer/domain/sim`'s synthetic seeds,
// picked by `?seed=`. The device save is opt-in, so opening `/dev/seeds/` never touches a developer's data:
// `?save=device` boots it on the seeds' content (kept for the tab until a `?seed=` asks for seeds again), and only
// legacy `&wipe` is ignored: device data is never deleted here (SE1, D365).
import { bootDevice, type G2Boot } from '../app/boot'

const DEV_SAVE_KEY = 'uma-racer:g2:dev-save'

/** Whether the seeds' mount boots the device save: asked by `?save=device`, remembered for the tab, undone by `?seed=`. */
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
    // `dev` as `operationEnv` sets it: a dev build runs `dev-grant` (M034), so Account's dev section works here too.
    return bootDevice(async () => ({ env: { ...(await import('./seed')).SEED_ENV, dev: import.meta.env.DEV }, purge: false }))
  }
  const [{ createMemoryGame }, { SEEDS, rememberSeed, seedFor }, { RULES }] = await Promise.all([import('./memory'), import('./seed'), import('../app/rules')])
  // Account's dev section loads any seed in place (T138); the tab then reopens on it after a reload, as `?seed=` would.
  const seeds = Object.fromEntries(Object.entries(SEEDS).map(([name, make]) => [name, () => {
    rememberSeed(name)
    return make()
  }]))
  return { game: createMemoryGame(seedFor(search), undefined, seeds), rules: RULES }
}
