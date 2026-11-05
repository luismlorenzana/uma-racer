// The route bodies (docs/game/11-hub-and-places.md §2.4, §7.1): the start rule, a page and a place. Each is a thin check
// over a lazy body, so the entry chunk holds the route rules and none of the screens.
import { isHubPage, placeOnPage } from '@racer/domain/hub'
import { lazy, Suspense, useRef } from 'react'
import { Navigate, useParams } from 'react-router'
import { matchSubPage, PLACE_UI } from '../places/registry'
import { useGame } from './game'
import { usePlaceScroll } from './scroll'
import { startPath } from './start'

const HubPage = lazy(() => import('../hub/HubPage'))
const UnfilledPage = lazy(() => import('../places/Unfilled').then((mod) => ({ default: mod.UnfilledPage })))

/** `/`: waits for the first snapshot, then replaces itself (§2.4): her career page while it runs, else the last page. */
export function StartRoute() {
  const ready = useGame((snapshot) => snapshot.status === 'ready')
  const careers = useGame((snapshot) => snapshot.state?.careers ?? null)
  if (!ready) return null
  return <Navigate to={startPath(undefined, undefined, (id) => careers?.[id]?.completedAt === null)} replace />
}

/** `/:page`, its map, with `?peek=:place`; a page that isn't one goes to `/`. */
export function PageRoute() {
  const { page } = useParams()
  if (!isHubPage(page)) return <Navigate to="/" replace />
  return (
    <Suspense fallback={null}>
      <HubPage page={page} />
    </Suspense>
  )
}

/** `/:page/:place/*`: the place's sub-page slots, then its Page with `rest`; a place not on that page goes to `/`. */
export function PlaceRoute() {
  const params = useParams()
  const scroller = useRef<HTMLDivElement>(null)
  usePlaceScroll(scroller)
  const place = placeOnPage(params['page'], params['place'])
  if (place === undefined) return <Navigate to="/" replace />
  const rest = params['*'] ?? ''
  const ui = PLACE_UI[place.id]
  const sub = matchSubPage(ui, rest)
  const Page = ui?.Page ?? UnfilledPage
  return (
    <div ref={scroller} className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain" data-racer="place" data-place-route={place.id}>
      <Suspense fallback={null}>
        {sub !== null ? <sub.Page key={place.id} place={place} rest={rest} params={sub.params} /> : <Page key={place.id} place={place} rest={rest} />}
      </Suspense>
    </div>
  )
}
