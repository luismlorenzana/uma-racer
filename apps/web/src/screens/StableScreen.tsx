import { DISTANCE_CATEGORIES, STRATEGIES, SURFACES, UMA_SHARDS_PER_COUPON, tierOfLevel } from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { exchangeUmaShards, redeemUmaCoupon } from '../game/actions'
import { EMPTY_UMA_ALBUM_FILTERS, buildUmaAlbum, type UmaAlbumFilters, type UmaAlbumItem } from '../game/collection-view'
import type { UmaSort } from '../game/view'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import { GameButton } from '../ui/GameButton'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'

const FILTER_LABELS = { tier: 'Tier', surface: 'Surface', distance: 'Distance', strategy: 'Strategy', ready: 'Ready' } as const
type FilterKind = keyof typeof FILTER_LABELS
const titleCase = (value: string) => `${value[0]!.toUpperCase()}${value.slice(1)}`

function UmaTile({ item, onUnowned }: { item: UmaAlbumItem; onUnowned: () => void }) {
  const body = <>
    <div className="relative bg-gradient-to-b from-sky-100 to-white p-2">
      <AtlasSprite asset={item.asset} alt={item.owned ? `${item.template.name} icon` : `${item.template.name} silhouette`} className={`w-full rounded-xl bg-sky-50 ${item.owned ? '' : 'brightness-0 opacity-35'}`} fallback={<div className="flex h-full items-center justify-center text-4xl">🐴</div>} />
      <span className="absolute top-3 left-3 rounded-full bg-ink/75 px-2 py-0.5 text-xs font-extrabold text-white">{item.owned ? `T${item.view?.tier ?? 1}` : 'New'}</span>
      {item.view?.readyToPromote && <span className="absolute right-2 bottom-2 rounded-full bg-gold px-2 py-1 text-[11px] font-extrabold text-white text-outline">Ready!</span>}
    </div>
    <div className="p-3">
      <p className="truncate font-extrabold">{item.template.name}</p>
      <p className="truncate text-xs text-ink-soft">{item.template.outfit ?? 'Standard outfit'}</p>
      {item.save ? <div className="mt-2 flex items-center justify-between text-xs font-extrabold"><span>Uma Lv {item.save.level}</span><span>TL {item.save.trainingLevel}</span></div> : <p className="mt-2 text-xs font-extrabold text-violet-700">Unowned outfit</p>}
    </div>
  </>
  const className = `block min-w-0 overflow-hidden rounded-[1.25rem] border-2 bg-white/95 text-left shadow-[var(--shadow-panel)] ${item.owned ? 'border-white' : 'border-violet-200'}`
  return item.owned
    ? <Link to={item.view?.readyToPromote ? `/scenario/${encodeURIComponent(item.template.id)}/start` : `/stable/${encodeURIComponent(item.template.id)}`} className={className}>{body}</Link>
    : <button type="button" onClick={onUnowned} className={className}>{body}</button>
}

function OptionButton({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return <button type="button" className={`min-h-12 rounded-2xl border-2 px-4 text-left font-extrabold ${selected ? 'border-sky bg-sky text-white text-outline' : 'border-white bg-white text-ink shadow-sm'}`} onClick={onClick}>{label}</button>
}

export function StableScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const persistent = useGame((state) => state.persistent)
  const profile = useGame((state) => state.profile)
  const owned = useGame((state) => state.umas)
  const pushToast = useGame((state) => state.pushToast)
  const sync = useGame((state) => state.sync)
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [filters, setFilters] = useState<UmaAlbumFilters>(EMPTY_UMA_ALBUM_FILTERS)
  const [sort, setSort] = useState<UmaSort>('name')
  const [filterSheet, setFilterSheet] = useState<FilterKind | null>(null)
  const [sortOpen, setSortOpen] = useState(false)
  const [selected, setSelected] = useState<UmaAlbumItem | null>(null)
  const [exchangeBusy, setExchangeBusy] = useState(false)
  const [redeemBusy, setRedeemBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exchangePulse, setExchangePulse] = useState(0)
  const album = useMemo(() => contentState.status === 'ready' && profile
    ? buildUmaAlbum(contentState.content, owned, profile, filters, sort) : null,
  [contentState, filters, owned, profile, sort])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to open your Stable" detail="Your private roster stays behind your account." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish a private content version before creating a save." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={lifecycleError ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile || !album) return <ScreenState title="Opening your Stable…" detail="Loading private content and your local save." />

  const tiers = [...new Set(contentState.content.umas.items.map((template) => owned[template.id] ? tierOfLevel(owned[template.id]!.level) : 1))].sort((a, b) => a - b)
  const activeLabel = (kind: FilterKind): string => {
    if (kind === 'ready') return filters.ready ? 'Ready only' : 'All readiness'
    const value = filters[kind]
    return value === null ? 'All' : kind === 'tier' ? `Tier ${value}` : titleCase(String(value))
  }
  const options = filterSheet === 'tier' ? tiers.map((value) => ({ value, label: `Tier ${value}` }))
    : filterSheet === 'surface' ? SURFACES.map((value) => ({ value, label: titleCase(value) }))
      : filterSheet === 'distance' ? DISTANCE_CATEGORIES.map((value) => ({ value, label: titleCase(value) }))
        : filterSheet === 'strategy' ? STRATEGIES.map((value) => ({ value, label: titleCase(value) })) : []
  const doExchange = () => {
    if (exchangeBusy || profile.umaShards < UMA_SHARDS_PER_COUPON) return
    setExchangeBusy(true)
    setError(null)
    void exchangeUmaShards().then(() => {
      setExchangePulse((value) => value + 1)
      pushToast('5 Uma Shards → 1 Select Coupon')
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not exchange shards'))
      .finally(() => setExchangeBusy(false))
  }
  const doRedeem = () => {
    if (!selected || redeemBusy || selected.redemptionLock) return
    setRedeemBusy(true)
    setError(null)
    void redeemUmaCoupon(selected.template.id).then((result) => {
      pushToast(result.alreadyRedeemed ? 'Uma already redeemed' : 'New Uma acquired')
      navigate(`/collection/reveal/uma/${encodeURIComponent(selected.template.id)}`, { replace: true })
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not redeem this coupon'))
      .finally(() => setRedeemBusy(false))
  }

  return <div className="flex flex-col gap-3 pt-2">
    <Panel className="bg-gradient-to-br from-sky-50 to-white">
      <div className="flex items-end justify-between gap-3"><div><h1 className="text-2xl font-extrabold">Stable</h1><p className="text-sm font-bold text-ink-soft">{album.owned} / {album.total} outfits owned</p></div><button type="button" className="min-h-11 rounded-2xl bg-white px-4 text-sm font-extrabold shadow-sm" onClick={() => setSortOpen(true)}>Sort ↕</button></div>
      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-violet-50 p-3">
        <div><p className="text-sm font-extrabold">💎 {album.shardBalance} / {UMA_SHARDS_PER_COUPON} Uma Shards</p><m.p key={exchangePulse} initial={reducedMotion || exchangePulse === 0 ? false : { scale: 1.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-xs font-bold text-violet-700">🎟️ {album.couponBalance} Uma Select Coupon{album.couponBalance === 1 ? '' : 's'}</m.p></div>
        <button type="button" disabled={exchangeBusy || album.shardBalance < UMA_SHARDS_PER_COUPON} onClick={doExchange} className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-extrabold text-white disabled:opacity-45">{exchangeBusy ? 'Exchanging…' : 'Exchange'}</button>
      </div>
      {exchangePulse > 0 && <m.div key={exchangePulse} initial={reducedMotion ? false : { x: -18, scale: 0.85, opacity: 0 }} animate={{ x: 0, scale: 1, opacity: 1 }} className="mt-2 rounded-xl bg-white/80 p-2 text-center text-sm font-extrabold text-violet-700">💎 × 5 → 🎟️ + 1</m.div>}
      {!persistent && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-extrabold">Memory only — acquisitions work for this session but cannot persist or sync.</p>}
      {persistent && sync.status === 'offline' && <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs font-extrabold">Offline — collection changes commit locally and will sync after reconnecting.</p>}
      {persistent && (sync.status === 'pending' || sync.status === 'syncing') && <p className="mt-2 rounded-xl bg-sky-50 p-2 text-xs font-extrabold text-sky-deep">Local changes are saved · cloud sync {sync.status === 'syncing' ? 'in progress' : 'pending'}.</p>}
      {album.orphanedIds.length > 0 && <p className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-bold text-danger">{album.orphanedIds.length} owned Uma reference{album.orphanedIds.length === 1 ? '' : 's'} need restored content.</p>}
      {error && <p role="alert" className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-bold text-danger">{error}</p>}
    </Panel>

    <div className="flex gap-2 overflow-x-auto pb-1">{(['all', 'owned', 'unowned'] as const).map((ownership) => <button key={ownership} type="button" onClick={() => setFilters((value) => ({ ...value, ownership }))} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-extrabold ${filters.ownership === ownership ? 'bg-violet-600 text-white' : 'bg-white'}`}>{titleCase(ownership)}</button>)}</div>
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Stable filters">{(Object.keys(FILTER_LABELS) as FilterKind[]).map((kind) => <button key={kind} type="button" className={`min-h-11 shrink-0 rounded-full border-2 px-3 text-sm font-extrabold ${activeLabel(kind).startsWith('All') ? 'border-white bg-white/85' : 'border-sky bg-sky text-white text-outline'}`} onClick={() => kind === 'ready' ? setFilters((current) => ({ ...current, ready: !current.ready })) : setFilterSheet(kind)}>{FILTER_LABELS[kind]}: {activeLabel(kind)}</button>)}</div>

    {album.items.length ? <div className="grid grid-cols-2 gap-3">{album.items.map((item) => <UmaTile key={item.template.id} item={item} onUnowned={() => { setSelected(item); setError(null) }} />)}</div> : <Panel className="text-center"><p className="font-extrabold">No Uma outfits match these filters.</p><button type="button" className="mt-3 min-h-11 rounded-2xl bg-sky px-5 font-extrabold text-white" onClick={() => setFilters(EMPTY_UMA_ALBUM_FILTERS)}>Reset filters</button></Panel>}

    <BottomSheet open={filterSheet !== null} onClose={() => setFilterSheet(null)}>{filterSheet && <div><h2 className="mb-3 text-xl font-extrabold">{FILTER_LABELS[filterSheet]}</h2>{filterSheet !== 'ready' && <div className="grid gap-2"><OptionButton selected={filters[filterSheet] === null} label="All" onClick={() => { setFilters((current) => ({ ...current, [filterSheet]: null })); setFilterSheet(null) }} />{options.map((option) => <OptionButton key={String(option.value)} selected={filters[filterSheet] === option.value} label={option.label} onClick={() => { setFilters((current) => ({ ...current, [filterSheet]: option.value })); setFilterSheet(null) }} />)}</div>}</div>}</BottomSheet>
    <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)}><h2 className="mb-3 text-xl font-extrabold">Sort Stable</h2><div className="grid gap-2">{([['name', 'Name'], ['uma-level', 'Uma Level'], ['training-level', 'Training Level']] as const).map(([value, label]) => <OptionButton key={value} selected={sort === value} label={label} onClick={() => { setSort(value); setSortOpen(false) }} />)}</div></BottomSheet>
    <BottomSheet open={selected !== null} onClose={() => { if (!redeemBusy) { setSelected(null); setError(null) } }}>{selected && <div>
      <div className="flex gap-3"><AtlasSprite asset={selected.asset} alt={`${selected.template.name} icon`} className="h-24 w-24 shrink-0 rounded-2xl bg-sky-50" fallback={<div className="flex h-full items-center justify-center text-4xl">🐴</div>} /><div><p className="text-xs font-extrabold text-violet-700">Unowned Uma outfit</p><h2 className="text-xl font-extrabold">{selected.template.name}</h2><p className="text-sm font-bold text-ink-soft">{selected.template.outfit ?? 'Standard outfit'}</p></div></div>
      {selected.redemptionLock ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold">{selected.redemptionLock}</p> : <div className="my-4 flex items-center justify-between rounded-2xl bg-violet-50 p-3 font-extrabold"><span>Uma Select Coupon</span><span>1 → {Math.max(0, profile.umaCoupons - 1)}</span></div>}
      {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-danger">{error}</p>}
      <GameButton disabled={redeemBusy || selected.redemptionLock !== null} onClick={doRedeem}>{redeemBusy ? 'Adding to Stable…' : selected.redemptionLock ? 'Coupon unavailable' : 'Redeem 1 Coupon'}</GameButton>
    </div>}</BottomSheet>
  </div>
}
