// Speed Tickets on a running job or session (docs/game/07-farm.md §8; docs/game/09-racing-rewards-and-exchange.md
// §5.1; docs/game/05-training-hub.md §2; T140): **−30m** is `speed-up` with the entry's `startedAt` and one ticket;
// **Finish · N** is `finish`, N being `ticketsToFinish` of what remains. With too few tickets Finish reads "Buy 3 and
// finish · 90", asks once, then runs `buy` and `finish` as two operations in order. Under 30 minutes left, it shows the
// minutes the ticket wastes before it confirms. Nothing shows on a queued, finished or empty slot.
import { SPEED_TICKET_PRICE } from '@racer/domain/economy'
import { SPEED_TICKET_ID } from '@racer/domain/items'
import { useState } from 'react'
import { speedUpModel, type SpeedUpModel } from './model'
import { TapNoteLine } from './TapNote'
import { useTap, useWordsContext } from './useTap'
import { useWorkView } from './view'
import { grouped, showWords, workWords } from './words'

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-[14px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

/** The question a spending or wasting tap asks once, or null when it runs at once. */
export function speedUpQuestion(model: SpeedUpModel): string | null {
  if (model.state === 'buy') {
    return model.buy === 1 && model.wastedMinutes > 0 && model.finish === 1
      ? workWords('buy-waste', { price: grouped(model.price), minutes: model.wastedMinutes })
      : workWords(model.buy === 1 ? 'buy-finish-ask-one' : 'buy-finish-ask', { n: model.buy, price: grouped(model.price) })
  }
  if (model.state === 'waste') return workWords('waste', { minutes: model.wastedMinutes })
  return null
}

export function SpeedUpControls({ outfitId, className = '' }: { outfitId: string; className?: string }) {
  const view = useWorkView()
  const tap = useTap()
  const context = useWordsContext()
  const [asking, setAsking] = useState(false)
  if (view === null) return null
  const model = speedUpModel(view.settled, outfitId, view.now)
  if (model.state === 'hidden') return null
  const busy = tap.pending !== null
  const key = `speed:${outfitId}`

  const finish = async () => {
    setAsking(false)
    if (model.buy > 0) {
      const bought = await tap.run('buy', { sku: SPEED_TICKET_ID, qty: model.buy, unitPrice: SPEED_TICKET_PRICE }, key)
      if (bought?.kind !== 'done') return
    }
    await tap.run('finish', { outfitId, startedAt: model.startedAt }, key)
  }
  const question = speedUpQuestion(model)

  if (asking && question !== null) {
    return (
      <div data-g2="speed-up-ask" className={`flex w-full flex-wrap items-center gap-2 rounded-sm bg-accent-wash p-2 text-[13px] ${className}`}>
        <span className="min-w-0 flex-1">{question}</span>
        <button type="button" disabled={busy} onClick={() => void finish()} className={`${BUTTON} bg-accent text-ink`}>{workWords('yes')}</button>
        <button type="button" onClick={() => setAsking(false)} className="min-h-11 px-3 font-semibold text-ink-soft">{workWords('not-now')}</button>
      </div>
    )
  }

  const finishLabel = model.state === 'buy'
    ? workWords('buy-finish', { n: model.buy, price: grouped(model.price) })
    : workWords('finish', { n: model.finish })
  const finishDisabled = busy || model.buyRefusal !== null
  return (
    <div data-g2="speed-up" data-state={model.state} className={`contents ${className}`}>
      {model.have > 0 && model.state !== 'waste' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void tap.run('speed-up', { outfitId, startedAt: model.startedAt, tickets: 1 }, key)}
          aria-label={workWords('speed-up-label')}
          className={`${BUTTON} border border-hairline-strong bg-panel text-ink`}
        >
          {workWords('speed-up')}
        </button>
      )}
      <button
        type="button"
        disabled={finishDisabled}
        onClick={() => (question === null ? void finish() : setAsking(true))}
        aria-label={model.state === 'buy' ? finishLabel : workWords(model.finish === 1 ? 'finish-label-one' : 'finish-label', { n: model.finish })}
        className={`${BUTTON} border border-hairline-strong bg-panel text-ink`}
      >
        {finishLabel}
      </button>
      {model.buyRefusal !== null && <p className="w-full text-[12px] text-ink-soft">{showWords(model.buyRefusal, context)}</p>}
      <TapNoteLine tap={tap} className="w-full" />
    </div>
  )
}
