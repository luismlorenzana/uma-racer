// Training Yard's view (docs/game/08-training-yard.md §5, D384), its own lazy chunk: DOM and Motion, no canvas. The
// top holds her score against the grade ladder, the placements left and the bonus tasks; the yard and the queue sit
// in the bottom of the screen under the thumb. Tap an empty cell to set the piece in hand down; Hold puts it aside (or
// swaps it with the held one), once a placement. Every target is 44 pt or more. Moves animate with transform and
// opacity only, and reduced motion keeps the moves without the pop.
import { Button, CheckIcon } from '@luismlorenzana/uma-kit/ui'
import {
  GRADE_FLOORS, YARD_CELLS, YARD_MOVE, YARD_PLACEMENTS, YARD_TARGET, cellX, cellY, yardDone, yardTasks, type YardState,
} from '@racer/domain/stages'
import { m } from 'motion/react'
import { useMemo } from 'react'
import { useGame } from '../../app/game'
import type { StageViewProps } from '../views'
import { yardFaces } from './faces'
import { CellPiece, describeCell, describeQueuePiece, QueuePiece } from './pieces'

const TASKS = ['Gold in two colours', 'No Fatigue left', 'Every Partner merged']
/** The bar runs to S's floor; the ticks mark C, B and A. */
const BAR_TOP = GRADE_FLOORS.S

function ScoreBar({ score }: { score: number }) {
  const fill = Math.min(1, score / (YARD_TARGET * BAR_TOP))
  const ticks = (['C', 'B', 'A'] as const).map((grade) => ({ grade, at: GRADE_FLOORS[grade] / BAR_TOP }))
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[13px] text-ink-soft">
        <span>Score <span className="numeral text-[17px] font-semibold text-ink" data-racer="yard-score">{score}</span></span>
        <span>A at {YARD_TARGET}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-sunken" role="meter" aria-label="Score toward grade S" aria-valuemin={0} aria-valuemax={YARD_TARGET * BAR_TOP} aria-valuenow={score}>
        <div className="absolute inset-0 origin-left bg-accent transition-transform duration-300" style={{ transform: `scaleX(${fill})` }} />
        {ticks.map(({ grade, at }) => <span key={grade} className="absolute top-0 h-full w-px bg-hairline-strong" style={{ left: `${at * 100}%` }} />)}
      </div>
      <div className="relative h-3 text-[10px] font-semibold text-ink-faint" aria-hidden>
        {ticks.map(({ grade, at }) => <span key={grade} className="absolute -translate-x-1/2" style={{ left: `${at * 100}%` }}>{grade}</span>)}
      </div>
    </div>
  )
}

function Tasks({ state }: { state: YardState }) {
  const done = yardTasks(state)
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]" aria-label="Bonus tasks">
      {TASKS.map((task, i) => (
        <li key={task} className={`flex items-center gap-1 ${done[i] ? 'text-success' : 'text-ink-faint'}`}>
          <CheckIcon size={16} aria-hidden />
          <span>{task}{done[i] ? '' : ' (not yet)'}</span>
        </li>
      ))}
    </ul>
  )
}

export default function YardView({ config, state, onMove, reducedMotion, locked }: StageViewProps<YardState>) {
  const umaIds = useGame((snapshot) => snapshot.env?.content.umas ?? null)
  const cards = useGame((snapshot) => snapshot.env?.content.cards ?? null)
  const faces = useMemo(() => yardFaces(config, umaIds === null ? [] : [...umaIds.keys()]), [config, umaIds])
  const done = yardDone(state)
  const closed = locked || done
  const pop = reducedMotion ? false : { scale: 0.6, opacity: 0 }
  const next = [state.queue[state.drawn] ?? -1, state.queue[state.drawn + 1] ?? -1]

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-3" data-racer="yard">
      <section className="space-y-2" aria-label="This play">
        <ScoreBar score={state.score} />
        <p className="text-[13px] text-ink-soft"><span className="numeral font-semibold text-ink" data-racer="yard-left">{YARD_PLACEMENTS - state.placed}</span> placements left</p>
        <Tasks state={state} />
      </section>

      <div className="flex-1" />

      <div className="mx-auto grid w-full max-w-[360px] grid-cols-6 gap-1" role="group" aria-label="The yard" data-racer="yard-board">
        {Array.from({ length: YARD_CELLS }, (_, cell) => {
          const value = state.board[cell]!
          const x = cellX(cell)
          const y = cellY(cell)
          const empty = value === 0
          return (
            <button
              key={cell}
              type="button"
              aria-label={`Row ${y + 1}, column ${x + 1}: ${describeCell(value)}`}
              disabled={!empty || closed}
              onClick={() => onMove({ code: YARD_MOVE.place, x, y })}
              className={`relative aspect-square min-h-11 min-w-11 rounded-md ${empty ? 'bg-sunken ring-1 ring-inset ring-hairline active:bg-accent-wash' : ''} disabled:cursor-default`}
              data-cell={cell}
            >
              {!empty && (
                <m.span key={value} className="absolute inset-0 block" initial={pop} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18 }}>
                  <CellPiece value={value} faces={faces} size={56} />
                </m.span>
              )}
            </button>
          )
        })}
      </div>

      <section className="mx-auto flex w-full max-w-[360px] items-end gap-3" aria-label="Pieces" data-racer="yard-queue">
        <div className="flex flex-col items-center gap-1">
          <span className="text-micro">Now</span>
          <m.span key={`${state.drawn}:${state.hand}`} role="group" className="block size-16" initial={pop} animate={{ scale: 1, opacity: 1 }} aria-label={`In hand: ${describeQueuePiece(state.hand, state.partners, cards)}`} data-racer="yard-hand">
            <QueuePiece piece={state.hand} faces={faces} partners={state.partners} cards={cards} size={64} />
          </m.span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-micro">Next</span>
          <div className="flex gap-1">
            {next.map((piece, i) => (
              <span key={i} role="group" className="block size-11 opacity-90" aria-label={`Next ${i + 1}: ${describeQueuePiece(piece, state.partners, cards)}`}>
                <QueuePiece piece={piece} faces={faces} partners={state.partners} cards={cards} size={44} />
              </span>
            ))}
          </div>
        </div>
        <div className="ml-auto flex flex-col items-center gap-1">
          <span className="text-micro">Hold</span>
          <span role="group" className="block size-14 rounded-md bg-sunken ring-1 ring-inset ring-hairline" aria-label={`Held: ${describeQueuePiece(state.hold, state.partners, cards)}`} data-racer="yard-held">
            <QueuePiece piece={state.hold} faces={faces} partners={state.partners} cards={cards} size={56} />
          </span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="min-w-16"
          disabled={state.held || closed}
          onClick={() => onMove({ code: YARD_MOVE.hold })}
          aria-label={state.hold < 0 ? 'Hold this piece' : 'Swap with the held piece'}
        >
          {state.hold < 0 ? 'Hold' : 'Swap'}
        </Button>
      </section>
      <p className="sr-only" aria-live="polite">{done ? 'The yard is done.' : ''}</p>
    </div>
  )
}
