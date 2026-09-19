import type { HTMLAttributes, ReactNode } from 'react'

/** Currency / counter pill for the top bar: icon, then a display numeral. */
export function Pill({ icon, children, ...rest }: { icon: ReactNode; children: ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...rest}
      className="flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-panel/90 pr-2.5 pl-1.5 text-[13px] text-ink shadow-1 backdrop-blur"
    >
      <span className="flex h-5 w-5 items-center justify-center text-[13px]" aria-hidden>
        {icon}
      </span>
      <span className="font-display font-semibold">{children}</span>
    </span>
  )
}
