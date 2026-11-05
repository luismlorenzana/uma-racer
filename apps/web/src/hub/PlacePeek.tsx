// The quick look (docs/game/11-hub-and-places.md §1; docs/design/ux.md "Peek, Page and Back"; T145, T147): uma-kit's side
// panel on `/:page?peek=:place`, 88% of the screen from the right with the Hub dimmed behind, holding the place's
// registry Peek (or its blurb over its building, and the not-ready line while its screen hasn't landed) and
// **Enter {place}**, which replaces the panel with the place's Page, so Back returns to the map. A swipe right, a tap on
// the dimmed Hub, Escape, the close button or Back closes it; focus stays inside and goes back where it was.
import { navState, PeekPanel, useLeave, withParam } from '@luismlorenzana/uma-kit/shell'
import { HUB_PAGE_NAMES, hubWords, type Place } from '@racer/domain/hub'
import { Suspense, useCallback } from 'react'
import { useLocation } from 'react-router'
import { PLACE_UI } from '../places/registry'
import { NotReady } from '../places/Unfilled'
import { BuildingSprite } from '../ui/BuildingSprite'

/** A place without a Peek of its own: its blurb over its building (uma-rpg's `PlacePreview`). */
function PlacePreview({ place }: { place: Place }) {
  return (
    <div className="space-y-3 py-2" data-racer="place-preview">
      <div className="flex justify-center"><BuildingSprite frame={place.frame} page={place.page} /></div>
      <p className="text-[15px] leading-relaxed text-ink">{place.blurb}</p>
      {PLACE_UI[place.id]?.Page === undefined && <NotReady />}
    </div>
  )
}

export function PlacePeek({ place, count }: { place: Place; count: number | null }) {
  const location = useLocation()
  const leave = useLeave()
  const Peek = PLACE_UI[place.id]?.Peek
  const close = useCallback(() => leave(withParam(location, 'peek', null)), [leave, location])
  return (
    <PeekPanel
      title={place.name}
      count={count !== null && count > 0 ? count : null}
      about={place.blurb}
      onClose={close}
      enter={{ to: place.route, label: hubWords('enter', { place: place.name }), state: { back: navState(location).back } }}
      words={{ close: hubWords('close'), about: hubWords('about', { place: place.name }), backTo: hubWords('back-to', { to: HUB_PAGE_NAMES[place.page] }) }}
      focusKey={`[data-place="${place.id}"]`}
    >
      <Suspense fallback={null}>{Peek !== undefined ? <Peek place={place} /> : <PlacePreview place={place} />}</Suspense>
    </PeekPanel>
  )
}
