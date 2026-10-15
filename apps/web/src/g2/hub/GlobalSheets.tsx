// The global sheets (docs/rework/11-hub-and-places.md §2.2, §2.3, §5) in today's modal BottomSheet: the menu (every
// drawn place by page with its counter, then Account and the planner's roster view), the featured Uma's quick sheet
// (T138's slot) and the check-in sheet (T142's slot). Focus moves into the sheet and returns to what opened it; Escape,
// the close button, the handle and Back close it.
import { HUB_PAGE_NAMES, HUB_PAGES, hubWords, placeById, placesOn, type HubView, type Place } from '@racer/domain/hub'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { BottomSheet } from '../../ui/BottomSheet'
import { useHub } from '../app/game'
import { SHEET_UI } from '../places/registry'
import { UmaArt } from '../ui/UmaArt'
import { useUmaName } from '../ui/uma'
import { shownCount, usePlaceCount } from './counts'
import { navState, peekPath, useLeave, withParam, type GlobalSheet } from './nav'

const TITLES: Readonly<Record<GlobalSheet, string>> = {
  menu: hubWords('menu-title'),
  featured: hubWords('featured-title'),
  'check-in': hubWords('check-in-title'),
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 data-sheet-heading tabIndex={-1} className="pb-2 text-lg outline-none">{children}</h2>
}

function MenuRow({ place, view }: { place: Place; view: HubView | null }) {
  const location = useLocation()
  const count = shownCount(usePlaceCount(place, view))
  const to = place.direct || place.hidden ? place.route : peekPath(place)
  return (
    <li>
      <Link
        to={to}
        replace
        state={{ back: navState(location).back }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-sm bg-sunken/60 px-3 text-left text-[13px] font-semibold"
      >
        <span className="truncate">{place.name}</span>
        {count !== null && <span className="font-display min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] leading-5 text-ink">{count}</span>}
      </Link>
    </li>
  )
}

function MenuSheet() {
  const view = useHub()
  const location = useLocation()
  const account = placeById('account')!
  return (
    <div>
      <Heading>{TITLES.menu}</Heading>
      <div className="space-y-4">
        {HUB_PAGES.map((page) => (
          <section key={page} aria-label={HUB_PAGE_NAMES[page]}>
            <h3 className="text-micro mb-1.5">{HUB_PAGE_NAMES[page]}</h3>
            <ul className="grid grid-cols-2 gap-1.5">
              {placesOn(page).map((place) => <MenuRow key={place.id} place={place} view={view} />)}
            </ul>
          </section>
        ))}
        <ul className="grid grid-cols-2 gap-1.5 border-t border-hairline pt-3">
          <MenuRow place={account} view={view} />
          <li>
            <Link
              to="/town/stable/needs"
              replace
              state={{ back: navState(location).back }}
              className="flex min-h-11 w-full items-center rounded-sm bg-sunken/60 px-3 text-left text-[13px] font-semibold"
            >
              {hubWords('menu-needs')}
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}

/** The featured Uma's sheet until T138's lands: her art and name, and the links her quick sheet offers (§5). */
function FeaturedSheet({ umaId }: { umaId: string | null }) {
  const name = useUmaName(umaId)
  const location = useLocation()
  if (umaId === null) return <Heading>{hubWords('no-umas')}</Heading>
  const links: readonly [string, string][] = [
    [hubWords('train'), `/town/stable/outfit/${encodeURIComponent(umaId)}/needs`],
    [hubWords('race'), `/racing/racecourse?uma=${encodeURIComponent(umaId)}`],
    [hubWords('profile'), `/town/stable/outfit/${encodeURIComponent(umaId)}`],
  ]
  return (
    <div>
      <div className="flex items-center gap-3 pb-3">
        <UmaArt outfitId={umaId} size={64} />
        <Heading>{name}</Heading>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {links.map(([label, to]) => (
          <Link key={to} to={to} replace state={{ back: navState(location).back }} className="font-display flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel font-semibold shadow-1">
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}

/** The check-in sheet until T142's lands: the pill's counts. */
function CheckInSheet() {
  const view = useHub()
  return (
    <div>
      <Heading>{TITLES['check-in']}</Heading>
      {view !== null && <p className="text-[15px] text-ink-soft">{hubWords('check-in-counts', { ready: view.ready, free: view.free })}</p>}
    </div>
  )
}

export default function GlobalSheets({ sheet }: { sheet: GlobalSheet | null }) {
  const location = useLocation()
  const leave = useLeave()
  const view = useHub()
  const [shown, setShown] = useState<GlobalSheet | null>(sheet)
  const body = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const close = () => leave(withParam(location, 'sheet', null))

  useEffect(() => {
    if (sheet === null) {
      const back = opener.current
      opener.current = null
      if (back?.isConnected) back.focus()
      return
    }
    setShown(sheet)
    if (opener.current === null && document.activeElement instanceof HTMLElement) opener.current = document.activeElement
    const frame = requestAnimationFrame(() => body.current?.querySelector<HTMLElement>('[data-sheet-heading]')?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
    }
    // `close` reads the location the sheet opened on; binding it once per sheet is enough.
  }, [sheet])

  const collect = navState(location).collect === true
  const Featured = SHEET_UI.featured
  const CheckIn = SHEET_UI['check-in']
  return (
    <BottomSheet open={sheet !== null} onClose={close} label={shown === null ? undefined : TITLES[shown]}>
      <div ref={body}>
        <Suspense fallback={null}>
          {shown === 'menu' && <MenuSheet />}
          {shown === 'featured' && (Featured ? <Featured umaId={view?.featured ?? null} onClose={close} /> : <FeaturedSheet umaId={view?.featured ?? null} />)}
          {shown === 'check-in' && (CheckIn ? <CheckIn collect={collect} onClose={close} /> : <CheckInSheet />)}
        </Suspense>
      </div>
    </BottomSheet>
  )
}
