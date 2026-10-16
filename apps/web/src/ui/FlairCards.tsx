import { BadgesIcon, type IconComponent, SparkIcon, StarIcon } from '@luismlorenzana/uma-kit/ui'
import { m } from 'motion/react'
import type { FlairEventView } from '../places/racing/flair-view'

const tierTone: Record<FlairEventView['stage'], string> = {
  // Paddock tier tokens on a panel: the ring carries the tier, the text stays ink (docs/design/visual-system.md).
  bronze: 'border-tier-bronze bg-panel text-ink',
  silver: 'border-tier-silver bg-panel text-ink',
  gold: 'border-tier-gold bg-accent-wash text-ink',
  platinum: 'border-tier-platinum bg-panel text-ink',
  rainbow: 'border-accent bg-gradient-to-br from-accent-wash via-panel to-page text-ink',
  'one-off': 'border-accent bg-accent-wash text-ink',
}

// The medal takes its tier's metal; the card's stage label names the tier, so it never rests on colour alone.
const tierGlyph: Record<FlairEventView['stage'], [IconComponent, string]> = {
  bronze: [BadgesIcon, 'text-tier-bronze'], silver: [BadgesIcon, 'text-tier-silver'], gold: [BadgesIcon, 'text-tier-gold'],
  platinum: [BadgesIcon, 'text-tier-platinum'], rainbow: [StarIcon, 'text-accent-strong'], 'one-off': [SparkIcon, 'text-accent-strong'],
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
      {title && <p className="text-xs font-semibold tracking-widest text-ink-soft uppercase">{title}</p>}
      {items.map((item, index) => {
        const [Glyph, tone] = tierGlyph[item.stage]
        return <m.div
          key={item.id}
          className={`flex min-h-11 items-center gap-3 rounded-md border-2 px-3 py-2 shadow-1 ${tierTone[item.stage]}`}
          initial={animate ? { y: 10, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={animate ? { delay: index * 0.12 } : { duration: 0 }}
        >
          <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel/80 ${tone}`}><Glyph size={24} variant="solid" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{item.label}</span>
            <span className="block text-[11px] font-bold opacity-75">{item.kindLabel} · {item.stageLabel}</span>
          </span>
          {item.prestigeDelta > 0 && <span className="shrink-0 text-xs font-semibold">+{item.prestigeDelta} P</span>}
        </m.div>
      })}
    </section>
  )
}
