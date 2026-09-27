import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { LoadedContent } from '../../content/runtime'
import {
  STABLE_DEFAULT_QUERY,
  STABLE_FACETS,
  STABLE_SORTS,
  STABLE_TIE_BREAK,
  buildStableAlbum,
  sortValueLabel,
  type StableEntry,
} from '../../game/album/stable'
import { emptyStateHint, runAlbumQuery, type AlbumQuery, type SortDef } from '../../game/album/query'
import { useGame } from '../../game/store'
import { ArtTile } from '../ArtTile'
import { AtlasSprite } from '../AtlasSprite'
import { BottomSheet } from '../BottomSheet'
import { Crest } from '../Crest'
import { Numeral } from '../Numeral'
import { CheckIcon } from '../icons'
import { AlbumChrome } from './AlbumChrome'
import { VirtualGrid } from './VirtualGrid'

/** A sort only this picker's caller can compute, such as how many aptitudes a parent would raise. */
export interface UmaPickerSort {
  key: string
  label: string
  direction: 'asc' | 'desc'
  value: (entry: StableEntry) => number | string | null
  /** The small line under a tile while this sort is active. */
  describe?: (entry: StableEntry) => string | null
}

// Sorts the picker can fill without the Stable's flair and race history.
const PICKER_SORTS = new Set(['level', 'release', 'name', 'tier', 'trainingLevel', 'statTotal', 'bestAptitude'])

/**
 * Choosing an Uma anywhere in the app (D181): the Stable's search, filters and sorts over the Umas a caller offers,
 * highest level first unless the caller leads with a sort of its own. Hundreds of Umas stay cheap through the album's
 * virtual grid. `keepOpen` makes it a multi-select, for pins.
 */
export function UmaPickerSheet({
  open,
  onClose,
  title,
  content,
  candidateIds,
  selectedIds = [],
  selectedLabel = 'Selected',
  sorts = [],
  defaultSort,
  describe,
  disabledReason,
  keepOpen = false,
  onPick,
}: {
  open: boolean
  onClose: () => void
  title: string
  content: LoadedContent
  /** The Umas on offer; owned Umas by default. Catalog Umas not owned can be offered too (a Legends parent slot). */
  candidateIds?: readonly string[]
  selectedIds?: readonly string[]
  selectedLabel?: string
  /** Extra sorts from the caller's context, listed first. */
  sorts?: readonly UmaPickerSort[]
  /** Which sort the picker opens on: `level` unless given. */
  defaultSort?: string
  /** A line under the tile, such as what this Uma would change. */
  describe?: (entry: StableEntry) => ReactNode
  /** Why this Uma cannot be picked here, or null. */
  disabledReason?: (entry: StableEntry) => string | null
  keepOpen?: boolean
  onPick: (umaId: string) => void
}) {
  const saves = useGame((state) => state.umas)
  const cards = useGame((state) => state.cards)
  const profile = useGame((state) => state.profile)
  const openingSort = defaultSort ?? 'level'
  // Callers pass their sorts inline, so the opening query keys on what they say rather than the array's identity.
  const openingDirection = sorts.find((sort) => sort.key === openingSort)?.direction ?? 'desc'
  const openingQuery = useMemo<AlbumQuery>(() => ({
    ...STABLE_DEFAULT_QUERY,
    filters: {},
    sort: openingSort,
    direction: openingDirection,
    view: 'icons',
  }), [openingDirection, openingSort])
  const [query, setQuery] = useState<AlbumQuery>(openingQuery)
  const [parameter, setParameter] = useState<string | null>(null)
  // Each time it opens it starts from the caller's order, not wherever the last pick left it.
  useEffect(() => {
    if (!open) return
    setQuery(openingQuery)
    setParameter(null)
  }, [open, openingQuery])

  const album = useMemo(() => profile ? buildStableAlbum({
    content, saves, cards, profile, lastRacedAt: {}, flair: {}, seen: [], mode: 'outfit',
  }) : null, [cards, content, profile, saves])
  const offered = useMemo(() => new Set(candidateIds ?? Object.keys(saves)), [candidateIds, saves])
  const rows = useMemo(() => (album?.rows ?? []).filter((row) => offered.has(row.id)).map((row) => {
    const entry = album!.entries.get(row.id)!
    return sorts.length === 0 ? row : { ...row, sorts: { ...row.sorts, ...Object.fromEntries(sorts.map((sort) => [sort.key, sort.value(entry)])) } }
  }), [album, offered, sorts])
  const mixed = useMemo(() => rows.some((row) => !album?.entries.get(row.id)?.owned), [album, rows])
  const facets = STABLE_FACETS.filter((facet) => facet.key !== 'isNew' && (mixed || facet.key !== 'ownership'))
  const sortDefs: SortDef[] = [
    ...sorts.map((sort) => ({ key: sort.key, label: sort.label, defaultDirection: sort.direction })),
    ...STABLE_SORTS.filter((sort) => PICKER_SORTS.has(sort.key)),
  ]
  const effective = query.sort === 'bestAptitude' && parameter ? { ...query, sort: parameter } : query
  const result = runAlbumQuery(rows, facets, effective, STABLE_TIE_BREAK)
  const entries = result.rows.flatMap((row) => album?.entries.get(row.id) ?? [])
  const selected = new Set(selectedIds)
  const contextSort = sorts.find((sort) => sort.key === query.sort)

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="max-h-[80vh] overflow-y-auto pb-2">
        <AlbumChrome
          title={title}
          completion={<>{rows.length} Uma{rows.length === 1 ? '' : 's'}</>}
          facets={facets}
          sorts={sortDefs}
          presets={[]}
          query={query}
          counts={result.counts}
          total={result.total}
          parameter={parameter}
          views={[]}
          emptyHint={emptyStateHint(rows, facets, query)}
          countFor={(draft) => runAlbumQuery(rows, facets, draft).total}
          onQueryChange={setQuery}
          onParameterChange={setParameter}
          onSaveView={() => undefined}
          onDeleteView={() => undefined}
        >
          <VirtualGrid
            items={entries}
            columns={query.view === 'list' ? 1 : query.view === 'icons' ? 3 : 2}
            rowHeight={query.view === 'list' ? 56 : query.view === 'icons' ? 168 : 230}
            keyOf={(entry) => entry.id}
            renderItem={(entry) => {
              const reason = disabledReason?.(entry) ?? null
              const isSelected = selected.has(entry.id)
              const note = reason
                ?? describe?.(entry)
                ?? contextSort?.describe?.(entry)
                ?? sortValueLabel(entry, query.sort, parameter)
                ?? entry.template.outfit
              const pick = () => {
                onPick(entry.id)
                if (!keepOpen) onClose()
              }
              if (query.view === 'list') {
                return (
                  <button
                    type="button"
                    disabled={reason !== null}
                    aria-pressed={keepOpen ? isSelected : undefined}
                    onClick={pick}
                    className={`flex min-h-12 w-full items-center gap-2 rounded-sm border px-2 py-1 text-left disabled:opacity-45 ${isSelected ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}
                  >
                    <AtlasSprite asset={entry.asset} decorative className={`h-10 w-10 shrink-0 rounded-sm ${entry.owned ? '' : 'opacity-45 saturate-50'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{entry.template.name}</span>
                      <span className="block truncate text-[11px] text-ink-soft">{note}</span>
                    </span>
                    {isSelected && <span className="shrink-0 text-[10px] font-bold text-accent-strong">{selectedLabel}</span>}
                    {entry.save && <span className="shrink-0 font-display text-sm font-semibold tabular-nums">Lv {entry.save.level}</span>}
                  </button>
                )
              }
              return (
                <button
                  type="button"
                  disabled={reason !== null}
                  aria-pressed={keepOpen ? isSelected : undefined}
                  onClick={pick}
                  className="block w-full min-w-0 text-left disabled:opacity-45"
                >
                  <ArtTile
                    asset={entry.asset}
                    alt={`${entry.template.name} portrait`}
                    dimmed={!entry.owned}
                    className={isSelected ? 'outline outline-2 outline-offset-1 outline-accent' : ''}
                    overlay={isSelected ? <Crest tone="accent"><CheckIcon size={16} />{selectedLabel}</Crest> : undefined}
                    badge={entry.save ? (
                      <span className="rounded-xs bg-stage/75 px-1 text-[11px] leading-4 text-ink-on-dark" aria-label={`Level ${entry.save.level}`}>
                        Lv <Numeral>{entry.save.level}</Numeral>
                      </span>
                    ) : undefined}
                  />
                  <p className="font-display truncate px-0.5 pt-1 text-[12px] font-semibold">{entry.template.name}</p>
                  <p className="line-clamp-2 px-0.5 text-[10px] leading-3 text-ink-soft">{note}</p>
                </button>
              )
            }}
          />
        </AlbumChrome>
      </div>
    </BottomSheet>
  )
}
