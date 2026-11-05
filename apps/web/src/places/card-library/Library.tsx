// The Card Library's album (docs/game/11-hub-and-places.md §3.1, docs/game/02-unlocks.md §3; D386),
// `/town/card-library?tab=owned|locked&type=&style=&distance=&q=`: the Owned and Locked tabs with their counts (Locked
// first on a new account), a search, the seven card types as icons and the eight focus marks (four running styles,
// four distances) as icons, each a 44 pt toggle, then the cards newest release first. Every filter rides in the URL, so
// Back from a card's page returns to the same view. A card opens its page, where a locked one is unlocked.
import { VirtualGrid } from '@luismlorenzana/uma-kit/album'
import { Button, Chip, LockedIcon, SearchIcon, Tabs } from '@luismlorenzana/uma-kit/ui'
import type { Place } from '@racer/domain/hub'
import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useGame } from '../../app/game'
import { cardPath, type OwnershipTab } from '../../hub/nav'
import { CardSquare } from '../../ui/ArtSquare'
import { DistanceTypeIcon, RunningStyleIcon } from '../../ui/CardFocusIcons'
import { DISTANCE_LABEL, DISTANCES, STYLE_LABEL, STYLES } from '../../ui/labels'
import { TypeIcon, typeLabel } from '../../ui/TypeIcon'
import { PlacePageHeader } from '../PlacePageHeader'
import { CARD_TYPES, libraryResult, libraryRows, libraryTab, libraryWords, readFilters, type CardRow } from './model'

function Toggle({ pressed, label, onClick, children }: { pressed: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`flex min-h-11 min-w-0 items-center justify-center rounded-sm transition-opacity ${pressed ? 'bg-accent-wash ring-2 ring-inset ring-accent' : 'opacity-70'}`}
    >
      {children}
    </button>
  )
}

function CardTile({ row }: { row: CardRow }) {
  return (
    <Link to={cardPath(row.id)} state={{ back: true }} aria-label={row.owned ? row.name : `${row.name}, ${libraryWords('locked')}`}
      className="block min-h-11 min-w-0 rounded-md" data-card={row.id} data-owned={row.owned}>
      <CardSquare
        cardId={row.id}
        name={row.name}
        dimmed={!row.owned}
        tight
        bottomLeft={<TypeIcon type={row.type} size={20} />}
        corner={row.owned ? undefined : <span className="flex size-6 items-center justify-center rounded-full bg-scrim/60 text-ink-on-dark"><LockedIcon size={16} /></span>}
      />
      <span className="mt-1 block truncate text-center text-[11px] font-semibold">{row.name}</span>
    </Link>
  )
}

export function Library({ place }: { place: Place }) {
  const [params, setParams] = useSearchParams()
  const state = useGame((snapshot) => snapshot.state)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const rows = useMemo(
    () => (state === null || content === null ? [] : libraryRows(content.cards.values(), content.skills, state.cards)),
    [state, content],
  )
  const owned = rows.filter((row) => row.owned).length
  const tab = libraryTab(params.get('tab'), owned)
  const filters = readFilters(params)
  const shown = libraryResult(rows, tab, filters)
  const inTab = tab === 'owned' ? owned : rows.length - owned
  const filtered = filters.type !== null || filters.style !== null || filters.distance !== null || filters.search !== ''

  /** Writes one URL parameter in place: a value sets it, an empty one removes it. */
  const write = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === '') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  /** A filter icon: on, or off again when it was the one on. */
  const toggle = (key: 'type' | 'style' | 'distance', value: string) => write(key, params.get(key) === value ? '' : value)
  const setTab = (next: OwnershipTab) => {
    const search = new URLSearchParams(params)
    search.set('tab', next)
    setParams(search, { replace: true })
  }
  const clear = () => setParams(new URLSearchParams({ tab }), { replace: true })

  return (
    <div data-place-page="card-library" data-racer="card-library" data-tab={tab}>
      <PlacePageHeader place={place} lines={[libraryWords('about-tickets'), libraryWords('about-effects')]} />
      <div className="space-y-3 px-4 py-3">
        <Tabs
          label={libraryWords('tabs')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'owned', label: `${libraryWords('owned')} · ${owned}` },
            { value: 'locked', label: `${libraryWords('locked')} · ${rows.length - owned}` },
          ]}
        />
        {inTab === 0 ? (
          <div className="space-y-3 rounded-md border border-hairline bg-panel p-4 text-center" data-racer="library-empty">
            <p className="text-[14px] text-ink-soft">{tab === 'owned' ? libraryWords('no-owned') : libraryWords('all-owned')}</p>
            {tab === 'owned' && <Button onClick={() => setTab('locked')}>{libraryWords('see-locked')}</Button>}
          </div>
        ) : (
          <>
            <label className="flex min-h-11 items-center gap-2 rounded-sm border border-hairline bg-panel px-3">
              <SearchIcon size={20} className="text-ink-faint" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => write('q', event.target.value)}
                placeholder={libraryWords('search')}
                aria-label={libraryWords('search')}
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              />
            </label>
            <div role="group" aria-label={libraryWords('types')} className="grid grid-cols-7 gap-1">
              {CARD_TYPES.map((type) => (
                <Toggle key={type} pressed={filters.type === type} label={typeLabel(type)} onClick={() => toggle('type', type)}>
                  <TypeIcon type={type} size={28} />
                </Toggle>
              ))}
            </div>
            <div role="group" aria-label={libraryWords('focus')} className="grid grid-cols-8">
              {STYLES.map((style) => (
                <Toggle key={style} pressed={filters.style === style} label={STYLE_LABEL[style]} onClick={() => toggle('style', style)}>
                  <RunningStyleIcon style={style} size={26} />
                </Toggle>
              ))}
              {DISTANCES.map((distance) => (
                <Toggle key={distance} pressed={filters.distance === distance} label={DISTANCE_LABEL[distance]} onClick={() => toggle('distance', distance)}>
                  <DistanceTypeIcon distance={distance} size={26} />
                </Toggle>
              ))}
            </div>
            {filtered && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] text-ink-soft" role="status">{shown.length} / {inTab}</p>
                <Chip className="min-h-11" onClick={clear}>{libraryWords('clear')}</Chip>
              </div>
            )}
            {shown.length === 0 ? (
              <p className="rounded-md border border-hairline bg-panel p-4 text-center text-[14px] text-ink-soft">{libraryWords('nothing-matches')}</p>
            ) : (
              <VirtualGrid items={shown} columns={4} rowHeight={108} keyOf={(row) => row.id} renderItem={(row) => <CardTile row={row} />} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
