// Speed up all, inside the check-in sheet (docs/game/02-check-ins-and-notifications.md §4 "Speed Tickets at a
// check-in"; docs/game/09-racing-rewards-and-exchange.md §5.1; T142): 1 h, 2 h and "to 13:00" (the next check-in),
// each with its ticket count from `speedUpAllPlan`. One confirmation names the count and runs `speed-up { all: true,
// span, utcOffsetMin }`; when the tickets run short the option reads `speedUpAll`'s own refusal ("Needs 12 Speed
// Tickets.") with the Exchange's row. Below, **Best use**: up to three running entries from today's plan, each with
// T140's −30m and Finish.
import type { SpeedUpSpan } from '@racer/domain/check-in'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useGame, useNow } from '../../app/game'
import { SpeedUpControls } from '../../ui/work/SpeedUpControls'
import { TapNoteLine } from '../../ui/work/TapNote'
import type { Taps } from '../../ui/work/useTap'
import { useWordsContext } from '../../ui/work/useTap'
import { useWorkView } from '../../ui/work/view'
import { grouped, showWords, workWords } from '../../ui/work/words'
import { bestUseLines, speedOptions, TICKETS_ROW } from './model'
import { summaryWords } from './words'

const BUTTON = 'font-display inline-flex min-h-11 items-center justify-center rounded-sm px-3 text-[14px] font-semibold shadow-1 disabled:opacity-45 disabled:shadow-none'

export function SpeedUpAll({ taps, onBack }: { taps: Taps; onBack: () => void }) {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const now = useNow()
  const view = useWorkView()
  const context = useWordsContext()
  const [asking, setAsking] = useState<SpeedUpSpan | null>(null)
  const [used, setUsed] = useState<number | null>(null)
  const options = useMemo(() => (state === null || env === null ? [] : speedOptions(state, env, now, context.utcOffsetMin)), [state, env, now, context.utcOffsetMin])
  const best = useMemo(() => (view === null ? [] : bestUseLines(view, context)), [view, context])
  const busy = taps.pending !== null
  const tap = taps.line('speed-up-all')

  const run = async (span: SpeedUpSpan) => {
    setAsking(null)
    setUsed(null)
    const answer = await taps.run('speed-up-all', 'speed-up', { all: true, span, utcOffsetMin: context.utcOffsetMin }, 'check-in:speed-up')
    if (answer?.kind === 'done') setUsed(answer.receipt.tickets)
  }
  const chosen = options.find((option) => option.span === asking) ?? null

  return (
    <div data-g2="speed-up-all" className="space-y-4">
      <h2 data-sheet-heading tabIndex={-1} className="text-lg outline-none">{summaryWords('speed-title')}</h2>
      {chosen !== null ? (
        <div role="group" data-g2="speed-up-ask" className="flex flex-wrap items-center gap-2 rounded-sm bg-accent-wash p-2 text-[14px]">
          <span className="min-w-0 flex-1">{summaryWords('speed-ask', { n: grouped(chosen.tickets), span: chosen.label })}</span>
          <button type="button" disabled={busy} onClick={() => void run(chosen.span)} className={`${BUTTON} bg-accent text-ink`}>{workWords('yes')}</button>
          <button type="button" onClick={() => setAsking(null)} className="min-h-11 px-3 font-semibold text-ink-soft">{workWords('not-now')}</button>
        </div>
      ) : (
        <ul className="space-y-2">
          {options.map((option) => (
            <li key={String(option.span)} data-span={option.span} className="space-y-1">
              <button
                type="button"
                disabled={busy || option.refusal !== null}
                onClick={() => setAsking(option.span)}
                className={`${BUTTON} w-full border border-hairline-strong bg-panel text-ink tabular-nums`}
              >
                {summaryWords('speed-option', { span: option.label, n: grouped(option.tickets) })}
              </button>
              {option.refusal !== null && <p className="text-[13px] text-ink-soft">{showWords(option.refusal, context)}</p>}
            </li>
          ))}
          {options.some((option) => option.short) && (
            <li>
              <Link to={TICKETS_ROW} state={{ back: true }} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-accent-strong underline">
                {summaryWords('buy-tickets')}
              </Link>
            </li>
          )}
        </ul>
      )}
      {used !== null && <p role="status" className="text-[13px] text-success">{summaryWords('speed-done', { n: grouped(used) })}</p>}
      <TapNoteLine tap={tap} />

      <section aria-labelledby="best-use" className="space-y-2">
        <h3 id="best-use" className="text-micro">{summaryWords('best-use')}</h3>
        {best.length === 0 && <p className="text-[13px] text-ink-soft">{summaryWords('best-use-none')}</p>}
        <ul className="space-y-2">
          {best.map((line) => (
            <li key={line.outfitId} data-best-use={line.outfitId} className="space-y-1.5 rounded-sm bg-sunken/60 p-2">
              <p className="text-[13px]">{line.words}</p>
              <div className="flex flex-wrap gap-2"><SpeedUpControls outfitId={line.outfitId} /></div>
            </li>
          ))}
        </ul>
      </section>

      <button type="button" onClick={onBack} className="min-h-11 w-full rounded-sm text-[14px] font-semibold text-ink-soft">{summaryWords('back')}</button>
    </div>
  )
}
