import { useCallback, useState, type ReactNode } from 'react'
import {
  ALBUM_VIEWS,
  isActiveSelection,
  type AlbumQuery,
  type EmptyStateHint,
  type FacetDef,
  type SortDef,
} from '../../game/album/query'
import type { AlbumPreset } from '../../game/album/stable'
import type { SavedView } from '../../game/album/prefs'
import { BottomSheet } from '../BottomSheet'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { ArrowDownIcon, ArrowUpIcon, CloseIcon, ViewCardsIcon, ViewGridIcon, ViewListIcon } from '../icons'
import { Numeral } from '../Numeral'
import { FilterTray } from './FilterTray'
import { SortSheet } from './SortSheet'

/**
 * The browsing chrome every album shares: search, a Sort control, a badged Filter control, quick
 * presets, removable active-filter chips and the result count
 * (docs/design/collection.md#shared-browsing-chrome).
 */
const VIEW_GLYPHS = { icons: ViewGridIcon, cards: ViewCardsIcon, list: ViewListIcon } as const

/** The album view toggle's glyph: solid for the chosen view, line for the others. */
function ViewGlyph({ view, active }: { view: keyof typeof VIEW_GLYPHS; active: boolean }) {
  const Glyph = VIEW_GLYPHS[view]
  return <Glyph size={20} variant={active ? 'solid' : 'line'} />
}

export function AlbumChrome({
  title,
  completion,
  segment,
  facets,
  sorts,
  presets,
  query,
  counts,
  total,
  parameter,
  views,
  emptyHint,
  hiddenFilterKeys,
  countFor,
  onQueryChange,
  onParameterChange,
  onSaveView,
  onDeleteView,
  children,
}: {
  title: string
  completion: ReactNode
  /** Ownership segment or another album-specific control, shown under the title. */
  segment?: ReactNode
  facets: readonly FacetDef[]
  sorts: readonly SortDef[]
  presets: readonly AlbumPreset[]
  query: AlbumQuery
  counts: Record<string, Record<string, number>>
  total: number
  parameter: string | null
  views: readonly SavedView[]
  emptyHint: EmptyStateHint | null
  hiddenFilterKeys?: readonly string[]
  countFor: (draft: AlbumQuery) => number
  onQueryChange: (query: AlbumQuery) => void
  onParameterChange: (parameter: string | null) => void
  onSaveView: (name: string) => void
  onDeleteView: (name: string) => void
  children: ReactNode
}) {
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [viewsOpen, setViewsOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [draftTotal, setDraftTotal] = useState(total)

  const activeFacets = facets.filter((facet) =>
    isActiveSelection(query.filters[facet.key]) && !(hiddenFilterKeys ?? []).includes(facet.key))
  // The badge counts what the tray controls, so the ownership segment never inflates it.
  const activeCount = activeFacets.length
  const sortLabel = sorts.find((sort) => sort.key === query.sort)?.label ?? 'Sort'
  const preview = useCallback((draft: AlbumQuery) => setDraftTotal(countFor(draft)), [countFor])

  const removeFilter = (key: string) => {
    const filters = { ...query.filters }
    delete filters[key]
    onQueryChange({ ...query, filters })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-[13px] text-ink-soft">{completion}</p>
        </div>
        <div role="group" aria-label="View" className="flex gap-1 rounded-sm bg-sunken p-1">
          {ALBUM_VIEWS.map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={query.view === view}
              aria-label={`${view === 'icons' ? 'Icon' : view === 'cards' ? 'Card' : 'List'} view`}
              onClick={() => onQueryChange({ ...query, view })}
              className={`flex h-9 w-9 items-center justify-center rounded-xs ${
                query.view === view ? 'bg-panel text-ink shadow-1' : 'text-ink-faint'
              }`}
            >
              <ViewGlyph view={view} active={query.view === view} />
            </button>
          ))}
        </div>
      </div>

      {segment}

      <div className="sticky top-0 z-10 -mx-4 bg-page/85 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <input
            type="search"
            value={query.search}
            onChange={(event) => onQueryChange({ ...query, search: event.target.value })}
            placeholder="Search"
            aria-label={`Search ${title}`}
            className="min-h-11 min-w-0 flex-1 rounded-sm border border-hairline bg-panel px-3 text-[15px]"
          />
          <Button variant="secondary" size="sm" onClick={() => setSortOpen(true)}>
            {sortLabel}
            {query.direction === 'asc' ? <ArrowUpIcon size={16} title="ascending" /> : <ArrowDownIcon size={16} title="descending" />}
          </Button>
          <Button variant={activeCount > 0 ? 'primary' : 'secondary'} size="sm" onClick={() => setFilterOpen(true)}>
            Filter{activeCount > 0 ? ` · ${activeCount}` : ''}
          </Button>
        </div>

        <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
          {presets.map((preset) => (
            <Chip key={preset.key} onClick={() => onQueryChange(preset.apply(query))}>{preset.label}</Chip>
          ))}
          <Chip onClick={() => setViewsOpen(true)}>Views{views.length > 0 ? ` · ${views.length}` : ''}</Chip>
        </div>

        {activeFacets.length > 0 && (
          <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4" aria-label="Active filters">
            {activeFacets.map((facet) => (
              <Chip key={facet.key} selected onClick={() => removeFilter(facet.key)}>
                {facet.label}
                <CloseIcon size={16} />
              </Chip>
            ))}
            <Chip onClick={() => onQueryChange({ ...query, filters: {} })}>Clear all</Chip>
          </div>
        )}
      </div>

      <p className="text-micro -mt-1">
        <Numeral className="text-ink">{total}</Numeral> result{total === 1 ? '' : 's'}
      </p>

      {total === 0 && (
        <div className="rounded-md border border-hairline bg-panel p-4 text-center">
          <p className="font-display font-semibold">Nothing matches these filters</p>
          {emptyHint && (
            <p className="mt-1 text-[13px] text-ink-soft">
              Remove <strong>{emptyHint.label}</strong> to see {emptyHint.count}.
            </p>
          )}
          <Button className="mt-3" variant="secondary" onClick={() => onQueryChange({ ...query, filters: {}, search: '' })}>
            Clear all
          </Button>
        </div>
      )}

      {children}

      <FilterTray
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        facets={facets}
        query={query}
        counts={counts}
        pendingTotal={draftTotal}
        hiddenKeys={hiddenFilterKeys}
        onPreview={preview}
        onApply={(draft) => { onQueryChange(draft); setFilterOpen(false) }}
      />

      <SortSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        sorts={sorts}
        query={query}
        parameter={parameter}
        onChange={(next) => {
          onParameterChange(next.parameter)
          onQueryChange({ ...query, sort: next.sort, direction: next.direction })
        }}
      />

      <BottomSheet open={viewsOpen} onClose={() => setViewsOpen(false)}>
        <h2 className="font-display mb-1 text-xl font-bold">Saved views</h2>
        <p className="text-micro mb-3">Filters, sort, grouping and density under a name</p>
        <div className="grid gap-1.5">
          {views.map((view) => (
            <div key={view.name} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { onQueryChange(view.query); setViewsOpen(false) }}
                className="min-h-12 flex-1 rounded-sm border border-hairline bg-panel px-4 text-left text-[15px] font-semibold"
              >
                {view.name}
              </button>
              <button
                type="button"
                aria-label={`Delete ${view.name}`}
                onClick={() => onDeleteView(view.name)}
                className="flex h-11 w-11 items-center justify-center rounded-sm text-ink-faint"
              >
                <CloseIcon size={20} />
              </button>
            </div>
          ))}
          {views.length === 0 && <p className="rounded-sm bg-sunken p-3 text-[13px] text-ink-soft">No saved views yet.</p>}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            placeholder="Name this view"
            aria-label="Name this view"
            maxLength={40}
            className="min-h-11 min-w-0 flex-1 rounded-sm border border-hairline bg-panel px-3"
          />
          <Button
            size="sm"
            disabled={viewName.trim().length === 0}
            onClick={() => { onSaveView(viewName); setViewName('') }}
          >
            Save
          </Button>
        </div>
      </BottomSheet>
    </div>
  )
}
