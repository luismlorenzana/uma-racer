// Her queue on a card (docs/rework/02-check-ins-and-notifications.md §3; docs/rework/07-farm.md §2; T140): "+2" beside
// the running entry, then each queued request in order with its projected end ("then Carrot ×6 → 08:20") and
// `queueWarnings`' mark where the stock won't cover it ("Short 2 Honey."). Each can move earlier or be removed (`queue`
// with `move` or `remove`). A queue that already stopped is the check-in's (T142).
import { SESSION_KIND, type WorkRequest } from '@racer/domain/rework/work'
import { ArrowUpIcon, CloseIcon, WarningIcon } from '../../../ui/icons'
import { clockTime } from '@racer/domain/rework/check-in'
import { queueChips } from './model'
import { TapNoteLine } from './TapNote'
import { useTap, useWordsContext } from './useTap'
import { useWorkView } from './view'
import { itemName, showWords, workWords } from './words'

/** A request's short name: "Carrot ×6", or "3 unlocks" for a session. */
export function requestWords(request: WorkRequest): string {
  if (request.kind === SESSION_KIND) {
    return request.unlocks.length === 1 ? workWords('what-session-one') : workWords('what-session', { n: request.unlocks.length })
  }
  return workWords('what-farm', { item: itemName(request.item), n: request.count })
}

/** The "+2" on a running card's shoulder. */
export function QueueCount({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span aria-label={workWords('queued-label', { n })} className="font-display rounded-full bg-ink px-1.5 text-[11px] leading-5 font-bold text-ink-on-dark">
      {workWords('queued', { n })}
    </span>
  )
}

export function QueueChips({ outfitId, label = requestWords }: {
  outfitId: string
  /** A queued request's name; a Farm job's item and size by default. */
  label?: (request: WorkRequest) => string
}) {
  const view = useWorkView()
  const tap = useTap()
  const context = useWordsContext()
  if (view === null) return null
  const chips = queueChips(view.projection, view.warnings, outfitId)
  if (chips.length === 0) return null
  const key = `queue:${outfitId}`
  return (
    <div data-g2="queue-chips">
      <ol aria-label={workWords('queue-title')} className="space-y-1">
        {chips.map((chip) => {
          const what = label(chip.request)
          return (
            <li key={chip.index} data-queued={chip.index} className="flex items-center gap-1 rounded-sm bg-sunken/70 pl-2 text-[13px]">
              <span className="min-w-0 flex-1 py-1">
                <span className="block truncate">
                  {chip.endsAt === null
                    ? workWords('queue-then-unknown', { what })
                    : workWords('queue-then', { what, time: clockTime(chip.endsAt, context.utcOffsetMin) })}
                </span>
                {chip.warning !== null && (
                  <span data-queue-warning className="flex items-center gap-1 text-[12px] font-semibold text-warning">
                    <WarningIcon size={16} />
                    {showWords(chip.warning, context)}
                  </span>
                )}
              </span>
              {chip.index > 0 && (
                <button
                  type="button"
                  disabled={tap.pending !== null}
                  onClick={() => void tap.run('queue', { outfitId, move: { from: chip.index, to: chip.index - 1 } }, key)}
                  aria-label={workWords('queue-up', { what })}
                  className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-soft disabled:opacity-45"
                >
                  <ArrowUpIcon size={20} />
                </button>
              )}
              <button
                type="button"
                disabled={tap.pending !== null}
                onClick={() => void tap.run('queue', { outfitId, remove: chip.index }, key)}
                aria-label={workWords('queue-remove', { what })}
                className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-soft disabled:opacity-45"
              >
                <CloseIcon size={20} />
              </button>
            </li>
          )
        })}
      </ol>
      <TapNoteLine tap={tap} className="mt-1" />
    </div>
  )
}
