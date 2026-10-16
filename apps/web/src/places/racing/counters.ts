// The Racing page's own counters (T141; docs/game/11-hub-and-places.md §3.3): the Racecourse's featured bonuses still
// open and the Trophy Hall's flair since this device's last visit. Hooks in the shell's entry, so the Racecourse's draw
// loads in its own chunk on first use and the count reads null until it arrives; the Trophy Hall's needs only the
// records and one device key. A screen calls both on every render (`hub/counts.ts`); while `active` is false (a Hub
// page other than Racing) they read nothing and count null.
import { useEffect, useState } from 'react'
import { useG2Content } from '../../app/content'
import { useGame, useNow, useRuntime, useSnapshot } from '../../app/game'
import { readSeen } from './seen'

type Counted = typeof import('./counted')

let counted: Counted | null = null
let loading: Promise<Counted> | null = null

function useCounted(active: boolean): Counted | null {
  const [module, setModule] = useState<Counted | null>(counted)
  useEffect(() => {
    if (module !== null || !active) return
    let live = true
    loading ??= import('./counted').then((loaded) => (counted = loaded))
    void loading.then((loaded) => { if (live) setModule(loaded) })
    return () => { live = false }
  }, [module, active])
  return module
}

/** Featured bonuses still open today (0–3), or null while the draw loads. */
export function useFeaturedOpen(active = true): number | null {
  const module = useCounted(active)
  const { game } = useRuntime()
  const profile = useGame((snapshot) => snapshot.state?.profile ?? null)
  const env = useGame((snapshot) => snapshot.env)
  const loaded = useG2Content()
  const now = useNow()
  if (!active || module === null || profile === null || env === null) return null
  return module.featuredOpen(profile, env, loaded, now, game.utcOffsetMin(now))
}

/** Flair earned since this device last opened the Trophy Hall, read through the port's logs as it publishes. */
export function useNewFlair(active = true): number | null {
  const { game } = useRuntime()
  const snapshot = useSnapshot()
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    if (!active || snapshot.status !== 'ready' || game.logs?.flairEvents === undefined) return
    let live = true
    const seen = readSeen()
    game.logs.flairEvents().then((events) => { if (live) setCount(events.filter((event) => event.earnedAt > seen).length) }, () => {})
    return () => { live = false }
  }, [game, snapshot, active])
  return active ? count : null
}
