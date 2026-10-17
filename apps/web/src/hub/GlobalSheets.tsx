// The global sheets (docs/game/11-hub-and-places.md §2.2, §2.3, §5) in uma-kit's modal bottom sheet: the menu (the
// kit's place menu: every drawn place by page with its counter, then Account and the planner's roster view), the
// featured Uma's quick sheet (T138's slot) and the check-in sheet (T142's slot). Focus moves into the sheet and returns
// to what opened it; Escape (the sheet's own), the close button, the handle and Back close it.
import { navState, PlaceMenu, peekPath, useLeave, type MenuGroup, type MenuPlace } from '@luismlorenzana/uma-kit/shell'
import { BottomSheet } from '@luismlorenzana/uma-kit/ui'
import { HUB_PAGE_NAMES, HUB_PAGES, hubWords, placeById, placesOn, type Place } from '@racer/domain/hub'
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useHub } from '../app/game'
import { SHEET_UI } from '../places/registry'
import { UmaArt } from '../ui/UmaArt'
import { useUmaName } from '../ui/uma'
import { shownCount, usePlaceCounts } from './counts'
import type { G2NavState, GlobalSheet } from './nav'

const TITLES: Readonly<Record<GlobalSheet, string>> = {
  menu: hubWords('menu-title'),
  featured: hubWords('featured-title'),
  'check-in': hubWords('check-in-title'),
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 data-sheet-heading tabIndex={-1} className="pb-2 text-lg outline-none">{children}</h2>
}

function MenuSheet() {
  const view = useHub()
  const counts = usePlaceCounts(view)
  const row = (place: Place): MenuPlace => ({
    key: place.id,
    name: place.name,
    to: place.direct || place.hidden ? place.route : peekPath(place.page, place.id),
    count: shownCount(counts[place.id]),
  })
  const groups: MenuGroup[] = HUB_PAGES.map((page) => ({ key: page, label: HUB_PAGE_NAMES[page], places: placesOn(page).map(row) }))
  const extra: MenuPlace[] = [row(placeById('account')!), { key: 'needs', name: hubWords('menu-needs'), to: '/town/stable/needs' }]
  return (
    <div>
      <Heading>{TITLES.menu}</Heading>
      <PlaceMenu groups={groups} extra={extra} />
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
  // Closing drops the sheet and the crowd figure it was opened for (`&uma=`, SA7).
  const close = () => {
    const params = new URLSearchParams(location.search)
    params.delete('sheet')
    params.delete('uma')
    const rest = params.toString()
    leave(`${location.pathname}${rest === '' ? '' : `?${rest}`}`)
  }
  const asked = new URLSearchParams(location.search).get('uma')

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
    return () => cancelAnimationFrame(frame)
  }, [sheet])

  const collect = navState<G2NavState>(location).collect === true
  const Featured = SHEET_UI.featured
  const CheckIn = SHEET_UI['check-in']
  return (
    <BottomSheet open={sheet !== null} onClose={close} label={shown === null ? undefined : TITLES[shown]}>
      <div ref={body}>
        <Suspense fallback={null}>
          {shown === 'menu' && <MenuSheet />}
          {shown === 'featured' && (Featured ? <Featured umaId={asked ?? view?.featured ?? null} onClose={close} /> : <FeaturedSheet umaId={view?.featured ?? null} />)}
          {shown === 'check-in' && (CheckIn ? <CheckIn collect={collect} onClose={close} /> : <CheckInSheet />)}
        </Suspense>
      </div>
    </BottomSheet>
  )
}
