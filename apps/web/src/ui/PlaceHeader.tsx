// Every place Page's header (docs/game/11-hub-and-places.md §1): back, the name, and (i) with the registry's blurb and
// the place's own lines, since explanations live behind (i), never in banners (uma-rpg D95). Back pops to where the Page
// was opened from, or goes up: a sub-route to its place, a place to its page.
import { HUB_PAGE_NAMES, hubWords, type Place } from '@racer/domain/hub'
import { useId, useState, type ReactNode } from 'react'
import { ChevronLeftIcon } from './icons'
import { useLeave } from '../hub/nav'
import { InfoIcon } from './icons'

export function PlaceHeader({ place, rest = '', title, lines = [], back, children }: {
  place: Place
  /** The Page's sub-route; Back from one goes to the place's root. */
  rest?: string
  /** A sub-page's own title; the place's name otherwise. */
  title?: string
  /** The place's own lines under its blurb in (i). */
  lines?: readonly ReactNode[]
  /** Where Back goes when the Page wasn't opened from inside the app. */
  back?: string
  /** Trailing header content: a counter, an action. */
  children?: ReactNode
}) {
  const leave = useLeave()
  const [open, setOpen] = useState(false)
  const about = useId()
  const target = back ?? (rest ? place.route : `/${place.page}`)
  const targetName = rest ? place.name : HUB_PAGE_NAMES[place.page]
  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-panel/95 backdrop-blur">
      <div className="flex min-h-13 items-center gap-1 px-1.5">
        <button
          type="button"
          onClick={() => leave(target)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft"
          aria-label={hubWords('back-to', { to: targetName })}
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg">{title ?? place.name}</h1>
        {children}
        <button
          type="button"
          onClick={() => setOpen((shown) => !shown)}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${open ? 'text-accent-strong' : 'text-ink-soft'}`}
          aria-label={hubWords('about', { place: place.name })}
          aria-expanded={open}
          aria-controls={about}
        >
          <InfoIcon variant={open ? 'duotone' : 'line'} />
        </button>
      </div>
      <div id={about} hidden={!open} className="space-y-1 px-4 pb-3 text-[13px] leading-relaxed text-ink-soft">
        <p>{place.blurb}</p>
        {lines.map((line, i) => <p key={i}>{line}</p>)}
      </div>
    </header>
  )
}
