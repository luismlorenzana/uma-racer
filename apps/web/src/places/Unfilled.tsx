// A place whose screen hasn't landed yet (T137, T152): its Page is the kit's place header (back, name, (i) with the
// blurb) over the place's building and the not-ready line, "Coming soon" (`hubWords('not-ready')`). M036's parts fill the
// places one by one (`registry.tsx`).
import { Panel } from '@luismlorenzana/uma-kit/ui'
import { hubWords } from '@racer/domain/hub'
import { BuildingSprite } from '../ui/BuildingSprite'
import { PlacePageHeader } from './PlacePageHeader'
import type { PageProps } from './registry'

/** The not-ready line, in the kit's panel. */
export function NotReady() {
  return (
    <Panel className="p-3 text-center" data-racer="not-ready">
      <p className="font-display text-[15px] font-semibold text-ink-soft">{hubWords('not-ready')}</p>
    </Panel>
  )
}

export function UnfilledPage({ place, rest }: PageProps) {
  return (
    <div data-racer="unfilled-page" data-place-page={place.id}>
      <PlacePageHeader place={place} rest={rest} />
      <div className="space-y-4 px-4 py-10">
        <div className="flex justify-center">
          <BuildingSprite frame={place.frame} page={place.page} />
        </div>
        <NotReady />
      </div>
    </div>
  )
}
