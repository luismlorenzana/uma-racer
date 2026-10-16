// One slot as a compact row (docs/game/07-farm.md §10; docs/game/05-training-hub.md §2, §8; T140, D366), the same for
// a Farm job and a session (a facility passes its dish and unlock as `what`), about 56 pt tall: her face in a ring
// filled by the current item's progress; what it makes as an icon; "×10 · 3/10"; how long is left ("1h 20m") or
// **Done**; and trailing 44 pt icon buttons: **Collect** with its count while items wait; **Repeat** on a finished Farm
// job (`collect`, then the domain's `repeat` for her); a Speed Ticket that opens −30m, Finish and "Buy N and finish"
// (`SpeedUpControls`) in a small sheet; and ⋯ for **Queue next**, her queue (`QueueChips`) and **Recall**
// (`RecallSheet`). Queued jobs follow as small chips with their durations (`QueueLine`). A free slot is a dashed "+"
// row whose link opens the place's sheet. VoiceOver reads a row as one line: "Special Week. Potato, 3 of 10 made, 1h 20m
// left". `PeekRow` is the side panel's 48 pt version. Rings and times redraw on the shell's 30-second clock, never per
// frame. Nothing here shows the clock time work ends.
import { ArrowDownIcon, BottomSheet, MoreIcon, PlusIcon, RetryIcon, UiMark } from '@luismlorenzana/uma-kit/ui'
import { durationText, type RepeatReceipt } from '@racer/domain/check-in'
import { MAX_QUEUE, SESSION_KIND, WORK_REFUSALS, type WorkRequest } from '@racer/domain/work'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useGame } from '../../app/game'
import { ItemIcon } from '../ItemIcon'
import { UmaFace } from '../UmaArt'
import { speedUpModel, type HeldSlotCard, type SlotCardModel } from './model'
import { QueueChips, QueueLine, requestWords } from './QueueChips'
import { RecallSheet } from './RecallSheet'
import { SpeedUpControls } from './SpeedUpControls'
import { TapNoteLine } from './TapNote'
import { useTap, useWordsContext, type Tap } from './useTap'
import { useWorkView } from './view'
import { grouped, itemName, showWords, workWords, type WordsContext } from './words'

/** What a row makes: its icon and its name for VoiceOver ("Potato", "Node 3 · Carrot Salad"). */
export interface SlotCardWhat {
  readonly icon: ReactNode
  readonly name: string
}

const ICON_BUTTON = 'flex size-11 shrink-0 items-center justify-center rounded-full border border-hairline-strong bg-panel text-ink disabled:opacity-45'

/** A Farm job's item; a session's words, for a place that doesn't pass its own. */
export function farmWhat(request: WorkRequest): SlotCardWhat {
  if (request.kind === SESSION_KIND) return { icon: null, name: requestWords(request) }
  return { icon: <ItemIcon item={request.item} decorative />, name: itemName(request.item) }
}

/** Her face in a ring filled by the current item's progress, full and gold once everything has ended (game/11 §4). */
export function FaceRing({ outfitId, progress, ready, size = 44 }: { outfitId: string; progress: number; ready: boolean; size?: number }) {
  const fill = ready ? 'var(--color-accent)' : `conic-gradient(var(--color-accent-strong) ${Math.round(progress * 360)}deg, var(--color-hairline-strong) 0)`
  return (
    <span aria-hidden data-ring={ready ? 'ready' : Math.round(progress * 100)} className="flex shrink-0 items-center justify-center rounded-full p-[3px]" style={{ width: size, height: size, background: fill }}>
      <span className="block size-full overflow-hidden rounded-full border-2 border-panel bg-sunken">
        <UmaFace outfitId={outfitId} size={size - 10} />
      </span>
    </span>
  )
}

/** Her row's VoiceOver line. */
function voiceOf(card: HeldSlotCard, uma: string, what: string): string {
  return card.running
    ? workWords('card-running', { uma, what, made: card.made, count: card.count, left: durationText(card.leftMs) })
    : workWords('card-ready', { uma, what, made: card.made, count: card.count })
}

/**
 * Repeat on a finished Farm row (07 §9, D366): `collect`, then the domain's `repeat` for her alone, which restarts her
 * last job at the same place, item and size (shrunk to the stock), or skips it with a reason. Resolves with what to say
 * beside the row: a skip's reason, the shrink ("×6 → ×3"), or nothing.
 */
export async function repeatOne(tap: Tap, outfitId: string, context: WordsContext): Promise<string | null> {
  const key = `repeat:${outfitId}`
  const collected = await tap.run('collect', { outfitId }, key)
  if (collected?.kind !== 'done') return null
  const answer = await tap.run('repeat', { outfitIds: [outfitId], utcOffsetMin: context.utcOffsetMin }, key)
  if (answer?.kind !== 'done') return null
  const receipt = answer.receipt as RepeatReceipt
  const skipped = receipt.skipped.find((line) => line.outfitId === outfitId)
  if (skipped !== undefined) return showWords(skipped.words, context)
  const started = receipt.started.find((line) => line.outfitId === outfitId)
  return started === undefined || started.notes.length === 0 ? null : started.notes.map((note) => showWords(note, context)).join(' · ')
}

/** Collect, with the count waiting. */
function CollectButton({ card, what, tap }: { card: HeldSlotCard; what: string; tap: Tap }) {
  return (
    <button
      type="button"
      disabled={tap.pending !== null}
      onClick={() => void tap.run('collect', { outfitId: card.outfitId }, `collect:${card.outfitId}`)}
      aria-label={workWords('collect-label', { n: card.waiting, what })}
      data-action="collect"
      className="font-display flex h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-full bg-accent px-2.5 text-[15px] font-bold text-ink shadow-1 tabular-nums disabled:opacity-45"
    >
      <ArrowDownIcon size={16} />
      {card.waiting}
    </button>
  )
}

function RepeatButton({ card, what, tap, onNote }: { card: HeldSlotCard; what: string; tap: Tap; onNote: (note: string | null) => void }) {
  const context = useWordsContext()
  return (
    <button
      type="button"
      disabled={tap.pending !== null}
      onClick={() => {
        onNote(null)
        void repeatOne(tap, card.outfitId, context).then(onNote)
      }}
      aria-label={workWords('repeat-label', { what, n: card.count })}
      data-action="repeat"
      className={ICON_BUTTON}
    >
      <RetryIcon size={20} />
    </button>
  )
}

export interface SlotRowProps {
  readonly card: SlotCardModel
  /** What a session makes (T139); a Farm job's item by default. */
  readonly what?: SlotCardWhat
  /** Where a free slot's "+" goes: the place's sheet. */
  readonly startTo?: string
  /** The free slot's name: **Start a job**, or a facility's **Start a session** (T139). */
  readonly startLabel?: string
  /** Where a running row's **Queue next** goes. */
  readonly queueTo?: string
  /** A queued request's name for its chips. */
  readonly queueLabel?: (request: WorkRequest) => string
  /** Offer **Repeat** on a finished row (the Farm's, D366). */
  readonly repeat?: boolean
}

export function SlotRow({ card, what, startTo, startLabel = workWords('start-job'), queueTo, queueLabel, repeat = false }: SlotRowProps) {
  const view = useWorkView()
  const tap = useTap()
  const [sheet, setSheet] = useState<'speed' | 'more' | 'recall' | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const outfitId = card.kind === 'held' ? card.outfitId : null
  const name = useGame((snapshot) => (outfitId === null ? '' : snapshot.env?.content.umas.get(outfitId)?.name ?? outfitId))
  const noteLine = note === null ? null : <p role="status" className="pl-[52px] text-[12px] text-ink-soft">{note}</p>

  if (card.kind === 'free') {
    const label = workWords('start-in-slot', { start: startLabel, n: card.slot.slot + 1 })
    return (
      <article aria-label={workWords('card-free', { n: card.slot.slot + 1 })} data-slot-card="free" data-slot={card.slot.slot} className="space-y-1">
        {startTo === undefined ? (
          <div className="flex min-h-14 items-center gap-2 rounded-md border border-dashed border-hairline-strong px-1.5">
            <span aria-hidden className="block size-11 rounded-full border-2 border-dashed border-ink-faint/50" />
            <span className="text-[13px] text-ink-soft">{workWords('free')}</span>
          </div>
        ) : (
          <Link
            to={startTo}
            state={{ back: true }}
            aria-label={label}
            data-action="start"
            className="flex min-h-14 items-center gap-2 rounded-md border border-dashed border-hairline-strong bg-panel/50 px-1.5 text-ink-soft"
          >
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-accent/60 text-accent-strong">
              <PlusIcon size={24} />
            </span>
            <span aria-hidden className="text-[13px] font-semibold">{workWords('free')}</span>
          </Link>
        )}
        {noteLine}
      </article>
    )
  }

  const shown = what ?? farmWhat(card.request)
  const ready = !card.running
  const speed = view !== null && card.running ? speedUpModel(view.settled, card.outfitId, view.now) : null
  const queueFull = card.queue.length >= MAX_QUEUE
  const jobName = `${shown.name} ×${card.count}`
  return (
    <article
      aria-label={voiceOf(card, name, shown.name)}
      data-slot-card={ready ? 'ready' : 'running'}
      data-slot={card.slot.slot}
      data-outfit={card.outfitId}
      className="space-y-1 rounded-md border border-hairline bg-panel px-1.5 py-1.5 shadow-1"
    >
      <div className="flex items-center gap-1.5">
        <FaceRing outfitId={card.outfitId} progress={card.progress} ready={ready} />
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center">{shown.icon}</span>
        <span aria-hidden className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[14px] font-semibold tabular-nums">
            ×{card.count}<span className="font-normal text-ink-soft"> · {workWords('made', { made: card.made, count: card.count })}</span>
          </span>
          {ready
            ? <span className="block text-[13px] font-bold text-accent-strong">{workWords('done')}</span>
            : <span className="block text-[13px] font-semibold tabular-nums">{durationText(card.leftMs)}</span>}
        </span>
        {card.waiting > 0 && <CollectButton card={card} what={shown.name} tap={tap} />}
        {ready && repeat && card.request.kind !== SESSION_KIND && <RepeatButton card={card} what={shown.name} tap={tap} onNote={setNote} />}
        {speed !== null && speed.state !== 'hidden' && (
          <button type="button" onClick={() => setSheet('speed')} aria-label={workWords('speed-label', { what: jobName })} data-action="speed" className={ICON_BUTTON}>
            <UiMark mark="currency/speed-ticket" />
          </button>
        )}
        {card.running && (
          <button type="button" onClick={() => setSheet('more')} aria-label={workWords('more-label', { uma: name })} data-action="more" className={`${ICON_BUTTON} text-ink-soft`}>
            <MoreIcon size={20} />
          </button>
        )}
      </div>
      <QueueLine outfitId={card.outfitId} label={queueLabel} />
      {noteLine}
      <TapNoteLine tap={tap} className="pl-[52px]" />

      <BottomSheet open={sheet === 'speed' && card.running} onClose={() => setSheet(null)} label={workWords('speed-title', { what: jobName })}>
        <div data-g2="speed-sheet" className="space-y-3 pb-2">
          <h2 className="text-lg">{workWords('speed-title', { what: jobName })}</h2>
          <p className="flex items-center gap-2 text-[13px] text-ink-soft tabular-nums">
            {workWords('speed-left', { time: durationText(card.leftMs) })}
            <span className="flex items-center gap-1"><UiMark mark="currency/speed-ticket" />{workWords('tickets-held', { n: grouped(speed?.have ?? 0) })}</span>
          </p>
          <div className="flex flex-wrap gap-2"><SpeedUpControls outfitId={card.outfitId} /></div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'more' && card.running} onClose={() => setSheet(null)} label={`${name} · ${jobName}`}>
        <div data-g2="slot-more" className="space-y-3 pb-2">
          <h2 className="text-lg">{name} · {jobName}</h2>
          <QueueChips outfitId={card.outfitId} label={queueLabel} />
          <div className="flex flex-wrap gap-2">
            {queueTo !== undefined && (queueFull ? (
              <span className="flex min-h-11 items-center text-[13px] text-ink-soft" data-action="queue-full">{WORK_REFUSALS['queue-full']}</span>
            ) : (
              <Link to={queueTo} state={{ back: true }} onClick={() => setSheet(null)} data-action="queue" className="font-display inline-flex min-h-11 flex-1 items-center justify-center rounded-sm bg-accent px-3 text-[14px] font-semibold text-ink shadow-1">
                {workWords('queue-next')}
              </Link>
            ))}
            <button type="button" onClick={() => setSheet('recall')} data-action="recall" className="font-display inline-flex min-h-11 flex-1 items-center justify-center rounded-sm border border-danger/40 bg-panel px-3 text-[14px] font-semibold text-danger">
              {workWords('recall')}
            </button>
          </div>
        </div>
      </BottomSheet>
      {card.running && <RecallSheet outfitId={card.outfitId} open={sheet === 'recall'} onClose={() => setSheet(null)} />}
    </article>
  )
}

/**
 * The side panel's slot row (game/11 §2.6, D366), about 48 pt: her face in its ring, what it makes, `text` ("Carrot ×2
 * · 0/2"), a "+1" chip with the next queued item when one waits, and how long is left, or **Done** with **Collect** and,
 * on a Farm job, **Repeat** (`repeatOne`). A free slot is a "+" link to `startTo`, or a plain line without one.
 */
export function PeekRow({ card, what, text, startTo, startLabel = workWords('start-job'), repeat = false }: {
  card: SlotCardModel
  what?: SlotCardWhat
  /** The row's words: "Carrot ×2 · 0/2". */
  text?: string
  startTo?: string
  startLabel?: string
  repeat?: boolean
}) {
  const tap = useTap()
  const [note, setNote] = useState<string | null>(null)
  const outfitId = card.kind === 'held' ? card.outfitId : null
  const name = useGame((snapshot) => (outfitId === null ? '' : snapshot.env?.content.umas.get(outfitId)?.name ?? outfitId))
  const noteLine = note === null ? null : <p role="status" className="px-1 text-[12px] text-ink-soft">{note}</p>
  if (card.kind === 'free') {
    const label = workWords('start-in-slot', { start: startLabel, n: card.slot.slot + 1 })
    return (
      <li data-peek-slot={card.slot.slot} data-peek-free className="space-y-0.5">
        {startTo === undefined ? (
          <span className="flex min-h-12 items-center gap-2 rounded-sm border border-dashed border-hairline-strong px-1 text-[13px] text-ink-soft">
            <span aria-hidden className="block size-10 rounded-full border-2 border-dashed border-ink-faint/50" />
            {workWords('card-free', { n: card.slot.slot + 1 })}
          </span>
        ) : (
          <Link to={startTo} state={{ back: true }} aria-label={label} data-action="peek-start" className="flex min-h-12 items-center gap-2 rounded-sm border border-dashed border-hairline-strong px-1 text-[13px] font-semibold text-ink-soft">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-accent/60 text-accent-strong"><PlusIcon size={20} /></span>
            <span aria-hidden>{workWords('free')}</span>
          </Link>
        )}
        {noteLine}
      </li>
    )
  }
  const shown = what ?? farmWhat(card.request)
  const ready = !card.running
  const next = card.queue[0]
  return (
    <li data-peek-slot={card.slot.slot} data-outfit={card.outfitId} className="space-y-0.5">
      <div aria-label={voiceOf(card, name, shown.name)} role="group" className="flex min-h-12 items-center gap-1.5 rounded-sm bg-sunken/60 py-0.5 pr-0.5 pl-1 text-[13px]">
        <FaceRing outfitId={card.outfitId} progress={card.progress} ready={ready} size={40} />
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center">{shown.icon}</span>
        <span aria-hidden className="min-w-0 flex-1 truncate tabular-nums">{text ?? `×${card.count} · ${workWords('made', { made: card.made, count: card.count })}`}</span>
        {next !== undefined && (
          <span aria-label={[workWords('queued-label', { n: card.queue.length }), workWords('next-queued-label', { what: requestWords(next) })].join(', ')} className="flex shrink-0 items-center gap-0.5 rounded-full bg-ink px-1 text-[11px] leading-5 font-bold text-ink-on-dark">
            +{card.queue.length}
            {next.kind !== SESSION_KIND && <ItemIcon item={next.item} scale={0.5} decorative />}
          </span>
        )}
        <span aria-hidden className={`shrink-0 px-1 font-semibold tabular-nums ${ready ? 'text-accent-strong' : ''}`}>
          {ready ? workWords('done') : durationText(card.leftMs)}
        </span>
        {ready && card.waiting > 0 && <CollectButton card={card} what={shown.name} tap={tap} />}
        {ready && repeat && card.request.kind !== SESSION_KIND && <RepeatButton card={card} what={shown.name} tap={tap} onNote={setNote} />}
      </div>
      {noteLine}
      <TapNoteLine tap={tap} className="px-1" />
    </li>
  )
}
