// One Uma in the Town Hall plaza's crowd (docs/game/11-hub-and-places.md §5, SA7): her 44 pt art (the kit's chibi, else
// bust, icon or initial), no name on the map. A tap opens her profile in the Stable.
import { UmaChibi } from '@luismlorenzana/uma-kit/album'
import { hubWords } from '@racer/domain/hub'
import { Link } from 'react-router'
import { useUmaName } from '../ui/uma'

export const profilePath = (umaId: string): string => `/town/stable/outfit/${encodeURIComponent(umaId)}`

export function PlazaFigure({ umaId }: { umaId: string }) {
  const name = useUmaName(umaId)
  return (
    <Link
      to={profilePath(umaId)}
      state={{ back: true }}
      aria-label={hubWords('crowd-figure', { uma: name || umaId })}
      data-racer="plaza-figure"
      data-uma={umaId}
      className="flex size-11 items-end justify-center rounded-md active:bg-ink/5"
    >
      <UmaChibi outfitId={umaId} label={name} size={44} className="size-11" />
    </Link>
  )
}
