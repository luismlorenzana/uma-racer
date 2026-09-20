import type { ReactNode } from 'react'

/**
 * Long albums stay cheap through browser-native `content-visibility`: rows outside the viewport skip
 * layout and paint, and scroll position restores natively because nothing is unmounted. No JS
 * measurement, no dependency (docs/tasks — T033).
 */
export function VirtualGrid<T>({
  items,
  columns,
  rowHeight,
  renderItem,
  keyOf,
}: {
  items: readonly T[]
  columns: number
  /** Estimated row height in px, used as the placeholder size for off-screen rows. */
  rowHeight: number
  renderItem: (item: T) => ReactNode
  keyOf: (item: T) => string
}) {
  const rows: T[][] = []
  for (let index = 0; index < items.length; index += columns) rows.push(items.slice(index, index + columns))
  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <div
          key={keyOf(row[0]!)}
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            contentVisibility: 'auto',
            containIntrinsicSize: `${rowHeight}px`,
          }}
        >
          {row.map((item) => (
            <div key={keyOf(item)} className="min-w-0">
              {renderItem(item)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
