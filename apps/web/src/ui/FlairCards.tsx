import { m } from 'motion/react'
import type { FlairEventView } from '../game/flair-view'

const tierTone: Record<FlairEventView['stage'], string> = {
  bronze: 'border-[#b87333] bg-[#f5dfca] text-[#75421d]',
  silver: 'border-slate-400 bg-slate-100 text-slate-700',
  gold: 'border-gold bg-amber-50 text-amber-900',
  platinum: 'border-sky bg-sky-50 text-sky-deep',
  rainbow: 'border-violet-500 bg-gradient-to-br from-rose-50 via-sky-50 to-violet-100 text-violet-900',
  'one-off': 'border-gold bg-gradient-to-r from-amber-50 to-white text-amber-900',
}

const tierGlyph: Record<FlairEventView['stage'], string> = {
  bronze: '●', silver: '■', gold: '◆', platinum: '⬡', rainbow: '★', 'one-off': '✦',
}

export function FlairCards({
  items,
  title,
  animate = false,
}: {
  items: readonly FlairEventView[]
  title?: string
  animate?: boolean
}) {
  if (items.length === 0) return null
  return (
    <section aria-label={title ?? 'Earned flair'} className="grid gap-2">
      {title && <p className="text-xs font-extrabold tracking-widest text-ink-soft uppercase">{title}</p>}
      {items.map((item, index) => (
        <m.div
          key={item.id}
          className={`flex min-h-11 items-center gap-3 rounded-2xl border-2 px-3 py-2 ${tierTone[item.stage]}`}
          initial={animate ? { y: 10, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={animate ? { delay: index * 0.12 } : { duration: 0 }}
        >
          <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-xl">{tierGlyph[item.stage]}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold">{item.label}</span>
            <span className="block text-[11px] font-bold opacity-75">{item.kindLabel} · {item.stageLabel}</span>
          </span>
          {item.prestigeDelta > 0 && <span className="shrink-0 text-xs font-extrabold">+{item.prestigeDelta} P</span>}
        </m.div>
      ))}
    </section>
  )
}
