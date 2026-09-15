import type { HTMLAttributes, ReactNode } from 'react'

export function Panel({ children, className = '', ...rest }: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`rounded-[var(--radius-panel)] border-2 border-white bg-panel/95 p-4 shadow-[var(--shadow-panel)] ${className}`}
    >
      {children}
    </div>
  )
}
