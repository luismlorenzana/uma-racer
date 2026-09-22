import {
  cardNodeValue,
  cardLimitBreak,
  bestCardLimitBreak,
  bestCardLevel,
  cardLevel,
  BROAD_CARD_STAT_DIVISOR,
  CARD_EFFECTS,
  MAX_LIMIT_BREAK,
  inactiveCardUniqueEffectCount,
  isBroadSupportCard,
  scenarioForTier,
  tierOfLevel,
  type CardEffect,
  type SupportCardTemplate,
} from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { bondRecallHref } from '../game/bond-links'
import { addSavedView, loadAlbumPrefs, markSeen, removeSavedView, saveAlbumPrefs, type AlbumPrefs } from '../game/album/prefs'
import { emptyStateHint, runAlbumQuery, type AlbumQuery, type AlbumView } from '../game/album/query'
import {
  CARDS_ALBUM_ID,
  CARD_DEFAULT_QUERY,
  CARD_FACETS,
  CARD_SORTS,
  CARD_TIE_BREAK,
  EFFECT_LABELS,
  buildCardAlbumRows,
  buildCardPresets,
  cardSortValueLabel,
  type CardEntry,
} from '../game/album/cards'
import { useGame } from '../game/store'
import { AlbumChrome } from '../ui/album/AlbumChrome'
import { AlbumDetail } from '../ui/album/AlbumDetail'
import { CompareSheet } from '../ui/album/CompareSheet'
import { VirtualGrid } from '../ui/album/VirtualGrid'
import { ArtTile } from '../ui/ArtTile'
import { AtlasSprite } from '../ui/AtlasSprite'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { Crest } from '../ui/Crest'
import { Meter } from '../ui/Meter'
import { Numeral } from '../ui/Numeral'
import { Panel } from '../ui/Panel'
import { Placeholder } from '../ui/Placeholder'
import { ScreenState } from '../ui/ScreenState'
import { SegmentedControl } from '../ui/SegmentedControl'

const MAX_COMPARE = 3
const PERCENT_EFFECTS = new Set<CardEffect>(['trainingBonus', 'friendshipBonus', 'hintFrequency', 'raceBonus'])

const effectValue = (effect: CardEffect, value: number): string =>
  PERCENT_EFFECTS.has(effect) ? `${Math.round(value * 1000) / 10}%` : `+${Math.round(value * 10) / 10}`

const cardEffectValue = (template: SupportCardTemplate, effect: CardEffect, value: number): string =>
  isBroadSupportCard(template) && (effect === 'statBonus' || effect === 'initialStats')
    ? `${effectValue(effect, value / BROAD_CARD_STAT_DIVISOR)} each`
    : effectValue(effect, value)

function LimitPips({ value }: { value: number }) {
  return (
    <span aria-label={`Limit break ${value}`} className="flex gap-0.5">
      {Array.from({ length: MAX_LIMIT_BREAK }, (_, index) => (
        <span key={index} className={`h-1.5 w-2.5 rounded-xs ${index < value ? 'bg-accent' : 'bg-white/35'}`} />
      ))}
    </span>
  )
}

function CardTile({
  entry,
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
  const headline = entry.headline
    ? `${EFFECT_LABELS[entry.headline.effect]} ${effectValue(entry.headline.effect, entry.headline.value)}`
    : 'No generated effects'

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
          <span className="block truncate text-[11px] text-ink-faint">{headline}</span>
        </span>
        <span className="shrink-0 text-right text-[12px] text-ink-soft">
          {entry.save ? <>Lv <Numeral className="text-ink">{bestCardLevel(entry.save)}</Numeral></> : 'Unowned'}
          <span className="block text-[11px] text-ink-faint">{sortLabel ?? `LB${(entry.save ? bestCardLimitBreak(entry.save) : 0) ?? 0}`}</span>
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
        aria-label={`${entry.template.charName} support card${entry.owned ? '' : ', not owned'}`}
      >
        <ArtTile
          asset={entry.asset}
          alt={entry.owned ? `${entry.template.charName} support card` : `${entry.template.charName} support card, not owned`}
          dimmed={!entry.owned}
          chamfer={!icons && entry.maxed}
          overlay={
            icons ? (
              <>
                {entry.isNew && <span aria-hidden className="h-2 w-2 rounded-full bg-accent shadow-1" />}
                {entry.equippedBy.length > 0 && <span aria-hidden className="h-2 w-2 rounded-full bg-info shadow-1" />}
              </>
            ) : (
              <>
                <Crest tone={entry.maxed ? 'accent' : 'neutral'}>{entry.template.type.slice(0, 3).toUpperCase()}</Crest>
                {entry.isNew && <Crest tone="accent">NEW</Crest>}
                {entry.equippedBy.length > 0 && <Crest>In deck</Crest>}
              </>
            )
          }
          corner={selecting ? <Crest tone={picked ? 'accent' : 'neutral'}>{picked ? '✓' : ''}</Crest> : null}
          footer={icons ? undefined : (
            <>
              <p className="font-display truncate text-[14px] font-semibold">{entry.template.charName}</p>
              {entry.save
                ? <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-ink-on-dark-soft">Lv {bestCardLevel(entry.save)}</span><LimitPips value={bestCardLimitBreak(entry.save)} /></div>
                : <p className="truncate text-[11px] text-ink-on-dark-soft">Unowned</p>}
            </>
          )}
          className={entry.maxed ? 'border-accent' : ''}
        />
        {!icons && <p className="truncate px-0.5 pt-1.5 pr-8 text-[11px] text-ink-faint">{sortLabel ?? headline}</p>}
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

export function CardsScreen() {
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const persistent = useGame((state) => state.persistent)
  const profile = useGame((state) => state.profile)
  const cards = useGame((state) => state.cards)
  const umas = useGame((state) => state.umas)
  const pushToast = useGame((state) => state.pushToast)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [prefs, setPrefs] = useState<AlbumPrefs>({ id: CARDS_ALBUM_ID, query: CARD_DEFAULT_QUERY, views: [], seen: [] })
  const [needsSeed, setNeedsSeed] = useState(false)
  const [parameter, setParameter] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selection, setSelection] = useState<readonly string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [actionsFor, setActionsFor] = useState<CardEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadAlbumPrefs(CARDS_ALBUM_ID, CARD_DEFAULT_QUERY, CARD_FACETS, CARD_SORTS)
      .then(({ fresh, ...loaded }) => {
        if (cancelled) return
        setPrefs(loaded)
        setNeedsSeed(fresh)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!needsSeed || status !== 'ready') return
    setNeedsSeed(false)
    setPrefs((current) => {
      const next = { ...current, seen: markSeen(current.seen, Object.keys(cards)) }
      void saveAlbumPrefs(next)
      return next
    })
  }, [cards, needsSeed, status])

  // Old `?card=` links land on the card's own page (M016).
  useEffect(() => {
    const requested = searchParams.get('card')
    if (requested) navigate(`/cards/${encodeURIComponent(requested)}`, { replace: true })
  }, [navigate, searchParams])

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

  const album = useMemo(() => contentState.status === 'ready' && profile
    ? buildCardAlbumRows({ content: contentState.content, cards, umas, tickets: profile.tickets, seen: prefs.seen })
    : null,
  [cards, contentState, prefs.seen, profile, umas])

  const effectiveQuery = useMemo(() => (
    prefs.query.sort === 'effect' && parameter ? { ...prefs.query, sort: parameter } : prefs.query
  ), [parameter, prefs.query])

  const result = useMemo(() => album
    ? runAlbumQuery(album.rows, CARD_FACETS, effectiveQuery, CARD_TIE_BREAK)
    : null,
  [album, effectiveQuery])

  const countFor = useCallback((draft: AlbumQuery) => album ? runAlbumQuery(album.rows, CARD_FACETS, draft).total : 0, [album])

  const umaNames = useMemo(() => {
    if (contentState.status !== 'ready') return {} as Record<string, string>
    return Object.fromEntries(Object.keys(umas).map((id) => [id, contentState.content.umas.byId.get(id)?.name ?? id]))
  }, [contentState, umas])

  const highestTier = useMemo(() => Math.max(1, ...Object.values(umas).map((save) => save.unlockedTier)), [umas])

  const trainableTiersFor = useCallback(
    (era: number) => Array.from({ length: highestTier }, (_, index) => index + 1).filter((tier) => tier >= era),
    [highestTier],
  )
  const presets = useMemo(() => buildCardPresets(highestTier), [highestTier])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to view Cards" detail="Your private card collection is part of the saved Stable." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before opening the card album." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={lifecycleError ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile || !album || !result) return <ScreenState title="Opening Cards…" detail="Loading your private SSR album." />
  if (album.total === 0) return <ScreenState title="No support cards imported" detail="Run and publish the private content pipeline first." />

  const entries = result.rows.flatMap((row) => album.entries.get(row.id) ?? [])
  const compareEntries = selection.flatMap((id) => album.entries.get(id) ?? [])
  const view = prefs.query.view
  const columns = view === 'icons' ? 5 : view === 'cards' ? 2 : 1
  const rowHeight = view === 'icons' ? 80 : view === 'cards' ? 215 : 64
  const detail = (detailId ? album.entries.get(detailId) : undefined) ?? entries[0] ?? null

  const openEntry = (entry: CardEntry) => {
    if (entry.isNew) updatePrefs({ ...prefs, seen: markSeen(prefs.seen, [entry.id]) })
    navigate(`/cards/${encodeURIComponent(entry.id)}`)
  }

  const toggleSelect = (id: string) => {
    setSelection((current) => current.includes(id)
      ? current.filter((entry) => entry !== id)
      : current.length >= MAX_COMPARE ? current : [...current, id])
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      <Panel>
        <p className="rounded-sm bg-sunken p-3 text-[13px] font-semibold">
          <Numeral>{profile.cardCoupons}</Numeral> Card Select Coupon{profile.cardCoupons === 1 ? '' : 's'}
          <span className="block text-[11px] font-normal text-ink-soft">Unlock any card from its page, with tickets or a coupon.</span>
        </p>
        {!persistent && <p className="mt-2 rounded-sm bg-warning/10 p-2 text-[12px] font-semibold">Memory only — progression works for this session but cannot persist or sync.</p>}
        {album.orphanedIds.length > 0 && <p className="mt-2 rounded-sm bg-danger/10 p-2 text-[12px] font-semibold text-danger">{album.orphanedIds.length} owned card reference{album.orphanedIds.length === 1 ? '' : 's'} need restored content.</p>}
      </Panel>

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
              <p className="text-micro">{detail.template.type} · {scenarioForTier(detail.template.era)?.name ?? `Era ${detail.template.era}`}</p>
              <p className="font-display truncate text-xl font-bold">{detail.template.charName}</p>
              <p className="truncate text-[12px] text-ink-soft">{detail.template.title || 'Support card'}</p>
            </div>
            {detail.isNew && <Crest tone="accent">NEW</Crest>}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {detail.save
              ? <>
                  <Crest>Lv {bestCardLevel(detail.save)}</Crest>
                  <span className="flex gap-0.5">
                    {Array.from({ length: MAX_LIMIT_BREAK }, (_, index) => (
                      <span key={index} className={`h-1.5 w-2.5 rounded-xs ${index < (detail.save ? bestCardLimitBreak(detail.save) : 0) ? 'bg-accent' : 'bg-sunken'}`} />
                    ))}
                  </span>
                  {detail.maxed && <Crest tone="accent">MAX</Crest>}
                </>
              : <Crest>Unowned</Crest>}
          </div>

          <div className="mt-2 grid gap-0.5">
            {detail.currentEffects
              .filter((row) => detail.template.effectProfile[row.effect] > 0 && row.value > 0)
              .slice(0, 3)
              .map((row) => (
                <p key={row.effect} className="flex justify-between gap-2 text-[12px]">
                  <span className="truncate text-ink-soft">{EFFECT_LABELS[row.effect]}</span>
                  <span className="font-semibold">{effectValue(row.effect, row.value)}</span>
                </p>
              ))}
          </div>

          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => openEntry(detail)}>Details</Button>
            {detail.owned && <Button size="sm" onClick={() => openEntry(detail)}>Bond</Button>}
          </div>
        </AlbumDetail>
      )}

      <AlbumChrome
        title="Support Cards"
        completion={<><Numeral className="text-ink">{album.owned}</Numeral> / {album.total} owned · {album.maxed} maxed</>}
        segment={
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
        }
        facets={CARD_FACETS}
        sorts={CARD_SORTS}
        presets={presets}
        query={prefs.query}
        counts={result.counts}
        total={result.total}
        parameter={parameter}
        views={prefs.views}
        emptyHint={emptyStateHint(album.rows, CARD_FACETS, effectiveQuery)}
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
              view={view}
              sortLabel={cardSortValueLabel(entry, prefs.query.sort, parameter)}
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
        title="Compare cards"
        columns={compareEntries.map((entry) => ({ id: entry.id, label: entry.template.charName, detail: entry.template.title }))}
        rows={[
          { label: 'Type', values: compareEntries.map((entry) => entry.template.type) },
          { label: 'Era', values: compareEntries.map((entry) => entry.template.era), best: 'high' },
          { label: 'Level', values: compareEntries.map((entry) => (entry.save ? bestCardLevel(entry.save) : null)), best: 'high' },
          { label: 'Limit break', values: compareEntries.map((entry) => entry.save ? bestCardLimitBreak(entry.save) : null), best: 'high' },
          ...CARD_EFFECTS.map((effect) => ({
            label: EFFECT_LABELS[effect],
            values: compareEntries.map((entry) => {
              const current = entry.currentEffects.find((row) => row.effect === effect)
              const next = entry.nextEffects?.find((row) => row.effect === effect)
              if (current?.inactiveReason) return `Inactive · ${current.inactiveReason}`
              if (!current || current.value === 0) return next && next.value > 0 ? `— → ${cardEffectValue(entry.template, effect, next.value)}` : null
              return next && next.value > current.value
                ? `${cardEffectValue(entry.template, effect, current.value)} → ${cardEffectValue(entry.template, effect, next.value)}`
                : cardEffectValue(entry.template, effect, current.value)
            }),
          })),
        ]}
      />

      <BottomSheet open={actionsFor !== null} onClose={() => setActionsFor(null)}>
        {actionsFor && (
          <div className="grid gap-1.5 pb-2">
            <h2 className="font-display mb-1 text-xl font-bold">{actionsFor.template.charName}</h2>
            <Button variant="secondary" onClick={() => { const entry = actionsFor; setActionsFor(null); openEntry(entry) }}>Open details</Button>
            {actionsFor.equippedBy.length > 0 && (
              <Link
                to={`/constellation/${encodeURIComponent(actionsFor.equippedBy[0]!)}/cards`}
                className="font-display flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel text-[15px] font-semibold"
              >
                Where it is equipped
              </Link>
            )}
          </div>
        )}
      </BottomSheet>

    </div>
  )
}
