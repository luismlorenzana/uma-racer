// The size picker every start and queue sheet shows (docs/game/02-check-ins-and-notifications.md §3; T142 part 1,
// owned here by T140): a chip per size from 1 to what the stock covers, each with its end in `chipWords`' words ("ends
// 14:00 · then free until 22:30"), the marked one carrying `fitWords` ("Fits 13:00" or "Overnight") and preselected.
// Nothing is confirmed for the owner: a chip only sets the size. `start` is now for a start, and `freeAt` (her chain's
// end) for an entry added to a queue. Each chip is a 44 pt target.
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
}

export function SizeChips({ start, itemSeconds, max, value, onChange }: SizeChipsProps) {
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
  return (
    <div data-g2="size-chips">
      <p id={label} className="text-micro mb-1.5">{workWords('size-label')}</p>
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
              className={`relative flex min-h-12 flex-col items-center justify-center rounded-sm border px-1 text-center ${
                on ? 'border-accent bg-accent-wash text-ink' : 'border-hairline-strong bg-panel text-ink-soft'
              }`}
            >
              <span className="font-display text-[15px] leading-5 font-bold">{workWords('size-chip', { n: chip.size })}</span>
              <span className="text-[11px] leading-4 tabular-nums">{chip.end}</span>
              {isMarked && (
                <span aria-hidden className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-accent px-1.5 text-[9px] leading-4 font-bold whitespace-nowrap text-ink shadow-1">
                  {view.fit}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <p aria-live="polite" className="mt-1.5 text-[13px] text-ink-soft tabular-nums">
        {workWords('size-chip-label', { n: selected.size, words: selected.words })}
      </p>
    </div>
  )
}
