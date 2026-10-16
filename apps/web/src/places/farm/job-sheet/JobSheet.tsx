// The job sheet (docs/game/07-farm.md §10; T140, D366): one screen over a building page or the map's side panel, from
// its query, with everything preselected so one tap starts the job (`preselect`). Top to bottom: **Free Umas** as a strip
// of faces (`UmaStrip`; a Queue next names her instead); **What** as an icon grid, five to a row, each cell with its
// grade, stock, the plan's "×N" and a lock, under icon tabs at the Pantry and the Kitchen; **How many** as size chips
// with durations (`SizeChips`); the inputs as icons with have/need; and one **Start · ×4 · 3h 36m** (or **Queue**)
// button, which says why it can't in the rule's words. A shortfall links to the building that makes it (and the
// Exchange's row for stocked raw), an `ask` re-offers the covered size, and Start returns to `back` when the link gave
// one. With no Free Uma it says so, with **Collect here** when that would free one, and nothing else.
import { navState } from '@luismlorenzana/uma-kit/shell'
import { BottomSheet, CheckIcon, ChevronRightIcon, LockedIcon, SparkIcon, StarIcon, UiMark } from '@luismlorenzana/uma-kit/ui'
import { durationText, hasReady } from '@racer/domain/check-in'
import type { FarmBuildingId } from '@racer/domain/farm'
import type { Place } from '@racer/domain/hub'
import { itemById, type ItemId } from '@racer/domain/items'
import { holdsSlot, slotsOf } from '@racer/domain/work'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ItemIcon } from '../../../ui/ItemIcon'
import { TypeIcon } from '../../../ui/TypeIcon'
import { SizeChips } from '../../../ui/work/SizeChips'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { useTap, useWordsContext } from '../../../ui/work/useTap'
import { useWorkView, type WorkView } from '../../../ui/work/view'
import { grouped, itemName, placeName, showWords } from '../../../ui/work/words'
import { farmWords } from '../words'
import {
  CAN_COOK_NOW, chooseSlot, dishWanters, freeRows, gatedOffer, neededByItem, preselect, queuedUma, readyHere, sheetAction, sheetItems, sheetPlan,
  sheetPreview, sheetTabs, sheetTiming, shortfallLinks, tabOf, type SheetItem, type SheetQuery, type SheetTab, type TabIcon,
} from './model'
import { UmaLine, UmaStrip } from './UmaStrip'

const BUTTON = 'font-display inline-flex min-h-12 items-center justify-center rounded-sm px-4 text-[15px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'
const LINK_CHIP = 'inline-flex min-h-11 items-center gap-1 rounded-full border border-hairline-strong bg-panel px-3 text-[13px] font-semibold'

function TabMark({ icon }: { icon: TabIcon }) {
  if (icon.kind === 'type') return <TypeIcon type={icon.type} size={24} />
  if (icon.kind === 'item') return <ItemIcon item={icon.item} scale={0.75} decorative />
  if (icon.mark === 'star') return <StarIcon size={24} variant="duotone" />
  if (icon.mark === 'spark') return <SparkIcon size={24} variant="duotone" />
  return <CheckIcon size={24} />
}

function itemLabel(row: SheetItem): string {
  return [
    farmWords('item-label', { name: row.name, grade: row.grade, stock: grouped(row.stock) }),
    row.locked !== null ? farmWords('item-locked', { level: row.locked }) : row.needed > 0 ? farmWords('item-needed', { n: grouped(row.needed) }) : null,
  ].filter(Boolean).join(', ')
}

/** One cell of the grid: the 32 pt icon, its grade in the corner, the stock, the plan's "×N", a lock above her level. */
function ItemCell({ row, chosen, onPick }: { row: SheetItem; chosen: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={chosen}
      aria-label={itemLabel(row)}
      data-item={row.item}
      data-locked={row.locked ?? undefined}
      className={`relative flex h-14 items-center justify-center rounded-sm border ${chosen ? 'border-accent bg-accent-wash ring-2 ring-accent' : 'border-hairline bg-sunken/50'}`}
    >
      <ItemIcon item={row.item} decorative className={row.locked !== null ? 'opacity-35 grayscale' : ''} />
      <span aria-hidden className="absolute top-0.5 left-1 text-[10px] leading-3 font-bold text-ink-soft">{row.grade}</span>
      {row.stock > 0 && <span aria-hidden className="absolute right-1 bottom-0.5 text-[10px] leading-3 font-semibold text-ink tabular-nums">{grouped(row.stock)}</span>}
      {row.locked === null && row.needed > 0 && (
        <span aria-hidden className="font-display absolute -top-1.5 -right-1 rounded-full bg-accent px-1 text-[10px] leading-4 font-bold text-ink tabular-nums shadow-1">
          {farmWords('needed-badge', { n: grouped(row.needed) })}
        </span>
      )}
      {row.locked !== null && (
        <span aria-hidden className="absolute inset-x-0 bottom-0.5 flex items-center justify-center gap-0.5 text-[10px] leading-3 font-bold text-ink-soft">
          <LockedIcon size={16} className="scale-75" />{farmWords('locked-badge', { level: row.locked })}
        </span>
      )}
    </button>
  )
}

/** With no Free Uma: one line, and Collect here when a finished job here would free one (D366). */
function NoFreeUma({ view, building }: { view: WorkView; building: FarmBuildingId }) {
  const tap = useTap()
  const ready = readyHere(view, building)
  const collect = async () => {
    const shown = Object.values(view.settled.work)
      .filter((row) => holdsSlot(row) && row.slot!.building === building && hasReady(row, view.now))
      .map((row) => row.slot!)
    await tap.run('collect-all', { places: [building], shown }, `here:${building}`)
  }
  return (
    <div data-g2="no-free-uma" className="flex min-h-11 flex-wrap items-center gap-2">
      <p className="flex-1 text-[14px] font-semibold">{farmWords('no-free-uma')}</p>
      {ready && (
        <button type="button" data-action="collect-here" disabled={tap.pending !== null} onClick={() => void collect()} className={`${BUTTON} min-h-11 bg-accent text-ink`}>
          {farmWords('collect-here')}
        </button>
      )}
      <TapNoteLine tap={tap} className="w-full" />
    </div>
  )
}

export default function JobSheet(props: { place: Place; building: FarmBuildingId; query: SheetQuery; onClose: () => void }) {
  const view = useWorkView()
  if (view === null) return null
  return <Sheet {...props} view={view} />
}

function Sheet({ place, building, query, onClose, view }: {
  place: Place
  building: FarmBuildingId
  query: SheetQuery
  onClose: () => void
  view: WorkView
}) {
  const context = useWordsContext()
  const tap = useTap()
  const location = useLocation()
  const navigate = useNavigate()
  const umaTitle = useId()
  const whatTitle = useId()
  const planned = useMemo(() => sheetPlan(view), [view])
  const needed = useMemo(() => neededByItem(planned), [planned])
  // Preselected once, when the sheet opens: the clock's tick never changes what the owner chose.
  const [first] = useState(() => preselect(view, building, query, planned, sheetTiming(view, context.utcOffsetMin)))
  const [uma, setUma] = useState<string | null>(first.uma)
  const [item, setItem] = useState<ItemId | null>(first.item)
  const [count, setCount] = useState<number | null>(first.count)
  const [tab, setTab] = useState<string | null>(null)
  // The chosen tab scrolls into view when it changes, so a sheet opened on Inspiration or Feasts shows it.
  const showTab = useCallback((node: HTMLButtonElement | null) => node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }), [])
  const wanters = useMemo(() => (building !== 'kitchen' ? new Map<ItemId, readonly string[]>() : dishWanters(view.settled)), [view, building])

  const { settled } = view
  const mode = query.queue && query.uma !== null ? 'queue' : 'start'
  const rows = mode === 'queue' ? [] : freeRows(view, building, item)
  const her = mode === 'queue' ? queuedUma(view, building, query.uma!, item) : rows.find((row) => row.outfitId === uma) ?? rows[0] ?? null
  const umaId = her?.outfitId ?? null
  const noUmas = Object.keys(settled.umas).length === 0
  const noFree = !noUmas && mode === 'start' && rows.length === 0

  // A Collect here that freed someone preselects for her, as the sheet's opening does.
  useEffect(() => {
    if (uma !== null || rows.length === 0 || mode === 'queue') return
    const next = preselect(view, building, { ...query, uma: null }, planned, sheetTiming(view, context.utcOffsetMin))
    setUma(next.uma)
    if (item === null) setItem(next.item)
    if (count === null) setCount(next.count)
  }, [uma, rows.length, mode, view, building, query, planned, context.utcOffsetMin, item, count])

  const level = her?.farmLevel ?? Math.max(1, ...Object.values(settled.umas).map((candidate) => candidate.farm.level))
  const tabs = sheetTabs(building, settled, level)
  const activeTab: SheetTab = tabs.find((candidate) => candidate.id === tab) ?? tabs.find((candidate) => candidate.id === tabOf(tabs, item))!
  const items = sheetItems(activeTab, settled, level, needed, wanters)
  const slot = chooseSlot(settled, building, umaId, query.slot) ?? (umaId === null ? null : settled.work[umaId]?.slot ?? null) ?? slotsOf(settled, building)[0]!
  const preview = item === null ? null : sheetPreview(view, building, umaId, item, count, mode, slot)
  const size = preview?.request.count ?? count ?? 1
  const action = sheetAction(view, building, umaId, mode, item, size, query.slot)
  const here = `${location.pathname}${location.search}`
  const links = preview === null ? [] : shortfallLinks(settled, preview.inputs, here)
  const chosenDef = item === null ? undefined : itemById(item)
  const locked = chosenDef !== undefined && chosenDef.kind !== 'ticket' && her !== null && her.highestGrade < chosenDef.grade
  const offer = locked && item !== null ? gatedOffer(settled, item) : null
  const title = farmWords(mode === 'queue' ? 'sheet-queue-title' : 'sheet-title', { place: place.name })

  const leave = () => {
    if (query.back === null) onClose()
    else if (navState(location).back === true) navigate(-1)
    else navigate(query.back, { replace: true })
  }
  const go = async () => {
    if (action.mode === 'blocked' || action.refusal !== null) return
    const answer = action.mode === 'queue' ? await tap.run('queue', action.input, `sheet:${building}`) : await tap.run('start', action.input, `sheet:${building}`)
    if (answer?.kind === 'done') leave()
  }
  const pickUma = (id: string) => {
    setUma(id)
    setCount(null)
    tap.clear()
  }
  const pickItem = (id: ItemId) => {
    setItem(id)
    setCount(null)
    tap.clear()
  }
  const blockedWords = action.mode === 'blocked' ? action.words : action.refusal === null ? null : showWords(action.refusal, context)
  const label = preview === null
    ? farmWords(mode === 'queue' ? 'queue-plain' : 'start-plain')
    : farmWords(mode === 'queue' ? 'queue' : 'start', { n: size, time: durationText(preview.ms) })
  const chosenRow = item === null ? undefined : sheetItems({ ...activeTab, items: [item] }, settled, level, needed, wanters)[0]
  const wanted = chosenRow === undefined || chosenRow.wantedBy.length === 0 ? null
    : (() => {
      const names = chosenRow.wantedBy.map((id) => context.umaName(id) || id)
      return farmWords('wanted-by', { names: names.length <= 2 ? names.join(', ') : farmWords('wanted-more', { names: names.slice(0, 2).join(', '), n: names.length - 2 }) })
    })()

  return (
    <BottomSheet open onClose={onClose} label={title}>
      <div data-g2="job-sheet" data-building={building} className="space-y-3">
        <h2 className="pr-8 text-[17px] leading-tight">{title}</h2>

        <section aria-labelledby={umaTitle}>
          <h3 id={umaTitle} className="text-micro">{mode === 'queue' ? farmWords('queue-for', { name: her?.name ?? '' }) : farmWords('uma-title')}</h3>
          {noUmas ? (
            <p className="text-[14px]">
              {farmWords('no-umas')}{' '}
              <Link to="/town/stable?tab=locked" className="inline-flex min-h-11 items-center font-semibold text-accent-strong underline">{farmWords('open-stable')}</Link>
            </p>
          ) : noFree ? (
            <NoFreeUma view={view} building={building} />
          ) : mode === 'queue' ? (
            her !== null && <div className="pt-1"><UmaLine uma={her} /></div>
          ) : (
            <UmaStrip rows={rows} chosen={umaId} onPick={pickUma} labelledBy={umaTitle} />
          )}
        </section>

        {!noUmas && !noFree && (
          <>
            <section aria-labelledby={whatTitle} className="space-y-1.5">
              <h3 id={whatTitle} className="sr-only">{farmWords('what-title')}</h3>
              {tabs.length > 1 && (
                <div role="tablist" aria-labelledby={whatTitle} className="scroll-strip -mx-4 flex gap-1 overflow-x-auto px-4 pt-0.5 pb-0.5">
                  {tabs.map((candidate) => (
                    <button
                      key={candidate.id}
                      ref={candidate.id === activeTab.id ? showTab : undefined}
                      type="button"
                      role="tab"
                      aria-selected={candidate.id === activeTab.id}
                      aria-label={candidate.label}
                      title={candidate.label}
                      data-tab={candidate.id}
                      onClick={() => setTab(candidate.id)}
                      className={`flex size-11 shrink-0 items-center justify-center rounded-full border ${
                        candidate.id === activeTab.id ? 'border-accent bg-accent-wash ring-1 ring-accent' : 'border-hairline-strong bg-panel'
                      }`}
                    >
                      <TabMark icon={candidate.icon} />
                    </button>
                  ))}
                </div>
              )}
              {items.length === 0 && activeTab.id === CAN_COOK_NOW && <p className="text-[13px] text-ink-soft">{farmWords('nothing-cookable')}</p>}
              <div role="group" aria-labelledby={whatTitle} className="grid grid-cols-5 gap-1.5 pt-1">
                {items.map((candidate) => <ItemCell key={candidate.item} row={candidate} chosen={candidate.item === item} onPick={() => pickItem(candidate.item)} />)}
              </div>
              {chosenRow !== undefined && (
                <p data-chosen-item={chosenRow.item} className="truncate text-[12px] text-ink-soft">
                  <span className="font-semibold text-ink">{farmWords('chosen-item', { name: chosenRow.name, grade: chosenRow.grade, stock: grouped(chosenRow.stock) })}</span>
                  {chosenRow.destination !== null && <> · {chosenRow.destination}</>}
                  {wanted !== null && <> · {wanted}</>}
                </p>
              )}
            </section>

            {preview !== null && (
              <section aria-label={farmWords('inputs-label')} className="space-y-2">
                <SizeChips start={preview.start} itemSeconds={preview.itemSeconds} max={preview.max} value={count} onChange={setCount} heading={false} />
                <div className="flex flex-wrap items-center gap-1.5 text-[13px] tabular-nums" data-g2="job-inputs">
                  {preview.inputs.map((input) => (
                    <span
                      key={input.item}
                      aria-label={input.short > 0
                        ? farmWords('input-short', { item: itemName(input.item), have: grouped(input.have), need: grouped(input.need), short: grouped(input.short) })
                        : farmWords('input', { item: itemName(input.item), have: grouped(input.have), need: grouped(input.need) })}
                      data-short={input.short > 0 || undefined}
                      className={`flex h-7 items-center gap-1 rounded-full pr-2 pl-1 ${input.short > 0 ? 'bg-danger/10 font-semibold text-danger' : 'bg-sunken/60'}`}
                    >
                      <ItemIcon item={input.item} scale={0.5} decorative />
                      <span aria-hidden>{grouped(input.have)}/{grouped(input.need)}</span>
                    </span>
                  ))}
                  {preview.farmExp !== null && <span className="ml-auto text-[12px] text-ink-soft">{farmWords('farm-exp', { n: grouped(preview.farmExp) })}</span>}
                </div>
                {(links.length > 0 || offer !== null) && (
                  <div data-g2="shortfall-links" className="flex flex-wrap gap-1.5">
                    {links.flatMap((link) => [
                      ...(link.make === null ? [] : [
                        <Link key={`make:${link.item}`} to={link.make.to} aria-label={farmWords('make-at', { item: itemName(link.item), place: placeName(link.make.building) })} className={LINK_CHIP}>
                          <ItemIcon item={link.item} scale={0.5} decorative />
                          <span aria-hidden>{placeName(link.make.building)}</span>
                          <ChevronRightIcon size={16} />
                        </Link>,
                      ]),
                      ...(link.buy === null ? [] : [
                        <Link key={`buy:${link.item}`} to={link.buy.to} aria-label={farmWords('buy-raw', { item: itemName(link.item), price: grouped(link.buy.price) })} className={LINK_CHIP}>
                          <ItemIcon item={link.item} scale={0.5} decorative />
                          <UiMark mark="currency/prize-money" />
                          <span aria-hidden className="tabular-nums">{grouped(link.buy.price)}</span>
                        </Link>,
                      ]),
                    ])}
                    {offer !== null && item !== null && (
                      <Link to={offer.to} state={{ back: true }} className={LINK_CHIP}>{farmWords('buy-at-exchange', { price: grouped(offer.price) })}</Link>
                    )}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {!noUmas && !noFree && (
          <div className="sticky bottom-0 -mx-4 space-y-1 border-t border-hairline bg-panel px-4 pt-2 pb-1">
            <button
              type="button"
              data-action="sheet-go"
              disabled={blockedWords !== null || tap.pending !== null}
              onClick={() => void go()}
              className={`${BUTTON} w-full bg-accent text-ink tabular-nums`}
            >
              {label}
            </button>
            {blockedWords !== null && <p data-g2="sheet-why" className="text-[13px] text-ink-soft">{blockedWords}</p>}
            <TapNoteLine tap={tap} onDone={leave} />
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
