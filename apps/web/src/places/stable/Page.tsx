// The Stable (docs/game/11-hub-and-places.md §3.1, docs/game/02-unlocks.md §2; D386): `/town/stable` is the album and
// `/town/stable/outfit/:umaId` her profile. Any other sub-route goes back to the album.
import { Navigate } from 'react-router'
import type { PageProps } from '../registry'
import { Album } from './Album'
import { Profile } from './Profile'

export default function StablePage({ place, rest }: PageProps) {
  if (rest === '') return <Album place={place} />
  const [segment, umaId, ...more] = rest.split('/')
  if (segment !== 'outfit' || umaId === undefined || umaId === '' || more.length > 0) return <Navigate to={place.route} replace />
  // The router hands `rest` decoded. Keyed by her, so moving to another Uma closes any open sheet.
  return <Profile key={umaId} place={place} rest={rest} umaId={umaId} />
}
