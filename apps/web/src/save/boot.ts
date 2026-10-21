// The save's boot (docs/rearchitecture/01-target-architecture.md §4.3; docs/rearchitecture/07-data-reset.md §2–§3;
// docs/game/02-check-ins-and-notifications.md §8, §11; T136, T144):
// Open, local first. The device wipe retired with SE1; the server purge retired with D362.
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
import { browserStorage } from './storage'
import { SAVE_WORDS } from './words'

export interface SaveBootOptions {
  readonly env: OperationEnv
  /** Whether sync may run yet; T143 follows the auth provider with `setSignedIn`. */
  readonly signedIn?: boolean
  readonly api?: SaveApi
  readonly db?: SaveDb
  readonly storage?: Storage | null
  readonly signals?: LaneSignals
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

  const lane: SyncLane = new SyncLane({
    db, api, env, serial, storage, now,
    signals: options.signals ?? browserSignals,
    dropSave: () => serial(async () => {
      await db.transaction('rw', db.allTables(), () => Promise.all(db.allTables().map((table) => table.clear())))
      forgetPull(storage)
      resetSave({ signedIn: useSave.getState().signedIn })
    }),
    reopen: () => open().catch(failed),
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
      void lane.request({ pull: true })
    },
    stop() {
      stopped = true
      lane.stop()
      db.close()
    },
  }
}
