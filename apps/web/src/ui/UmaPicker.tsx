// The one Uma picker (D181; docs/design/collection.md "Default sorts"; T138): a sheet on the Stable's album over the Umas a
// caller offers, with its search, filters, sorts and three views, opening on the level order unless the caller leads
// with a sort of its own. Today's `UmaPickerSheet` props on the new game's store: the caller's sorts, `describe`,
// `disabledReason` and `candidateIds`. An Uma that can't be picked stays listed, after the ones that can, with her
// reason. Owned by the Stable; the Training (T139) and Farm (T140) places use it too.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { emptyStateHint, runAlbumQuery, type AlbumQuery, type SortDef } from './album/query'
import { AlbumChrome } from './album/AlbumChrome'
import { VirtualGrid } from './album/VirtualGrid'
import { BottomSheet } from './BottomSheet'
import { Crest } from './Crest'
import { CheckIcon } from './icons'
import { useGame } from '../app/game'
import {
  buildStableAlbum, STABLE_DEFAULT_QUERY, STABLE_FACETS, STABLE_SORTS, STABLE_TIE_BREAK, type StableEntry,
} from '../places/stable/model'
import { UmaSquare } from './ArtSquare'

/** A sort only the caller can compute, such as "dish in the Warehouse". */
export interface UmaPickerSort {
  readonly key: string
  readonly label: string
  readonly direction: 'asc' | 'desc'
  readonly value: (entry: StableEntry) => number | string | null
  /** The small line under a tile while this sort is active. */
  readonly describe?: (entry: StableEntry) => string | null
}

export interface UmaPickerProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  /** The Umas on offer; every owned Uma by default. */
  readonly candidateIds?: readonly string[]
  readonly selectedIds?: readonly string[]
  readonly selectedLabel?: string
  /** The caller's sorts, listed first. */
  readonly sorts?: readonly UmaPickerSort[]
  /** The sort it opens on: `level` unless given. */
  readonly defaultSort?: string
  /** A line under the tile: what picking her would do. */
  readonly describe?: (entry: StableEntry) => ReactNode
  /** Why she can't be picked here, or null. */
  readonly disabledReason?: (entry: StableEntry) => string | null
  /** A trailing action on her row, such as Bond's Queue for a busy Uma. */
  readonly action?: (entry: StableEntry) => ReactNode
  /** Keeps the sheet open after a pick: a multi-select. */
  readonly keepOpen?: boolean
  readonly onPick: (umaId: string) => void
}

export function UmaPicker({
  open, onClose, title, candidateIds, selectedIds = [], selectedLabel = 'Selected', sorts = [], defaultSort, describe, disabledReason, action,
  keepOpen = false, onPick,
}: UmaPickerProps) {
  const state = useGame((snapshot) => snapshot.state)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const opening = defaultSort ?? 'level'
  const direction = sorts.find((sort) => sort.key === opening)?.direction ?? STABLE_SORTS.find((sort) => sort.key === opening)?.defaultDirection ?? 'desc'
  const openingQuery = useMemo<AlbumQuery>(() => ({ ...STABLE_DEFAULT_QUERY, sort: opening, direction }), [opening, direction])
  const [query, setQuery] = useState<AlbumQuery>(openingQuery)
  const [parameter, setParameter] = useState<string | null>(null)
  // Each time it opens it starts from the caller's order, not wherever the last pick left it.
  useEffect(() => {
    if (open) setQuery(openingQuery)
  }, [open, openingQuery])

  const album = useMemo(() => (state === null || content === null ? null : buildStableAlbum(state, content, Object.keys(state.umas))), [state, content])
  const offered = useMemo(() => new Set(candidateIds ?? Object.keys(state?.umas ?? {})), [candidateIds, state])
  const rows = useMemo(() => (album?.rows ?? []).filter((row) => offered.has(row.id)).map((row) => {
    if (sorts.length === 0) return row
    const entry = album!.entries.get(row.id)!
    return { ...row, sorts: { ...row.sorts, ...Object.fromEntries(sorts.map((sort) => [sort.key, sort.value(entry)])) } }
  }), [album, offered, sorts])
  const sortDefs: SortDef[] = [...sorts.map((sort) => ({ key: sort.key, label: sort.label, defaultDirection: sort.direction })), ...STABLE_SORTS]
  const result = runAlbumQuery(rows, STABLE_FACETS, query, STABLE_TIE_BREAK)
  const ordered = result.rows.map((row) => album!.entries.get(row.id)!)
  // Those she can't pick follow those she can, each with the reason.
  const entries = disabledReason === undefined ? ordered : [
    ...ordered.filter((entry) => disabledReason(entry) === null),
    ...ordered.filter((entry) => disabledReason(entry) !== null),
  ]
  const selected = new Set(selectedIds)
  const contextSort = sorts.find((sort) => sort.key === query.sort)

  // A portal, so it opens over another sheet (the featured Uma's, a card page's) without that sheet's transform.
  return createPortal(
    <BottomSheet open={open} onClose={onClose} label={title}>
      <div className="pb-2" data-g2="uma-picker">
        <AlbumChrome
          title={title}
          completion={<>{rows.length} Uma{rows.length === 1 ? '' : 's'}</>}
          facets={STABLE_FACETS}
          sorts={sortDefs}
          presets={[]}
          query={query}
          counts={result.counts}
          total={result.total}
          parameter={parameter}
          views={[]}
          emptyHint={emptyStateHint(rows, STABLE_FACETS, query)}
          countFor={(draft) => runAlbumQuery(rows, STABLE_FACETS, draft).total}
          onQueryChange={setQuery}
          onParameterChange={setParameter}
          onSaveView={() => undefined}
          onDeleteView={() => undefined}
        >
          <VirtualGrid
            items={entries}
            columns={query.view === 'list' ? 1 : query.view === 'icons' ? 3 : 2}
            rowHeight={query.view === 'list' ? 60 : query.view === 'icons' ? 168 : 230}
            keyOf={(entry) => entry.id}
            renderItem={(entry) => {
              const reason = disabledReason?.(entry) ?? null
              const isSelected = selected.has(entry.id)
              const note = reason ?? describe?.(entry) ?? contextSort?.describe?.(entry) ?? entry.level ?? entry.outfit
              const pick = () => {
                onPick(entry.id)
                if (!keepOpen) onClose()
              }
              const extra = action?.(entry)
              if (query.view === 'list') {
                return (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={reason !== null}
                      aria-pressed={keepOpen ? isSelected : undefined}
                      onClick={pick}
                      className={`flex min-h-14 min-w-0 flex-1 items-center gap-2 rounded-sm border px-2 py-1 text-left disabled:opacity-60 ${isSelected ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}
                    >
                      <span className="w-11 shrink-0"><UmaSquare outfitId={entry.id} name={entry.name} tight /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{entry.name}</span>
                        <span className="block text-[12px] leading-4 text-ink-soft">{note}</span>
                      </span>
                      {isSelected && <span className="shrink-0 text-[11px] font-bold text-accent-strong">{selectedLabel}</span>}
                      {entry.level !== null && <span className="font-display shrink-0 text-[12px] font-semibold tabular-nums">{entry.level}</span>}
                    </button>
                    {extra}
                  </div>
                )
              }
              return (
                <div>
                  <button
                    type="button"
                    disabled={reason !== null}
                    aria-pressed={keepOpen ? isSelected : undefined}
                    onClick={pick}
                    className="block w-full min-w-0 text-left disabled:opacity-60"
                    aria-label={`${entry.name}${entry.level ? `, ${entry.level}` : ''}${reason ? `. ${reason}` : ''}`}
                  >
                    <UmaSquare
                      outfitId={entry.id}
                      name={entry.name}
                      className={isSelected ? 'outline outline-2 outline-offset-1 outline-accent' : ''}
                      overlay={isSelected ? <Crest tone="accent"><CheckIcon size={16} />{selectedLabel}</Crest> : undefined}
                      badge={entry.level !== null ? <span className="rounded-xs bg-stage/75 px-1 text-[11px] leading-4 text-ink-on-dark">{entry.level}</span> : undefined}
                    />
                    <p className="font-display truncate px-0.5 pt-1 text-[12px] font-semibold">{entry.name}</p>
                    <p className="line-clamp-2 px-0.5 text-[11px] leading-3.5 text-ink-soft">{note}</p>
                  </button>
                  {extra}
                </div>
              )
            }}
          />
        </AlbumChrome>
      </div>
    </BottomSheet>,
    document.body,
  )
}
