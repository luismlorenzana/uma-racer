import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Embossed display numerals for stats, levels, placements and rewards — the one typographic
 * ornament (docs/design/visual-system.md#type). Body text never uses it.
 */
export function Numeral({
  children,
  className = '',
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...rest} className={`numeral ${className}`}>
      {children}
    </span>
  )
}
