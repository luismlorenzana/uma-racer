// The Card Library place (docs/game/06-cards-and-bonds.md §6; docs/game/11-hub-and-places.md §3.1, §7.1; T138): the
// album at its root and each card page at `card/:cardId`, in its own chunk.
import { lazy, Suspense } from 'react'
import { PlacePageHeader } from '../PlacePageHeader'
import type { PageProps } from '../registry'
import { CardLibrary } from './CardLibrary'

const CardPage = lazy(() => import('./CardPage'))
const CARD = /^card\/([^/]+)\/?$/

export default function CardLibraryPage({ place, rest }: PageProps) {
  const card = CARD.exec(rest)
  if (card !== null) {
    return (
      <Suspense fallback={null}>
        <CardPage place={place} rest={rest} cardId={decodeURIComponent(card[1]!)} />
      </Suspense>
    )
  }
  return (
    <div data-place-page="card-library">
      <PlacePageHeader place={place} rest={rest} lines={['Every SSR is open. A card joins an Uma\'s sets once it is bonded to her: one Dojo session at the grade its era sets, with nothing to cook.']} />
      <div className="px-4 pt-2 pb-24">
        <CardLibrary mode="browse" title="Cards" />
      </div>
    </div>
  )
}
