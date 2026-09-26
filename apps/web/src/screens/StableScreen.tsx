import { DISTANCE_CATEGORIES, STATS, SURFACES, UMA_SHARDS_PER_COUPON, badgeStateId } from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { useArt } from '../ui/album/useArt'
import { exchangeUmaShards, listLatestRaceTimes, redeemUmaCoupon } from '../game/actions'
import { addSavedView, loadAlbumPrefs, markSeen, removeSavedView, saveAlbumPrefs, type AlbumPrefs } from '../game/album/prefs'
import { emptyStateHint, runAlbumQuery, type AlbumQuery, type AlbumView } from '../game/album/query'
import {
  STABLE_ALBUM_ID,
  STABLE_DEFAULT_QUERY,
  STABLE_FACETS,
  STABLE_MODES,
  STABLE_PRESETS,
  STABLE_SORTS,
  STABLE_TIE_BREAK,
  buildStableAlbum,
  sortValueLabel,
  type StableEntry,
  type StableMode,
  type UmaFlairFacts,
} from '../game/album/stable'
import { useGame } from '../game/store'
import { buildUmaFlairSummary } from '../game/flair-view'
import type { BadgeFrameStyle } from '../game/badge-frame'
import { AlbumChrome } from '../ui/album/AlbumChrome'
import { AlbumDetail } from '../ui/album/AlbumDetail'
import { CompareSheet } from '../ui/album/CompareSheet'
import { VirtualGrid } from '../ui/album/VirtualGrid'
import { ArtTile } from '../ui/ArtTile'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { Crest } from '../ui/Crest'
import { Numeral } from '../ui/Numeral'
import { Panel } from '../ui/Panel'
import { Placeholder } from '../ui/Placeholder'
import { ScreenState } from '../ui/ScreenState'
import { SaveErrorState } from '../ui/SaveErrorState'
import { SegmentedControl } from '../ui/SegmentedControl'

const MAX_COMPARE = 3
const titleCase = (value: string) => `${value[0]!.toUpperCase()}${value.slice(1)}`

/** The compact aptitude line: her best surface, best distance and best strategy. */
function aptitudeLine(entry: StableEntry): string {
  const best = (values: Record<string, string>): string => {
    const order = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G']
    const [key, grade] = Object.entries(values)
      .sort(([, left], [, right]) => order.indexOf(left) - order.indexOf(right))[0]!
    return `${titleCase(key).slice(0, 4)} ${grade}`
  }
  return [best(entry.aptitudes.surface), best(entry.aptitudes.distance), best(entry.aptitudes.strategy)].join(' · ')
}

function UmaTile({
  entry,
  frame,
  view,
  sortLabel,
  selected,
  selecting,
  picked,
  onSelect,
  onOpen,
  onToggleSelect,
  onActions,
}: {
  entry: StableEntry
  frame: BadgeFrameStyle | null
  view: AlbumView
  sortLabel: string | null
  /** The entry currently shown in the detail area. */
  selected: boolean
  selecting: boolean
  picked: boolean
  onSelect: () => void
  onOpen: () => void
  onToggleSelect: () => void
  onActions: () => void
}) {
  const contentState = useContent()
  // Busts are the list portrait, as in the original's Trainee Select; the icon shows until one arrives (M019).
  const bust = useArt(contentState.status === 'ready' ? contentState.content : null, 'bust', entry.template.id)
  const press = useRef<number | null>(null)
  const startPress = () => { press.current = window.setTimeout(() => { press.current = null; onActions() }, 450) }
  const endPress = () => { if (press.current !== null) window.clearTimeout(press.current); press.current = null }
  // A tap selects; tapping the already-selected entry opens it, as the reserved detail area implies.
  const activate = selecting ? onToggleSelect : selected ? onOpen : onSelect
  const ring = selected && !selecting ? 'outline outline-2 outline-accent outline-offset-1' : ''

  if (view === 'list') {
    return (
      <button
        type="button"
        onClick={activate}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        className={`flex w-full items-center gap-3 rounded-sm border border-hairline bg-panel p-2 text-left ${ring}`}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xs bg-sunken">
          {bust ? (
            <img src={bust} alt="" draggable={false} className={`h-full w-full object-cover ${entry.owned ? '' : 'opacity-45 saturate-50'}`} />
          ) : (
            <AtlasSprite
              asset={entry.asset}
              alt=""
              decorative
              className={`h-full w-full ${entry.owned ? '' : 'opacity-45 saturate-50'}`}
              fallback={<Placeholder label={entry.template.name} />}
            />
          )}
        </div>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold">{entry.template.name}</span>
            {entry.isNew && <Crest tone="accent">NEW</Crest>}
            {entry.outfitCount > 1 && <span className="text-[11px] text-ink-faint">×{entry.outfitCount}</span>}
          </span>
          <span className="block truncate text-[11px] text-ink-faint">{aptitudeLine(entry)}</span>
        </span>
        <span className="shrink-0 text-right text-[12px] text-ink-soft">
          {entry.save ? <>Lv <Numeral className="text-ink">{entry.save.level}</Numeral></> : 'Unowned'}
          <span className="block text-[11px] text-ink-faint">{sortLabel ?? `TL ${entry.view?.derived.trainingLevel ?? '—'}`}</span>
        </span>
      </button>
    )
  }

  const icons = view === 'icons'
  return (
    <div className="relative">
      <button
        type="button"
        onClick={activate}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        className={`block w-full min-w-0 rounded-md text-left ${ring}`}
        aria-label={`${entry.template.name}${entry.owned ? '' : ', not owned'}`}
      >
        <ArtTile
          asset={entry.asset}
          artUrl={bust}
          alt={entry.owned ? `${entry.template.name} portrait` : `${entry.template.name}, not owned`}
          dimmed={!entry.owned}
          chamfer={!icons && (entry.view?.readyToAdvance ?? false)}
          overlay={
            icons ? (
              <>
                {entry.isNew && <span aria-hidden className="h-2 w-2 rounded-full bg-accent shadow-1" />}
                {entry.view?.readyToAdvance && <span aria-hidden className="h-2 w-2 rounded-full bg-success shadow-1" />}
              </>
            ) : (
              <>
                {entry.owned ? <Crest>T{entry.view?.tier ?? 1}</Crest> : <Crest>Locked</Crest>}
                {entry.isNew && <Crest tone="accent">NEW</Crest>}
                {entry.outfitCount > 1 && <Crest>×{entry.outfitCount}</Crest>}
              </>
            )
          }
          corner={
            selecting
              ? <Crest tone={picked ? 'accent' : 'neutral'}>{picked ? '✓' : ''}</Crest>
              : !icons && entry.view?.readyToAdvance ? <Crest tone="accent">Ready</Crest> : null
          }
          footer={icons ? undefined : (
            <>
              <p className="font-display truncate text-[15px] font-semibold">{entry.template.name}</p>
              <p className="truncate text-[11px] text-ink-on-dark-soft">{entry.template.outfit ?? 'Standard outfit'}</p>
            </>
          )}
          className={frame && entry.owned ? frame.borderClass : ''}
        />
        {!icons && (
          <div className="flex items-center justify-between gap-2 px-0.5 pt-1.5 pr-8 text-[12px] text-ink-soft">
            <span className="truncate">
              {entry.save ? <>Lv <Numeral className="text-ink">{entry.save.level}</Numeral></> : 'Unowned'}
            </span>
            <span className="truncate text-right text-[11px] text-ink-faint">{sortLabel ?? aptitudeLine(entry)}</span>
          </div>
        )}
      </button>
      {!selecting && !icons && (
        <button
          type="button"
          aria-label={`Actions for ${entry.template.name}`}
          onClick={onActions}
          className="absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center text-ink-faint"
        >
          <span aria-hidden>⋯</span>
        </button>
      )}
    </div>
  )
}

export function StableScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const persistent = useGame((state) => state.persistent)
  const profile = useGame((state) => state.profile)
  const owned = useGame((state) => state.umas)
  const cards = useGame((state) => state.cards)
  const badges = useGame((state) => state.badges)
  const flairEvents = useGame((state) => state.flairEvents)
  const pushToast = useGame((state) => state.pushToast)
  const sync = useGame((state) => state.sync)
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()

  const [prefs, setPrefs] = useState<AlbumPrefs>({ id: STABLE_ALBUM_ID, query: STABLE_DEFAULT_QUERY, views: [], seen: [] })
  const [parameter, setParameter] = useState<string | null>(null)
  const [lastRacedAt, setLastRacedAt] = useState<Record<string, number>>({})
  const [detailId, setDetailId] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selection, setSelection] = useState<readonly string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [actionsFor, setActionsFor] = useState<StableEntry | null>(null)
  const [redeemFor, setRedeemFor] = useState<StableEntry | null>(null)
  const [exchangeBusy, setExchangeBusy] = useState(false)
  const [redeemBusy, setRedeemBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exchangePulse, setExchangePulse] = useState(0)
  const [needsSeed, setNeedsSeed] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadAlbumPrefs(STABLE_ALBUM_ID, STABLE_DEFAULT_QUERY, STABLE_FACETS, STABLE_SORTS, [...STABLE_MODES])
      .then(({ fresh, ...loaded }) => {
        if (cancelled) return
        setPrefs(loaded)
        setNeedsSeed(fresh)
      })
    void listLatestRaceTimes().then((times) => { if (!cancelled) setLastRacedAt(times) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  // A device that has never opened the album marks what is already here as seen, so NEW means new
  // to you. This waits for the save, which loads after preferences do.
  useEffect(() => {
    if (!needsSeed || status !== 'ready') return
    setNeedsSeed(false)
    setPrefs((current) => {
      const next = { ...current, seen: markSeen(current.seen, Object.keys(owned)) }
      void saveAlbumPrefs(next)
      return next
    })
  }, [needsSeed, owned, status])

  const updatePrefs = useCallback((next: AlbumPrefs) => {
    setPrefs(next)
    void saveAlbumPrefs(next)
  }, [])
  const setQuery = useCallback((query: AlbumQuery) => {
    setPrefs((current) => {
      const next = { ...current, query }
      void saveAlbumPrefs(next)
      return next
    })
  }, [])

  const flair = useMemo(() => {
    if (contentState.status !== 'ready') return {} as Record<string, UmaFlairFacts>
    const facts: Record<string, UmaFlairFacts> = {}
    for (const save of Object.values(owned)) {
      const state = badges[badgeStateId(save.templateId)]
      if (state?.scope !== 'uma') continue
      const summary = buildUmaFlairSummary(contentState.content, state, flairEvents)
      facts[save.templateId] = { prestige: summary.prestige, badgeCount: summary.badgeCount, activeTitle: summary.activeTitle }
    }
    return facts
  }, [badges, contentState, flairEvents, owned])

  const frames = useMemo(() => {
    if (contentState.status !== 'ready') return new Map<string, BadgeFrameStyle>()
    return new Map(Object.values(owned).flatMap((save) => {
      const state = badges[badgeStateId(save.templateId)]
      return state?.scope === 'uma'
        ? [[save.templateId, buildUmaFlairSummary(contentState.content, state, flairEvents).frame] as const]
        : []
    }))
  }, [badges, contentState, flairEvents, owned])

  const mode = (prefs.query.mode ?? 'outfit') as StableMode
  const album = useMemo(() => contentState.status === 'ready' && profile
    ? buildStableAlbum({ content: contentState.content, saves: owned, cards, profile, lastRacedAt, flair, seen: prefs.seen, mode })
    : null,
  [cards, contentState, flair, lastRacedAt, mode, owned, prefs.seen, profile])

  // "Best aptitude for…" sorts by the chosen parameter key, so the parameter is part of the sort.
  const effectiveQuery = useMemo(() => (
    prefs.query.sort === 'bestAptitude' && parameter ? { ...prefs.query, sort: parameter } : prefs.query
  ), [parameter, prefs.query])

  const result = useMemo(() => album
    ? runAlbumQuery(album.rows, STABLE_FACETS, effectiveQuery, STABLE_TIE_BREAK)
    : null,
  [album, effectiveQuery])

  const countFor = useCallback((draft: AlbumQuery) => album
    ? runAlbumQuery(album.rows, STABLE_FACETS, draft).total
    : 0,
  [album])

  const openEntry = useCallback((entry: StableEntry) => {
    if (entry.isNew) updatePrefs({ ...prefs, seen: markSeen(prefs.seen, [entry.id]) })
    if (!entry.owned) { setRedeemFor(entry); setError(null); return }
    const order = result?.rows.map((row) => row.id) ?? []
    navigate(
      entry.view?.readyToAdvance
        ? `/stable/${encodeURIComponent(entry.template.id)}`
        : `/stable/${encodeURIComponent(entry.template.id)}`,
      { state: { albumOrder: order } },
    )
  }, [navigate, prefs, result, updatePrefs])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to open your Stable" detail="Your private roster stays behind your account." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish a private content version before creating a save." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <SaveErrorState detail={lifecycleError} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile || !album || !result) return <ScreenState title="Opening your Stable…" detail="Loading private content and your local save." />

  const entries = result.rows.flatMap((row) => album.entries.get(row.id) ?? [])
  const compareEntries = selection.flatMap((id) => album.entries.get(id) ?? [])
  const view = prefs.query.view
  const columns = view === 'icons' ? 5 : view === 'cards' ? 2 : 1
  const rowHeight = view === 'icons' ? 80 : view === 'cards' ? 230 : 64
  // The detail area always has something in it: the first result until the player picks.
  const detail = (detailId ? album.entries.get(detailId) : undefined) ?? entries[0] ?? null
  const orphaned = Object.keys(owned).filter((id) => !contentState.content.umas.byId.has(id))

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
    if (!redeemFor || redeemBusy || redeemFor.redemptionLock) return
    setRedeemBusy(true)
    setError(null)
    void redeemUmaCoupon(redeemFor.template.id).then((outcome) => {
      pushToast(outcome.alreadyRedeemed ? 'Uma already redeemed' : 'New Uma acquired')
      navigate(`/collection/reveal/uma/${encodeURIComponent(redeemFor.template.id)}`, { replace: true })
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not redeem this coupon'))
      .finally(() => setRedeemBusy(false))
  }

  const toggleSelect = (id: string) => {
    setSelection((current) => current.includes(id)
      ? current.filter((entry) => entry !== id)
      : current.length >= MAX_COMPARE ? current : [...current, id])
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      <Panel>
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-sm bg-sunken p-3">
          <div>
            <p className="text-[13px] font-semibold">
              <Numeral>{profile.umaShards}</Numeral> / {UMA_SHARDS_PER_COUPON} Uma Shards
            </p>
            <m.p
              key={exchangePulse}
              initial={reducedMotion || exchangePulse === 0 ? false : { scale: 1.15, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[12px] text-ink-soft"
            >
              {profile.umaCoupons} Uma Select Coupon{profile.umaCoupons === 1 ? '' : 's'}
            </m.p>
          </div>
          <Button size="sm" disabled={exchangeBusy || profile.umaShards < UMA_SHARDS_PER_COUPON} onClick={doExchange}>
            {exchangeBusy ? 'Exchanging…' : 'Exchange'}
          </Button>
        </div>
        {!persistent && <p className="mt-2 rounded-sm bg-warning/10 p-2 text-[12px] font-semibold">Memory only — acquisitions work for this session but cannot persist or sync.</p>}
        {persistent && sync.status === 'offline' && <p className="mt-2 rounded-sm bg-warning/10 p-2 text-[12px] font-semibold">Offline — collection changes commit locally and will sync after reconnecting.</p>}
        {orphaned.length > 0 && <p className="mt-2 rounded-sm bg-danger/10 p-2 text-[12px] font-semibold text-danger">{orphaned.length} owned Uma reference{orphaned.length === 1 ? '' : 's'} need restored content.</p>}
        {error && <p role="alert" className="mt-2 rounded-sm bg-danger/10 p-2 text-[12px] font-semibold text-danger">{error}</p>}
      </Panel>

      {detail && (
        <AlbumDetail
          content={contentState.content}
          kind="uma"
          id={detail.id}
          icon={detail.asset}
          alt={`${detail.template.name} portrait`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-micro">{detail.view?.scenario?.name ?? `Tier ${detail.view?.tier ?? 1}`}</p>
              <p className="font-display truncate text-xl font-bold">{detail.template.name}</p>
              <p className="truncate text-[12px] text-ink-soft">{detail.template.outfit ?? 'Standard outfit'}</p>
            </div>
            {detail.isNew && <Crest tone="accent">NEW</Crest>}
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            {detail.save
              ? <>
                  <Crest>Lv {detail.save.level}</Crest>
                  <Crest>TL {detail.view?.derived.trainingLevel ?? 1}</Crest>
                  {detail.activeTitle && <Crest tone="accent">{detail.activeTitle}</Crest>}
                  {detail.outfitCount > 1 && <Crest>{detail.ownedOutfitCount}/{detail.outfitCount} outfits</Crest>}
                </>
              : <Crest>Unowned</Crest>}
          </div>

          {detail.save && (
            <div className="mt-2 grid grid-cols-5 gap-1 text-center">
              {STATS.map((stat) => (
                <div key={stat}>
                  <p className="text-[10px] text-ink-faint uppercase">{stat.slice(0, 3)}</p>
                  <p className="font-display text-[13px] font-semibold">{detail.view?.derived.stats[stat] ?? 0}</p>
                </div>
              ))}
            </div>
          )}

          <p className="mt-2 text-[11px] text-ink-faint">{aptitudeLine(detail)}</p>

          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => openEntry(detail)}>
              {detail.owned ? 'Open' : 'Redeem'}
            </Button>
            {detail.owned && (
              <Button size="sm" variant="secondary" onClick={() => navigate(`/constellation/${encodeURIComponent(detail.id)}`)}>Train</Button>
            )}
            {detail.owned && (
              <Button size="sm" onClick={() => navigate(`/race?uma=${encodeURIComponent(detail.id)}`)}>Race</Button>
            )}
          </div>
        </AlbumDetail>
      )}

      <AlbumChrome
        title="Stable"
        completion={<><Numeral className="text-ink">{album.owned}</Numeral> / {album.total} {mode === 'character' ? 'characters' : 'outfits'} owned</>}
        segment={
          <div className="flex flex-col gap-2">
            <SegmentedControl
              label="Ownership"
              value={(prefs.query.filters.ownership as string[] | undefined)?.[0] ?? 'all'}
              onChange={(value) => setQuery({
                ...prefs.query,
                filters: value === 'all'
                  ? Object.fromEntries(Object.entries(prefs.query.filters).filter(([key]) => key !== 'ownership'))
                  : { ...prefs.query.filters, ownership: [value] },
              })}
              options={[{ value: 'all', label: 'All' }, { value: 'owned', label: 'Owned' }, { value: 'unowned', label: 'Unowned' }] as const}
            />
            <SegmentedControl
              label="Grouping"
              value={mode}
              onChange={(value) => { setSelection([]); setQuery({ ...prefs.query, mode: value }) }}
              options={[{ value: 'outfit', label: 'Outfits' }, { value: 'character', label: 'Characters' }] as const}
            />
          </div>
        }
        facets={STABLE_FACETS}
        sorts={STABLE_SORTS}
        presets={STABLE_PRESETS}
        query={prefs.query}
        counts={result.counts}
        total={result.total}
        parameter={parameter}
        views={prefs.views}
        emptyHint={emptyStateHint(album.rows, STABLE_FACETS, effectiveQuery)}
        hiddenFilterKeys={['ownership']}
        countFor={countFor}
        onQueryChange={setQuery}
        onParameterChange={setParameter}
        onSaveView={(name) => {
          try {
            updatePrefs({ ...prefs, views: addSavedView(prefs.views, name, prefs.query) })
          } catch (reason) {
            pushToast(reason instanceof Error ? reason.message : 'Could not save this view')
          }
        }}
        onDeleteView={(name) => updatePrefs({ ...prefs, views: removeSavedView(prefs.views, name) })}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-pressed={selecting}
            onClick={() => { setSelecting((value) => !value); setSelection([]) }}
            className="min-h-11 text-[13px] font-semibold text-accent-strong"
          >
            {selecting ? 'Done' : 'Compare'}
          </button>
          {selecting && (
            <Button
              size="sm"
              disabled={selection.length < 2}
              onClick={() => setCompareOpen(true)}
            >
              Compare {selection.length}/{MAX_COMPARE}
            </Button>
          )}
        </div>

        <VirtualGrid
          items={entries}
          columns={columns}
          rowHeight={rowHeight}
          keyOf={(entry) => entry.id}
          renderItem={(entry) => (
            <UmaTile
              entry={entry}
              frame={frames.get(entry.id) ?? null}
              view={view}
              sortLabel={sortValueLabel(entry, prefs.query.sort, parameter)}
              selected={detail?.id === entry.id}
              selecting={selecting}
              picked={selection.includes(entry.id)}
              onSelect={() => setDetailId(entry.id)}
              onOpen={() => openEntry(entry)}
              onToggleSelect={() => toggleSelect(entry.id)}
              onActions={() => setActionsFor(entry)}
            />
          )}
        />
      </AlbumChrome>

      <CompareSheet
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Compare"
        columns={compareEntries.map((entry) => ({ id: entry.id, label: entry.template.name, detail: entry.template.outfit ?? undefined }))}
        rows={[
          { label: 'Level', values: compareEntries.map((entry) => entry.save?.level ?? null), best: 'high' },
          { label: 'Training Lv', values: compareEntries.map((entry) => entry.view?.derived.trainingLevel ?? null), best: 'high' },
          ...STATS.map((stat) => ({
            label: titleCase(stat),
            values: compareEntries.map((entry) => entry.view?.derived.stats[stat] ?? null),
            best: 'high' as const,
          })),
          { label: 'Total', values: compareEntries.map((entry) => (entry.save ? entry.statTotal : null)), best: 'high' },
          ...SURFACES.map((surface) => ({
            label: titleCase(surface),
            values: compareEntries.map((entry) => entry.aptitudes.surface[surface]),
          })),
          ...DISTANCE_CATEGORIES.map((distance) => ({
            label: titleCase(distance),
            values: compareEntries.map((entry) => entry.aptitudes.distance[distance]),
          })),
          { label: 'Prestige', values: compareEntries.map((entry) => entry.prestige), best: 'high' },
        ]}
      />

      <BottomSheet open={actionsFor !== null} onClose={() => setActionsFor(null)}>
        {actionsFor && (
          <div className="grid gap-1.5 pb-2">
            <h2 className="font-display mb-1 text-xl font-bold">{actionsFor.template.name}</h2>
            {actionsFor.owned ? (
              <>
                <Button variant="secondary" onClick={() => navigate(`/constellation/${encodeURIComponent(actionsFor.id)}`)}>Train</Button>
                <Button variant="secondary" onClick={() => navigate(`/race?uma=${encodeURIComponent(actionsFor.id)}`)}>Race</Button>
                <Button variant="secondary" onClick={() => navigate(`/constellation/${encodeURIComponent(actionsFor.id)}/cards`)}>Card set</Button>
                <Button variant="secondary" onClick={() => { setActionsFor(null); openEntry(actionsFor) }}>Open profile</Button>
              </>
            ) : (
              <Button onClick={() => { setActionsFor(null); setRedeemFor(actionsFor) }}>Redeem with a coupon</Button>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={redeemFor !== null} onClose={() => { if (!redeemBusy) { setRedeemFor(null); setError(null) } }}>
        {redeemFor && (
          <div>
            <div className="flex gap-3">
              <AtlasSprite
                asset={redeemFor.asset}
                alt={`${redeemFor.template.name} portrait`}
                className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-hairline bg-sunken"
                fallback={<Placeholder label={redeemFor.template.name} />}
              />
              <div>
                <p className="text-micro">Unowned Uma outfit</p>
                <h2 className="font-display text-xl font-bold">{redeemFor.template.name}</h2>
                <p className="text-[13px] text-ink-soft">{redeemFor.template.outfit ?? 'Standard outfit'}</p>
              </div>
            </div>
            {redeemFor.redemptionLock
              ? <p className="mt-4 rounded-sm bg-warning/10 p-3 text-[13px] font-semibold">{redeemFor.redemptionLock}</p>
              : <div className="my-4 flex items-center justify-between rounded-sm bg-sunken p-3 text-[14px] font-semibold">
                  <span>Uma Select Coupon</span>
                  <span><Numeral>1</Numeral> → <Numeral>{Math.max(0, profile.umaCoupons - 1)}</Numeral></span>
                </div>}
            {error && <p role="alert" className="mb-3 rounded-sm bg-danger/10 p-3 text-[13px] font-semibold text-danger">{error}</p>}
            <Button className="w-full" disabled={redeemBusy || redeemFor.redemptionLock !== null} onClick={doRedeem}>
              {redeemBusy ? 'Adding to Stable…' : redeemFor.redemptionLock ? 'Coupon unavailable' : 'Redeem 1 Coupon'}
            </Button>
          </div>
        )}
      </BottomSheet>

      <p className="pb-2 text-center text-[12px] text-ink-faint">
        <Link to="/cards" className="font-semibold text-accent-strong">Support cards</Link> · {album.total - album.owned} still to collect
      </p>
    </div>
  )
}
