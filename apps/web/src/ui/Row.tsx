import type { ReactNode } from 'react'

/** 56 pt list row: art or icon, primary over secondary text, value on the right. */
export function Row({
  leading,
  title,
  detail,
  value,
  trailing,
  className = '',
}: {
  leading?: ReactNode
  title: ReactNode
  detail?: ReactNode
  value?: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  return (
    <div className={`flex min-h-14 items-center gap-3 ${className}`}>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{title}</p>
        {detail && <p className="truncate text-[13px] text-ink-soft">{detail}</p>}
      </div>
      {value && <div className="font-display shrink-0 text-right text-[17px] font-semibold text-ink">{value}</div>}
      {trailing}
    </div>
  )
}
