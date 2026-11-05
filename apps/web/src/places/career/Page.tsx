// The Careers place (docs/game/11-hub-and-places.md §3.2, §7.1; D386, D387). Its routes, under `/career/careers`:
// - `` every career, and Start a career;
// - `:careerId` one career's page (`CareerPage.tsx`);
// - `:careerId/upgrade?tab=tree|deck|bonds|skills` the Upgrade screen;
// - `:careerId/play/:kind` a play of Training Yard or Furlong Hand for her, full screen (the stage host);
// - `:careerId/race/:operationId` a race's run and result, full screen.
// The router hands `rest` decoded, and a career's id is `{umaId}:{T}`; a sub-route it doesn't know goes to the career.
import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router'
import { careerPath, isPlayKind } from '../../hub/nav'
import type { PageProps } from '../registry'
import { CareerPage } from './CareerPage'
import { Careers } from './Careers'

// The Upgrade screen, a play (the stage host and the games' rules) and a race's run (the engine and the race scene) are
// each their own chunk, so the career page stays light.
const Upgrade = lazy(() => import('./Upgrade'))
const PlayPage = lazy(() => import('./Play'))
const RunPage = lazy(() => import('./RunPage'))

export default function CareersPage({ place, rest }: PageProps) {
  if (rest === '') return <Careers place={place} />
  const [careerId = '', view, arg, ...more] = rest.split('/')
  if (view === undefined) return <CareerPage key={careerId} place={place} rest={rest} careerId={careerId} />
  if (more.length === 0 && view === 'upgrade' && arg === undefined) {
    return <Suspense fallback={null}><Upgrade key={careerId} place={place} rest={rest} careerId={careerId} /></Suspense>
  }
  if (more.length === 0 && view === 'play' && isPlayKind(arg)) {
    return <Suspense fallback={null}><PlayPage key={`${careerId}:${arg}`} careerId={careerId} kind={arg} /></Suspense>
  }
  if (more.length === 0 && view === 'race' && arg !== undefined && arg !== '') {
    return <Suspense fallback={null}><RunPage key={arg} careerId={careerId} operationId={arg} /></Suspense>
  }
  return <Navigate to={careerPath(careerId)} replace />
}
