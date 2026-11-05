// Furlong Hand's view (docs/game/09-furlong-hand.md §11, D385), its own lazy chunk: DOM and Motion, no canvas. The top
// 40% is the race: the leg strip from her objective's real course, the place ladder with her face and the rivals' (each
// rival's next move under it, her band shaded), and her bust with Breath and Drive. The bottom 60% is her hand: before
// each spread the line (three large buttons, and the next spread's front cards she may peek at); in a leg the spread's
// four columns, the lead and the draw pile. Tap a front card to run it; swipe it down (or turn Bank on) to bank it.
// The spurt has its own moment. Every target is 44 pt or more; moves animate with transform and opacity only, and
// reduced motion keeps the moves without the flourish.
import { Button } from '@luismlorenzana/uma-kit/ui'
import {
  canRedraw, DRIVE_BASE, DRIVE_MAX, FURLONG_MOVE, isSpurt, LENGTH, LINE, placings, playableColumns, railClosed, terrainAt,
  type FurlongState,
} from '@racer/domain/stages'
import { m } from 'motion/react'
import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { useGame } from '../../app/game'
import type { StageViewProps } from '../views'
import { CardBack, CardFace, describeCard, type CardContent } from './cards'
import { favoured, HerGauges, Ladder, LegStrip, placeWord, TERRAIN_WORD } from './race'

/** A swipe this far down a front card banks it. */
export const SWIPE_BANK = 32
/** How far each card behind the front shows. */
const PEEK_STEP = 22
const CARD_HEIGHT = 92

function spreadWord(state: FurlongState): string {
  if (isSpurt(state)) return `The spurt · ${TERRAIN_WORD[state.spurtTerrain]}`
  return `Leg ${state.spread + 1} of ${state.legs.length} · ${TERRAIN_WORD[terrainAt(state, state.spread)]}, ${favoured(terrainAt(state, state.spread))} favoured`
}

function LineChoice({ state, onMove, closed, content }: { state: FurlongState; onMove: StageViewProps['onMove']; closed: boolean; content: CardContent }) {
  const shut = railClosed(state, state.spread)
  const terrain = terrainAt(state, state.spread)
  const shown = Math.max(0, state.peeked)
  const options = [
    { line: LINE.rail, name: 'Rail', words: shut ? 'A rival is closing it: column 1 starts shut until a Power or Wit card plays' : `${favoured(terrain)} +1 on the inside` },
    { line: LINE.middle, name: 'Middle', words: 'As it comes' },
    { line: LINE.outside, name: 'Outside', words: 'Speed +1, −1 Breath, never shut' },
  ]
  return (
    <div className="flex flex-1 flex-col gap-3" data-racer="furlong-line">
      <p className="text-[14px] font-semibold">{state.spread === 0 ? 'From the gate: pick a line' : isSpurt(state) ? 'Into the home stretch: pick a line' : `Before leg ${state.spread + 1}: pick a line`}</p>
      <div className="grid grid-cols-4 gap-2" aria-label={shown > 0 ? `The next spread's front cards: ${shown} shown` : 'The next spread, face down'} role="group" data-racer="furlong-peek">
        {state.columns.map((column, c) => (
          <span key={c} className="block h-16 w-full" aria-label={c < shown ? describeCard(state, column.at(-1)!, content) : 'Face down'} role="img">
            {c < shown ? <CardFace state={state} index={column.at(-1)!} content={content} /> : <CardBack />}
          </span>
        ))}
      </div>
      <div className="mt-auto grid gap-2">
        {options.map((option) => (
          <Button
            key={option.name}
            size="lg"
            variant={option.line === LINE.rail && shut ? 'secondary' : 'primary'}
            disabled={closed}
            onClick={() => onMove({ code: FURLONG_MOVE.line, x: option.line })}
            className="!h-auto min-h-14 flex-col !items-start !py-2 text-left"
            aria-label={`${option.name}: ${option.words}`}
          >
            <span className="text-[16px] font-bold">{option.name}</span>
            <span className="text-[12px] font-normal opacity-80">{option.words}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

function Spread({ state, onMove, closed, bankMode, reducedMotion, content }: {
  state: FurlongState
  onMove: StageViewProps['onMove']
  closed: boolean
  bankMode: boolean
  reducedMotion: boolean
  content: CardContent
}) {
  const playable = new Set(playableColumns(state))
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const pop = reducedMotion ? false : { scale: 0.85, opacity: 0 }
  const down = (event: PointerEvent) => {
    start.current = { x: event.clientX, y: event.clientY }
    swiped.current = false
  }
  const up = (column: number) => (event: PointerEvent) => {
    const from = start.current
    start.current = null
    if (from === null || closed || !playable.has(column)) return
    if (event.clientY - from.y >= SWIPE_BANK) {
      swiped.current = true
      onMove({ code: FURLONG_MOVE.bank, x: column })
    }
  }
  const tap = (column: number) => () => {
    if (swiped.current) {
      swiped.current = false
      return
    }
    onMove({ code: bankMode ? FURLONG_MOVE.bank : FURLONG_MOVE.run, x: column })
  }
  const depth = Math.max(...state.columns.map((column) => column.length), 1)
  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="The spread" data-racer="furlong-spread" style={{ minHeight: CARD_HEIGHT + PEEK_STEP * (depth - 1) }}>
      {state.columns.map((column, c) => {
        const blocked = c === state.blocked
        return (
          <div key={c} className="relative" data-column={c} aria-label={`Column ${c + 1}${blocked ? ', shut by the rail' : ''}`} role="group">
            {column.map((card, i) => {
              const front = i === column.length - 1
              const top = i * PEEK_STEP
              if (!front) {
                return (
                  <span key={card} className="absolute inset-x-0 block" style={{ top, height: CARD_HEIGHT }} role="img" aria-label={describeCard(state, card, content)}>
                    <CardFace state={state} index={card} content={content} />
                  </span>
                )
              }
              const can = playable.has(c) && !closed
              const words = describeCard(state, card, content)
              return (
                <m.button
                  key={card}
                  type="button"
                  className={`absolute inset-x-0 block min-h-11 min-w-11 touch-none rounded-md ${can ? 'shadow-2' : ''} disabled:cursor-default`}
                  style={{ top, height: CARD_HEIGHT }}
                  initial={pop}
                  animate={{ scale: 1, opacity: can ? 1 : 0.6 }}
                  transition={{ duration: 0.16 }}
                  disabled={!can}
                  onPointerDown={down}
                  onPointerUp={up(c)}
                  onClick={tap(c)}
                  aria-label={`${words}${blocked ? ', shut by the rail' : can ? (bankMode ? ': tap to bank' : ': tap to run, swipe down to bank') : ', does not follow the lead'}`}
                  data-front={c}
                >
                  <CardFace state={state} index={card} content={content} />
                </m.button>
              )
            })}
            {blocked && <span className="absolute inset-x-0 top-0 rounded-md bg-scrim/60 py-1 text-center text-[11px] font-semibold text-ink-on-dark" aria-hidden>Shut</span>}
          </div>
        )
      })}
    </div>
  )
}

function Leg({ state, onMove, closed, reducedMotion, content }: {
  state: FurlongState
  onMove: StageViewProps['onMove']
  closed: boolean
  reducedMotion: boolean
  content: CardContent
}) {
  const [bankMode, setBankMode] = useState(false)
  const stuck = playableColumns(state).length === 0
  const redraw = canRedraw(state)
  const chainLeft = Math.max(0, 4 - state.chain)
  return (
    <div className="flex flex-1 flex-col gap-3" data-racer="furlong-leg">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-soft" aria-live="polite">
        <span data-racer="furlong-chain">Chain <span className="numeral font-semibold text-ink">{state.chain}</span>{state.chainPaid ? ' · Drive paid' : chainLeft > 0 ? ` · ${chainLeft} more for Drive` : ''}</span>
        {state.rainbow > 0 && <span className="font-semibold text-accent-strong" data-racer="furlong-rainbow">Rainbow: next {state.rainbow} double</span>}
        <span>{state.pile.length} to draw</span>
      </div>
      <Spread state={state} onMove={onMove} closed={closed} bankMode={bankMode} reducedMotion={reducedMotion} content={content} />
      <div className="mt-auto flex items-end gap-2" data-racer="furlong-actions">
        <div className="flex flex-col items-center gap-1">
          <span className="text-micro">Lead</span>
          <span className="block h-[72px] w-14" role="img" aria-label={`Lead: ${describeCard(state, state.lead, content)}`} data-racer="furlong-lead">
            <CardFace state={state} index={state.lead} content={content} />
          </span>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2">
          <Button
            size="lg"
            variant={stuck ? 'primary' : 'secondary'}
            disabled={closed || state.pile.length === 0}
            onClick={() => onMove({ code: FURLONG_MOVE.flip })}
            aria-label="Flip a draw card as the lead, for 1 Breath"
          >
            Flip −1
          </Button>
          <Button
            size="lg"
            variant={bankMode ? 'primary' : 'secondary'}
            aria-pressed={bankMode}
            disabled={closed}
            onClick={() => setBankMode((on) => !on)}
            aria-label="Bank: taps bank cards for Drive"
          >
            Bank
          </Button>
          {redraw && (
            <Button size="lg" variant="secondary" className="col-span-2" disabled={closed} onClick={() => onMove({ code: FURLONG_MOVE.redraw })} aria-label="Redraw this spread, free, once">
              Redraw (free)
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Finish({ state, umaId, nameOf }: { state: FurlongState; umaId: string; nameOf: (id: string) => string }) {
  const { her, rivals } = placings(state.ground, state.rivalGround)
  const leader = Math.max(...state.rivalGround)
  const margin = Math.abs(state.ground - leader) / LENGTH
  const winner = her === 1 ? umaId : state.rivals[rivals.indexOf(1)]!.umaId
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center" data-racer="furlong-finish" role="status">
      <p className="font-display text-3xl font-bold">{placeWord(her)}</p>
      <p className="text-[14px] text-ink-soft">
        {her === 1 ? `${margin.toFixed(1)} lengths clear` : `${nameOf(winner)} won; you were ${margin.toFixed(1)} lengths behind`}
      </p>
    </div>
  )
}

export default function FurlongView({ config, state, onMove, reducedMotion, locked }: StageViewProps<FurlongState>) {
  const umas = useGame((snapshot) => snapshot.env?.content.umas ?? null)
  const cards = useGame((snapshot) => snapshot.env?.content.cards ?? null)
  const skills = useGame((snapshot) => snapshot.env?.content.skills ?? null)
  const content = useMemo<CardContent>(() => ({ cards, skills }), [cards, skills])
  const nameOf = (id: string) => umas?.get(id)?.name ?? 'A rival'
  const umaId = config.uma.id
  const closed = locked || state.phase === 'finished'
  const spurt = isSpurt(state) && state.phase !== 'finished'
  const times = (DRIVE_BASE + Math.min(DRIVE_MAX, state.drive)) / DRIVE_BASE
  const race = config.furlong?.race
  return (
    <div className="flex flex-1 flex-col px-4 pb-3" data-racer="furlong">
      <section className="flex basis-[40%] flex-col gap-2 pb-2" aria-label="The race" data-racer="furlong-race">
        <p className="truncate text-[12px] text-ink-soft">{race === undefined ? 'Prep heat' : `Prep heat: ${race.name} · ${race.meters.toLocaleString('en-US')} m`}</p>
        <LegStrip state={state} />
        <Ladder state={state} umaId={umaId} nameOf={nameOf} />
        <HerGauges state={state} umaId={umaId} name={nameOf(umaId)} />
      </section>

      <section className="flex basis-[60%] flex-col gap-2 border-t border-hairline pt-2" aria-label="Your hand" data-racer="furlong-hand">
        {spurt && (
          <m.div
            key="spurt"
            className="flex items-center justify-between rounded-md bg-stage px-3 py-2 text-ink-on-dark"
            initial={reducedMotion ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            data-racer="furlong-spurt"
            role="status"
          >
            <span className="font-display text-[18px] font-bold">The spurt</span>
            <span className="numeral text-[14px]">Drive ×{times.toFixed(1)} on every run card</span>
          </m.div>
        )}
        {state.phase !== 'finished' && <p className="text-[13px] font-semibold" data-racer="furlong-spread-word">{spreadWord(state)}</p>}
        {state.phase === 'line' && <LineChoice state={state} onMove={onMove} closed={closed} content={content} />}
        {state.phase === 'leg' && <Leg key={`${state.spread}`} state={state} onMove={onMove} closed={closed} reducedMotion={reducedMotion} content={content} />}
        {state.phase === 'finished' && <Finish state={state} umaId={umaId} nameOf={nameOf} />}
      </section>
      <p className="sr-only" aria-live="polite">{state.phase === 'finished' ? `You finished ${placeWord(placings(state.ground, state.rivalGround).her)}.` : ''}</p>
    </div>
  )
}

