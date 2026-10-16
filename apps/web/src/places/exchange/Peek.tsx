// The Exchange's Peek (docs/game/11-hub-and-places.md §3.1; T138): Prize Money, Speed Tickets held, and the planner's top
// shortage with its price, linking to its row.
import { UiMark } from '@luismlorenzana/uma-kit/ui'
import { itemById, SPEED_TICKET_ID } from '@racer/domain/items'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useGame, useNow } from '../../app/game'
import { amount } from '../../ui/labels'
import type { PeekProps } from '../registry'
import { exchangeView, topShortage } from './model'

export default function ExchangePeek(_: PeekProps) {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const view = useMemo(() => (state === null || env === null ? null : exchangeView(state, now, env)), [state, env, now])
  if (view === null) return null
  const top = topShortage(view.current, view.plan)
  const item = top === null ? null : itemById(top.line.item)
  return (
    <div className="space-y-2 text-[14px]" data-g2="exchange-peek">
      <p className="flex items-center gap-4">
        <span className="flex items-center gap-1"><UiMark mark="currency/prize-money" /><strong>{amount(view.current.profile.prizeMoney)}</strong> Prize Money</span>
        <span className="flex items-center gap-1"><UiMark mark="currency/speed-ticket" /><strong>{view.current.items[SPEED_TICKET_ID] ?? 0}</strong> Speed Tickets</span>
      </p>
      {top !== null && item !== null && item?.kind === 'raw' && (
        <Link to={`/town/exchange?family=${item.family}&grade=${item.grade}`} state={{ back: true }}
          className="flex min-h-11 items-center justify-between rounded-sm bg-sunken/60 px-3 font-semibold">
          <span className="truncate">Short {top.line.short} {item.name}</span>
          <span className="flex shrink-0 items-center gap-1"><UiMark mark="currency/prize-money" />{amount(top.total)}</span>
        </Link>
      )}
    </div>
  )
}
