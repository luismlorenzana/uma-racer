// SC5: selection, sizing, preview and confirmation are uma-kit/work's. Only Racer's recipes, needs, aptitude order,
// check-in fit, shortfall links and navigation live here. Training's distinct unlock/card authoring stays game-owned.
import { navState } from '@luismlorenzana/uma-kit/shell'
import { CheckIcon, ChevronRightIcon, LockedIcon, StarIcon, UiMark } from '@luismlorenzana/uma-kit/ui'
import { JobSheet as WorkJobSheet, type JobPreview, type JobSelection } from '@luismlorenzana/uma-kit/work'
import { hasReady } from '@racer/domain/check-in'
import type { FarmBuildingId } from '@racer/domain/farm'
import type { Place } from '@racer/domain/hub'
import { itemById, type ItemId } from '@racer/domain/items'
import { holdsSlot } from '@racer/domain/work'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ItemIcon } from '../../../ui/ItemIcon'
import { TypeIcon } from '../../../ui/TypeIcon'
import { racerAlbumRows, racerBadges } from '../../../ui/racerAlbum'
import { buildStableAlbum, STABLE_FACETS, STABLE_SORTS } from '../../stable/model'
import { TapNoteLine } from '../../../ui/work/TapNote'
import { racerSizeRule } from '../../../ui/work/size'
import { useTap, useWordsContext } from '../../../ui/work/useTap'
import { useWorkView, type WorkView } from '../../../ui/work/view'
import { grouped, itemName, placeName } from '../../../ui/work/words'
import { farmKindOf } from '../building/model'
import { farmWords } from '../words'
import {
  CAN_COOK_NOW, bestItem, dishWanters, freeRows, gatedOffer, neededByItem, preselect, readyHere, sheetItems, sheetPlan,
  sheetTabs, sheetTiming, shortfallLinks, tabOf, type SheetItem, type SheetQuery, type TabIcon,
} from './model'

const LINK_BASE = 'inline-flex min-h-11 items-center gap-1 rounded-full border border-hairline-strong px-3 text-[13px] font-semibold'
const LINK = `${LINK_BASE} bg-panel`

function TabMark({ icon }: { icon: TabIcon }) {
  if (icon.kind === 'type') return <TypeIcon type={icon.type} size={24} />
  if (icon.kind === 'item') return <ItemIcon item={icon.item} scale={0.75} decorative />
  return icon.mark === 'star' ? <StarIcon size={24} variant="duotone" /> : <CheckIcon size={24} />
}

function ItemCell({ row, chosen, onPick }: { row: SheetItem; chosen: boolean; onPick: () => void }) {
  const label = [farmWords('item-label', { name: row.name, grade: row.grade, stock: grouped(row.stock) }),
    row.locked !== null ? farmWords('item-locked', { level: row.locked }) : row.needed > 0 ? farmWords('item-needed', { n: grouped(row.needed) }) : null].filter(Boolean).join(', ')
  return <button type="button" onClick={onPick} aria-pressed={chosen} aria-label={label} data-item={row.item} data-locked={row.locked ?? undefined}
    className={`relative flex h-14 items-center justify-center rounded-sm border ${chosen ? 'border-accent bg-accent-wash ring-2 ring-accent' : 'border-hairline bg-sunken/50'}`}>
    <ItemIcon item={row.item} decorative className={row.locked !== null ? 'opacity-35 grayscale' : ''} />
    <span aria-hidden className="absolute top-0.5 left-1 text-[10px] leading-3 font-bold text-ink-soft">{row.grade}</span>
    {row.stock > 0 && <span aria-hidden className="absolute right-1 bottom-0.5 text-[10px] leading-3 font-semibold tabular-nums">{grouped(row.stock)}</span>}
    {row.locked === null && row.needed > 0 && <span aria-hidden className="absolute -top-1.5 -right-1 rounded-full bg-accent px-1 text-[10px] leading-4 font-bold text-accent-ink">×{grouped(row.needed)}</span>}
    {row.locked !== null && <span aria-hidden className="absolute inset-x-0 bottom-0.5 flex items-center justify-center gap-0.5 text-[10px] font-bold text-ink-soft"><LockedIcon size={16} />{farmWords('locked-badge', { level: row.locked })}</span>}
  </button>
}

function NoFreeUma({ view, building }: { view: WorkView; building: FarmBuildingId }) {
  const tap = useTap()
  const collect = async () => {
    const shown = Object.values(view.settled.work).filter((row) => holdsSlot(row) && row.slot!.building === building && hasReady(row, view.now)).map((row) => row.slot!)
    await tap.run('collect-all', { places: [building], shown }, `here:${building}`)
  }
  return <div data-g2="no-free-uma" className="flex min-h-11 flex-wrap items-center gap-2">
    <p className="flex-1 text-[14px] font-semibold">{farmWords(Object.keys(view.settled.umas).length === 0 ? 'no-umas' : 'no-free-uma')}</p>
    {readyHere(view, building) && <button type="button" disabled={tap.pending !== null} onClick={() => void collect()} className={`${LINK_BASE} bg-accent text-accent-ink`}>{farmWords('collect-here')}</button>}
    {Object.keys(view.settled.umas).length === 0 && <Link to="/town/stable?tab=locked" className={LINK}>{farmWords('open-stable')}</Link>}
    <TapNoteLine tap={tap} />
  </div>
}

function What({ view, building, selection, needed, wanters, onItem }: {
  view: WorkView; building: FarmBuildingId; selection: JobSelection & { onChange: (job: string) => void }
  needed: ReadonlyMap<ItemId, number>; wanters: ReadonlyMap<ItemId, readonly string[]>; onItem: (item: string | null) => void
}) {
  const [tab, setTab] = useState<string | null>(null)
  const title = useId()
  const context = useWordsContext()
  const { outfitId, job: item } = selection
  useEffect(() => onItem(item), [item, onItem])
  const showTab = useCallback((node: HTMLButtonElement | null) => node?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }), [])
  const level = outfitId === null ? 1 : view.settled.umas[outfitId]?.farm.level ?? 1
  const tabs = sheetTabs(building, view.settled, level)
  const active = tabs.find((one) => one.id === tab) ?? tabs.find((one) => one.id === tabOf(tabs, item))!
  const items = sheetItems(active, view.settled, level, needed, wanters)
  const chosen = item === null ? undefined : sheetItems({ ...active, items: [item] }, view.settled, level, needed, wanters)[0]
  const def = item === null ? undefined : itemById(item)
  const offer = chosen?.locked != null && item !== null ? gatedOffer(view.settled, item) : null
  const wanted = chosen?.wantedBy.map((id) => context.umaName(id) || id) ?? []
  return <div className="space-y-1.5">
    <h4 id={title} className="sr-only">{farmWords('what-title')}</h4>
    {tabs.length > 1 && <div role="tablist" aria-labelledby={title} className="scroll-strip -mx-4 flex gap-1 overflow-x-auto px-4 py-1">
      {tabs.map((one) => <button key={one.id} ref={one.id === active.id ? showTab : undefined} type="button" role="tab" aria-selected={one.id === active.id} aria-label={one.label} title={one.label}
        data-tab={one.id} onClick={() => setTab(one.id)} className={`flex size-11 shrink-0 items-center justify-center rounded-full border ${one.id === active.id ? 'border-accent bg-accent-wash ring-1 ring-accent' : 'border-hairline-strong bg-panel'}`}><TabMark icon={one.icon} /></button>)}
    </div>}
    {items.length === 0 && active.id === CAN_COOK_NOW && <p className="text-[13px] text-ink-soft">{farmWords('nothing-cookable')}</p>}
    <div role="group" aria-labelledby={title} className="grid grid-cols-5 gap-1.5 pt-1">
      {items.map((row) => <ItemCell key={row.item} row={row} chosen={item === row.item} onPick={() => selection.onChange(row.item)} />)}
    </div>
    {chosen && <p data-chosen-item={chosen.item} className="text-[12px] text-ink-soft">
      <span className="font-semibold text-ink">{farmWords('chosen-item', { name: chosen.name, grade: chosen.grade, stock: grouped(chosen.stock) })}</span>
      {chosen.destination && ` · ${chosen.destination}`}
      {wanted.length > 0 && ` · ${farmWords('wanted-by', { names: wanted.length <= 2 ? wanted.join(', ') : farmWords('wanted-more', { names: wanted.slice(0, 2).join(', '), n: wanted.length - 2 }) })}`}
    </p>}
    {offer !== null && def !== undefined && <Link to={offer.to} state={{ back: true }} className={LINK}>{farmWords('buy-at-exchange', { price: grouped(offer.price) })}</Link>}
  </div>
}

function Preview({ preview, view }: { preview: JobPreview; view: WorkView }) {
  const location = useLocation()
  const links = shortfallLinks(view.settled, preview.inputs.map((row) => ({ ...row, short: Math.max(0, row.need - row.have) })), `${location.pathname}${location.search}`)
  return <>
    <span className="ml-auto text-[12px] text-ink-soft">{farmWords('farm-exp', { n: grouped(Math.round(preview.exp / 4)) })}</span>
    {links.length > 0 && <div data-g2="shortfall-links" className="flex w-full flex-wrap gap-1.5">
      {links.flatMap((link) => [
        ...(link.make === null ? [] : [<Link key={`make:${link.item}`} to={link.make.to} className={LINK} aria-label={farmWords('make-at', { item: itemName(link.item), place: placeName(link.make.building) })}><ItemIcon item={link.item} scale={0.5} decorative />{placeName(link.make.building)}<ChevronRightIcon size={16} /></Link>]),
        ...(link.buy === null ? [] : [<Link key={`buy:${link.item}`} to={link.buy.to} className={LINK} aria-label={farmWords('buy-raw', { item: itemName(link.item), price: grouped(link.buy.price) })}><ItemIcon item={link.item} scale={0.5} decorative /><UiMark mark="currency/prize-money" />{grouped(link.buy.price)}</Link>]),
      ])}
    </div>}
  </>
}

export default function JobSheet(props: { place: Place; building: FarmBuildingId; query: SheetQuery; onClose: () => void }) {
  const view = useWorkView()
  return view === null ? null : <Sheet {...props} view={view} />
}

function Sheet({ place, building, query, onClose, view }: { place: Place; building: FarmBuildingId; query: SheetQuery; onClose: () => void; view: WorkView }) {
  const context = useWordsContext()
  const location = useLocation(), navigate = useNavigate()
  const planned = useMemo(() => sheetPlan(view), [view])
  const needed = useMemo(() => neededByItem(planned), [planned])
  const [first] = useState(() => preselect(view, building, query, planned, sheetTiming(view, context.utcOffsetMin)))
  const [item, setItem] = useState(first.item)
  const free = freeRows(view, building, item)
  const order = new Map(free.map((row, i) => [row.outfitId, i]))
  const offered = new Set(query.queue && query.uma !== null ? [query.uma] : free.map((row) => row.outfitId))
  const rows = racerAlbumRows(buildStableAlbum(view.settled, view.env.content, Object.keys(view.settled.umas))).filter((row) => offered.has(row.id))
  const byId = new Map(free.map((row) => [row.outfitId, row]))
  const wanters = useMemo(() => building === 'kitchen' ? dishWanters(view.settled) : new Map<ItemId, readonly string[]>(), [view, building])
  const leave = () => query.back === null ? onClose() : navState(location).back === true ? navigate(-1) : navigate(query.back, { replace: true })
  return <WorkJobSheet key={rows.length === 0 ? 'empty' : 'ready'}
    building={building} query={{ ...query, job: first.item, uma: first.uma, count: first.count }}
    title={farmWords(query.queue ? 'sheet-queue-title' : 'sheet-title', { place: place.name })} rows={rows}
    initialJob={(id) => first.item ?? bestItem(view.settled, building, id === null ? 1 : view.settled.umas[id]?.farm.level ?? 1, needed)}
    request={(job, count) => ({ kind: farmKindOf(building), item: job, count })}
    sizeRule={racerSizeRule(view.settled.profile.checkIns, context.utcOffsetMin)}
    picker={{ facets: STABLE_FACETS, order: (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
      sorts: STABLE_SORTS.filter((sort) => sort.key !== 'farm').map((sort) => ({ key: sort.key, label: sort.label, direction: sort.defaultDirection, value: (row) => row.sorts[sort.key] ?? null })),
      describe: (row) => byId.get(row.id)?.aptitude ?? row.entry.outfit, renderBadges: racerBadges, words: { level: 'Farm Level' } }}
    renderWhat={(selection) => <What view={view} building={building} selection={selection} needed={needed} wanters={wanters} onItem={setItem} />}
    renderPreview={(preview) => <Preview preview={preview} view={view} />}
    empty={<NoFreeUma view={view} building={building} />} onClose={onClose} onDone={leave} />
}
