import { BOND_RECALL_TICKET_COST, MAX_STARS, brokenTiers, scenarioForTier } from '@racer/domain'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { unlockCard } from '../game/actions'
import { addSavedView, loadAlbumPrefs, markSeen, removeSavedView, saveAlbumPrefs, type AlbumPrefs } from '../game/album/prefs'
import { emptyStateHint, runAlbumQuery, type AlbumQuery, type AlbumView } from '../game/album/query'
import {
  CARDS_ALBUM_ID,
  CARDS_SCENARIO_ALBUM_ID,
  CARD_COLLECTION_FACETS,
  CARD_COLLECTION_QUERY,
  CARD_COLLECTION_SORTS,
  CARD_SCENARIO_FACETS,
  CARD_SCENARIO_QUERY,
  CARD_SCENARIO_SORTS,
  CARD_TIE_BREAK,
  buildCardAlbumRows,
  buildCardPresets,
  cardFacets,
  cardSortValueLabel,
  cardSorts,
  cardPayLabel,
  cardSplitLabel,
  type CardEntry,
  type CardLens,
} from '../game/album/cards'
import { bondRecallHref } from '../game/bond-links'
import { useGame } from '../game/store'
import { AlbumChrome } from '../ui/album/AlbumChrome'
import { AlbumDetail } from '../ui/album/AlbumDetail'
import { CompareSheet } from '../ui/album/CompareSheet'
import { VirtualGrid } from '../ui/album/VirtualGrid'
import { ArtTile } from '../ui/ArtTile'
import { AtlasSprite } from '../ui/AtlasSprite'
import { Stars } from '../ui/Stars'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { Crest } from '../ui/Crest'
import { Numeral } from '../ui/Numeral'
import { Panel } from '../ui/Panel'
import { Placeholder } from '../ui/Placeholder'
import { ScreenState } from '../ui/ScreenState'
import { SaveErrorState } from '../ui/SaveErrorState'
import { SegmentedControl } from '../ui/SegmentedControl'
import { CheckIcon } from '../ui/icons'
import { formatTickets } from '../ui/tickets'

const MAX_COMPARE = 3
const titleCase = (value: string) => value.slice(0, 1).toUpperCase() + value.slice(1)
const scenarioName = (tier: number) => scenarioForTier(tier)?.name ?? `Tier ${tier}`
const emptyPrefs = (id: string, query: AlbumQuery): AlbumPrefs => ({ id, query, views: [], seen: [] })

/** What a tile says under or beside the art: bond and pay in a scenario, price when unowned. */
function tileValue(entry: CardEntry, lens: CardLens): string {
  if (!entry.owned) return `${entry.unlockCost} tickets`
  if (lens === 'collection') return cardSplitLabel(entry.template)
  return cardPayLabel(entry) ?? ''
}

function CardTile({
  entry,
  lens,
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
  entry: CardEntry
  lens: CardLens
  view: AlbumView
  sortLabel: string | null
  selected: boolean
  selecting: boolean
  picked: boolean
  onSelect: () => void
  onOpen: () => void
  onToggleSelect: () => void
  onActions: () => void
}) {
  const press = useRef<number | null>(null)
  const startPress = () => { press.current = window.setTimeout(() => { press.current = null; onActions() }, 450) }
  const endPress = () => { if (press.current !== null) window.clearTimeout(press.current); press.current = null }
  const activate = selecting ? onToggleSelect : selected ? onOpen : onSelect
  const ring = selected && !selecting ? 'outline outline-2 outline-accent outline-offset-1' : ''
  const showBond = lens !== 'collection' && entry.owned

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
          <AtlasSprite
            asset={entry.asset}
            alt=""
            decorative
            className={`h-full w-full ${entry.owned ? '' : 'opacity-45 saturate-50'}`}
            fallback={<Placeholder label={entry.template.charName} />}
          />
        </div>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold">{entry.template.charName}</span>
            {entry.isNew && <Crest tone="accent">NEW</Crest>}
          </span>
          <span className="block truncate text-[11px] text-ink-faint">{titleCase(entry.template.type)} · {sortLabel ?? cardSplitLabel(entry.template)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-ink-soft">
          {showBond && <Stars value={entry.bond ?? 0} />}
          {tileValue(entry, lens)}
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
        aria-label={`${entry.template.charName} support card${entry.owned ? '' : ', not owned'}${showBond ? `, ${entry.bond}★` : ''}`}
      >
        <ArtTile
          asset={entry.asset}
          alt={entry.owned ? `${entry.template.charName} support card` : `${entry.template.charName} support card, not owned`}
          dimmed={!entry.owned}
          chamfer={!icons && entry.bond === MAX_STARS}
          overlay={
            icons ? (
              <>
                {entry.isNew && <span aria-hidden className="h-2 w-2 rounded-full bg-accent shadow-1" />}
                {entry.equippedBy.length > 0 && <span aria-hidden className="h-2 w-2 rounded-full bg-info shadow-1" />}
              </>
            ) : (
              <>
                <Crest tone={entry.bond === MAX_STARS ? 'accent' : 'neutral'}>{entry.template.type.slice(0, 3).toUpperCase()}</Crest>
                {entry.isNew && <Crest tone="accent">NEW</Crest>}
                {entry.equippedBy.length > 0 && <Crest>In a set</Crest>}
              </>
            )
          }
          corner={selecting ? <Crest tone={picked ? 'accent' : 'neutral'}>{picked ? <CheckIcon size={16} title="Picked" /> : <span className="h-4 w-4" />}</Crest> : null}
          footer={icons
            ? (showBond ? <Stars value={entry.bond ?? 0} onDark /> : undefined)
            : (
              <>
                <p className="font-display truncate text-[14px] font-semibold">{entry.template.charName}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-ink-on-dark-soft">{tileValue(entry, lens)}</span>
                  {showBond && <Stars value={entry.bond ?? 0} onDark />}
                </div>
              </>
            )}
          className={entry.bond === MAX_STARS ? 'border-accent' : ''}
        />
        {!icons && <p className="truncate px-0.5 pt-1.5 pr-8 text-[11px] text-ink-faint">{sortLabel ?? entry.template.title}</p>}
      </button>
      {!selecting && !icons && (
        <button
          type="button"
          aria-label={`Actions for ${entry.template.charName}`}
          onClick={onActions}
          className="absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center text-ink-faint"
        >
          <span aria-hidden>⋯</span>
        </button>
      )}
    </div>
  )
}

/**
 * The Cards tab, seen through a lens (M016): the **collection**, where cards are owned or bought, or **one
 * scenario**, where each card has a bond and a price per node and can be bonded from here.
 */
export function CardsScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const persistent = useGame((state) => state.persistent)
  const profile = useGame((state) => state.profile)
  const cards = useGame((state) => state.cards)
  const umas = useGame((state) => state.umas)
  const pushToast = useGame((state) => state.pushToast)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const [collectionPrefs, setCollectionPrefs] = useState<AlbumPrefs>(emptyPrefs(CARDS_ALBUM_ID, CARD_COLLECTION_QUERY))
  const [scenarioPrefs, setScenarioPrefs] = useState<AlbumPrefs>(emptyPrefs(CARDS_SCENARIO_ALBUM_ID, CARD_SCENARIO_QUERY))
  const [needsSeed, setNeedsSeed] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selection, setSelection] = useState<readonly string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [actionsFor, setActionsFor] = useState<CardEntry | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadAlbumPrefs(CARDS_ALBUM_ID, CARD_COLLECTION_QUERY, CARD_COLLECTION_FACETS, CARD_COLLECTION_SORTS),
      loadAlbumPrefs(CARDS_SCENARIO_ALBUM_ID, CARD_SCENARIO_QUERY, CARD_SCENARIO_FACETS, CARD_SCENARIO_SORTS),
    ]).then(([collection, scenario]) => {
      if (cancelled) return
      const { fresh, ...collectionRest } = collection
      const { fresh: _scenarioFresh, ...scenarioRest } = scenario
      setCollectionPrefs(collectionRest)
      setScenarioPrefs(scenarioRest)
      setNeedsSeed(fresh)
    })
    return () => { cancelled = true }
  }, [])

  // A first visit marks the starter collection as seen, so NEW means new since then.
  useEffect(() => {
    if (!needsSeed || status !== 'ready') return
    setNeedsSeed(false)
    setCollectionPrefs((current) => {
      const next = { ...current, seen: markSeen(current.seen, Object.keys(cards)) }
      void saveAlbumPrefs(next)
      return next
    })
  }, [cards, needsSeed, status])

  // Old `?card=` links land on the card's own page.
  useEffect(() => {
    const requested = params.get('card')
    if (requested) navigate(`/cards/${encodeURIComponent(requested)}`, { replace: true })
  }, [navigate, params])

  const highestTier = useMemo(() => Math.max(1, ...Object.values(umas).map((save) => save.unlockedTier)), [umas])
  const featuredTier = profile?.featuredUmaId ? umas[profile.featuredUmaId]?.unlockedTier : undefined
  const lensParam = params.get('lens')
  const lens: CardLens = lensParam === 'collection'
    ? 'collection'
    : Number(lensParam) >= 1 && Number(lensParam) <= highestTier
      ? Number(lensParam)
      : Math.min(highestTier, featuredTier ?? highestTier)

  const prefs = lens === 'collection' ? collectionPrefs : scenarioPrefs
  const facets = cardFacets(lens)
  const sorts = cardSorts(lens)

  const updatePrefs = useCallback((next: AlbumPrefs) => {
    if (next.id === CARDS_ALBUM_ID) setCollectionPrefs(next)
    else setScenarioPrefs(next)
    void saveAlbumPrefs(next)
  }, [])
  const setQuery = (query: AlbumQuery) => updatePrefs({ ...prefs, query })
  const setLens = (next: CardLens) => {
    setDetailId(null)
    setSelection([])
    setParams((current) => {
      const nextParams = new URLSearchParams(current)
      nextParams.set('lens', String(next))
      return nextParams
    }, { replace: true })
  }

  const album = useMemo(() => contentState.status === 'ready'
    ? buildCardAlbumRows({ content: contentState.content, cards, umas, seen: collectionPrefs.seen, lens })
    : null,
  [cards, collectionPrefs.seen, contentState, lens, umas])

  const result = useMemo(() => album ? runAlbumQuery(album.rows, facets, prefs.query, CARD_TIE_BREAK) : null, [album, facets, prefs.query])
  const countFor = useCallback((draft: AlbumQuery) => album ? runAlbumQuery(album.rows, facets, draft).total : 0, [album, facets])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to view Cards" detail="Your private card collection is part of the saved Stable." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before opening the card album." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <SaveErrorState detail={lifecycleError} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile || !album || !result) return <ScreenState title="Opening Cards…" detail="Loading your private SSR album." />
  if (contentState.content.cards.items.length === 0) return <ScreenState title="No support cards imported" detail="Run and publish the private content pipeline first." />

  const tickets = profile.tickets
  const entries = result.rows.flatMap((row) => album.entries.get(row.id) ?? [])
  // A tapped tile opens its detail in a sheet, where the list is, instead of a panel above it (D176).
  const detail = (detailId ? album.entries.get(detailId) : undefined) ?? null
  const compareEntries = selection.flatMap((id) => album.entries.get(id) ?? [])
  const view = prefs.query.view
  const columns = view === 'icons' ? 5 : view === 'cards' ? 2 : 1
  const rowHeight = view === 'icons' ? 80 : view === 'cards' ? 215 : 64
  const lensTier = lens === 'collection' ? null : lens
  const reachedTiers = Array.from({ length: highestTier }, (_, index) => highestTier - index)

  const openEntry = (entry: CardEntry) => {
    if (entry.isNew) updatePrefs({ ...collectionPrefs, seen: markSeen(collectionPrefs.seen, [entry.id]) })
    navigate(`/cards/${encodeURIComponent(entry.id)}${lensTier ? `?tier=${lensTier}` : ''}`)
  }
  const bondHref = (entry: CardEntry, tier: number) =>
    bondRecallHref({ cardId: entry.id, tier, returnTo: `/cards?lens=${tier}` })
  const unlock = (entry: CardEntry) => {
    if (busy) return
    setBusy(true)
    void unlockCard(entry.id, 'tickets')
      .then(() => navigate(`/collection/reveal/card/${encodeURIComponent(entry.id)}`))
      .catch((reason: unknown) => pushToast(reason instanceof Error ? reason.message : 'Could not unlock this card'))
      .finally(() => setBusy(false))
  }
  const toggleSelect = (id: string) => {
    setSelection((current) => current.includes(id)
      ? current.filter((entry) => entry !== id)
      : current.length >= MAX_COMPARE ? current : [...current, id])
  }

  const bondAction = (entry: CardEntry, size: 'sm' | 'md') => {
    if (lensTier === null || !entry.owned || (entry.bond ?? 0) >= MAX_STARS) return null
    if (tickets < BOND_RECALL_TICKET_COST) return <Button size={size} disabled>Bond · need {formatTickets(BOND_RECALL_TICKET_COST)}</Button>
    return (
      <Link
        to={bondHref(entry, lensTier)}
        className={`font-display inline-flex items-center justify-center rounded-sm bg-accent px-3 font-semibold text-ink shadow-1 ${size === 'sm' ? 'min-h-11 text-sm' : 'min-h-12 text-[15px]'}`}
      >
        Bond · {formatTickets(BOND_RECALL_TICKET_COST)}
      </Link>
    )
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div role="tablist" aria-label="Show cards for" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
        <Chip role="tab" aria-selected={lens === 'collection'} selected={lens === 'collection'} onClick={() => setLens('collection')}>
          Collection
        </Chip>
        {reachedTiers.map((tier) => (
          <Chip key={tier} role="tab" aria-selected={lens === tier} selected={lens === tier} onClick={() => setLens(tier)}>
            {scenarioName(tier)}
          </Chip>
        ))}
      </div>

      {(!persistent || album.orphanedIds.length > 0) && (
        <Panel className="p-2">
          {!persistent && <p className="rounded-sm bg-warning/10 p-2 text-[12px] font-semibold">Memory only — progression works for this session but cannot persist or sync.</p>}
          {album.orphanedIds.length > 0 && <p className="mt-1 rounded-sm bg-danger/10 p-2 text-[12px] font-semibold text-danger">{album.orphanedIds.length} owned card reference{album.orphanedIds.length === 1 ? '' : 's'} need restored content.</p>}
        </Panel>
      )}


      <AlbumChrome
        title={lensTier === null ? 'Support Cards' : `${scenarioName(lensTier)} cards`}
        completion={lensTier === null
          ? <><Numeral className="text-ink">{album.owned}</Numeral> / {album.total} owned</>
          : <><Numeral className="text-ink">{album.owned}</Numeral> of {album.total} eligible owned · {album.bonded} bonded · {album.maxed} max</>}
        segment={
          <SegmentedControl
            size="sm"
            label="Ownership"
            value={(prefs.query.filters.ownership as string[] | undefined)?.[0] ?? 'all'}
            onChange={(value) => setQuery({
              ...prefs.query,
              filters: value === 'all'
                ? Object.fromEntries(Object.entries(prefs.query.filters).filter(([key]) => key !== 'ownership'))
                : { ...prefs.query.filters, ownership: [value] },
            })}
            options={[{ value: 'all', label: 'All' }, { value: 'owned', label: 'Owned' }, { value: 'unowned', label: 'Not owned' }] as const}
          />
        }
        facets={facets}
        sorts={sorts}
        presets={buildCardPresets(lens)}
        query={prefs.query}
        counts={result.counts}
        total={result.total}
        parameter={null}
        views={prefs.views}
        emptyHint={emptyStateHint(album.rows, facets, prefs.query)}
        hiddenFilterKeys={['ownership']}
        countFor={countFor}
        onQueryChange={setQuery}
        onParameterChange={() => undefined}
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
            <Button size="sm" disabled={selection.length < 2} onClick={() => setCompareOpen(true)}>
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
            <CardTile
              entry={entry}
              lens={lens}
              view={view}
              sortLabel={cardSortValueLabel(entry, prefs.query.sort)}
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

      <BottomSheet open={detail !== null} onClose={() => setDetailId(null)}>
        {detail && (
        <AlbumDetail
          content={contentState.content}
          kind="card"
          id={detail.id}
          icon={detail.asset}
          alt={`${detail.template.charName} support card`}
          frame="art"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-micro">{detail.template.type} · {scenarioName(detail.template.era)}</p>
              <p className="font-display truncate text-xl font-bold">{detail.template.charName}</p>
              <p className="truncate text-[12px] text-ink-soft">{detail.template.title || 'Support card'}</p>
            </div>
            {detail.isNew && <Crest tone="accent">NEW</Crest>}
          </div>
          <p className="mt-1 text-[12px] text-ink-soft">{cardSplitLabel(detail.template)}</p>
          {!detail.owned ? (
            <p className="mt-2 text-[12px] font-semibold">Not owned · {detail.unlockCost} tickets to unlock</p>
          ) : lensTier !== null ? (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <Stars value={detail.bond ?? 0} />
                <span className="text-[12px] font-semibold">{detail.bond === MAX_STARS ? `${MAX_STARS}★ · Max` : `${detail.bond}★`}</span>
              </div>
              <p className="text-[12px] text-ink-soft">{cardPayLabel(detail)} here</p>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-ink-soft">
              {detail.save && brokenTiers(detail.save).length > 0
                ? `Stars in ${brokenTiers(detail.save).length} scenario${brokenTiers(detail.save).length === 1 ? '' : 's'}`
                : 'Not bonded in any scenario yet'}
              {detail.equippedBy.length > 0 ? ` · in ${detail.equippedBy.length} active set${detail.equippedBy.length === 1 ? '' : 's'}` : ''}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {!detail.owned
              ? <Button size="sm" disabled={busy || tickets < detail.unlockCost} onClick={() => unlock(detail)}>Unlock · {detail.unlockCost}</Button>
              : bondAction(detail, 'sm')}
            <Button size="sm" variant="secondary" onClick={() => openEntry(detail)}>Open</Button>
          </div>
        </AlbumDetail>
        )}
      </BottomSheet>

      <CompareSheet
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        title="Compare cards"
        columns={compareEntries.map((entry) => ({ id: entry.id, label: entry.template.charName, detail: entry.template.title }))}
        rows={[
          { label: 'Type', values: compareEntries.map((entry) => titleCase(entry.template.type)) },
          { label: 'Era', values: compareEntries.map((entry) => entry.template.era), best: 'high' },
          { label: 'One node splits', values: compareEntries.map((entry) => cardSplitLabel(entry.template)) },
          ...(lensTier === null ? [] : [
            { label: 'Stars here', values: compareEntries.map((entry) => entry.bond), best: 'high' as const },
            { label: 'Pays per node here', values: compareEntries.map((entry) => entry.owned ? cardPayLabel(entry) : null) },
          ]),
          { label: 'Skills', values: compareEntries.map((entry) => entry.hintSkillNames.length), best: 'high' },
          { label: 'Unlock', values: compareEntries.map((entry) => entry.owned ? 'Owned' : `${entry.unlockCost} tickets`) },
        ]}
      />

      <BottomSheet open={actionsFor !== null} onClose={() => setActionsFor(null)}>
        {actionsFor && (
          <div className="grid gap-1.5 pb-2">
            <h2 className="font-display mb-1 text-xl font-bold">{actionsFor.template.charName}</h2>
            <Button variant="secondary" onClick={() => { const entry = actionsFor; setActionsFor(null); openEntry(entry) }}>Open card</Button>
            {!actionsFor.owned && (
              <Button disabled={busy || tickets < actionsFor.unlockCost} onClick={() => { const entry = actionsFor; setActionsFor(null); unlock(entry) }}>
                Unlock · {actionsFor.unlockCost} tickets
              </Button>
            )}
            {bondAction(actionsFor, 'md')}
            {actionsFor.equippedBy.length > 0 && (
              <Link
                to={`/constellation/${encodeURIComponent(actionsFor.equippedBy[0]!)}/cards`}
                className="font-display flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel text-[15px] font-semibold"
              >
                Open {contentState.content.umas.byId.get(actionsFor.equippedBy[0]!)?.name ?? 'this Uma'}&rsquo;s card set
              </Link>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
