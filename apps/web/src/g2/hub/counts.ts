// A place's counter (docs/rework/11-hub-and-places.md §1, §3): the hub view's count by default, or the place's own
// `useCounter` where the rework state can't give it (T141's Racecourse and Trophy Hall). 0 is hidden, so the bar and
// the pages stay quiet (§2.2).
import type { HubView, Place } from '@racer/domain/hub'
import { PLACE_UI } from '../places/registry'

/** Call once per place, with the same place for the component's life: the registry's hook is fixed per place. */
export function usePlaceCount(place: Place, view: HubView | null): number | null {
  const own = PLACE_UI[place.id]?.useCounter
  if (own !== undefined) return own()
  return view?.counts[place.id] ?? null
}

/** The badge to draw: a count above 0, else nothing. */
export const shownCount = (count: number | null): number | null => (count !== null && count > 0 ? count : null)
