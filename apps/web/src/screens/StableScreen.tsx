import { DISTANCE_CATEGORIES, STRATEGIES, SURFACES, UMA_SHARDS_PER_COUPON, badgeStateId, tierOfLevel } from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { exchangeUmaShards, redeemUmaCoupon } from '../game/actions'
import { EMPTY_UMA_ALBUM_FILTERS, buildUmaAlbum, type UmaAlbumFilters, type UmaAlbumItem } from '../game/collection-view'
import type { UmaSort } from '../game/view'
import { useGame } from '../game/store'
import { buildUmaFlairSummary } from '../game/flair-view'
import type { BadgeFrameStyle } from '../game/badge-frame'
import { ArtTile } from '../ui/ArtTile'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Crest } from '../ui/Crest'
import { Numeral } from '../ui/Numeral'
import { Panel } from '../ui/Panel'
import { Placeholder } from '../ui/Placeholder'
import { ScreenState } from '../ui/ScreenState'
import { SegmentedControl } from '../ui/SegmentedControl'

const FILTER_LABELS = { tier: 'Tier', surface: 'Surface', distance: 'Distance', strategy: 'Strategy', sex: 'Sex', ready: 'Ready' } as const
type FilterKind = keyof typeof FILTER_LABELS
const titleCase = (value: string) => `${value[0]!.toUpperCase()}${value.slice(1)}`

function UmaTile({ item, onUnowned, frame }: { item: UmaAlbumItem; onUnowned: () => void; frame: BadgeFrameStyle | null }) {
  const body = (
    <>
      <ArtTile
        asset={item.asset}
        alt={item.owned ? `${item.template.name} portrait` : `${item.template.name}, not owned`}
        dimmed={!item.owned}
        chamfer={item.view?.readyToPromote ?? false}
        overlay={item.owned ? <Crest>T{item.view?.tier ?? 1}</Crest> : <Crest tone="neutral">Locked</Crest>}
        corner={item.view?.readyToPromote ? <Crest tone="accent">Ready</Crest> : null}
        footer={
          <>
            <p className="font-display truncate text-[15px] font-semibold">{item.template.name}</p>
            <p className="truncate text-[11px] text-ink-on-dark-soft">{item.template.outfit ?? 'Standard outfit'}</p>
          </>
        }
        className={frame && item.owned ? frame.borderClass : ''}
      />
      {item.save ? (
        <div className="flex items-center justify-between px-0.5 pt-1.5 text-[12px] text-ink-soft">
          <span>Lv <Numeral className="text-ink">{item.save.level}</Numeral></span>
          <span>TL {item.save.trainingLevel}</span>
        </div>
      ) : (
        <p className="px-0.5 pt-1.5 text-[12px] text-ink-faint">Unowned outfit</p>
      )}
    </>
  )
  return item.owned ? (
    <Link
      to={item.view?.readyToPromote ? `/scenario/${encodeURIComponent(item.template.id)}/start` : `/stable/${encodeURIComponent(item.template.id)}`}
      className="block min-w-0 text-left"
    >
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onUnowned} className="block min-w-0 text-left">
      {body}
    </button>
  )
}

function OptionButton({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`min-h-12 rounded-sm px-4 text-left text-[15px] font-semibold ${selected ? 'border border-accent bg-accent-wash text-accent-strong' : 'border border-hairline bg-panel text-ink'}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

export function StableScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const persistent = useGame((state) => state.persistent)
  const profile = useGame((state) => state.profile)
  const owned = useGame((state) => state.umas)
  const badges = useGame((state) => state.badges)
  const flairEvents = useGame((state) => state.flairEvents)
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
  const frames = useMemo(() => {
    if (contentState.status !== 'ready') return new Map<string, BadgeFrameStyle>()
    return new Map(Object.values(owned).flatMap((save) => {
      const state = badges[badgeStateId(save.templateId)]
      return state?.scope === 'uma'
        ? [[save.templateId, buildUmaFlairSummary(contentState.content, state, flairEvents).frame] as const]
        : []
    }))
  }, [badges, contentState, flairEvents, owned])

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
        : filterSheet === 'strategy' ? STRATEGIES.map((value) => ({ value, label: titleCase(value) }))
          : filterSheet === 'sex' ? ([['female', 'Female'], ['male', 'Male'], ['unknown', 'Unknown']] as const).map(([value, label]) => ({ value, label })) : []
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

  return <div className="flex flex-col gap-3 pt-1">
    <Panel>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Stable</h1>
          <p className="text-[13px] text-ink-soft"><Numeral className="text-ink">{album.owned}</Numeral> / {album.total} outfits owned</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setSortOpen(true)}>Sort</Button>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-sm bg-sunken p-3">
        <div>
          <p className="text-[13px] font-semibold"><Numeral>{album.shardBalance}</Numeral> / {UMA_SHARDS_PER_COUPON} Uma Shards</p>
          <m.p key={exchangePulse} initial={reducedMotion || exchangePulse === 0 ? false : { scale: 1.15, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-[12px] text-ink-soft">
            {album.couponBalance} Uma Select Coupon{album.couponBalance === 1 ? '' : 's'}
          </m.p>
        </div>
        <Button size="sm" disabled={exchangeBusy || album.shardBalance < UMA_SHARDS_PER_COUPON} onClick={doExchange}>{exchangeBusy ? 'Exchanging…' : 'Exchange'}</Button>
      </div>
      {!persistent && <p className="mt-2 rounded-sm bg-warning/10 p-2 text-[12px] font-semibold">Memory only — acquisitions work for this session but cannot persist or sync.</p>}
      {persistent && sync.status === 'offline' && <p className="mt-2 rounded-sm bg-warning/10 p-2 text-[12px] font-semibold">Offline — collection changes commit locally and will sync after reconnecting.</p>}
      {persistent && (sync.status === 'pending' || sync.status === 'syncing') && <p className="mt-2 rounded-sm bg-info/10 p-2 text-[12px] font-semibold text-info">Local changes are saved · cloud sync {sync.status === 'syncing' ? 'in progress' : 'pending'}.</p>}
      {album.orphanedIds.length > 0 && <p className="mt-2 rounded-sm bg-danger/10 p-2 text-[12px] font-semibold text-danger">{album.orphanedIds.length} owned Uma reference{album.orphanedIds.length === 1 ? '' : 's'} need restored content.</p>}
      {error && <p role="alert" className="mt-2 rounded-sm bg-danger/10 p-2 text-[12px] font-semibold text-danger">{error}</p>}
    </Panel>

    <SegmentedControl
      label="Ownership"
      value={filters.ownership}
      onChange={(ownership) => setFilters((value) => ({ ...value, ownership }))}
      options={[{ value: 'all', label: 'All' }, { value: 'owned', label: 'Owned' }, { value: 'unowned', label: 'Unowned' }] as const}
    />

    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Stable filters">
      {(Object.keys(FILTER_LABELS) as FilterKind[]).map((kind) => (
        <Chip
          key={kind}
          selected={!activeLabel(kind).startsWith('All')}
          onClick={() => kind === 'ready' ? setFilters((current) => ({ ...current, ready: !current.ready })) : setFilterSheet(kind)}
        >
          {FILTER_LABELS[kind]}: {activeLabel(kind)}
        </Chip>
      ))}
    </div>

    {album.items.length ? (
      <div className="grid grid-cols-2 gap-3">
        {album.items.map((item) => <UmaTile key={item.template.id} item={item} frame={frames.get(item.template.id) ?? null} onUnowned={() => { setSelected(item); setError(null) }} />)}
      </div>
    ) : (
      <Panel className="text-center">
        <p className="font-display font-semibold">No Uma outfits match these filters.</p>
        <Button className="mt-3" onClick={() => setFilters(EMPTY_UMA_ALBUM_FILTERS)}>Reset filters</Button>
      </Panel>
    )}

    <BottomSheet open={filterSheet !== null} onClose={() => setFilterSheet(null)}>{filterSheet && <div><h2 className="font-display mb-3 text-xl font-bold">{FILTER_LABELS[filterSheet]}</h2>{filterSheet !== 'ready' && <div className="grid gap-2"><OptionButton selected={filters[filterSheet] === null} label="All" onClick={() => { setFilters((current) => ({ ...current, [filterSheet]: null })); setFilterSheet(null) }} />{options.map((option) => <OptionButton key={String(option.value)} selected={filters[filterSheet] === option.value} label={option.label} onClick={() => { setFilters((current) => ({ ...current, [filterSheet]: option.value })); setFilterSheet(null) }} />)}</div>}</div>}</BottomSheet>
    <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)}><h2 className="font-display mb-3 text-xl font-bold">Sort Stable</h2><div className="grid gap-2">{([['name', 'Name'], ['uma-level', 'Uma Level'], ['training-level', 'Training Level']] as const).map(([value, label]) => <OptionButton key={value} selected={sort === value} label={label} onClick={() => { setSort(value); setSortOpen(false) }} />)}</div></BottomSheet>
    <BottomSheet open={selected !== null} onClose={() => { if (!redeemBusy) { setSelected(null); setError(null) } }}>{selected && <div>
      <div className="flex gap-3"><AtlasSprite asset={selected.asset} alt={`${selected.template.name} portrait`} className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-hairline bg-sunken" fallback={<Placeholder label={selected.template.name} />} /><div><p className="text-micro">Unowned Uma outfit</p><h2 className="font-display text-xl font-bold">{selected.template.name}</h2><p className="text-[13px] text-ink-soft">{selected.template.outfit ?? 'Standard outfit'}</p></div></div>
      {selected.redemptionLock ? <p className="mt-4 rounded-sm bg-warning/10 p-3 text-[13px] font-semibold">{selected.redemptionLock}</p> : <div className="my-4 flex items-center justify-between rounded-sm bg-sunken p-3 text-[14px] font-semibold"><span>Uma Select Coupon</span><span><Numeral>1</Numeral> → <Numeral>{Math.max(0, profile.umaCoupons - 1)}</Numeral></span></div>}
      {error && <p role="alert" className="mb-3 rounded-sm bg-danger/10 p-3 text-[13px] font-semibold text-danger">{error}</p>}
      <Button className="w-full" disabled={redeemBusy || selected.redemptionLock !== null} onClick={doRedeem}>{redeemBusy ? 'Adding to Stable…' : selected.redemptionLock ? 'Coupon unavailable' : 'Redeem 1 Coupon'}</Button>
    </div>}</BottomSheet>
  </div>
}
