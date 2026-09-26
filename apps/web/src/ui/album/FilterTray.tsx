import { useEffect, useState } from 'react'
import {
  isActiveSelection,
  type AlbumQuery,
  type FacetDef,
  type FacetSelection,
  type RangeSelection,
} from '../../game/album/query'
import { BottomSheet } from '../BottomSheet'
import { Button } from '../Button'
import { Chip } from '../Chip'
import { ChevronDownIcon, ChevronRightIcon } from '../icons'

const asArray = (selection: FacetSelection | undefined): readonly string[] =>
  Array.isArray(selection) ? selection : []

const asRange = (selection: FacetSelection | undefined): RangeSelection =>
  typeof selection === 'object' && selection !== null && !Array.isArray(selection)
    ? (selection as RangeSelection)
    : { min: null, max: null }

/**
 * Faceted tray: grouped sections, per-option counts, and no zero-result dead ends — an option that
 * would return nothing is disabled rather than a trapdoor (docs/design/collection.md#shared-browsing-chrome).
 * Selections apply on Apply, not on every tap.
 */
export function FilterTray({
  open,
  onClose,
  facets,
  query,
  counts,
  pendingTotal,
  onPreview,
  onApply,
  hiddenKeys = [],
}: {
  open: boolean
  onClose: () => void
  facets: readonly FacetDef[]
  query: AlbumQuery
  counts: Record<string, Record<string, number>>
  /** Result count for the draft query, shown on Apply. */
  pendingTotal: number
  onPreview: (draft: AlbumQuery) => void
  onApply: (draft: AlbumQuery) => void
  /** Facets driven by another control, such as the ownership segment. */
  hiddenKeys?: readonly string[]
}) {
  const [draft, setDraft] = useState(query)
  const [openGroups, setOpenGroups] = useState<readonly string[]>([])

  useEffect(() => {
    if (open) setDraft(query)
  }, [open, query])

  useEffect(() => {
    onPreview(draft)
  }, [draft, onPreview])

  const visible = facets.filter((facet) => !hiddenKeys.includes(facet.key))
  // Count only what this tray controls, so a segment elsewhere never inflates the button.
  const draftCount = visible.filter((facet) => isActiveSelection(draft.filters[facet.key])).length
  const groups = [...new Set(visible.map((facet) => facet.group))]
  const setFilter = (key: string, selection: FacetSelection | null) => {
    setDraft((current) => {
      const filters = { ...current.filters }
      if (selection === null || !isActiveSelection(selection)) delete filters[key]
      else filters[key] = selection
      return { ...current, filters }
    })
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Filter</h2>
        <button
          type="button"
          className="min-h-11 px-1 text-[13px] font-semibold text-ink-soft"
          onClick={() => setDraft({ ...draft, filters: {} })}
        >
          Clear all
        </button>
      </div>

      <div className="max-h-[52vh] overflow-y-auto pb-2">
        {groups.map((group) => {
          const groupFacets = visible.filter((facet) => facet.group === group)
          const groupActive = groupFacets.filter((facet) => isActiveSelection(draft.filters[facet.key])).length
          const expanded = openGroups.includes(group) || groupActive > 0
          return (
            <section key={group} className="border-b border-hairline py-2 last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                className="flex min-h-11 w-full items-center justify-between"
                onClick={() => setOpenGroups((current) =>
                  current.includes(group) ? current.filter((entry) => entry !== group) : [...current, group])}
              >
                <span className="text-[15px] font-semibold">
                  {group}
                  {groupActive > 0 && <span className="ml-1 text-accent-strong">· {groupActive}</span>}
                </span>
                {expanded ? <ChevronDownIcon size={20} className="text-ink-faint" /> : <ChevronRightIcon size={20} className="text-ink-faint" />}
              </button>

              {expanded && (
                <div className="flex flex-col gap-2 pb-2">
                  {groupFacets.map((facet) => {
                    if (facet.kind === 'boolean') {
                      const count = counts[facet.key]?.true ?? 0
                      return (
                        <Chip
                          key={facet.key}
                          selected={draft.filters[facet.key] === true}
                          disabled={count === 0 && draft.filters[facet.key] !== true}
                          onClick={() => setFilter(facet.key, draft.filters[facet.key] === true ? null : true)}
                        >
                          {facet.label} <span className="text-ink-faint">{count}</span>
                        </Chip>
                      )
                    }
                    if (facet.kind === 'range') {
                      const range = asRange(draft.filters[facet.key])
                      return (
                        <div key={facet.key}>
                          <p className="text-micro mb-1">{facet.label}</p>
                          <div className="flex items-center gap-2">
                            {(['min', 'max'] as const).map((bound) => (
                              <input
                                key={bound}
                                type="number"
                                inputMode="numeric"
                                placeholder={bound === 'min' ? 'From' : 'To'}
                                aria-label={`${facet.label} ${bound === 'min' ? 'from' : 'to'}`}
                                value={range[bound] ?? ''}
                                onChange={(event) => {
                                  const raw = event.target.value
                                  const parsed = raw === '' ? null : Number(raw)
                                  setFilter(facet.key, {
                                    ...range,
                                    [bound]: parsed !== null && Number.isFinite(parsed) ? parsed : null,
                                  })
                                }}
                                className="min-h-11 w-24 rounded-sm border border-hairline bg-panel px-3"
                              />
                            ))}
                          </div>
                        </div>
                      )
                    }
                    const selected = asArray(draft.filters[facet.key])
                    return (
                      <div key={facet.key}>
                        <p className="text-micro mb-1">{facet.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(facet.options ?? []).map((option) => {
                            const count = counts[facet.key]?.[option.value] ?? 0
                            const isSelected = selected.includes(option.value)
                            return (
                              <Chip
                                key={option.value}
                                selected={isSelected}
                                disabled={count === 0 && !isSelected}
                                onClick={() => setFilter(
                                  facet.key,
                                  isSelected ? selected.filter((entry) => entry !== option.value) : [...selected, option.value],
                                )}
                              >
                                {option.label} <span className="text-ink-faint">{count}</span>
                              </Chip>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="pt-2 pb-1">
        <Button className="w-full" onClick={() => onApply(draft)}>
          {pendingTotal === 0 ? 'No results' : `Show ${pendingTotal}`}
          {draftCount > 0 ? ` · ${draftCount} filter${draftCount === 1 ? '' : 's'}` : ''}
        </Button>
      </div>
    </BottomSheet>
  )
}
