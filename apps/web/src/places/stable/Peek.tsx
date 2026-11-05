// The Stable's quick look (docs/game/11-hub-and-places.md §2.6; D386): Uma Tickets in hand and how many Umas are owned
// of all of them, then the latest unlocks as faces, each a link to her profile.
import { FaceTile } from '@luismlorenzana/uma-kit/album'
import { OwnedIcon, UiMark } from '@luismlorenzana/uma-kit/ui'
import { hubWords } from '@racer/domain/hub'
import { Link } from 'react-router'
import { useGame, useHub } from '../../app/game'
import { profilePath } from '../../hub/nav'
import { PeekStat } from '../PeekStat'

const LATEST = 5

export default function StablePeek() {
  const view = useHub()
  const umas = useGame((snapshot) => snapshot.env?.content.umas ?? null)
  const owned = view?.owned ?? []
  return (
    <div className="space-y-4 py-2" data-racer="stable-peek">
      <div className="grid grid-cols-2 gap-2">
        <PeekStat icon={<UiMark mark="currency/uma-ticket" />} value={view?.wallet.umaTickets ?? '–'} label={hubWords('peek-uma-tickets')} />
        <PeekStat icon={<OwnedIcon size={20} className="text-ink-soft" />} label={hubWords('peek-owned')}
          value={hubWords('peek-owned-of', { n: owned.length, total: umas?.size ?? '–' })} />
      </div>
      {owned.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-micro">{hubWords('peek-latest-umas')}</h3>
          <ul className="grid grid-cols-5 gap-2">
            {owned.slice(0, LATEST).map((umaId) => {
              const name = umas?.get(umaId)?.name ?? umaId
              return (
                <li key={umaId}>
                  <Link to={profilePath(umaId)} state={{ back: true }} aria-label={hubWords('crowd-figure', { uma: name })} className="block min-h-11 rounded-md">
                    <FaceTile outfitId={umaId} size={56} label={name} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
