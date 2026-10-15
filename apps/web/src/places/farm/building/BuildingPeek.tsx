// A Farm building's Peek (docs/rework/11-hub-and-places.md §3.4; T140): its slots with faces and the next output's
// time; a site's stock by open grade; the planner's lines here (the Pantry's crafted items and the Kitchen's dishes
// short for the targets). Display only: the Peek's Enter opens the page.
import { clockTime } from '@racer/domain/check-in'
import type { FarmBuildingId } from '@racer/domain/farm'
import { useMemo } from 'react'
import type { PeekProps } from '../../registry'
import { ItemIcon } from '../../../ui/ItemIcon'
import { UmaFace } from '../../../ui/UmaArt'
import { useWordsContext } from '../../../ui/work/useTap'
import { useWorkView } from '../../../ui/work/view'
import { grouped, itemName } from '../../../ui/work/words'
import { farmWords } from '../words'
import { buildingView, stockByGrade } from './model'

/** The Peek's planner lines: the first few, lowest grade first. */
export const PEEK_LINES = 3

export default function BuildingPeek({ place }: PeekProps) {
  const building = place.id as FarmBuildingId
  const view = useWorkView()
  const context = useWordsContext()
  const model = useMemo(() => (view === null ? null : buildingView(view, building, context)), [view, building, context])
  if (view === null || model === null) return null
  const held = model.cards.filter((card) => card.kind === 'held')
  const free = model.cards.length - held.length
  const stock = stockByGrade(view.settled, building)
  return (
    <div data-g2="farm-peek" className="space-y-3 pb-1">
      <p className="font-display text-[13px] font-semibold text-ink-soft">
        {farmWords('level', { level: model.level })} · {farmWords('slots-in-use', { used: model.used, slots: model.slots })}
      </p>
      <ul aria-label={farmWords('slots-title')} className="space-y-1">
        {held.map((card) => (
          <li key={card.slot.slot} data-peek-slot={card.slot.slot} className="flex items-center gap-2 text-[13px]">
            <span className="block size-6 shrink-0 overflow-hidden rounded-full bg-sunken"><UmaFace outfitId={card.outfitId} size={24} /></span>
            <span className="min-w-0 flex-1 truncate">{context.umaName(card.outfitId) || card.outfitId}</span>
            {card.request.kind !== 'session' && <ItemIcon item={card.request.item} decorative />}
            <span className="shrink-0 text-ink-soft tabular-nums">
              {card.running && card.nextAt !== null ? farmWords('peek-next', { time: clockTime(card.nextAt, context.utcOffsetMin) }) : farmWords('peek-ready')}
            </span>
          </li>
        ))}
        {free > 0 && <li className="text-[13px] text-ink-soft">{free === 1 ? farmWords('peek-free-one') : farmWords('peek-free', { n: free })}</li>}
      </ul>
      {stock.length > 0 && (
        <section aria-label={farmWords('peek-stock')}>
          <h3 className="text-micro mb-1">{farmWords('peek-stock')}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {stock.map((row) => (
              <li key={row.item} className="flex items-center gap-1 rounded-sm bg-sunken/60 py-0.5 pr-2 pl-0.5 text-[12px] tabular-nums" aria-label={`${itemName(row.item)}: ${grouped(row.count)}`}>
                <ItemIcon item={row.item} decorative />
                <span aria-hidden>G{row.grade} · {grouped(row.count)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {model.lines.length > 0 && (
        <section aria-label={farmWords('targets-title')}>
          <h3 className="text-micro mb-1">{farmWords('targets-title')}</h3>
          <ul className="space-y-1 text-[12px] text-ink-soft">
            {model.lines.slice(0, PEEK_LINES).map((line) => (
              <li key={line.line.item} className="flex items-center gap-1.5">
                <ItemIcon item={line.line.item} />
                <span className="min-w-0 flex-1">{line.words}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
