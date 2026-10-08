// Legacy restore dispatch remains lazy. Read the bank before mounting any old Spark effect (§8).
import { liveQuery } from 'dexie'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { db } from '../../game/db'
import { PUZZLES_RELEASE_ENABLED } from '../../game/puzzles/capability'
const Legacy = lazy(async () => ({ default: (await import('./SparkMatchScreen')).SparkMatchScreen }))
export function SparkEntry() {
  const [state, setState] = useState<'loading' | 'legacy' | 'retired' | 'error'>(PUZZLES_RELEASE_ENABLED ? 'loading' : 'legacy')
  useEffect(() => {
    if (!PUZZLES_RELEASE_ENABLED) return
    const sub = liveQuery(() => db.constellationBank.get('main')).subscribe({ next: r => setState(r ? 'retired' : 'legacy'), error: () => setState('error') })
    return () => sub.unsubscribe()
  }, [])
  if (state === 'retired') return <Navigate to="/puzzles?notice=spark-retired" replace />
  if (state === 'error') return <main className="h-dvh bg-stage p-5 pt-safe pb-safe text-ink-on-dark">The saved cutover needs recovery. Keep app data and return home.</main>
  return state === 'legacy' ? <Suspense fallback={<div className="h-dvh bg-stage" aria-label="Loading Spark history" />}><Legacy /></Suspense>
    : <div className="h-dvh bg-stage p-5 pt-safe pb-safe text-ink-on-dark" role="status">Checking preserved Constellation Levels…</div>
}
