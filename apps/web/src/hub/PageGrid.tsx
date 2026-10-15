// A Hub page as a DOM grid of place tiles (docs/rework/11-hub-and-places.md §3, §4, §11, §12): each place in its
// registry cell on a three-column grid that scrolls vertically when it doesn't fit, never sideways; the Town Hall plaza
// with the featured Uma (§5); the floating pill (§2.3); and the Peek, a non-modal half sheet that leaves the page live.
// A tile is one link: to its Peek, to its Page when it is `direct` or already peeked, labelled with its VoiceOver line.
import {
  hubWords, pageRows, pillWords, PLAZA_CELL, placesOn, tileLabel, type HubPage, type HubView, type Place,
} from '@racer/domain/hub'
import type { BuildingId } from '@racer/domain/rework/farm'
import { m } from 'motion/react'
import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { CloseIcon } from '../ui/icons'
import { useHub } from '../app/game'
import { PLACE_UI, TOWN_PLAZA } from '../places/registry'
import { BuildingSprite } from '../ui/BuildingSprite'
import { InfoIcon } from '../ui/icons'
import { UmaArt } from '../ui/UmaArt'
import { useUmaName } from '../ui/uma'
import { shownCount, usePlaceCount } from './counts'
import { navState, peekPath, useLeave, withParam } from './nav'
import { Pips } from './Pips'

const EASE = [0.2, 0, 0, 1] as const

function PlaceTile({ place, view, peek }: { place: Place; view: HubView | null; peek: Place | undefined }) {
  const location = useLocation()
  const count = usePlaceCount(place, view)
  const shown = shownCount(count)
  const building = place.pips && view !== null ? view.buildings[place.id as BuildingId] : undefined
  const peeked = peek?.id === place.id
  // Tap once for the Peek, again for the Page; from an open Peek either replaces it, so Back returns to the page.
  const to = place.direct || peeked ? place.route : peekPath(place)
  const fromPeek = peek !== undefined
  return (
    <Link
      to={to}
      replace={fromPeek}
      state={{ back: fromPeek ? navState(location).back : true }}
      data-place={place.id}
      aria-label={tileLabel(place, view, count)}
      aria-current={peeked ? 'true' : undefined}
      className={`flex min-h-24 w-full min-w-24 flex-col items-center gap-1 rounded-md px-0.5 py-1 transition-colors active:bg-ink/5 ${peeked ? 'bg-accent-wash ring-2 ring-accent/60' : ''}`}
      style={{ gridRow: place.cell!.row, gridColumn: place.cell!.col }}
    >
      <span className="relative">
        <BuildingSprite frame={place.frame} />
        {building !== undefined && building.ready > 0 && (
          <span aria-hidden data-ready-badge={building.ready} className="font-display absolute -top-1 -right-2 rounded-full bg-success px-1.5 text-[10px] leading-4 font-bold text-ink-on-dark shadow-1">
            {hubWords('ready-badge', { n: building.ready })}
          </span>
        )}
      </span>
      <span aria-hidden className="relative max-w-full rounded-full border border-hairline bg-panel/95 px-1.5 py-0.5 text-[11px] leading-4 font-semibold text-ink shadow-1">
        <span className="block truncate">{place.name}</span>
        {shown !== null && (
          <span data-counter={shown} className="font-display absolute -top-2 -right-2.5 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 text-ink shadow-1">
            {shown}
          </span>
        )}
      </span>
      {building !== undefined && <Pips building={building} />}
    </Link>
  )
}

/** The Town Hall plaza (§5): T138's card when it lands, else the featured Uma as still art; empty with no Umas. */
function Plaza({ view }: { view: HubView | null }) {
  const location = useLocation()
  const umaId = view?.featured ?? null
  const name = useUmaName(umaId)
  const Card = TOWN_PLAZA.Card
  return (
    <div className="flex items-center justify-center" style={{ gridRow: PLAZA_CELL.row, gridColumn: PLAZA_CELL.col }} data-g2="plaza">
      {Card !== undefined ? (
        <Suspense fallback={null}><Card umaId={umaId} /></Suspense>
      ) : umaId !== null && (
        <Link
          to={withParam(location, 'sheet', 'featured')}
          state={{ back: true }}
          aria-label={hubWords('featured', { uma: name })}
          className="flex min-h-24 min-w-24 flex-col items-center justify-center gap-1 rounded-md p-1 active:bg-ink/5"
        >
          <UmaArt outfitId={umaId} size={72} />
          <span aria-hidden className="max-w-28 truncate rounded-full border border-accent/40 bg-accent-wash px-2 py-0.5 text-[11px] leading-4 font-semibold text-ink">{name}</span>
        </Link>
      )}
    </div>
  )
}

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

/** The Peek (§1): a non-modal sheet over the lower half. Back, the close button or the handle close it; Enter opens the Page. */
function PeekSheet({ place, view }: { place: Place; view: HubView | null }) {
  const location = useLocation()
  const leave = useLeave()
  const title = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  const swipe = useRef<number | null>(null)
  const [about, setAbout] = useState(false)
  const count = shownCount(usePlaceCount(place, view))
  const Peek = PLACE_UI[place.id]?.Peek
  const close = useCallback(() => leave(withParam(location, 'peek', null)), [leave, location])

  useEffect(() => {
    heading.current?.focus()
    setAbout(false)
    return () => document.querySelector<HTMLElement>(`[data-place="${place.id}"]`)?.focus()
  }, [place.id])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <m.section
      role="dialog"
      aria-modal={false}
      aria-labelledby={title}
      data-g2="peek"
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.18, ease: EASE }}
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[52%] min-h-[40%] flex-col rounded-t-lg border-t border-hairline bg-panel shadow-3"
    >
      <div
        aria-hidden
        onClick={close}
        onPointerDown={(event) => { swipe.current = event.clientY }}
        onPointerUp={(event) => {
          if (swipe.current !== null && event.clientY - swipe.current > 40) close()
          swipe.current = null
        }}
        className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
      >
        <span className="h-1.5 w-12 rounded-full bg-ink/20" />
      </div>
      <div className="flex shrink-0 items-center gap-1 pr-1 pl-4">
        <h2 ref={heading} id={title} tabIndex={-1} className="min-w-0 flex-1 truncate text-lg outline-none">{place.name}</h2>
        {count !== null && <span className="font-display min-w-5 rounded-full bg-accent px-1.5 text-center text-[12px] leading-5 text-ink">{count}</span>}
        <button
          type="button"
          onClick={() => setAbout((open) => !open)}
          aria-label={hubWords('about', { place: place.name })}
          aria-expanded={about}
          className={`flex size-11 items-center justify-center rounded-full ${about ? 'text-accent-strong' : 'text-ink-soft'}`}
        >
          <InfoIcon variant={about ? 'duotone' : 'line'} />
        </button>
        <button type="button" onClick={close} aria-label={hubWords('close')} className="flex size-11 items-center justify-center rounded-full text-ink-soft">
          <CloseIcon size={20} />
        </button>
      </div>
      {about && <p className="shrink-0 px-4 pb-2 text-[13px] leading-relaxed text-ink-soft">{place.blurb}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
        {Peek !== undefined ? (
          <Suspense fallback={null}><Peek place={place} /></Suspense>
        ) : (
          <div className="flex justify-center py-2"><BuildingSprite frame={place.frame} /></div>
        )}
      </div>
      <div className="shrink-0 border-t border-hairline p-3">
        <Link
          to={place.route}
          replace
          state={{ back: navState(location).back }}
          className="font-display flex min-h-12 w-full items-center justify-center rounded-sm bg-accent text-base font-bold text-ink shadow-1"
        >
          {hubWords('enter', { place: place.name })}
        </Link>
      </div>
    </m.section>
  )
}

export default function PageGrid({ page }: { page: HubPage }) {
  const [params] = useSearchParams()
  const location = useLocation()
  const view = useHub()
  const places = placesOn(page)
  // Reading order follows the grid, row by row, so VoiceOver and the keyboard meet the tiles as the eye does.
  const cells = [
    ...places.map((place) => ({ place, ...place.cell! })),
    ...(page === 'town' ? [{ place: null, ...PLAZA_CELL }] : []),
  ].sort((a, b) => a.row - b.row || a.col - b.col)
  const peekId = params.get('peek')
  const peek = peekId === null ? undefined : places.find((place) => place.id === peekId && !place.direct)
  if (peekId !== null && peek === undefined) return <Navigate to={withParam(location, 'peek', null)} replace />
  return (
    <>
      <div className="absolute inset-0 overflow-x-hidden overflow-y-auto overscroll-contain" data-g2="page" data-page={page}>
        <div
          className={`grid min-h-full grid-cols-3 content-evenly justify-items-center gap-x-1 gap-y-3 px-2 pt-3 ${peek ? 'pb-[56dvh]' : 'pb-20'}`}
          style={{ gridTemplateRows: `repeat(${pageRows(page)}, auto)` }}
        >
          {cells.map((cell) => (cell.place === null
            ? <Plaza key="plaza" view={view} />
            : <PlaceTile key={cell.place.id} place={cell.place} view={view} peek={peek} />))}
        </div>
      </div>
      <FloatingPill view={view} />
      {peek !== undefined && <PeekSheet key={peek.id} place={peek} view={view} />}
    </>
  )
}
