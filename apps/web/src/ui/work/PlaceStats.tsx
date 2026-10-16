// A building's level, slots in use and speed as small chips (docs/game/07-farm.md §10; docs/game/05-training-hub.md §8;
// D366): "Lv 2", "3/4" and, once an upgrade makes it faster, "×1.25". The building page's header row, its Peek's first
// line and a Training facility's header all show them so. VoiceOver reads one line: "Lv 2 · 3 of 4 slots in use · speed
// ×1.25".
import { StopwatchIcon, ViewGridIcon } from '@luismlorenzana/uma-kit/ui'
import { workWords } from './words'

const CHIP = 'font-display flex h-7 shrink-0 items-center gap-1 rounded-full bg-sunken px-2 text-[13px] font-semibold tabular-nums'

export function PlaceStats({ level, used, slots, speed, className = '' }: { level: number; used: number; slots: number; speed: number; className?: string }) {
  const label = speed > 1
    ? workWords('stats-speed-label', { level, used, slots, speed })
    : workWords('stats-label', { level, used, slots })
  return (
    <div data-g2="place-stats" className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="sr-only">{label}</span>
      <span aria-hidden className={CHIP}>{workWords('stats-level', { level })}</span>
      <span aria-hidden className={CHIP}><ViewGridIcon size={16} className="text-ink-soft" />{workWords('stats-slots', { used, slots })}</span>
      {speed > 1 && <span aria-hidden className={CHIP}><StopwatchIcon size={16} className="text-ink-soft" />{workWords('stats-speed', { speed })}</span>}
    </div>
  )
}
