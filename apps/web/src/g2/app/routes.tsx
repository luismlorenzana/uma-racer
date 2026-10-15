// The route bodies (docs/rework/11-hub-and-places.md §2.4, §7.1): the start rule, a page, a place, and a full-screen
// flow. Each is a thin check over a lazy body, so the entry chunk holds the route rules and none of the screens.
import { isHubPage, placeOnPage } from '@racer/domain/hub'
import { lazy, Suspense } from 'react'
import { Navigate, useParams } from 'react-router'
import { FLOW_UI, matchSubPage, PLACE_UI } from '../places/registry'
import { useGame, useHub } from './game'
import { startPath } from './start'

const PageGrid = lazy(() => import('../hub/PageGrid'))
const UnfilledPage = lazy(() => import('../places/Unfilled').then((mod) => ({ default: mod.UnfilledPage })))
const UnfilledReveal = lazy(() => import('../places/Unfilled').then((mod) => ({ default: mod.UnfilledReveal })))

/** `/`: waits for the first snapshot, then replaces itself (§2.4). */
export function StartRoute() {
  const ready = useGame((snapshot) => snapshot.status === 'ready')
  const view = useHub()
  if (!ready || view === null) return null
  return <Navigate to={startPath(view)} replace />
}

/** `/:page`, with `?peek=:place`; a page that isn't one goes to `/`. */
export function PageRoute() {
  const { page } = useParams()
  if (!isHubPage(page)) return <Navigate to="/" replace />
  return (
    <Suspense fallback={null}>
      <PageGrid page={page} />
    </Suspense>
  )
}

/** `/:page/:place/*`: the place's sub-page slots, then its Page with `rest`; a place not on that page goes to `/`. */
export function PlaceRoute() {
  const params = useParams()
  const place = placeOnPage(params['page'], params['place'])
  if (place === undefined) return <Navigate to="/" replace />
  const rest = params['*'] ?? ''
  const ui = PLACE_UI[place.id]
  const sub = matchSubPage(ui, rest)
  const Page = ui?.Page ?? UnfilledPage
  return (
    <div className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain" data-g2="place" data-place-route={place.id}>
      <Suspense fallback={null}>
        {sub !== null ? <sub.Page key={place.id} place={place} rest={rest} params={sub.params} /> : <Page key={place.id} place={place} rest={rest} />}
      </Suspense>
    </div>
  )
}

/** `/collection/reveal/uma/:umaId`: the reveal, full screen outside the shell (§6). */
export function RevealRoute() {
  const params = useParams()
  const Reveal = FLOW_UI.reveal ?? UnfilledReveal
  return (
    <Suspense fallback={null}>
      <Reveal params={params} />
    </Suspense>
  )
}
