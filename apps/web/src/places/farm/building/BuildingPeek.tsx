// A Farm building's quick look in the side panel (docs/game/11-hub-and-places.md §2.6, §3.4; T140, D366), uma-rpg's
// structure made tappable: level, slots in use and speed as chips; one 48 pt row per slot (`PeekRow`): a running job's
// face in its ring, item, "Carrot ×2 · 0/2", a "+1" chip with the next queued item, and how long is left; a finished
// one's **Done** with **Collect** and **Repeat** (collect, then the domain's `repeat` for her); a free one a "+" that
// opens the job sheet at once, over the map; the targets here as icons, each opening the sheet filled in; a site's
// stock by open grade; and **Collect here** when anything is ready. The panel's **Enter** opens the page. So the Hub
// is two taps from collecting a building or restarting a finished job, and three from a new job in a free slot.
import { navState } from '@luismlorenzana/uma-kit/shell'
import type { FarmBuildingId } from '@racer/domain/farm'
import { lazy, Suspense, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import type { PeekProps } from '../../registry'
import { ItemIcon } from '../../../ui/ItemIcon'
import { PlaceStats } from '../../../ui/work/PlaceStats'
import { PeekRow } from '../../../ui/work/SlotRow'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap, useWordsContext } from '../../../ui/work/useTap'
import { useWorkView } from '../../../ui/work/view'
import { grouped, itemName, workWords } from '../../../ui/work/words'
import { readSheetQuery, withoutSheet } from '../job-sheet/model'
import { farmWords } from '../words'
import { buildingView, sheetQuery, stockByGrade, withSheet } from './model'
import { TargetStrip } from './TargetStrip'

const JobSheet = lazy(() => import('../job-sheet/JobSheet'))

export default function BuildingPeek({ place }: PeekProps) {
  const building = place.id as FarmBuildingId
  const view = useWorkView()
  const context = useWordsContext()
  const tap = useTap()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const model = useMemo(() => (view === null ? null : buildingView(view, building, context)), [view, building, context])
  const query = readSheetQuery(params)
  if (view === null || model === null) return null
  const stock = stockByGrade(view.settled, building)
  const over = (sheet: string) => `${location.pathname}${withSheet(location.search, sheet)}`
  const closeSheet = () => {
    if (navState(location).back === true) navigate(-1)
    else navigate(`${location.pathname}${withoutSheet(location.search)}`, { replace: true })
  }
  const collect = () => void tap.run('collect-all', { places: [building], shown: model.readySlots }, `here:${building}`)
  return (
    <div data-g2="farm-peek" className="flex min-h-full flex-col gap-3 pb-1">
      <PlaceStats level={model.level} used={model.used} slots={model.slots} speed={model.speed} />
      <ul aria-label={farmWords('slots-title')} className="space-y-1.5">
        {model.cards.map((card) => (
          <PeekRow
            key={card.slot.slot}
            card={card}
            repeat
            text={card.kind === 'held' && card.request.kind !== 'session'
              ? `${itemName(card.request.item)} ×${card.count} · ${workWords('made', { made: card.made, count: card.count })}`
              : undefined}
            startTo={over(sheetQuery({ job: null, slot: card.slot.slot }))}
          />
        ))}
      </ul>
      <TargetStrip lines={model.lines} sheetTo={(line) => over(line.sheet)} />
      {stock.length > 0 && (
        <section aria-label={farmWords('peek-stock')}>
          <h3 className="text-micro mb-1">{farmWords('peek-stock')}</h3>
          <ul className="flex flex-wrap gap-1.5">
            {stock.map((row) => (
              <li key={row.item} className="flex items-center gap-1 rounded-full bg-sunken/60 py-0.5 pr-2 pl-0.5 text-[12px] font-semibold tabular-nums" aria-label={`${itemName(row.item)}: ${grouped(row.count)}`}>
                <ItemIcon item={row.item} scale={0.75} decorative />
                <span aria-hidden>{grouped(row.count)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {model.ready > 0 && (
        <div className="mt-auto space-y-1 pt-2">
          <TapNoteLine tap={tap} />
          <button
            type="button"
            data-action="collect-here"
            disabled={tap.pending !== null}
            onClick={collect}
            className="font-display flex min-h-12 w-full items-center justify-center rounded-sm bg-accent text-base font-bold text-ink shadow-1 disabled:opacity-45"
          >
            {farmWords('collect-here-n', { n: model.ready })}
          </button>
        </div>
      )}
      {query !== null && (
        // The sheet sits inside the side panel's tree: a sideways drag on it is the sheet's, never the panel's swipe to close.
        <div onPointerDown={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()}>
          <Suspense fallback={null}>
            <JobSheet place={place} building={building} query={query} onClose={closeSheet} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
