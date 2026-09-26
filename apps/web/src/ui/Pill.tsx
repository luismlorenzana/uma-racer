import type { HTMLAttributes, ReactNode } from 'react'

/** Currency / counter pill for the top bar: icon, then a display numeral. The label names the count for screen readers. */
export function Pill({ icon, label, children, ...rest }: { icon: ReactNode; label: string; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...rest}
      className="flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-panel/90 pr-2.5 pl-1.5 text-[13px] text-ink shadow-1 backdrop-blur"
    >
      <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
        {icon}
      </span>
      <span className="sr-only">{label}: </span>
      <span className="font-display font-semibold">{children}</span>
    </span>
  )
}
