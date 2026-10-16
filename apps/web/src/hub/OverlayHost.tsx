// The quick look as a side panel (docs/game/11-hub-and-places.md §1; docs/design/ux.md "Peek, Page and Back"; ported
// from uma-rpg's `hub/OverlayHost.tsx` and its HubScreen quick look, D43): `/:page?peek=:place` slides in from the right
// over 88% of the screen with the Hub dimmed behind. It shows the place's registry Peek (or its blurb over its building)
// and **Enter {place}**, which replaces the panel with the place's Page, so Back returns to the map. A swipe right, a
// tap on the dimmed Hub, Escape, the close button or Back closes it; focus stays inside and goes back where it was.
import { HUB_PAGE_NAMES, hubWords, type HubView, type Place } from '@racer/domain/hub'
import { m } from 'motion/react'
import { Suspense, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { PLACE_UI } from '../places/registry'
import { BuildingSprite } from '../ui/BuildingSprite'
import { CloseIcon, InfoIcon } from '../ui/icons'
import { shownCount, usePlaceCount } from './counts'
import { navState, useLeave, withParam } from './nav'
import { swipeDirection, type Point } from './swipe'

const EASE = [0.2, 0, 0, 1] as const
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** A place without a Peek of its own: its blurb over its building (uma-rpg's `PlacePreview`). */
function PlacePreview({ place }: { place: Place }) {
  return (
    <div className="space-y-3 py-2" data-g2="place-preview">
      <div className="flex justify-center"><BuildingSprite frame={place.frame} page={place.page} /></div>
      <p className="text-[15px] leading-relaxed text-ink">{place.blurb}</p>
    </div>
  )
}

export function OverlayHost({ place, view }: { place: Place; view: HubView | null }) {
  const location = useLocation()
  const leave = useLeave()
  const title = useId()
  const panel = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const start = useRef<Point | null>(null)
  const [about, setAbout] = useState(false)
  const count = shownCount(usePlaceCount(place, view))
  const Peek = PLACE_UI[place.id]?.Peek
  const close = useCallback(() => leave(withParam(location, 'peek', null)), [leave, location])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    heading.current?.focus()
    setAbout(false)
    return () => {
      const target = previous?.isConnected ? previous : document.querySelector<HTMLElement>(`[data-place="${place.id}"]`)
      target?.focus()
    }
  }, [place.id])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.key !== 'Tab' || panel.current === null) return
      const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const i = focusable.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey ? i <= 0 : i === -1 || i === focusable.length - 1) {
        event.preventDefault()
        ;(event.shiftKey ? last : first)?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  return (
    <div className="fixed inset-0 z-30" role="dialog" aria-modal="true" aria-labelledby={title} data-g2="peek">
      <m.button
        type="button"
        tabIndex={-1}
        aria-label={hubWords('back-to', { to: HUB_PAGE_NAMES[place.page] })}
        onClick={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, ease: EASE }}
        className="absolute inset-0 bg-black/45"
      />
      <m.div
        ref={panel}
        initial={{ x: 24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.22, ease: EASE }}
        onPointerDown={(event) => { start.current = { x: event.clientX, y: event.clientY } }}
        onPointerUp={(event) => {
          if (start.current !== null && swipeDirection(start.current, { x: event.clientX, y: event.clientY }) === -1) close()
          start.current = null
        }}
        onPointerCancel={() => { start.current = null }}
        className="pt-safe pb-safe absolute inset-y-0 right-0 flex w-[88%] max-w-md touch-pan-y flex-col border-l border-hairline-strong bg-panel shadow-3"
        data-g2="side-panel"
      >
        <div className="flex shrink-0 items-center gap-1 border-b border-hairline py-1 pr-1 pl-4">
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
        {about && <p className="shrink-0 px-4 pt-2 text-[13px] leading-relaxed text-ink-soft">{place.blurb}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
          <Suspense fallback={null}>{Peek !== undefined ? <Peek place={place} /> : <PlacePreview place={place} />}</Suspense>
        </div>
        <div className="shrink-0 border-t border-hairline bg-panel/95 p-3">
          <Link
            to={place.route}
            replace
            state={{ back: navState(location).back }}
            className="font-display flex min-h-12 w-full items-center justify-center rounded-sm bg-accent text-base font-bold text-ink shadow-1"
          >
            {hubWords('enter', { place: place.name })}
          </Link>
        </div>
      </m.div>
    </div>
  )
}
