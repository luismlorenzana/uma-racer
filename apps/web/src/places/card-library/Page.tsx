// The Card Library (docs/game/11-hub-and-places.md §3.1, docs/game/02-unlocks.md §3; D386): `/town/card-library` is the
// album and `/town/card-library/card/:cardId` a card's page. Any other sub-route goes back to the album.
import { Navigate } from 'react-router'
import type { PageProps } from '../registry'
import { CardPage } from './CardPage'
import { Library } from './Library'

export default function CardLibraryPage({ place, rest }: PageProps) {
  if (rest === '') return <Library place={place} />
  const [segment, cardId, ...more] = rest.split('/')
  if (segment !== 'card' || cardId === undefined || cardId === '' || more.length > 0) return <Navigate to={place.route} replace />
  // The router hands `rest` decoded. Keyed by the card, so moving to another one starts its page afresh.
  return <CardPage key={cardId} place={place} rest={rest} cardId={cardId} />
}
