// Thin lazy cutover adapter. Off flag does no host/content/bank I/O; current training is left alone (§9).
import { liveQuery } from 'dexie'
import { lazy, Suspense, useEffect, useState } from 'react'
import { db } from '../../game/db'
import { PUZZLES_RELEASE_ENABLED } from '../../game/puzzles/capability'
const Live = lazy(() => import('./ClLevelUpLive'))
export function useClCutover() {
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!PUZZLES_RELEASE_ENABLED) return
    const sub = liveQuery(() => db.constellationBank.get('main')).subscribe({ next: r => setActive(r?.data.phase === 'active'), error: () => setActive(false) })
    return () => sub.unsubscribe()
  }, [])
  return PUZZLES_RELEASE_ENABLED && active
}
export function ClLevelUpButton({ outfitId, tier, level }: { outfitId: string; tier: number; level: number }) {
  return PUZZLES_RELEASE_ENABLED ? <Suspense fallback={<span>CL {level}/10</span>}><Live outfitId={outfitId} tier={tier} level={level} /></Suspense> : null
}
export function GlobalMaterialItems({ visibility, scenarioTier }: { visibility: 'owned' | 'all'; scenarioTier: number | null }) {
  return PUZZLES_RELEASE_ENABLED ? <Suspense fallback={<p>Loading material items…</p>}><Live visibility={visibility} scenarioTier={scenarioTier} /></Suspense> : null
}
