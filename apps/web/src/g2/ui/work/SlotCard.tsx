// One slot's card (docs/rework/07-farm.md §10; docs/rework/05-training-hub.md §2; T140), the same for a Farm job and a
// session (T139 passes its unlock line as `what`). A held slot: her face, name and Farm Level; what it makes with a
// ring for the current item's progress; "3 / 10 made"; the next item's and the entry's end; her queue; **Collect**
// while items wait, **−30m** and **Finish** (`SpeedUpControls`), **Recall** (`RecallSheet`) and **+ Queue**. A free
// slot: **Start a job**. VoiceOver reads the card as one line: "Special Week. Potato, 3 of 10 made, next at 11:10".
// The ring redraws on the shell's 30-second clock, never per frame.
import { clockTime } from '@racer/domain/rework/check-in'
import { itemById } from '@racer/domain/rework/items'
import { MAX_QUEUE, SESSION_KIND, WORK_REFUSALS, type WorkRequest } from '@racer/domain/rework/work'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useGame } from '../../app/game'
import { ItemIcon } from '../ItemIcon'
import { UmaFace } from '../UmaArt'
import type { SlotCardModel } from './model'
import { QueueChips, QueueCount, requestWords } from './QueueChips'
import { RecallSheet } from './RecallSheet'
import { SpeedUpControls } from './SpeedUpControls'
import { TapNoteLine } from './TapNote'
import { useTap, useWordsContext } from './useTap'
import { itemName, workWords } from './words'

const ACTION = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-[14px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

export interface SlotCardWhat {
  readonly icon: ReactNode
  readonly line: ReactNode
  /** Its name in the VoiceOver line: "Potato". */
  readonly name: string
}

export interface SlotCardProps {
  readonly card: SlotCardModel
  /** What a session makes (T139); a Farm job's item and grade by default. */
  readonly what?: SlotCardWhat
  /** Where a free slot's **Start a job** goes: the place's sheet. */
  readonly startTo?: string
  /** Where a running entry's **+ Queue** goes. */
  readonly queueTo?: string
  /** A queued request's name for `QueueChips`. */
  readonly queueLabel?: (request: WorkRequest) => string
  /** Her Farm Level beside her name; false for a session (T139). */
  readonly farmLevel?: boolean
}

function farmWhat(request: WorkRequest): SlotCardWhat {
  if (request.kind === SESSION_KIND) return { icon: null, line: requestWords(request), name: requestWords(request) }
  const def = itemById(request.item)
  const grade = def !== undefined && def.kind !== 'ticket' ? def.grade : null
  return {
    icon: <ItemIcon item={request.item} decorative />,
    line: <>{itemName(request.item)}{grade !== null && <span className="text-ink-soft"> · G{grade}</span>}</>,
    name: itemName(request.item),
  }
}

/** The ring round what it makes: the current item's progress, full and gold once everything has ended. */
function Ring({ progress, ready, children }: { progress: number; ready: boolean; children: ReactNode }) {
  const fill = ready ? 'var(--color-accent)' : `conic-gradient(var(--color-ink-soft) ${Math.round(progress * 360)}deg, var(--color-hairline-strong) 0)`
  return (
    <span aria-hidden data-ring={ready ? 'ready' : Math.round(progress * 100)} className="relative flex size-12 shrink-0 items-center justify-center rounded-full p-[3px]" style={{ background: fill }}>
      <span className="flex size-full items-center justify-center rounded-full bg-panel">{children}</span>
    </span>
  )
}

export function SlotCard({ card, what, startTo, queueTo, queueLabel, farmLevel = true }: SlotCardProps) {
  const context = useWordsContext()
  const tap = useTap()
  const [recalling, setRecalling] = useState(false)
  const outfitId = card.kind === 'held' ? card.outfitId : null
  const name = useGame((snapshot) => (outfitId === null ? '' : snapshot.env?.content.umas.get(outfitId)?.name ?? outfitId))
  const level = useGame((snapshot) => (outfitId === null ? null : snapshot.state?.umas[outfitId]?.farm.level ?? null))

  if (card.kind === 'free') {
    const label = workWords('card-free', { n: card.slot.slot + 1 })
    return (
      <article aria-label={label} data-slot-card="free" data-slot={card.slot.slot} className="flex min-h-16 items-center gap-3 rounded-md border border-dashed border-hairline-strong bg-panel/60 p-3">
        <span aria-hidden className="block size-10 rounded-full border-2 border-ink-faint/50" />
        <span className="min-w-0 flex-1 text-[14px] text-ink-soft">{workWords('free')}</span>
        {startTo !== undefined && (
          <Link to={startTo} state={{ back: true }} className={`${ACTION} bg-accent text-ink`} data-action="start">
            {workWords('start-job')}
          </Link>
        )}
      </article>
    )
  }

  const shown = what ?? farmWhat(card.request)
  const time = (at: number) => clockTime(at, context.utcOffsetMin)
  const ready = !card.running
  const voice = card.running && card.nextAt !== null
    ? workWords('card-running', { uma: name, what: shown.name, made: card.made, count: card.count, next: time(card.nextAt) })
    : workWords('card-ready', { uma: name, what: shown.name, made: card.made, count: card.count })
  const queueFull = card.queue.length >= MAX_QUEUE
  const key = `collect:${card.outfitId}`
  return (
    <article aria-label={voice} data-slot-card={ready ? 'ready' : 'running'} data-slot={card.slot.slot} data-outfit={card.outfitId} className="space-y-2 rounded-md border border-hairline bg-panel p-3 shadow-1">
      <div className="flex items-center gap-3">
        <span className="block size-10 shrink-0 overflow-hidden rounded-full bg-sunken">
          <UmaFace outfitId={card.outfitId} size={40} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-semibold">{name}</span>
            <QueueCount n={card.queue.length} />
          </span>
          {farmLevel && level !== null && <span className="block text-[12px] text-ink-soft">{workWords('farm-level', { level })}</span>}
        </span>
        <Ring progress={card.progress} ready={ready}>{shown.icon}</Ring>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[14px]">
        <span className="min-w-0">{shown.line}</span>
        <span className="font-semibold tabular-nums">{workWords('made', { made: card.made, count: card.count })}</span>
      </div>
      <p className="text-[13px] text-ink-soft tabular-nums">
        {card.nextAt !== null && <>{workWords('next', { time: time(card.nextAt) })} · </>}
        {workWords(card.running ? 'ends' : 'finished', { time: time(card.endsAt) })}
      </p>
      <QueueChips outfitId={card.outfitId} label={queueLabel} />
      <div className="flex flex-wrap gap-2" data-g2="card-actions">
        {card.waiting > 0 && (
          <button
            type="button"
            disabled={tap.pending !== null}
            onClick={() => void tap.run('collect', { outfitId: card.outfitId }, key)}
            className={`${ACTION} bg-accent text-ink`}
            data-action="collect"
          >
            {workWords('collect', { n: card.waiting })}
          </button>
        )}
        {card.running && <SpeedUpControls outfitId={card.outfitId} />}
        {card.running && (
          <button type="button" onClick={() => setRecalling(true)} className={`${ACTION} border border-hairline-strong bg-panel text-ink`} data-action="recall">
            {workWords('recall')}
          </button>
        )}
        {card.running && queueTo !== undefined && (queueFull ? (
          <span className="flex min-h-11 items-center text-[12px] text-ink-soft" data-action="queue-full">{WORK_REFUSALS['queue-full']}</span>
        ) : (
          <Link to={queueTo} state={{ back: true }} className={`${ACTION} border border-hairline-strong bg-panel text-ink`} data-action="queue">
            {workWords('add-queue')}
          </Link>
        ))}
      </div>
      <TapNoteLine tap={tap} />
      {card.running && <RecallSheet outfitId={card.outfitId} open={recalling} onClose={() => setRecalling(false)} />}
    </article>
  )
}
