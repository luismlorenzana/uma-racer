// A stopped queue (docs/game/02-check-ins-and-notifications.md §3 "Queues", §4; T142), beside T140's work pieces: her
// face and name, "Pantry ×10 · stopped 7h 5m ago", what stopped behind it, "Short 2 Carrot.", and the one-tap ways to put it back:
// - **Restart** when the stock covers it: `start { outfitId, from: 'dropped' }`, which puts the whole queue back;
// - **Buy 2 and restart · 190**: asks once with the amount, then one `buy` per short item at `buyFor`'s prices, then
//   that restart, each its own operation, in order;
// - **Start ×8**: the restart at the size the stock covers;
// - **Make them: Vegetable Garden ×2**: the `start` of `makeThem`'s suggestion, by another Free Uma;
// - **Dismiss**: `queue { outfitId, dismiss: true }`.
// Each answer shows beside the buttons in plain words. A summary passes its own `tap`, so one tap is in flight at once.
import type { StoppedQueue } from '@racer/domain/check-in'
import { useState } from 'react'
import { useGame } from '../../app/game'
import { FaceTile } from '@luismlorenzana/uma-kit/album'
import { stoppedCardView } from './stopped'
import { TapNoteLine } from './TapNote'
import { useTap, useWordsContext, type Tap } from './useTap'
import { grouped, showWords, workWords } from './words'

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-[14px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

export function StoppedQueueCard({ queue, tap: given, onDone }: {
  queue: StoppedQueue
  /** The list's tap for this card, so one tap is in flight at once; the card's own otherwise. */
  tap?: Tap
  /** Called when a fix's last operation applies. */
  onDone?: () => void
}) {
  const own = useTap()
  const tap = given ?? own
  const context = useWordsContext()
  const name = useGame((snapshot) => snapshot.env?.content.umas.get(queue.outfitId)?.name ?? queue.outfitId)
  const maker = useGame((snapshot) => (queue.makeThem === null ? '' : snapshot.env?.content.umas.get(queue.makeThem.outfitId)?.name ?? queue.makeThem.outfitId))
  const [asking, setAsking] = useState(false)
  const view = stoppedCardView(queue, context)
  const outfitId = queue.outfitId
  const key = `stopped:${outfitId}`
  const busy = tap.pending !== null

  const done = (applied: boolean) => {
    if (applied) onDone?.()
  }
  const restart = async (count?: number) => {
    const answer = await tap.run('start', count === undefined ? { outfitId, from: 'dropped' } : { outfitId, from: 'dropped', count }, key)
    done(answer?.kind === 'done')
  }
  const buyAndRestart = async () => {
    setAsking(false)
    for (const line of queue.buy?.items ?? []) {
      const bought = await tap.run('buy', { sku: line.sku, qty: line.qty, unitPrice: line.unitPrice }, key)
      if (bought?.kind !== 'done') return
    }
    await restart()
  }
  const make = async () => {
    const suggestion = queue.makeThem
    if (suggestion === null) return
    const answer = await tap.run('start', { outfitId: suggestion.outfitId, slot: suggestion.slot, request: suggestion.request }, key)
    done(answer?.kind === 'done')
  }
  const dismiss = async () => {
    const answer = await tap.run('queue', { outfitId, dismiss: true }, key)
    done(answer?.kind === 'done')
  }

  return (
    <article
      id={`stopped-${outfitId}`}
      tabIndex={-1}
      aria-label={workWords('stopped-label', { uma: name, line: view.line })}
      data-g2="stopped-queue"
      data-outfit={outfitId}
      className="space-y-2 rounded-md border border-warning/40 bg-panel p-3 shadow-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-center gap-3">
        <span className="block size-10 shrink-0 overflow-hidden rounded-full bg-sunken">
          <FaceTile round label="" outfitId={outfitId} size={40} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{name}</span>
          <span className="block text-[13px] text-ink-soft tabular-nums">{view.line}</span>
        </span>
      </div>
      {view.behind.length > 0 && <p className="text-[12px] text-ink-soft">{view.behind.join(' · ')}</p>}
      <p data-stopped-words className="text-[13px] font-semibold text-warning">{showWords(view.words, context)}</p>
      {asking && view.buy !== null ? (
        <div role="group" data-g2="buy-restart-ask" className="flex flex-wrap items-center gap-2 rounded-sm bg-accent-wash p-2 text-[13px]">
          <span className="min-w-0 flex-1">{workWords('buy-restart-ask', { items: view.buy.items, price: grouped(view.buy.price) })}</span>
          <button type="button" disabled={busy} onClick={() => void buyAndRestart()} className={`${BUTTON} bg-accent text-accent-ink`}>{workWords('yes')}</button>
          <button type="button" onClick={() => setAsking(false)} className="min-h-11 px-3 font-semibold text-ink-soft">{workWords('not-now')}</button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2" data-g2="stopped-actions">
          {view.restart && (
            <button type="button" data-action="restart" disabled={busy} onClick={() => void restart()} className={`${BUTTON} bg-accent text-accent-ink`}>
              {workWords('restart')}
            </button>
          )}
          {view.buy !== null && (
            <button type="button" data-action="buy-restart" disabled={busy} onClick={() => setAsking(true)} className={`${BUTTON} bg-accent text-accent-ink`}>
              {workWords('buy-restart', { n: view.buy.n, price: grouped(view.buy.price) })}
            </button>
          )}
          {view.smaller !== null && (
            <button type="button" data-action="start-smaller" disabled={busy} onClick={() => void restart(view.smaller!)} className={`${BUTTON} border border-hairline-strong bg-panel text-ink`}>
              {workWords('start-smaller', { n: view.smaller })}
            </button>
          )}
          {view.make !== null && (
            <button
              type="button"
              data-action="make-them"
              disabled={busy}
              onClick={() => void make()}
              aria-label={workWords('make-them-label', { place: view.make.place, n: view.make.n, uma: maker })}
              className={`${BUTTON} border border-hairline-strong bg-panel text-ink`}
            >
              {workWords('make-them', { place: view.make.place, n: view.make.n })}
            </button>
          )}
          <button
            type="button"
            data-action="dismiss"
            disabled={busy}
            onClick={() => void dismiss()}
            aria-label={workWords('dismiss-label', { uma: name })}
            className="min-h-11 rounded-sm px-3 text-[14px] font-semibold text-ink-soft disabled:opacity-45"
          >
            {workWords('dismiss')}
          </button>
        </div>
      )}
      <TapNoteLine tap={tap} onDone={() => done(true)} />
    </article>
  )
}
