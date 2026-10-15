// The Card Library's album (docs/rework/06-cards-and-bonds.md §6; Collection "Card album", D238; T138): every SSR in the
// shared chrome, search over name, character and skill text, the lens chips (All and each playable scenario) and the
// Uma control, whose scenario the lens follows. Tiles keep D238's corners; the bottom-right pill is the bond state.
// `mode: 'pick'` is the same album for T139's card set tab and session sheet: her lens, the caller's `eligible`
// filter, and `onPick` instead of the card page.
import type { DistanceCategory } from '@racer/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { runAlbumQuery, emptyStateHint } from '../../ui/album/query'
import { AlbumChrome } from '../../ui/album/AlbumChrome'
import { VirtualGrid } from '../../ui/album/VirtualGrid'
import { DistanceTypeIcon, RunningStyleIcon } from '../../ui/CardFocusIcons'
import { Chip } from '../../ui/Chip'
import { Crest } from '../../ui/Crest'
import { CheckIcon, LockedIcon, StopwatchIcon } from '../../ui/icons'
import { TypeIcon } from '../../ui/TypeIcon'
import { useGame, useHub } from '../../app/game'
import { useAlbumPrefs } from '../../ui/albumPrefs'
import { CardSquare } from '../../ui/ArtSquare'
import { UmaPicker } from '../../ui/UmaPicker'
import { umaName } from '../../ui/words'
import {
  buildLibrary, LENS_MODES, lensMode, lensOf, LIBRARY_ALBUM, LIBRARY_DEFAULT_QUERY, LIBRARY_FACETS, LIBRARY_SORTS, LIBRARY_TIE_BREAK, payWords,
  PLAYABLE, TYPE_COLOR, TYPE_LABEL, type CardEntry, type Pill,
} from './model'
import { scenarioRow } from '@racer/domain/tiers'

export interface CardLibraryProps {
  readonly mode: 'browse' | 'pick'
  /** Browse: the Uma it opens on (the featured one when absent). Pick: the Uma whose set or session it fills. */
  readonly umaId?: string | null
  /** Pick: the preset the set is for; marks the cards already in it. */
  readonly preset?: DistanceCategory
  /** Pick: only these cards are offered. */
  readonly eligible?: (cardId: string) => boolean
  readonly onPick?: (cardId: string) => void
  readonly title?: string
}

/** The pill's words for VoiceOver. */
function pillWords(pill: Pill): string {
  switch (pill.kind) {
    case 'count': return `${pill.n} Uma${pill.n === 1 ? '' : 's'} bonded`
    case 'bonded': return 'bonded to her'
    case 'pending': return 'bonding now'
    case 'grade': return `bond with a grade ${pill.grade} dish`
    case 'locked': return pill.words
    case 'none': return ''
  }
}

export function PillMark({ pill, type }: { pill: Pill; type: CardEntry['card']['type'] }) {
  const base = 'font-display flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-xs px-1 text-[11px] leading-4 font-bold shadow-1'
  switch (pill.kind) {
    case 'count': return <span className={`${base} bg-stage/80 text-ink-on-dark`} data-pill="count">{pill.n}</span>
    case 'bonded': return <span className={`${base} bg-success text-ink-on-dark`} data-pill="bonded"><CheckIcon size={16} /></span>
    case 'pending': return <span className={`${base} bg-stage/80 text-ink-on-dark`} data-pill="pending"><StopwatchIcon size={16} /></span>
    case 'grade': return <span className={`${base} text-white`} style={{ background: TYPE_COLOR[type] }} data-pill="grade">G{pill.grade}</span>
    case 'locked': return <span className={`${base} bg-stage/80 text-ink-on-dark`} data-pill="locked"><LockedIcon size={16} /></span>
    case 'none': return null
  }
}

function CardTile({ entry, view, inSet, href, onPick }: { entry: CardEntry; view: 'icons' | 'cards' | 'list'; inSet: boolean; href: string | null; onPick: (() => void) | null }) {
  const { card, focus, pill } = entry
  const label = [entry.name, TYPE_LABEL[card.type], `era ${card.era}`, pillWords(pill), inSet ? 'in this set' : ''].filter(Boolean).join(', ')
  const art = (
    <CardSquare
      cardId={card.id}
      name={entry.name}
      tight={view !== 'cards'}
      dimmed={pill.kind === 'locked'}
      overlay={<>
        {focus.distance !== 'generalist' && <DistanceTypeIcon distance={focus.distance} size={view === 'list' ? 16 : 20} className="drop-shadow" />}
        {entry.isNew && view !== 'list' && <Crest tone="accent">NEW</Crest>}
        {inSet && view !== 'list' && <Crest>In set</Crest>}
      </>}
      corner={focus.style !== 'generalist' ? <RunningStyleIcon style={focus.style} size={view === 'list' ? 16 : 20} className="drop-shadow" /> : undefined}
      bottomLeft={<TypeIcon type={card.type} size={view === 'list' ? 16 : 20} />}
      badge={<PillMark pill={pill} type={card.type} />}
    />
  )
  const body = view === 'list' ? (
    <span className="flex min-h-14 w-full items-center gap-3 rounded-sm border border-hairline bg-panel p-2 text-left">
      <span className="w-12 shrink-0">{art}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{entry.name}</span>
        <span className="block truncate text-[12px] text-ink-soft">{entry.pay === null ? `Era ${card.era}` : payWords(entry.pay)}</span>
      </span>
    </span>
  ) : (
    <span className="block w-full min-w-0 text-left">
      {art}
      <span className="font-display block truncate px-0.5 pt-1 text-[12px] font-semibold">{card.charName}</span>
      <span className="block truncate px-0.5 text-[11px] text-ink-soft">{view === 'cards' && entry.pay !== null ? payWords(entry.pay) : card.title}</span>
    </span>
  )
  if (href !== null) return <Link to={href} state={{ back: true }} aria-label={label} className="block" data-card={card.id}>{body}</Link>
  return (
    <button type="button" aria-label={label} className="block w-full disabled:opacity-60" data-card={card.id} disabled={onPick === null} onClick={onPick ?? undefined}>{body}</button>
  )
}

export function CardLibrary({ mode, umaId: given, preset, eligible, onPick, title = 'Card Library' }: CardLibraryProps) {
  const state = useGame((snapshot) => snapshot.state)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const view = useHub()
  const prefs = useAlbumPrefs(mode === 'pick' ? `${LIBRARY_ALBUM}-pick` : LIBRARY_ALBUM, {
    fallback: LIBRARY_DEFAULT_QUERY, facets: LIBRARY_FACETS, sorts: LIBRARY_SORTS, modes: LENS_MODES,
  })
  // The Library opens on the featured Uma (06 §6); a lens chip clears her, the Uma control picks another.
  const [chosen, setChosen] = useState<string | null | undefined>(mode === 'pick' ? given ?? null : given)
  const [picking, setPicking] = useState(false)
  const [parameter, setParameter] = useState<string | null>(null)
  const umaId = chosen === undefined ? view?.featured ?? null : chosen
  const uma = umaId === null ? null : state?.umas[umaId] ?? null
  useEffect(() => {
    if (prefs.fresh && content !== null) prefs.see([...content.cards.keys()])
    // Once, when this device first opens the Library: only cards a content update adds read NEW.
  }, [prefs.fresh, content === null])

  const lens = lensOf(prefs.query.mode)
  const album = useMemo(
    () => (state === null || content === null ? null : buildLibrary(state, content, lens, uma, prefs.seen, eligible)),
    [state, content, lens, uma, prefs.seen, eligible],
  )
  if (state === null || content === null || album === null) return null
  // Her bond filters mean nothing without her, so they rest until an Uma is chosen again.
  const { bondable: _bondable, bond: _bond, ...rest } = prefs.query.filters
  const query = uma === null ? { ...prefs.query, filters: rest } : prefs.query
  const facets = uma === null ? LIBRARY_FACETS.filter((facet) => facet.key !== 'bondable' && facet.key !== 'bond') : LIBRARY_FACETS
  const result = runAlbumQuery(album.rows, facets, query, LIBRARY_TIE_BREAK)
  const entries = result.rows.map((row) => album.entries.get(row.id)!)
  const set = uma !== null && preset !== undefined ? new Set(uma.build.presets[preset].cardSetIds) : new Set<string>()
  const presets = [
    { key: 'bondable', label: 'Bondable now', apply: (q: typeof query) => ({ ...q, filters: { ...q.filters, bondable: true } }) },
    { key: 'bonded', label: 'Bonded to her', apply: (q: typeof query) => ({ ...q, filters: { ...q.filters, bond: ['bonded'] } }) },
    { key: 'race-bonus', label: 'Has Race Bonus', apply: (q: typeof query) => ({ ...q, filters: { ...q.filters, raceBonus: true } }) },
  ].filter((entry) => uma !== null || entry.key === 'race-bonus')
  const setLens = (next: 'all' | number) => {
    if (mode === 'browse') setChosen(null)
    prefs.setQuery({ ...prefs.query, mode: lensMode(next) })
  }

  return (
    <div data-g2="card-library" data-lens={album.lens}>
      <AlbumChrome
        title={title}
        completion={<>{album.rows.length} cards{uma !== null ? ` · ${umaName(content, uma.outfitId)}` : ''}</>}
        segment={
          <div className="space-y-2">
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Lens">
              {(['all', ...PLAYABLE] as const).map((value) => (
                <Chip key={value} selected={album.lens === value} disabled={mode === 'pick'} onClick={() => setLens(value)} className="min-h-11"
                  aria-label={value === 'all' ? 'Every card' : `Scenario ${value}, ${scenarioRow(value).name}`}>
                  {value === 'all' ? 'All' : album.lens === value ? `${value} · ${scenarioRow(value).name}` : value}
                </Chip>
              ))}
            </div>
            {mode === 'browse' && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPicking(true)} data-g2="uma-control"
                  className="min-h-11 min-w-0 flex-1 truncate rounded-sm border border-hairline-strong bg-panel px-3 text-left text-[13px] font-semibold">
                  {uma === null ? 'Uma: none · pick one' : `Uma: ${umaName(content, uma.outfitId)}`}
                </button>
                {uma !== null && <Chip className="min-h-11" onClick={() => setChosen(null)}>No Uma</Chip>}
              </div>
            )}
          </div>
        }
        facets={facets}
        sorts={LIBRARY_SORTS}
        presets={presets}
        query={query}
        counts={result.counts}
        total={result.total}
        parameter={parameter}
        views={prefs.views}
        emptyHint={emptyStateHint(album.rows, facets, query)}
        countFor={(draft) => runAlbumQuery(album.rows, facets, draft).total}
        onQueryChange={prefs.setQuery}
        onParameterChange={setParameter}
        onSaveView={prefs.saveView}
        onDeleteView={prefs.deleteView}
      >
        <VirtualGrid
          items={entries}
          columns={query.view === 'list' ? 1 : query.view === 'icons' ? 3 : 2}
          rowHeight={query.view === 'list' ? 68 : query.view === 'icons' ? 160 : 220}
          keyOf={(entry) => entry.card.id}
          renderItem={(entry) => (
            <CardTile
              entry={entry}
              view={query.view}
              inSet={set.has(entry.card.id)}
              href={mode === 'browse' ? `/town/card-library/card/${encodeURIComponent(entry.card.id)}` : null}
              onPick={mode === 'pick' && onPick !== undefined ? () => onPick(entry.card.id) : null}
            />
          )}
        />
      </AlbumChrome>
      {mode === 'browse' && (
        <UmaPicker
          open={picking}
          onClose={() => setPicking(false)}
          title="See the Library as"
          selectedIds={uma === null ? [] : [uma.outfitId]}
          onPick={(id) => setChosen(id)}
        />
      )}
    </div>
  )
}
