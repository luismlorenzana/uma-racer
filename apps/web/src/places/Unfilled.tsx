// What an unfilled slot shows until its task lands (T137): a Page is its header (back, name, (i) with the blurb) over
// the place's building; the reveal is a full-screen frame with her art, her name and the way to her profile. No
// placeholder text: the (i) holds the explanation (uma-rpg D95).
import { hubWords } from '@racer/domain/hub'
import { Link } from 'react-router'
import { BuildingSprite } from '../ui/BuildingSprite'
import { PlacePageHeader } from './PlacePageHeader'
import { UmaArt } from '../ui/UmaArt'
import { useUmaName } from '../ui/uma'
import type { FlowProps, PageProps } from './registry'

export function UnfilledPage({ place, rest }: PageProps) {
  return (
    <div data-g2="unfilled-page" data-place-page={place.id}>
      <PlacePageHeader place={place} rest={rest} />
      <div className="flex justify-center py-10">
        <BuildingSprite frame={place.frame} page={place.page} />
      </div>
    </div>
  )
}

export function UnfilledReveal({ params }: FlowProps) {
  const umaId = params['umaId'] ?? ''
  const name = useUmaName(umaId)
  return (
    <div data-g2="unfilled-reveal" className="pt-safe pb-safe flex h-dvh flex-col items-center justify-center gap-4 bg-stage px-6 text-ink-on-dark">
      <UmaArt outfitId={umaId} size={160} />
      <h1 className="font-display text-2xl font-bold">{name}</h1>
      <Link
        to={`/town/stable/outfit/${encodeURIComponent(umaId)}`}
        replace
        className="font-display flex min-h-12 items-center rounded-sm bg-accent px-6 font-bold text-ink shadow-1"
      >
        {hubWords('profile')}
      </Link>
    </div>
  )
}
