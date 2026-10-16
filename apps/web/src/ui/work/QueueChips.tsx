// Her queue (docs/game/02-check-ins-and-notifications.md §3; docs/game/07-farm.md §2; T140, D366), each queued job
// with how long it takes, never when it ends: on a slot row, `QueueLine`'s small chips ("then [Carrot]×4 · 2h", with
// `queueWarnings`' mark where the stock won't cover it); in the row's ⋯ sheet, `QueueChips`' list, where each can move
// earlier or be removed (`queue` with `move` or `remove`). A queue that already stopped is the check-in's (T142).
import { ArrowUpIcon, CloseIcon, WarningIcon } from '@luismlorenzana/uma-kit/ui'
import { durationText } from '@racer/domain/check-in'
import { SESSION_KIND, type WorkRequest } from '@racer/domain/work'
import type { ReactNode } from 'react'
import { ItemIcon } from '../ItemIcon'
import { queueChips, type QueueChip } from './model'
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

/** A request drawn small: a Farm job's item icon and "×6"; a session's words. */
export function requestMark(request: WorkRequest, label: (request: WorkRequest) => string = requestWords): ReactNode {
  if (request.kind === SESSION_KIND) return <span className="truncate">{label(request)}</span>
  return <><ItemIcon item={request.item} scale={0.5} decorative /><span>×{request.count}</span></>
}

/** The "+2" on a running row. */
export function QueueCount({ n }: { n: number }) {
  if (n <= 0) return null
  return (
    <span aria-label={workWords('queued-label', { n })} className="font-display rounded-full bg-ink px-1.5 text-[11px] leading-5 font-bold text-ink-on-dark">
      {workWords('queued', { n })}
    </span>
  )
}

/** "then Carrot ×4 · 2h", for VoiceOver and the ⋯ sheet's list. */
export const queuedWords = (chip: QueueChip, what: string): string =>
  chip.ms === null ? workWords('queue-then-unknown', { what }) : workWords('queue-then', { what, time: durationText(chip.ms) })

/** A slot row's queue, display only: one small chip per queued job with its duration. */
export function QueueLine({ outfitId, label = requestWords }: {
  outfitId: string
  /** A queued request's name; a Farm job's item and size by default. */
  label?: (request: WorkRequest) => string
}) {
  const view = useWorkView()
  const context = useWordsContext()
  if (view === null) return null
  const chips = queueChips(view.projection, view.warnings, outfitId)
  if (chips.length === 0) return null
  return (
    <ol aria-label={workWords('queue-title')} data-g2="queue-line" className="flex flex-wrap gap-1 pl-[52px]">
      {chips.map((chip) => {
        const words = queuedWords(chip, label(chip.request))
        const warning = chip.warning === null ? null : showWords(chip.warning, context)
        return (
          <li
            key={chip.index}
            data-queued={chip.index}
            aria-label={warning === null ? words : `${words}. ${warning}`}
            className={`flex h-6 max-w-full items-center gap-1 rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${warning === null ? 'bg-sunken text-ink-soft' : 'bg-warning/15 text-warning'}`}
          >
            <span aria-hidden className="flex min-w-0 items-center gap-0.5">
              <span className="font-normal">then</span> {requestMark(chip.request, label)}
              {chip.ms !== null && <span>· {durationText(chip.ms)}</span>}
            </span>
            {warning !== null && <WarningIcon size={16} />}
          </li>
        )
      })}
    </ol>
  )
}

/** Her queue in the ⋯ sheet: each queued job with its duration and warning, movable and removable. */
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
                <span className="block truncate tabular-nums">{queuedWords(chip, what)}</span>
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
