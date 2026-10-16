// Every place Page's header (docs/game/11-hub-and-places.md §1; T147): uma-kit's place header with a place's words.
// Back, the name, and (i) with the registry's blurb and the place's own lines, since explanations live behind (i), never
// in banners (uma-rpg D95). Back pops to where the Page was opened from, or goes up: a sub-route to its place, a place to
// its page.
import { PlaceHeader, useLeave } from '@luismlorenzana/uma-kit/shell'
import { HUB_PAGE_NAMES, hubWords, type Place } from '@racer/domain/hub'
import type { ReactNode } from 'react'

export function PlacePageHeader({ place, rest = '', title, lines = [], back, children }: {
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
  const target = back ?? (rest ? place.route : `/${place.page}`)
  const targetName = rest ? place.name : HUB_PAGE_NAMES[place.page]
  return (
    <PlaceHeader
      title={title ?? place.name}
      onBack={() => leave(target)}
      about={<><p>{place.blurb}</p>{lines.map((line, i) => <p key={i}>{line}</p>)}</>}
      words={{ back: hubWords('back-to', { to: targetName }), about: hubWords('about', { place: place.name }) }}
    >
      {children}
    </PlaceHeader>
  )
}
