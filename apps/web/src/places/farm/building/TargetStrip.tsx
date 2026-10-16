// "For your targets" as one row of item icons (docs/game/07-farm.md §10; docs/game/02-check-ins-and-notifications.md
// §6; D366): each of the planner's lines here is its item's icon with "×N" short (a check when what's coming covers
// it, a lock when no Free Uma's Farm Level opens it), scrolling sideways if they don't fit. A tap opens the job sheet
// filled in with that item, the planner's Free Uma and her size, so one more tap starts it. VoiceOver reads the line in
// 02 §6's words: "Vegetables G3 · short 6 · Warehouse 4 · coming 2 (Gold Ship, in 1h 20m)".
import { CheckIcon, LockedIcon, TargetIcon } from '@luismlorenzana/uma-kit/ui'
import { useId } from 'react'
import { Link } from 'react-router'
import { ItemIcon } from '../../../ui/ItemIcon'
import { grouped } from '../../../ui/work/words'
import { farmWords } from '../words'
import type { TargetLineView } from './model'

export function TargetStrip({ lines, sheetTo, className = '' }: {
  lines: readonly TargetLineView[]
  /** The link a line opens: its sheet query on the page or over the map. */
  sheetTo: (line: TargetLineView) => string
  className?: string
}) {
  const title = useId()
  if (lines.length === 0) return null
  return (
    <section aria-labelledby={title} data-g2="targets" className={`flex items-center gap-1.5 ${className}`}>
      <h2 id={title} className="sr-only">{farmWords('targets-title')}</h2>
      <span aria-hidden title={farmWords('targets-title')} className="flex size-6 shrink-0 items-center justify-center text-accent-strong"><TargetIcon size={20} /></span>
      <ul className="scroll-strip -my-1.5 -mr-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-1.5 pr-4">
        {lines.map((line) => (
          <li key={line.line.item} className="shrink-0">
            <Link
              to={sheetTo(line)}
              state={{ back: true }}
              aria-label={line.gate === null ? line.words : `${line.words}. ${line.gate}`}
              data-target-line={line.line.item}
              className="relative flex size-12 items-center justify-center rounded-sm border border-hairline bg-sunken/60"
            >
              <ItemIcon item={line.line.item} decorative className={line.gate !== null ? 'opacity-45' : ''} />
              {line.line.short > 0 ? (
                <span aria-hidden className="font-display absolute -top-1.5 -right-1.5 rounded-full bg-accent px-1 text-[10px] leading-4 font-bold text-accent-ink tabular-nums shadow-1">
                  {farmWords('target-short', { n: grouped(line.line.short) })}
                </span>
              ) : (
                <span aria-hidden className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-success text-ink-on-dark"><CheckIcon size={16} className="scale-75" /></span>
              )}
              {line.gate !== null && <span aria-hidden className="absolute bottom-0 left-0.5 text-ink-soft"><LockedIcon size={16} /></span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
