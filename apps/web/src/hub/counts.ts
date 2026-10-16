// A place's counter (docs/game/11-hub-and-places.md §1, §3): the hub view's count by default, or the place's own
// `useCounter` where the rework state can't give it (T141's Racecourse and Trophy Hall). 0 is hidden, so the bar and
// the pages stay quiet (§2.2). uma-kit's map and menu take the counts as values, so a screen reads all it shows at once.
import { HUB_PAGES, placesOn, type HubView, type Place, type PlaceId } from '@racer/domain/hub'
import { PLACE_UI } from '../places/registry'

/** The places with a counter hook of their own, in one fixed order, so a screen can call every hook on every render. */
const OWN_COUNTERS: readonly Place[] = HUB_PAGES.flatMap((page) => placesOn(page)).filter((place) => PLACE_UI[place.id]?.useCounter !== undefined)

/**
 * Every place's count, by id. `active` says which own counters a screen shows now: an inactive one reads nothing and
 * counts null, so a Hub page loads only its own places' (the Racing page's Racecourse and Trophy Hall).
 */
export function usePlaceCounts(view: HubView | null, active: (place: Place) => boolean = () => true): Readonly<Partial<Record<PlaceId, number | null>>> {
  const counts: Partial<Record<PlaceId, number | null>> = { ...view?.counts }
  for (const place of OWN_COUNTERS) counts[place.id] = PLACE_UI[place.id]!.useCounter!(active(place))
  return counts
}

/** The count to draw: above 0, else nothing. */
export const shownCount = (count: number | null | undefined): number | null => (count !== null && count !== undefined && count > 0 ? count : null)
