// The web save layer (T136; docs/game/02-check-ins-and-notifications.md §8–§11; docs/rearchitecture/01-target-
// architecture.md §4.2–§4.3; docs/rearchitecture/07-data-reset.md §2–§4), and its adapter to the shell's `G2Game` port
// (T137's `app/game.ts`), one to one:
// - `status` is the store's `lifecycle`, with its `words` on `error`; `state` the fold; `env` the content's, once open;
// - `trainerName` is the trainer badge row's display name;
// - `sync` is the chip: `paused` while signed out, `offline`, `failing` (red) on `error`, `waiting` (amber, D157) once the
//   oldest waiting row is over a day old, else `synced`;
// - `receipts` and `notices` as the store keeps them; `run` is the actions' tap; `syncNow` a flush and a pull;
//   `logs` the read helpers, so a screen reads race results or the ledger without the store holding them;
// - `badges` the badge rows (T141), a tap's `device` rows ride in its transaction, and `writeDevice` writes them alone.
// Loaded lazily by `app/boot.ts`, so none of it, Dexie and Zustand included, reaches the entry chunk.
import type { OperationEnv } from '@racer/domain/save'
import type { G2Game, G2Snapshot, G2Sync } from '../app/game'
import { bootSave, type SaveBootOptions, type SaveSession } from './boot'
import { useSave, type SaveStore } from './store'

export { createSaveApi, setSaveTokenProvider, type SaveApi, type SaveFailure } from './api'
export { bootSave, type SaveBootOptions, type SaveSession } from './boot'
export { SAVE_DB_NAME, SaveDb } from './db'
export { operationEnv } from './env'
export { fold } from './fold'
export { RECEIPTS_KEPT, resetSave, useSave, type SaveStore } from './store'
export { DEBOUNCE_MS, PULL_KEY, PULL_OVERLAP_MS, RETRY_DELAYS_MS, RETRY_EVERY_MS } from './sync'

/** The chip turns amber once a change has waited this long (02 §9, D157). */
export const WAITING_MS = 24 * 60 * 60 * 1000

/** The trainer's name before a trainer badge row exists: the badges' own default. */
const DEFAULT_TRAINER = 'Trainer'

export function chipOf(store: SaveStore, now: number): G2Sync {
  if (!store.signedIn) return 'paused'
  if (store.sync.status === 'offline') return 'offline'
  if (store.sync.status === 'error') return 'failing'
  if (store.sync.oldestQueuedAt !== null && now - store.sync.oldestQueuedAt > WAITING_MS) return 'waiting'
  return 'synced'
}

function trainerName(store: SaveStore): string {
  const trainer = store.badges.trainer
  return trainer?.scope === 'trainer' ? trainer.preferences.displayName : DEFAULT_TRAINER
}

function snapshotOf(store: SaveStore, env: OperationEnv, now: number): G2Snapshot {
  const open = store.lifecycle === 'ready'
  return Object.freeze({
    status: store.lifecycle,
    state: open ? store.state : null,
    env: open ? env : null,
    trainerName: trainerName(store),
    sync: chipOf(store, now),
    receipts: store.receipts,
    notices: store.notices,
    badges: store.badges,
    ...(store.lifecycle === 'error' && store.words !== null ? { words: store.words } : {}),
  })
}

const SNAPSHOT_FIELDS = ['status', 'state', 'env', 'trainerName', 'sync', 'receipts', 'notices', 'words', 'badges'] as const satisfies readonly (keyof G2Snapshot)[]

const sameSnapshot = (a: G2Snapshot, b: G2Snapshot): boolean => SNAPSHOT_FIELDS.every((field) => a[field] === b[field])

export interface SaveGame extends G2Game {
  readonly session: SaveSession
  /** Sync waits while signed out ("Sync paused"); the session follows the auth provider with it (T143). */
  setSignedIn(signedIn: boolean): void
  stop(): void
}

/** The device save behind the shell's port: opens local first, without any cutover writes and publishes as the store changes. */
export function createSaveGame(options: SaveBootOptions): SaveGame {
  const clock = options.now ?? (() => Date.now())
  const session = bootSave(options)
  const listeners = new Set<() => void>()
  let flip: ReturnType<typeof setTimeout> | null = null
  let snapshot = snapshotOf(useSave.getState(), options.env, clock())

  const publish = (): void => {
    const store = useSave.getState()
    const next = snapshotOf(store, options.env, clock())
    if (flip !== null) clearTimeout(flip)
    flip = null
    // The chip turns amber on its own once the oldest row passes a day, with no write to publish it.
    const oldest = store.sync.oldestQueuedAt
    if (next.sync === 'synced' && oldest !== null) flip = setTimeout(publish, Math.max(0, oldest + WAITING_MS - clock()) + 1)
    // A change the port doesn't show (the lane's `syncing`, a count) keeps the snapshot, so nothing re-renders.
    if (sameSnapshot(snapshot, next)) return
    snapshot = next
    for (const listener of [...listeners]) listener()
  }
  const unsubscribe = useSave.subscribe(publish)
  publish()

  return {
    session,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot: () => snapshot,
    now: clock,
    utcOffsetMin: (now) => -new Date(now).getTimezoneOffset(),
    run: (name, input, busyKey, options) => session.actions.run(name, input, busyKey, options),
    writeDevice: (rows) => session.actions.writeDevice(rows),
    dismissNotice: (id) => session.actions.dismissNotice(id),
    syncNow: () => session.lane.request({ pull: true }),
    logs: {
      raceResults: (umaId) => session.actions.raceResults(umaId),
      allRaceResults: () => session.actions.allRaceResults(),
      flairEvents: () => session.actions.flairEvents(),
      ledgerRows: () => session.actions.ledgerRows(),
      itemLedgerRows: () => session.actions.itemLedgerRows(),
      receipt: (id) => session.actions.receipt(id),
      operation: (id) => session.actions.operation(id),
    },
    setSignedIn: (signedIn) => session.setSignedIn(signedIn),
    stop() {
      unsubscribe()
      if (flip !== null) clearTimeout(flip)
      session.stop()
    },
  }
}
