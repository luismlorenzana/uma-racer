// The Warehouse's Peek (docs/rework/11-hub-and-places.md §3.1; T138): the three biggest stacks, the planner's three largest
// shortfalls, and "Surplus worth 1,240".
import { itemById } from '@racer/domain/items'
import { useMemo } from 'react'
import { useGame, useNow } from '../../app/game'
import { amount } from '../../ui/labels'
import type { PeekProps } from '../registry'
import { ItemIcon } from '../../ui/ItemIcon'
import { biggestStacks, EMPTY_WORDS, largestShortfalls, surplusWorth, warehouse } from './model'

export default function WarehousePeek(_: PeekProps) {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const house = useMemo(() => (state === null || env === null ? null : warehouse(state, now, env)), [state, env, now])
  if (house === null) return null
  const stacks = biggestStacks(house.rows)
  const short = largestShortfalls(house.plan)
  return (
    <div className="space-y-3 text-[14px]" data-g2="warehouse-peek">
      {stacks.length === 0 ? <p className="text-ink-soft">{EMPTY_WORDS}</p> : (
        <section aria-label="Biggest stacks">
          <h3 className="text-micro mb-1">Biggest stacks</h3>
          <ul className="space-y-1">
            {stacks.map((row) => (
              <li key={row.item.id} className="flex items-center gap-2"><ItemIcon item={row.item.id} decorative /><span className="flex-1 truncate">{row.item.name}</span><span className="tabular-nums">{row.held}</span></li>
            ))}
          </ul>
        </section>
      )}
      {short.length > 0 && (
        <section aria-label="Short for your targets">
          <h3 className="text-micro mb-1">Short for your targets</h3>
          <ul className="space-y-1">
            {short.map((line) => (
              <li key={`${line.level}:${line.item}`} className="flex items-center gap-2">
                <ItemIcon item={line.item} decorative /><span className="flex-1 truncate">{itemById(line.item)?.name}</span><span className="tabular-nums">short {line.short}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="font-semibold" data-g2="surplus">Surplus worth {amount(surplusWorth(house.rows))}</p>
    </div>
  )
}
