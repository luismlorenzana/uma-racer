// The save's boot (docs/rearchitecture/01-target-architecture.md §4.3; docs/rearchitecture/07-data-reset.md §2–§3;
// docs/rework/02-check-ins-and-notifications.md §8, §11; T136), in this order:
// 1. The wipe (`wipe.ts`), unless `uma-racer:g2:wiped` is set. Only the new game's own boot asks for it.
// 2. The purge, unless `uma-racer:g2:purged` is set: `POST /api/legacy/purge` in the background once signed in, again
//    at the next boot or back online after a failure. It never blocks play, and it touches only `players/`, so it can
//    run before or after the create; online, its request goes first (07 §3's order).
// 3. Open, local first:
//    - a save on the device (a profile row, or a create in the outbox): fold, ready at once, then flush and pull;
//    - empty: pull every page from 0. With rows, the store opens once the pages have brought the kinds the rules read,
//      and the history keeps loading behind it. With none, `initialSave(now)` is queued as the create, and it opens;
//    - empty and offline (or signed out, or any failed pull): the device creates the save too. A later `exists`
//      adopts the server's save and pulls it from 0.
import type { OperationEnv } from '@racer/domain/save'
import { createSaveApi, type SaveApi } from './api'
import { createActions, type SaveActions } from './actions'
import { CREATE_KEY, holdsSave, SaveDb, UnreadableRow } from './db'
import { createSerial, refold, resetSave, useSave } from './store'
import { browserSignals, forgetPull, SyncLane, type LaneSignals } from './sync'
import { browserStorage, browserWipe, wipeOnce, type WipeDeps } from './wipe'
import { SAVE_WORDS } from './words'

export const PURGED_KEY = 'uma-racer:g2:purged'

export interface SaveBootOptions {
  readonly env: OperationEnv
  /** The first-boot wipe: the app's own boot only, never the seeds' mount unless it asks (`&wipe`). */
  readonly wipe: boolean
  /** The purge call: with the wipe, until the release after the owner confirms it ran (07 §6). */
  readonly purge: boolean
  /** Whether sync may run yet; T143 follows the auth provider with `setSignedIn`. */
  readonly signedIn?: boolean
  readonly api?: SaveApi
  readonly db?: SaveDb
  readonly storage?: Storage | null
  readonly signals?: LaneSignals
  readonly wipeDeps?: WipeDeps
  readonly now?: () => number
  readonly newId?: () => string
}

export interface SaveSession {
  readonly env: OperationEnv
  readonly actions: SaveActions
  readonly lane: SyncLane
  /** Resolves once the boot has done all it does before play: the store is then ready, or in error. */
  readonly opened: Promise<void>
  setSignedIn(signedIn: boolean): void
  stop(): void
}

const randomId = (): string => globalThis.crypto.randomUUID()

export function bootSave(options: SaveBootOptions): SaveSession {
  const db = options.db ?? new SaveDb()
  const api = options.api ?? createSaveApi()
  const storage = options.storage === undefined ? browserStorage() : options.storage
  const now = options.now ?? (() => Date.now())
  const { env } = options
  const serial = createSerial()
  resetSave({ signedIn: options.signedIn ?? true })

  let purging = false
  function purge(): void {
    if (!options.purge || purging || !useSave.getState().signedIn) return
    try {
      if (storage?.getItem(PURGED_KEY) != null) return
    } catch {
      return
    }
    purging = true
    api.purge().then(
      (answer) => {
        try {
          storage?.setItem(PURGED_KEY, JSON.stringify({ status: answer.status, at: answer.at }))
        } catch {
          // Asked again next boot; the server answers `already` at once.
        }
      },
      () => {
        // Tried again at the next boot, or when back online.
      },
    ).finally(() => {
      purging = false
    })
  }

  const lane: SyncLane = new SyncLane({
    db, api, env, serial, storage, now,
    signals: options.signals ?? browserSignals,
    dropSave: () => serial(async () => {
      await db.transaction('rw', db.allTables(), () => Promise.all(db.allTables().map((table) => table.clear())))
      forgetPull(storage)
      resetSave({ signedIn: useSave.getState().signedIn })
    }),
    reopen: () => open().catch(failed),
    onOnline: purge,
  }, createSerial())

  const actions = createActions({ db, env, serial, now, newId: options.newId ?? randomId, lane })

  let stopped = false
  function failed(error: unknown): void {
    // A session stopped while it was still opening has nothing left to say.
    if (stopped) return
    if (!(error instanceof UnreadableRow)) console.error(error)
    lane.stop()
    useSave.setState({ lifecycle: 'error', words: SAVE_WORDS.unexpected })
  }

  /** Folds what Dexie holds and opens the store. */
  const ready = () => serial(async () => {
    if (useSave.getState().lifecycle === 'ready') return
    if (!(await refold(db, env))) throw new Error('The save holds no profile')
    useSave.setState({ lifecycle: 'ready', words: null })
  })

  /** A new account, queued as the create: it leads the outbox, ahead of anything already waiting. */
  const create = () => serial(async () => {
    await db.transaction('rw', db.outbox, async () => {
      const waiting = await db.outbox.orderBy('seq').toArray()
      await db.outbox.clear()
      await db.outbox.add({ key: CREATE_KEY, change: { type: 'create', createdAt: now() }, queuedAt: now() })
      for (const { seq: _seq, ...row } of waiting) await db.outbox.add(row)
    })
  })

  async function open(): Promise<void> {
    if (await holdsSave(db)) {
      await ready()
    } else if (!useSave.getState().signedIn) {
      await create()
      await ready()
    } else {
      // Opens as soon as the rule kinds are in; with no rows, or no answer, the device creates the save itself.
      await lane.initialPull(ready)
      if (useSave.getState().lifecycle !== 'ready') {
        if (!(await holdsSave(db))) await create()
        await ready()
      }
    }
    lane.start()
  }

  const opened = (async () => {
    if (options.wipe) await wipeOnce(options.wipeDeps ?? browserWipe())
    purge()
    await db.open()
    await open()
  })().catch(failed)

  return {
    env,
    actions,
    lane,
    opened,
    setSignedIn(signedIn) {
      if (useSave.getState().signedIn === signedIn) return
      useSave.setState({ signedIn })
      if (!signedIn) return
      purge()
      void lane.request({ pull: true })
    },
    stop() {
      stopped = true
      lane.stop()
      db.close()
    },
  }
}
