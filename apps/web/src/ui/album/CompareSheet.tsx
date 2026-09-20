import { BottomSheet } from '../BottomSheet'
import { Numeral } from '../Numeral'

export interface CompareColumn {
  id: string
  label: string
  detail?: string
}

export interface CompareRow {
  label: string
  /** One value per column, in the same order. `null` renders as a dash. */
  values: (string | number | null)[]
  /** Emphasise the highest or lowest numeric value in the row. */
  best?: 'high' | 'low'
}

/** Side-by-side comparison of two or three entries (docs/design/collection.md#shared-behaviours). */
export function CompareSheet({
  open,
  onClose,
  title,
  columns,
  rows,
}: {
  open: boolean
  onClose: () => void
  title: string
  columns: readonly CompareColumn[]
  rows: readonly CompareRow[]
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="font-display mb-3 text-xl font-bold">{title}</h2>
      <div className="max-h-[60vh] overflow-y-auto pb-2">
        <table className="w-full table-fixed border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="text-micro w-20 pb-2 text-left">Field</th>
              {columns.map((column) => (
                <th key={column.id} className="pb-2 text-left align-bottom">
                  <span className="block truncate text-[13px] font-semibold text-ink">{column.label}</span>
                  {column.detail && <span className="block truncate text-[11px] font-normal text-ink-faint">{column.detail}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const numeric = row.values.filter((value): value is number => typeof value === 'number')
              const target = row.best && numeric.length > 1
                ? (row.best === 'high' ? Math.max(...numeric) : Math.min(...numeric))
                : null
              return (
                <tr key={row.label} className="border-t border-hairline">
                  <th scope="row" className="py-2 pr-2 text-left align-top text-[12px] font-medium text-ink-soft">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={columns[index]?.id ?? index} className="py-2 align-top">
                      {value === null ? (
                        <span className="text-ink-faint">—</span>
                      ) : typeof value === 'number' ? (
                        <Numeral className={value === target ? 'text-accent-strong' : 'text-ink'}>{value}</Numeral>
                      ) : (
                        <span className="text-ink">{value}</span>
                      )}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </BottomSheet>
  )
}
