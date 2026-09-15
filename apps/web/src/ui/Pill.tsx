import type { HTMLAttributes, ReactNode } from 'react'

/** Currency / counter pill for the top bar. */
export function Pill({ icon, children, ...rest }: { icon: ReactNode; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...rest}
      className="flex h-8 items-center gap-1 rounded-full border-2 border-white bg-white/85 pr-2.5 pl-1 text-sm font-extrabold text-ink shadow-[0_3px_0_rgb(35_50_74/0.12)]"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cream text-sm" aria-hidden>
        {icon}
      </span>
      {children}
    </span>
  )
}
