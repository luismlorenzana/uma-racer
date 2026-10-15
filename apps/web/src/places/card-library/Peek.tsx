// The Card Library's Peek (docs/game/11-hub-and-places.md §3.1; T138): the newest cards, the bonds made this tier (every
// Uma's, in her current tier), and the cards the featured Uma could bond now.
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useGame, useHub } from '../../app/game'
import { umaName } from '../../ui/words'
import type { PeekProps } from '../registry'
import { bondOf, cardName } from './model'
import { isRefusal } from '@racer/domain/state'

export default function CardLibraryPeek(_: PeekProps) {
  const state = useGame((snapshot) => snapshot.state)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const featured = useHub()?.featured ?? null
  const view = useMemo(() => {
    if (state === null || content === null) return null
    const cards = [...content.cards.values()]
    const newest = [...cards].sort((a, b) => b.era - a.era || b.jpRelease.localeCompare(a.jpRelease) || a.title.localeCompare(b.title)).slice(0, 3)
    const bonds = Object.values(state.umas).reduce((sum, uma) => sum + uma.build.bonds.length, 0)
    const uma = featured === null ? null : state.umas[featured] ?? null
    const could = uma === null ? [] : cards.filter((card) => {
      const status = bondOf(state, uma, card)
      return !isRefusal(status) && status.status === 'available'
    })
    return { newest, bonds, could }
  }, [state, content, featured])
  if (view === null || content === null) return null
  return (
    <div className="space-y-3 text-[14px]" data-g2="library-peek">
      <section aria-label="Newest cards">
        <h3 className="text-micro mb-1">Newest cards</h3>
        <ul className="space-y-1">
          {view.newest.map((card) => (
            <li key={card.id}>
              <Link to={`/town/card-library/card/${encodeURIComponent(card.id)}`} state={{ back: true }} className="flex min-h-11 items-center rounded-sm bg-sunken/60 px-3 font-semibold">
                <span className="truncate">{cardName(card)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p data-g2="bonds-this-tier"><strong>{view.bonds}</strong> bond{view.bonds === 1 ? '' : 's'} made this tier</p>
      {featured !== null && (
        <p data-g2="featured-could"><strong>{view.could.length}</strong> card{view.could.length === 1 ? '' : 's'} {umaName(content, featured)} could bond now</p>
      )}
    </div>
  )
}
