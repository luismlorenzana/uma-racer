// The global sheets (docs/game/11-hub-and-places.md §2.2) in uma-kit's modal bottom sheet: the menu, the kit's place
// menu with every drawn place by page and its counter, then Account. Focus moves into the sheet and returns to what
// opened it; Escape (the sheet's own), the close button, the handle and Back close it.
import { PlaceMenu, peekPath, useLeave, type MenuGroup, type MenuPlace } from '@luismlorenzana/uma-kit/shell'
import { BottomSheet } from '@luismlorenzana/uma-kit/ui'
import { HUB_PAGE_NAMES, HUB_PAGES, hubWords, placeById, placesOn, type Place } from '@racer/domain/hub'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import { useHub } from '../app/game'
import { placeCounts, shownCount } from './counts'
import type { GlobalSheet } from './nav'

const TITLES: Readonly<Record<GlobalSheet, string>> = {
  menu: hubWords('menu-title'),
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 data-sheet-heading tabIndex={-1} className="pb-2 text-lg outline-none">{children}</h2>
}

function MenuSheet() {
  const counts = placeCounts(useHub())
  const row = (place: Place): MenuPlace => ({
    key: place.id,
    name: place.name,
    to: place.direct || place.hidden ? place.route : peekPath(place.page, place.id),
    count: shownCount(counts[place.id]),
  })
  const groups: MenuGroup[] = HUB_PAGES.map((page) => ({ key: page, label: HUB_PAGE_NAMES[page], places: placesOn(page).map(row) }))
  return (
    <div>
      <Heading>{TITLES.menu}</Heading>
      <PlaceMenu groups={groups} extra={[row(placeById('account')!)]} />
    </div>
  )
}

export default function GlobalSheets({ sheet }: { sheet: GlobalSheet | null }) {
  const location = useLocation()
  const leave = useLeave()
  const [shown, setShown] = useState<GlobalSheet | null>(sheet)
  const body = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const close = () => {
    const params = new URLSearchParams(location.search)
    params.delete('sheet')
    const rest = params.toString()
    leave(`${location.pathname}${rest === '' ? '' : `?${rest}`}`)
  }

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

  return (
    <BottomSheet open={sheet !== null} onClose={close} label={shown === null ? undefined : TITLES[shown]}>
      <div ref={body}>{shown === 'menu' && <MenuSheet />}</div>
    </BottomSheet>
  )
}
