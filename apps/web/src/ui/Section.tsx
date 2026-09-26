import type { ReactNode } from 'react'
import { ChevronRightIcon } from './icons'

/** A zone divider: a small display label over its section, with an optional hint on the right. */
export function SectionHeading({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between px-1 pt-2">
      <h2 className="font-display text-[13px] font-semibold tracking-tight text-ink">{label}</h2>
      {hint !== undefined && <span className="text-micro">{hint}</span>}
    </div>
  )
}

/** Archive rows stay closed: they exist to be found, not to be scrolled past. */
export function Collapsible({ label, count, children }: { label: string; count?: number; children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-hairline bg-panel">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between px-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
        <span>{label}{count !== undefined && <span className="text-ink-faint"> · {count}</span>}</span>
        <ChevronRightIcon size={20} className="text-ink-faint transition-transform group-open:rotate-90" />
      </summary>
      <div className="border-t border-hairline p-3">{children}</div>
    </details>
  )
}
