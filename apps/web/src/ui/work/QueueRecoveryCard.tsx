// Racer's stopped-queue remedies, slotted into the shared card (SC5). The kit owns its header, reason, Restart and
// Dismiss; only Racer knows Exchange prices, shrinking and planner suggestions.
import { StoppedQueueCard } from '@luismlorenzana/uma-kit/work'
import type { StoppedQueue } from '@racer/domain/check-in'
import { useState } from 'react'
import { stoppedCardView } from './stopped'
import { TapNoteLine } from './TapNote'
import { useTap, useWordsContext, type Tap } from './useTap'
import { grouped, workWords } from './words'

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm border border-hairline-strong bg-panel px-3 text-[14px] font-semibold disabled:opacity-45'

export function QueueRecoveryCard({ queue, tap: given, onDone }: { queue: StoppedQueue; tap?: Tap; onDone?: () => void }) {
  const own = useTap(), tap = given ?? own
  const context = useWordsContext()
  const [asking, setAsking] = useState(false)
  const view = stoppedCardView(queue, context)
  const outfitId = queue.outfitId, key = `stopped:${outfitId}`, busy = tap.pending !== null
  const restart = async (count?: number) => {
    const result = await tap.run('start', count === undefined ? { outfitId, from: 'dropped' } : { outfitId, from: 'dropped', count }, key)
    if (result?.kind === 'done') onDone?.()
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
    if (queue.makeThem === null) return
    const suggestion = queue.makeThem
    const result = await tap.run('start', { outfitId: suggestion.outfitId, slot: suggestion.slot, request: suggestion.request }, key)
    if (result?.kind === 'done') onDone?.()
  }
  return <div id={`stopped-${outfitId}`} tabIndex={-1}>
    <StoppedQueueCard outfitId={outfitId} onDone={onDone}>
      {asking && view.buy !== null ? <div role="group" className="flex flex-wrap items-center gap-2 rounded-sm bg-accent-wash p-2 text-[13px]">
        <span className="min-w-0 flex-1">{workWords('buy-restart-ask', { items: view.buy.items, price: grouped(view.buy.price) })}</span>
        <button type="button" disabled={busy} onClick={() => void buyAndRestart()} className={BUTTON}>{workWords('yes')}</button>
        <button type="button" onClick={() => setAsking(false)} className={BUTTON}>{workWords('not-now')}</button>
      </div> : <>
        {view.buy !== null && <button type="button" disabled={busy} onClick={() => setAsking(true)} className={BUTTON}>{workWords('buy-restart', { n: view.buy.n, price: grouped(view.buy.price) })}</button>}
        {view.smaller !== null && <button type="button" disabled={busy} onClick={() => void restart(view.smaller!)} className={BUTTON}>{workWords('start-smaller', { n: view.smaller })}</button>}
        {view.make !== null && <button type="button" disabled={busy} onClick={() => void make()} className={BUTTON}
          aria-label={workWords('make-them-label', { place: view.make.place, n: view.make.n, uma: context.umaName(view.make.outfitId) })}>{workWords('make-them', { place: view.make.place, n: view.make.n })}</button>}
      </>}
      <TapNoteLine tap={tap} onDone={onDone} />
    </StoppedQueueCard>
  </div>
}
