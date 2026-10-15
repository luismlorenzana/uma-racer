// Creates the game port lazily (T137, T136, T143). Everything it loads, the port and the rules alike, stays out of the
// entry chunk.
// - `bootSaveGame` is the app's boot, called by the session once the private content is ready: the device save (`save/`)
//   with the first-boot wipe and the purge call, its requests on the signed-in owner's token, and Account's Sign in and
//   Sign out from the auth provider. It is the only caller that wipes.
// - `bootDevice` is the device save under any options: the seeds' mount (`dev/boot.ts`) opens it on the seeds' content.
// A page holds one device save: one database connection and one sync lane. A second boot (StrictMode runs the
// provider's effect twice in development) gets the first one's port. Every tap holds the update prompt's restart until
// it has committed (`criticalGameplayAction`), as today's actions did.
import type { G2Game, G2Rules } from './game'
import type { SaveGame } from '../save'
import type { SaveBootOptions } from '../save/boot'
import type { OperationContent } from '../save/env'
import { criticalGameplayAction } from './update-lifecycle'

export interface G2Boot {
  readonly game: G2Game
  readonly rules: G2Rules
  /** The device save behind `game`, when it is one: the session follows the auth provider through it. */
  readonly save?: SaveGame
}

/** What the session gives the save from the auth provider. */
export interface SaveAuth {
  /** The signed-in owner's Firebase ID token; null signed out or with auth off. */
  readonly token: () => Promise<string | null>
  /** Whether sync may run at boot; the session then follows the provider with `SaveGame.setSignedIn`. */
  readonly signedIn: boolean
  /** Account's Sign in and Sign out; absent where nobody signs in (auth off in dev). */
  readonly signIn?: () => Promise<void>
  readonly signOut?: () => Promise<void>
}

let device: Promise<G2Boot> | null = null

export function bootDevice(options: () => Promise<SaveBootOptions>, account: Pick<SaveAuth, 'signIn' | 'signOut'> = {}): Promise<G2Boot> {
  device ??= (async () => {
    const [{ createSaveGame }, { RULES }, made] = await Promise.all([import('../save'), import('./rules'), options()])
    const save = createSaveGame(made)
    // Dev builds expose the port, as they expose `__raceScene`: taps and the Sync chip's states from the console.
    if (import.meta.env.DEV) (globalThis as { __g2Save?: typeof save }).__g2Save = save
    const { writeDevice } = save
    const game: G2Game = {
      ...save,
      run: (name, input, busyKey, options) => criticalGameplayAction(() => save.run(name, input, busyKey, options)),
      ...(writeDevice === undefined ? {} : { writeDevice: (rows) => criticalGameplayAction(() => writeDevice(rows)) }),
      ...(account.signIn === undefined ? {} : { signIn: account.signIn }),
      ...(account.signOut === undefined ? {} : { signOut: account.signOut }),
    }
    return { game, rules: RULES, save }
  })()
  return device
}

export function bootSaveGame(content: OperationContent, auth: SaveAuth): Promise<G2Boot> {
  return bootDevice(async () => {
    const { operationEnv, setSaveTokenProvider } = await import('../save')
    setSaveTokenProvider(auth.token)
    return { env: operationEnv(content), wipe: true, purge: true, signedIn: auth.signedIn }
  }, auth)
}

/** Forgets the page's device save (tests boot several pages in one file). */
export function forgetDeviceBoot(): void {
  device = null
}
