// The first-boot wipe (docs/rearchitecture/07-data-reset.md §2, §4; T136): generation 2 never reads the old save, it
// deletes it, once per device, before its own database opens.
// - `Dexie.delete('uma-racer')`, today's database (v34, 47 tables);
// - in dev builds, every database of the old app's isolated dev proofs, all named `<name>-proof-*`;
// - every localStorage key that starts with `uma-racer:` and not `uma-racer:g2:`;
// - `caches.delete('racer-content')`; the service worker refills what generation 2 reads.
// Then it sets `uma-racer:g2:wiped`. Each step tolerates absence, so a repeat is harmless, and a step that fails leaves
// the marker unset so the next boot tries again. It never reads old data. Firebase's own databases (the signed-in
// session stays) and the Workbox precache (the new service worker replaces it) are left alone (07 §2).
import Dexie from 'dexie'

export const WIPED_KEY = 'uma-racer:g2:wiped'
export const OLD_DATABASE = 'uma-racer'
export const OLD_CONTENT_CACHE = 'racer-content'
const DEV_PROOF_DATABASE = /^[a-z][a-z-]*-proof-/
const OLD_KEY = 'uma-racer:'
const NEW_KEY = 'uma-racer:g2:'

export interface WipeDeps {
  readonly storage: Storage | null
  readonly deleteDatabase: (name: string) => Promise<void>
  readonly databaseNames: () => Promise<string[]>
  readonly caches: Pick<CacheStorage, 'delete'> | null
  /** Dev builds also hold the isolated proofs' databases. */
  readonly dev: boolean
  readonly now: () => number
}

export function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export const browserWipe = (): WipeDeps => ({
  storage: browserStorage(),
  deleteDatabase: (name) => Dexie.delete(name),
  databaseNames: () => Dexie.getDatabaseNames(),
  caches: typeof caches === 'undefined' ? null : caches,
  dev: import.meta.env.DEV,
  now: () => Date.now(),
})

export type WipeResult = 'wiped' | 'already' | 'incomplete'

function marked(storage: Storage | null): boolean {
  try {
    return storage?.getItem(WIPED_KEY) != null
  } catch {
    return false
  }
}

export async function wipeOnce(deps: WipeDeps = browserWipe()): Promise<WipeResult> {
  if (marked(deps.storage)) return 'already'
  let complete = true
  const step = async (work: () => Promise<unknown>): Promise<void> => {
    try {
      await work()
    } catch {
      complete = false
    }
  }
  await step(() => deps.deleteDatabase(OLD_DATABASE))
  if (deps.dev) {
    await step(async () => {
      for (const name of await deps.databaseNames()) if (DEV_PROOF_DATABASE.test(name)) await deps.deleteDatabase(name)
    })
  }
  await step(async () => {
    const storage = deps.storage
    if (storage === null) return
    const old: string[] = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key !== null && key.startsWith(OLD_KEY) && !key.startsWith(NEW_KEY)) old.push(key)
    }
    for (const key of old) storage.removeItem(key)
  })
  await step(async () => deps.caches?.delete(OLD_CONTENT_CACHE))
  if (!complete) return 'incomplete'
  try {
    deps.storage?.setItem(WIPED_KEY, String(deps.now()))
  } catch {
    // Without storage the wipe runs again next boot, which is harmless.
  }
  return 'wiped'
}
