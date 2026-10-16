// A Hub page (docs/game/11-hub-and-places.md §1–§5, §12; ported from uma-rpg's `hub/HubScreen.tsx`): the page's pixel
// map on a lazy Phaser canvas, the DOM place links over it, the Town Hall plaza, the floating pill (§2.3), and the quick
// look as uma-rpg's side panel (`?peek=:place`). A mostly sideways drag of more than 60 px on the map moves to the next
// or previous page, with the scene's camera fade; the bottom bar's tabs still do. The scene pauses while the panel or a
// global sheet covers it.
import { HUB_PAGE_NAMES, hubWords, pillWords, PLAZA_AT, placesOn, type HubPage as HubPageId, type HubView } from '@racer/domain/hub'
import { useMemo, useRef } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useHub } from '../app/game'
import { useReducedMotionSetting } from '../app/motion'
import { HubCanvas } from './HubCanvas'
import { isGlobalSheet, withParam } from './nav'
import { OverlayHost } from './OverlayHost'
import { PlaceTargets } from './PlaceTargets'
import { neighbourPage, swipeDirection, type Point } from './swipe'

/** The floating pill (§2.3), right thumb zone above the bar: Collect all, else Check-in, else nothing. */
function FloatingPill({ view }: { view: HubView | null }) {
  const location = useLocation()
  const words = pillWords(view)
  if (words === null) return null
  return (
    <Link
      to={withParam(location, 'sheet', 'check-in')}
      state={{ back: true, collect: words.collect }}
      data-g2="pill"
      className={`font-display absolute right-4 bottom-3 z-20 flex min-h-11 items-center rounded-full px-4 text-[14px] font-bold shadow-3 ${
        words.collect ? 'bg-accent text-ink' : 'border border-hairline-strong bg-panel text-ink'
      }`}
    >
      {words.text}
    </Link>
  )
}

export default function HubPage({ page }: { page: HubPageId }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const view = useHub()
  const reducedMotion = useReducedMotionSetting()
  const places = useMemo(() => placesOn(page), [page])
  const scenePlaces = useMemo(() => places.map((place) => ({ id: place.id, frame: place.frame ?? place.id, at: place.at! })), [places])
  const clearings = useMemo(() => (page === 'town' ? [PLAZA_AT] : []), [page])
  const swipeStart = useRef<Point | null>(null)
  const swiped = useRef(false)
  const peekId = params.get('peek')
  const peek = peekId === null ? undefined : places.find((place) => place.id === peekId && !place.direct)
  const sheet = isGlobalSheet(params.get('sheet'))
  if (peekId !== null && peek === undefined) return <Navigate to={withParam(location, 'peek', null)} replace />
  const covered = peek !== undefined || sheet

  return (
    <>
      <main
        aria-label={hubWords('map', { page: HUB_PAGE_NAMES[page] })}
        className="absolute inset-0 touch-pan-y overflow-hidden select-none"
        data-g2="page"
        data-page={page}
        onPointerDown={(event) => {
          swipeStart.current = { x: event.clientX, y: event.clientY }
          swiped.current = false
        }}
        onPointerUp={(event) => {
          const start = swipeStart.current
          swipeStart.current = null
          if (start === null || covered) return
          const direction = swipeDirection(start, { x: event.clientX, y: event.clientY })
          const next = direction === 0 ? null : neighbourPage(page, direction)
          if (direction !== 0) swiped.current = true
          if (next !== null) navigate(`/${next}`)
        }}
        onPointerCancel={() => { swipeStart.current = null }}
        // A swipe that starts and ends on one place link isn't a tap on it.
        onClickCapture={(event) => {
          if (!swiped.current) return
          swiped.current = false
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        <HubCanvas page={page} places={scenePlaces} clearings={clearings} paused={covered} reducedMotion={reducedMotion} />
        <PlaceTargets page={page} places={places} view={view} />
      </main>
      <FloatingPill view={view} />
      {peek !== undefined && <OverlayHost key={peek.id} place={peek} view={view} />}
    </>
  )
}
