// The job sheet (docs/rework/07-farm.md §10; T140), over a building page from its query: **Uma** (`UmaList`), **What**
// (items by grade, tabs at the Pantry and the Kitchen), **How many** (`SizeChips`) with the preview from the kind's own
// plan, then **Start**, **Add to queue** or **Recall and start here**. A disabled button always says why in the rule's
// words, a shortfall links to the building that makes it (and the Exchange's row for a stocked raw item), an `ask`
// re-offers the covered size, and Start returns to `back` when the link gave one.
import { clockTime } from '@racer/domain/rework/check-in'
import type { FarmBuildingId } from '@racer/domain/rework/farm'
import { itemById, type ItemId } from '@racer/domain/rework/items'
import { slotsOf } from '@racer/domain/rework/work'
import type { Place } from '@racer/domain/hub'
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { BottomSheet } from '../../../../ui/BottomSheet'
import { navState } from '../../../hub/nav'
import { ItemIcon } from '../../../ui/ItemIcon'
import { RecallPreviewLines } from '../../../ui/work/RecallSheet'
import { SizeChips } from '../../../ui/work/SizeChips'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap, useWordsContext } from '../../../ui/work/useTap'
import { useWorkView } from '../../../ui/work/view'
import { grouped, itemName, placeName, showWords, workWords } from '../../../ui/work/words'
import { farmWords } from '../words'
import {
  CAN_COOK_NOW, chooseSlot, dishWanters, modeOf, neededByItem, sheetAction, sheetItems, sheetPlan, sheetPreview, sheetTabs, shortfallLinks, tabOf,
  umaRows, type SheetItem, type SheetQuery,
} from './model'
import { UmaList } from './UmaList'

const BUTTON = 'font-display inline-flex min-h-12 items-center justify-center rounded-sm px-4 text-[15px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

const minutes = (m: number): string => grouped(Math.round(m * 10) / 10)

function ItemRow({ row, chosen, onPick }: { row: SheetItem; chosen: boolean; onPick: () => void }) {
  const wanted = row.wantedBy.length <= 2
    ? row.wantedBy.join(', ')
    : farmWords('wanted-more', { names: row.wantedBy.slice(0, 2).join(', '), n: row.wantedBy.length - 2 })
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={chosen}
        data-item={row.item}
        data-locked={row.locked ?? undefined}
        className={`flex min-h-12 w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left ${chosen ? 'bg-accent-wash ring-1 ring-accent' : 'bg-sunken/50'}`}
      >
        <ItemIcon item={row.item} decorative className={row.locked !== null ? 'opacity-45' : ''} />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">{row.name} <span className="font-normal text-ink-soft">· G{row.grade}</span></span>
          <span className="block text-[12px] text-ink-soft">
            {farmWords('stock', { n: grouped(row.stock) })}
            {row.destination !== null && <> · {row.destination}</>}
          </span>
          {row.wantedBy.length > 0 && <span className="block truncate text-[12px] text-ink-soft">{farmWords('wanted-by', { names: wanted })}</span>}
        </span>
        {row.locked !== null && <span className="text-[12px] font-semibold text-ink-soft">{farmWords('locked', { level: row.locked })}</span>}
        {row.locked === null && row.needed > 0 && (
          <span className="font-display rounded-full bg-accent px-2 text-[11px] leading-5 font-bold text-ink">{farmWords('needed', { n: grouped(row.needed) })}</span>
        )}
      </button>
    </li>
  )
}

export default function JobSheet({ place, building, query, onClose }: {
  place: Place
  building: FarmBuildingId
  query: SheetQuery
  onClose: () => void
}) {
  const view = useWorkView()
  const context = useWordsContext()
  const tap = useTap()
  const location = useLocation()
  const navigate = useNavigate()
  const asked = query.job !== null && itemById(query.job) !== undefined ? query.job : null
  const [uma, setUma] = useState<string | null>(query.uma)
  const [item, setItem] = useState<ItemId | null>(asked)
  const [count, setCount] = useState<number | null>(query.count)
  const [pickingItem, setPickingItem] = useState(asked === null)
  const [tab, setTab] = useState<string | null>(null)
  const [recalling, setRecalling] = useState(false)

  const planned = useMemo(() => (view === null ? null : sheetPlan(view)), [view])
  const needed = useMemo(() => (planned === null ? new Map<ItemId, number>() : neededByItem(planned)), [planned])
  const wanters = useMemo(() => (view === null || building !== 'kitchen' ? new Map<ItemId, readonly string[]>() : dishWanters(view.settled)), [view, building])
  const rows = useMemo(() => (view === null ? [] : umaRows(view, building, item)), [view, building, item])

  if (view === null) return null
  const { settled } = view
  const time = (at: number) => clockTime(at, context.utcOffsetMin)
  const row = rows.find((candidate) => candidate.outfitId === uma && candidate.pickable)
  const level = row?.farmLevel ?? Math.max(1, ...rows.map((candidate) => candidate.farmLevel))
  const tabs = sheetTabs(building, settled, level)
  const activeTab = tabs.find((candidate) => candidate.id === tab) ?? tabs.find((candidate) => candidate.id === tabOf(tabs, item))!
  const items = sheetItems(activeTab, settled, level, needed, wanters)
    .map((entry) => ({ ...entry, wantedBy: entry.wantedBy.map((id) => context.umaName(id) || id) }))
  const mode = modeOf(row)
  const slot = chooseSlot(settled, building, row?.outfitId ?? null, query.slot) ?? (row === undefined ? null : settled.work[row.outfitId]?.slot ?? null) ?? slotsOf(settled, building)[0]!
  const preview = item === null ? null : sheetPreview(view, building, row?.outfitId ?? null, item, count, mode, slot)
  const size = preview?.request.count ?? count ?? 1
  const action = sheetAction(view, building, row, item, size, query.slot, time)
  const here = `${location.pathname}${location.search}`
  const links = preview === null ? [] : shortfallLinks(settled, preview.inputs, here)
  const title = farmWords(mode === 'queue' ? 'sheet-queue-title' : 'sheet-title', { place: place.name })

  const leave = () => {
    if (query.back === null) onClose()
    else if (navState(location).back === true) navigate(-1)
    else navigate(query.back, { replace: true })
  }
  const key = `sheet:${building}`
  const go = async () => {
    if (action.mode === 'blocked' || action.refusal !== null) return
    if (action.mode === 'recall-start') {
      setRecalling(true)
      return
    }
    const answer = action.mode === 'queue' ? await tap.run('queue', action.input, key) : await tap.run('start', action.input, key)
    if (answer?.kind === 'done') leave()
  }
  const recallAndStart = async () => {
    if (action.mode !== 'recall-start') return
    const recalled = await tap.run('recall', { outfitId: action.input.outfitId }, key)
    if (recalled?.kind !== 'done') return
    setRecalling(false)
    const started = await tap.run('start', action.input, key)
    if (started?.kind === 'done') leave()
  }
  const pickUma = (id: string) => {
    setUma(id)
    setCount(null)
    setRecalling(false)
    tap.clear()
  }
  const pickItem = (id: ItemId) => {
    setItem(id)
    setCount(null)
    setPickingItem(false)
    tap.clear()
  }
  const blockedWords = action.mode === 'blocked' ? action.words : action.refusal === null ? null : showWords(action.refusal, context)
  const label = mode === 'queue' ? farmWords('add-to-queue') : mode === 'recall-start' ? farmWords('recall-here') : farmWords('start')
  const noUmas = Object.keys(settled.umas).length === 0

  return (
    <BottomSheet open onClose={onClose} label={title}>
      <div data-g2="job-sheet" data-building={building} className="space-y-4 pb-2">
        <h2 className="text-lg">{title}</h2>

        <section aria-labelledby="sheet-uma" className="space-y-2">
          <h3 id="sheet-uma" className="text-micro">{farmWords('uma-title')}</h3>
          {noUmas ? (
            <p className="text-[14px]">
              {farmWords('no-umas')}{' '}
              <Link to="/town/stable?tab=locked" className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline">{farmWords('open-stable')}</Link>
            </p>
          ) : (
            <UmaList rows={rows} chosen={row?.outfitId ?? null} onPick={pickUma} time={time} />
          )}
        </section>

        <section aria-labelledby="sheet-what" className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 id="sheet-what" className="text-micro">{farmWords('what-title')}</h3>
            {!pickingItem && item !== null && (
              <button type="button" onClick={() => setPickingItem(true)} aria-label={farmWords('change-item')} className="min-h-11 px-2 text-[13px] font-semibold text-accent-strong">{farmWords('change')}</button>
            )}
          </div>
          {!pickingItem && item !== null ? (
            <div data-chosen-item={item} className="flex items-center gap-2 rounded-sm bg-accent-wash px-2 py-1.5">
              <ItemIcon item={item} decorative />
              <span className="text-[14px] font-semibold">{itemName(item)}</span>
              <span className="text-[12px] text-ink-soft">{farmWords('stock', { n: grouped(settled.items[item] ?? 0) })}</span>
            </div>
          ) : (
            <>
              {tabs.length > 1 && (
                <div role="tablist" aria-label={farmWords('what-title')} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
                  {tabs.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      role="tab"
                      aria-selected={candidate.id === activeTab.id}
                      onClick={() => setTab(candidate.id)}
                      className={`min-h-11 shrink-0 rounded-full border px-3 text-[13px] font-semibold ${
                        candidate.id === activeTab.id ? 'border-accent bg-accent-wash text-ink' : 'border-hairline-strong bg-panel text-ink-soft'
                      }`}
                    >
                      {candidate.label}
                    </button>
                  ))}
                </div>
              )}
              {items.length === 0 && activeTab.id === CAN_COOK_NOW && <p className="text-[13px] text-ink-soft">{farmWords('nothing-cookable')}</p>}
              <ul className="space-y-1">
                {items.map((candidate) => <ItemRow key={candidate.item} row={candidate} chosen={candidate.item === item} onPick={() => pickItem(candidate.item)} />)}
              </ul>
            </>
          )}
        </section>

        {preview !== null && (
          <section aria-label={workWords('size-label')} className="space-y-2">
            <SizeChips start={preview.start} itemSeconds={preview.itemSeconds} max={preview.max} value={count} onChange={setCount} />
            <p data-g2="job-preview" className="text-[13px] text-ink-soft tabular-nums">
              {[
                farmWords('each-output', { minutes: minutes(preview.minutesEach) }),
                farmWords('ends', { time: time(preview.endsAt) }),
                ...(preview.farmExp === null ? [] : [farmWords('farm-exp', { n: grouped(preview.farmExp) })]),
              ].join(' · ')}
            </p>
            {preview.inputs.length > 0 && (
              <ul data-g2="job-inputs" className="space-y-0.5 text-[13px]">
                {preview.inputs.map((input) => (
                  <li key={input.item} className={input.short > 0 ? 'font-semibold text-danger' : 'text-ink'}>
                    {input.short > 0
                      ? farmWords('input-short', { item: itemName(input.item), have: grouped(input.have), need: grouped(input.need), short: grouped(input.short) })
                      : farmWords('input', { item: itemName(input.item), have: grouped(input.have), need: grouped(input.need) })}
                  </li>
                ))}
              </ul>
            )}
            {links.length > 0 && (
              <ul data-g2="shortfall-links" className="flex flex-wrap gap-2">
                {links.flatMap((link) => [
                  ...(link.make === null ? [] : [
                    <li key={`make:${link.item}`}>
                      <Link to={link.make.to} className="inline-flex min-h-11 items-center rounded-sm border border-hairline-strong bg-panel px-3 text-[13px] font-semibold">
                        {farmWords('make-at', { item: itemName(link.item), place: placeName(link.make.building) })}
                      </Link>
                    </li>,
                  ]),
                  ...(link.buy === null ? [] : [
                    <li key={`buy:${link.item}`}>
                      <Link to={link.buy.to} className="inline-flex min-h-11 items-center rounded-sm border border-hairline-strong bg-panel px-3 text-[13px] font-semibold">
                        {farmWords('buy-raw', { item: itemName(link.item), price: grouped(link.buy.price) })}
                      </Link>
                    </li>,
                  ]),
                ])}
              </ul>
            )}
          </section>
        )}

        {recalling && row !== undefined && (
          <section aria-label={workWords('recall-title', { uma: row.name })} className="space-y-2 rounded-sm border border-danger/30 p-3">
            <RecallPreviewLines outfitId={row.outfitId} />
            <div className="flex gap-2">
              <button type="button" disabled={tap.pending !== null} onClick={() => void recallAndStart()} className={`${BUTTON} flex-1 border border-danger/40 bg-panel text-danger`}>
                {workWords('recall-and-start')}
              </button>
              <button type="button" onClick={() => setRecalling(false)} className="min-h-12 flex-1 font-semibold text-ink-soft">{workWords('not-now')}</button>
            </div>
          </section>
        )}

        <div className="space-y-1.5">
          <button
            type="button"
            data-action="sheet-go"
            disabled={blockedWords !== null || tap.pending !== null || recalling}
            onClick={() => void go()}
            className={`${BUTTON} w-full bg-accent text-ink`}
          >
            {label}
          </button>
          {blockedWords !== null && <p data-g2="sheet-why" className="text-[13px] text-ink-soft">{blockedWords}</p>}
          <TapNoteLine tap={tap} onDone={leave} />
        </div>
      </div>
    </BottomSheet>
  )
}
