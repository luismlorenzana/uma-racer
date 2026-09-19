import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** Filter / state chip. Selected uses an accent wash, never a saturated fill. */
export function Chip({
  selected = false,
  children,
  className = '',
  ...rest
}: { selected?: boolean; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...rest}
      className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition-colors disabled:opacity-45 ${
        selected ? 'border border-accent bg-accent-wash text-accent-strong' : 'border border-hairline-strong bg-panel text-ink-soft'
      } ${className}`}
    >
      {children}
    </button>
  )
}
