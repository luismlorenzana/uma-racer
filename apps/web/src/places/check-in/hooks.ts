// What the check-in sheet reads beside the work view (docs/game/02-check-ins-and-notifications.md §9, §10; T142):
// an operation's receipt, the server's once it has answered, else this device's (so "Already collected." shows in place
// when the other device collected first), read from the save's log when the snapshot no longer holds it; and whether
// the phone is offline, from the port's Sync state or the browser's own signal.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useGame, useRuntime } from '../../app/game'

/** An operation's receipt: the server's when it has answered, else the local one; null while unknown. */
export function useReceipt(id: string | null): unknown {
  const { game } = useRuntime()
  const kept = useGame((snapshot) => (id === null ? undefined : snapshot.receipts[id]))
  const [read, setRead] = useState<{ readonly id: string; readonly receipt: unknown } | null>(null)
  useEffect(() => {
    if (id === null || kept !== undefined || game.logs === undefined) return
    let live = true
    game.logs.receipt(id).then(
      (receipt) => { if (live && receipt !== undefined && receipt !== null) setRead({ id, receipt }) },
      () => {},
    )
    return () => { live = false }
  }, [id, kept, game])
  if (id === null) return null
  if (kept !== undefined) return kept.server ?? kept.local
  return read?.id === id ? read.receipt : null
}

function subscribeOnline(listener: () => void): () => void {
  globalThis.addEventListener?.('online', listener)
  globalThis.addEventListener?.('offline', listener)
  return () => {
    globalThis.removeEventListener?.('online', listener)
    globalThis.removeEventListener?.('offline', listener)
  }
}

const onlineNow = (): boolean => globalThis.navigator?.onLine !== false

/** Offline (02 §9): the save's lane says so, or the browser does. */
export function useOffline(): boolean {
  const sync = useGame((snapshot) => snapshot.sync)
  const online = useSyncExternalStore(subscribeOnline, onlineNow, () => true)
  return sync === 'offline' || !online
}
