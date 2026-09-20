import type { AlbumQuery, FacetOption, SortDef, SortDirection } from '../../game/album/query'
import { BottomSheet } from '../BottomSheet'
import { Chip } from '../Chip'

/** Sort is a separate control from Filter, and always exposes its direction (and any parameter). */
export function SortSheet({
  open,
  onClose,
  sorts,
  query,
  parameter,
  onChange,
}: {
  open: boolean
  onClose: () => void
  sorts: readonly SortDef[]
  query: AlbumQuery
  parameter: string | null
  onChange: (next: { sort: string; direction: SortDirection; parameter: string | null }) => void
}) {
  const active = sorts.find((sort) => sort.key === query.sort)
  const options: readonly FacetOption[] = active?.parameter?.options ?? []
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="font-display mb-1 text-xl font-bold">Sort</h2>
      <p className="text-micro mb-3">The tile shows the value you sort by</p>
      <div className="grid gap-1.5 pb-2">
        {sorts.map((sort) => {
          const selected = sort.key === query.sort
          return (
            <button
              key={sort.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({
                sort: sort.key,
                direction: selected
                  ? (query.direction === 'asc' ? 'desc' : 'asc')
                  : sort.defaultDirection,
                parameter: sort.parameter ? parameter ?? sort.parameter.options[0]?.value ?? null : null,
              })}
              className={`flex min-h-12 items-center justify-between rounded-sm px-4 text-[15px] font-semibold ${
                selected ? 'border border-accent bg-accent-wash text-accent-strong' : 'border border-hairline bg-panel text-ink'
              }`}
            >
              <span>{sort.label}</span>
              {selected && <span aria-label={query.direction === 'asc' ? 'Ascending' : 'Descending'}>{query.direction === 'asc' ? '↑' : '↓'}</span>}
            </button>
          )
        })}
      </div>
      {options.length > 0 && (
        <div className="mb-3">
          <p className="text-micro mb-1.5">{active?.parameter?.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => (
              <Chip
                key={option.value}
                selected={option.value === parameter}
                onClick={() => onChange({ sort: query.sort, direction: query.direction, parameter: option.value })}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
