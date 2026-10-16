import type { ReactNode } from 'react'

const TONE = {
  neutral: 'bg-scrim/70 text-ink-on-dark',
  accent: 'bg-accent text-accent-ink',
  turf: 'bg-turf text-ink-on-dark',
  dirt: 'bg-dirt text-ink-on-dark',
} as const

/** Small crest / state chip that sits over art: tier, grade, ownership. */
export function Crest({
  tone = 'neutral',
  children,
  className = '',
}: { tone?: keyof typeof TONE; children: ReactNode; className?: string }) {
  return (
    <span
      className={`font-display inline-flex min-h-6 items-center gap-1 rounded-xs px-1.5 text-[11px] font-semibold tracking-tight backdrop-blur-[2px] ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
