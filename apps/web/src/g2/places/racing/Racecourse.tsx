// The Racecourse (T141; docs/rework/11-hub-and-places.md §3.3, §6, §7): `direct`, so it opens at once on race select;
// `run` is the full-screen run and result, a chunk of its own that brings the PixiJS scene and the engine with it, so
// neither race select nor the shell ever loads them.
import { lazy, Suspense } from 'react'
import type { PageProps } from '../registry'
import { RaceSelect } from './RaceSelect'

const RunPage = lazy(() => import('./run/RunPage'))

export default function Racecourse({ place, rest }: PageProps) {
  if (rest === 'run') {
    return (
      <Suspense fallback={null}>
        <RunPage />
      </Suspense>
    )
  }
  return <RaceSelect place={place} />
}
