// The size picker every start and queue sheet shows (docs/game/02-check-ins-and-notifications.md §3; T142 part 1,
// owned here by T140; D366): a chip per size from 1 to what the stock covers, each with how long it takes ("×4 ·
// 3h 36m"), never the clock time it ends. The size that fits until the next check-in carries a check-in mark (a moon
// when that check-in is the morning's) and is preselected; VoiceOver reads it as "fits the next check-in" or "runs
// overnight", and each chip's wait after it. Nothing is confirmed for the owner: a chip only sets the size. `start` is
// now for a start, and her chain's end (`freeAt`) for an entry added to a queue. Each chip is a 44 pt target.
import { CheckIcon, MoonIcon } from '@luismlorenzana/uma-kit/ui'
import { useEffect, useId, useMemo } from 'react'
import { useGame, useRuntime } from '../../app/game'
import { sizeChipsView } from './model'
import { workWords } from './words'

export interface SizeChipsProps {
  /** When the first item would start: now, or her chain's end for a queued entry. */
  readonly start: number
  /** Each item's seconds at today's speed, in order (a Farm job: the same time ten times; a session: one per unlock). */
  readonly itemSeconds: readonly number[]
  /** What the stock covers, 10 at most; at least ×1 always shows, so a short start can name its shortfall. */
  readonly max: number
  /** The size picked; null preselects the marked chip. */
  readonly value: number | null
  readonly onChange: (size: number) => void
  /** Show the "How many" heading; a sheet that names the section itself passes false. */
  readonly heading?: boolean
}

export function SizeChips({ start, itemSeconds, max, value, onChange, heading = true }: SizeChipsProps) {
  const { game } = useRuntime()
  const times = useGame((snapshot) => snapshot.state?.profile.checkIns ?? null)
  const label = useId()
  const offset = game.utcOffsetMin(start)
  const key = itemSeconds.join(',')
  // `key` names the seconds; the array itself may be rebuilt each render.
  const view = useMemo(() => (times === null || itemSeconds.length === 0 ? null : sizeChipsView(start, itemSeconds, max, times, offset)), [start, key, max, times, offset])
  const chosen = view === null ? null : value !== null && value >= 1 && value <= view.chips.length ? value : null
  const marked = view?.marked ?? null

  useEffect(() => {
    if (chosen === null && marked !== null) onChange(marked)
  }, [chosen, marked, onChange])

  if (view === null) return null
  const selected = view.chips.find((chip) => chip.size === (chosen ?? view.marked)) ?? view.chips[0]!
  const Mark = view.overnight ? MoonIcon : CheckIcon
  return (
    <div data-g2="size-chips">
      <p id={label} className={heading ? 'text-micro mb-1.5' : 'sr-only'}>{workWords('size-label')}</p>
      <div role="radiogroup" aria-labelledby={label} className="grid grid-cols-5 gap-1.5">
        {view.chips.map((chip) => {
          const isMarked = chip.size === view.marked
          const on = chip.size === selected.size
          const words = isMarked ? `${chip.words}, ${view.fit}` : chip.words
          return (
            <button
              key={chip.size}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={workWords('size-chip-label', { n: chip.size, words })}
              data-size={chip.size}
              data-marked={isMarked || undefined}
              onClick={() => onChange(chip.size)}
              className={`relative flex min-h-11 flex-col items-center justify-center rounded-sm border px-0.5 text-center ${
                on ? 'border-accent bg-accent-wash text-ink' : 'border-hairline-strong bg-panel text-ink-soft'
              }`}
            >
              <span className="font-display text-[14px] leading-4 font-bold">{workWords('size-chip', { n: chip.size })}</span>
              <span className="text-[11px] leading-4 whitespace-nowrap tabular-nums">{chip.duration}</span>
              {isMarked && (
                <span aria-hidden data-fit={view.overnight ? 'overnight' : 'next'} className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink shadow-1">
                  <Mark size={16} variant="solid" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
