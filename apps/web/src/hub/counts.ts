// A place's counter (docs/game/11-hub-and-places.md §1, §3): the hub view's count (Uma Tickets on the Stable, Card
// Tickets on the Card Library, careers open on Careers). 0 is hidden, so the pages stay quiet (§2.2). uma-kit's map and
// menu take the counts as values.
import type { HubView, PlaceId } from '@racer/domain/hub'

/** Every place's count, by id; none while the save loads. */
export const placeCounts = (view: HubView | null): Readonly<Partial<Record<PlaceId, number>>> => view?.counts ?? {}

/** The count to draw: above 0, else nothing. */
export const shownCount = (count: number | null | undefined): number | null => (count !== null && count !== undefined && count > 0 ? count : null)
