import type { HTMLAttributes, ReactNode } from 'react'

/** Ordinary content surface: white, hairline, one radius (docs/design/visual-system.md#surfaces). */
export function Panel({
  label,
  children,
  className = '',
  ...rest
}: { label?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <section {...rest} className={`rounded-md border border-hairline bg-panel p-4 shadow-1 ${className}`}>
      {label && <p className="text-micro mb-2">{label}</p>}
      {children}
    </section>
  )
}
