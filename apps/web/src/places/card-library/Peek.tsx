// The Card Library's quick look (docs/game/11-hub-and-places.md §2.6; D386): Card Tickets in hand and how many cards are
// owned of all of them.
import { CardsIcon, OwnedIcon, UiMark } from '@luismlorenzana/uma-kit/ui'
import { hubWords } from '@racer/domain/hub'
import { useGame, useHub } from '../../app/game'
import { PeekStat } from '../PeekStat'

export default function CardLibraryPeek() {
  const view = useHub()
  const total = useGame((snapshot) => snapshot.env?.content.cards.size ?? null)
  return (
    <div className="grid grid-cols-2 gap-2 py-2" data-racer="card-library-peek">
      <PeekStat icon={<UiMark mark="currency/card-ticket" fallback={<CardsIcon size={20} variant="duotone" />} />}
        value={view?.wallet.cardTickets ?? '–'} label={hubWords('peek-card-tickets')} />
      <PeekStat icon={<OwnedIcon size={20} className="text-ink-soft" />} label={hubWords('peek-owned')}
        value={hubWords('peek-owned-of', { n: view?.ownedCards ?? 0, total: total ?? '–' })} />
    </div>
  )
}
