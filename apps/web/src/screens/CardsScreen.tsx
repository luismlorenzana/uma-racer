import { CARD_EFFECTS, MAX_LIMIT_BREAK, scenarioForTier, tierOfLevel, type CardEffect } from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { promoteSupportCard } from '../game/actions'
import { addSavedView, loadAlbumPrefs, markSeen, removeSavedView, saveAlbumPrefs, type AlbumPrefs } from '../game/album/prefs'
import { emptyStateHint, runAlbumQuery, type AlbumQuery } from '../game/album/query'
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
  sortLabel,
  selecting,
  selected,
  onOpen,
  onToggleSelect,
  onActions,
}: {
  entry: CardEntry
  sortLabel: string | null
  selecting: boolean
  selected: boolean
  onOpen: () => void
  onToggleSelect: () => void
  onActions: () => void
}) {
  const press = useRef<number | null>(null)
  const startPress = () => { press.current = window.setTimeout(() => { press.current = null; onActions() }, 450) }
  const endPress = () => { if (press.current !== null) window.clearTimeout(press.current); press.current = null }
  const headline = entry.headline
    ? `${EFFECT_LABELS[entry.headline.effect]} ${effectValue(entry.headline.effect, entry.headline.value)}`
    : 'No generated effects'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={selecting ? onToggleSelect : onOpen}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        className="block w-full min-w-0 text-left"
      >
        <ArtTile
          asset={entry.asset}
          alt={entry.owned ? `${entry.template.charName} support card` : `${entry.template.charName} support card, not owned`}
          dimmed={!entry.owned}
          chamfer={entry.maxed}
          overlay={
            <>
              <Crest tone={entry.maxed ? 'accent' : 'neutral'}>{entry.template.type.slice(0, 3).toUpperCase()}</Crest>
              {entry.isNew && <Crest tone="accent">NEW</Crest>}
              {entry.equippedBy.length > 0 && <Crest>In deck</Crest>}
            </>
          }
          corner={selecting ? <Crest tone={selected ? 'accent' : 'neutral'}>{selected ? '✓' : ''}</Crest> : null}
          footer={
            <>
              <p className="font-display truncate text-[14px] font-semibold">{entry.template.charName}</p>
              {entry.save
                ? <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-ink-on-dark-soft">Lv {entry.save.level}</span><LimitPips value={entry.save.limitBreak} /></div>
                : <p className="truncate text-[11px] text-ink-on-dark-soft">Unowned</p>}
            </>
          }
          className={entry.maxed ? 'border-accent' : ''}
        />
        <p className="truncate px-0.5 pt-1.5 pr-8 text-[11px] text-ink-faint">{sortLabel ?? headline}</p>
      </button>
      {!selecting && (
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

function CardDetail({
  entry,
  umaNames,
  busy,
  error,
  celebration,
  onPromote,
  onStep,
}: {
  entry: CardEntry
  umaNames: Readonly<Record<string, string>>
  busy: boolean
  error: string | null
  celebration: number
  onPromote: () => void
  onStep: (delta: number) => void
}) {
  const reducedMotion = useReducedMotion()
  const save = entry.save
  const next = new Map(entry.nextEffects?.map((row) => [row.effect, row.value]) ?? [])
  const usable = entry.template.type !== 'friend' && entry.template.type !== 'group'

  return (
    <div className="max-h-[76vh] overflow-y-auto pb-2">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous card" onClick={() => onStep(-1)} className="min-h-11 px-2 text-ink-soft">‹</button>
        <p className="text-micro">{scenarioForTier(entry.template.era)?.name ?? `Era ${entry.template.era}`}</p>
        <button type="button" aria-label="Next card" onClick={() => onStep(1)} className="min-h-11 px-2 text-ink-soft">›</button>
      </div>

      <div className="flex gap-3">
        <m.div
          key={celebration}
          initial={reducedMotion || celebration === 0 ? false : { scale: 1.12, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 shrink-0"
        >
          <AtlasSprite
            asset={entry.asset}
            alt={`${entry.template.charName} support card`}
            className={`overflow-hidden rounded-md border border-hairline bg-sunken ${entry.owned ? '' : 'opacity-45 saturate-50'}`}
            fallback={<Placeholder label={entry.template.charName} />}
          />
        </m.div>
        <div className="min-w-0 flex-1">
          <p className="text-micro">{entry.template.type} card</p>
          <h2 className="font-display mt-0.5 text-lg leading-tight font-bold">{entry.template.charName}</h2>
          <p className="text-[13px] text-ink-soft">{entry.template.title || 'Support card'}</p>
          {save && (
            <div className="mt-2 flex items-center gap-2 text-[13px] font-semibold">
              <span>Lv <Numeral>{save.level}</Numeral></span>
              <span className="flex gap-0.5">
                {Array.from({ length: MAX_LIMIT_BREAK }, (_, index) => (
                  <span key={index} className={`h-1.5 w-2.5 rounded-xs ${index < save.limitBreak ? 'bg-accent' : 'bg-sunken'}`} />
                ))}
              </span>
            </div>
          )}
        </div>
      </div>

      {!usable && <p className="mt-3 rounded-sm bg-warning/10 p-3 text-[13px] font-semibold">Friend and Group cards are collectible now; equipping them arrives with Milestone 8.</p>}
      {!entry.owned && <p className="mt-3 rounded-sm bg-sunken p-3 text-[13px] font-semibold">Unowned. Use a Card Select Coupon to add it to your collection.</p>}

      {entry.equippedBy.length > 0 && (
        <div className="mt-3">
          <p className="text-micro mb-1">In these decks</p>
          <div className="flex flex-wrap gap-1.5">
            {entry.equippedBy.map((umaId) => (
              <Link
                key={umaId}
                to={`/stable/${encodeURIComponent(umaId)}/deck`}
                className="inline-flex min-h-8 items-center rounded-full border border-hairline-strong bg-panel px-3 text-[13px] font-semibold"
              >
                {umaNames[umaId] ?? umaId}
              </Link>
            ))}
          </div>
        </div>
      )}

      {save && (
        <>
          <div className="mt-4">
            <div className="flex justify-between text-[12px] font-semibold">
              <span>Card EXP</span>
              <span>{entry.maxed ? 'MAX' : `${save.exp} / ${entry.expToNext}`}</span>
            </div>
            <div className="mt-1"><Meter value={entry.maxed ? 1 : save.exp / entry.expToNext} color="var(--color-accent)" height={6} /></div>
          </div>

          <div className="mt-4 grid gap-1.5">
            <p className="text-micro">Generated effects · now → next limit break</p>
            {entry.currentEffects.filter((row) => entry.template.effectProfile[row.effect] > 0).map((row) => {
              const nextValue = next.get(row.effect)
              return (
                <div key={row.effect} className="flex min-h-11 items-center justify-between gap-2 border-b border-hairline py-1.5 text-[14px] last:border-b-0">
                  <span>{EFFECT_LABELS[row.effect]}{row.signatureBonus > 0 ? ' ★' : ''}</span>
                  <span className="text-right font-semibold">
                    {row.value === 0 ? <span className="text-ink-faint">LB{row.unlockLimitBreak}</span> : effectValue(row.effect, row.value)}
                    {nextValue !== undefined && nextValue > row.value && <span className="ml-1 text-[13px] text-success">→ {effectValue(row.effect, nextValue)}</span>}
                  </span>
                </div>
              )
            })}
            {CARD_EFFECTS.every((effect) => entry.template.effectProfile[effect] === 0) && <p className="text-[13px] text-ink-soft">No generated MVP effects in this profile.</p>}
          </div>

          {entry.hintSkillNames.length > 0 && (
            <div className="mt-3">
              <p className="text-micro mb-1">Hint skills · gold hints unlock at LB3</p>
              <p className="text-[13px] text-ink-soft">{entry.hintSkillNames.join(' · ')}</p>
            </div>
          )}

          {error && <p role="alert" className="mt-3 rounded-sm bg-danger/10 p-3 text-[13px] font-semibold text-danger">{error}</p>}

          <div className="mt-4 grid gap-2">
            <Button className="w-full" disabled={busy || entry.promotionLock !== null} onClick={onPromote}>
              {busy ? 'Limit breaking…' : entry.promotionCost ? `Limit Break · ${entry.promotionCost} tickets` : 'Maximum limit break'}
            </Button>
            {entry.promotionLock && <p className="text-center text-[12px] text-ink-soft">{entry.promotionLock}</p>}
            {save.maxCouponGranted && <p className="text-center text-[12px] font-semibold text-accent-strong">Card Select Coupon earned</p>}
          </div>
        </>
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
  const [searchParams, setSearchParams] = useSearchParams()

  const [prefs, setPrefs] = useState<AlbumPrefs>({ id: CARDS_ALBUM_ID, query: CARD_DEFAULT_QUERY, views: [], seen: [] })
  const [needsSeed, setNeedsSeed] = useState(false)
  const [parameter, setParameter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selection, setSelection] = useState<readonly string[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [actionsFor, setActionsFor] = useState<CardEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [celebration, setCelebration] = useState(0)

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

  useEffect(() => {
    const requested = searchParams.get('card')
    if (requested) setSelectedId(requested)
  }, [searchParams])

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

  const highestTier = useMemo(() => Math.max(1, ...Object.values(umas).map((save) => tierOfLevel(save.level))), [umas])
  const presets = useMemo(() => buildCardPresets(highestTier), [highestTier])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to view Cards" detail="Your private card collection is part of the saved Stable." action={{ label: 'Open Settings', to: '/settings' }} />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before opening the card album." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={lifecycleError ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile || !album || !result) return <ScreenState title="Opening Cards…" detail="Loading your private SSR album." />
  if (album.total === 0) return <ScreenState title="No support cards imported" detail="Run and publish the private content pipeline first." />

  const entries = result.rows.flatMap((row) => album.entries.get(row.id) ?? [])
  const selected = selectedId ? album.entries.get(selectedId) ?? null : null
  const compareEntries = selection.flatMap((id) => album.entries.get(id) ?? [])
  const columns = prefs.query.density === 'compact' ? 3 : 2

  const openEntry = (entry: CardEntry) => {
    if (entry.isNew) updatePrefs({ ...prefs, seen: markSeen(prefs.seen, [entry.id]) })
    setSelectedId(entry.id)
    setError(null)
  }

  const stepSelection = (delta: number) => {
    if (!selectedId) return
    const index = entries.findIndex((entry) => entry.id === selectedId)
    const next = entries[index + delta]
    if (next) { setSelectedId(next.id); setError(null) }
  }

  const promote = () => {
    if (!selected?.save || busy) return
    setBusy(true)
    setError(null)
    void promoteSupportCard(selected.template.id)
      .then((mutation) => {
        setCelebration((value) => value + 1)
        pushToast(`LB${mutation.result.toLimitBreak} · Card Lv ${mutation.result.levelGained}`)
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not limit break this card'))
      .finally(() => setBusy(false))
  }

  const toggleSelect = (id: string) => {
    setSelection((current) => current.includes(id)
      ? current.filter((entry) => entry !== id)
      : current.length >= MAX_COMPARE ? current : [...current, id])
  }

  return (
    <div className="flex flex-col gap-3 pt-1">
      <Panel>
        <div className="flex items-center justify-between gap-3 rounded-sm bg-sunken p-3">
          <p className="text-[13px] font-semibold">
            <Numeral>{profile.cardCoupons}</Numeral> Card Select Coupon{profile.cardCoupons === 1 ? '' : 's'}
          </p>
          <Link to="/cards/redeem" className="font-display flex min-h-11 items-center rounded-sm bg-accent px-4 text-[14px] font-semibold text-ink">Redeem</Link>
        </div>
        {!persistent && <p className="mt-2 rounded-sm bg-warning/10 p-2 text-[12px] font-semibold">Memory only — progression works for this session but cannot persist or sync.</p>}
        {album.orphanedIds.length > 0 && <p className="mt-2 rounded-sm bg-danger/10 p-2 text-[12px] font-semibold text-danger">{album.orphanedIds.length} owned card reference{album.orphanedIds.length === 1 ? '' : 's'} need restored content.</p>}
      </Panel>

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
          rowHeight={prefs.query.density === 'compact' ? 150 : 215}
          keyOf={(entry) => entry.id}
          renderItem={(entry) => (
            <CardTile
              entry={entry}
              sortLabel={cardSortValueLabel(entry, prefs.query.sort, parameter)}
              selecting={selecting}
              selected={selection.includes(entry.id)}
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
          { label: 'Level', values: compareEntries.map((entry) => entry.save?.level ?? null), best: 'high' },
          { label: 'Limit break', values: compareEntries.map((entry) => entry.save?.limitBreak ?? null), best: 'high' },
          ...CARD_EFFECTS.map((effect) => ({
            label: EFFECT_LABELS[effect],
            values: compareEntries.map((entry) => {
              const current = entry.currentEffects.find((row) => row.effect === effect)
              const next = entry.nextEffects?.find((row) => row.effect === effect)
              if (!current || current.value === 0) return next && next.value > 0 ? `— → ${effectValue(effect, next.value)}` : null
              return next && next.value > current.value
                ? `${effectValue(effect, current.value)} → ${effectValue(effect, next.value)}`
                : effectValue(effect, current.value)
            }),
          })),
        ]}
      />

      <BottomSheet open={actionsFor !== null} onClose={() => setActionsFor(null)}>
        {actionsFor && (
          <div className="grid gap-1.5 pb-2">
            <h2 className="font-display mb-1 text-xl font-bold">{actionsFor.template.charName}</h2>
            <Button variant="secondary" onClick={() => { const entry = actionsFor; setActionsFor(null); openEntry(entry) }}>Open details</Button>
            {actionsFor.owned && actionsFor.promotionLock === null && (
              <Button onClick={() => { const entry = actionsFor; setActionsFor(null); openEntry(entry) }}>
                Limit break · {actionsFor.promotionCost} tickets
              </Button>
            )}
            {actionsFor.equippedBy.length > 0 && (
              <Link
                to={`/stable/${encodeURIComponent(actionsFor.equippedBy[0]!)}/deck`}
                className="font-display flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel text-[15px] font-semibold"
              >
                Where it is equipped
              </Link>
            )}
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={selected !== null}
        onClose={() => { if (!busy) { setSelectedId(null); setError(null); setSearchParams({}, { replace: true }) } }}
      >
        {selected && (
          <CardDetail
            entry={selected}
            umaNames={umaNames}
            busy={busy}
            error={error}
            celebration={celebration}
            onPromote={promote}
            onStep={stepSelection}
          />
        )}
      </BottomSheet>
    </div>
  )
}
