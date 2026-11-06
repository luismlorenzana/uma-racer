// The Card Library's quick look (docs/game/11-hub-and-places.md §2.6; D386, D392): Card Tickets in hand and how many
// of the cards this release can unlock are owned.
import { OwnedIcon, UiMark } from '@luismlorenzana/uma-kit/ui'
import { hubWords } from '@racer/domain/hub'
import { useMemo } from 'react'
import { useGame, useHub } from '../../app/game'
import { PeekStat } from '../PeekStat'
import { unlockableCount } from './model'

export default function CardLibraryPeek() {
  const view = useHub()
  const cards = useGame((snapshot) => snapshot.env?.content.cards ?? null)
  const owned = useGame((snapshot) => snapshot.state?.cards ?? null)
  const count = useMemo(() => (cards === null || owned === null ? null : unlockableCount(cards.values(), owned)), [cards, owned])
  return (
    <div className="grid grid-cols-2 gap-2 py-2" data-racer="card-library-peek">
      <PeekStat icon={<UiMark mark="currency/card-ticket" />}
        value={view?.wallet.cardTickets ?? '–'} label={hubWords('peek-card-tickets')} />
      <PeekStat icon={<OwnedIcon size={20} className="text-ink-soft" />} label={hubWords('peek-owned')}
        value={hubWords('peek-owned-of', { n: count?.n ?? 0, total: count?.total ?? '–' })} />
    </div>
  )
}
