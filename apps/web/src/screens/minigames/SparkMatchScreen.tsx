import { SPARK_MATCH_TICKET_COST } from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { getContentAsset, type ContentAsset } from '../../content/runtime'
import { getMinigameHost, type RunReward, type RunTicket } from '../../game/minigame-host'
import {
  SPARK_BOARD_WIDTH,
  SPARK_RUN_MOVES,
  legalSparkMoves,
  playSparkMove,
  sparkAdjacent,
  startSparkRun,
  type SparkRunState,
  type SparkTile,
} from '../../game/minigames/spark-match'
import { useGame } from '../../game/store'
import { useArtSet } from '../../ui/album/useArt'
import { SPARK_TILE_COLOR_NAMES, SparkTileFace } from '../../ui/minigames/SparkTileFace'
import { formatTickets } from '../../ui/tickets'

interface TileIdentity {
  id: string
  label: string
  asset: ContentAsset | null
}

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

export function SparkMatchScreen() {
  const { umaId = '' } = useParams()
  const reducedMotion = useReducedMotion()
  const contentState = useContent()
  const gameStatus = useGame((state) => state.status)
  const uma = useGame((state) => state.umas[umaId])
  const [ticket, setTicket] = useState<RunTicket | null>(null)
  const [run, setRun] = useState<SparkRunState | null>(null)
  const [displayCells, setDisplayCells] = useState<readonly SparkTile[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [hint, setHint] = useState<readonly [number, number] | null>(null)
  const [clearing, setClearing] = useState<ReadonlySet<number>>(new Set())
  const [animating, setAnimating] = useState(false)
  const [message, setMessage] = useState('Match three or more. Invalid swaps are free.')
  const [phase, setPhase] = useState<'ready' | 'reserving' | 'playing' | 'committing' | 'complete'>('ready')
  const [reward, setReward] = useState<RunReward | null>(null)
  const [error, setError] = useState<string | null>(null)
  const animationId = useRef(0)
  const committedRun = useRef<string | null>(null)

  useEffect(() => () => { animationId.current += 1 }, [])

  const cast = useMemo<TileIdentity[]>(() => {
    if (contentState.status !== 'ready' || !uma) return []
    const trainee = contentState.content.umas.byId.get(uma.templateId)
    if (!trainee) return []
    const orderedStarters = contentState.content.umas.items
      .filter((candidate) => candidate.starter && candidate.id !== trainee.id)
      .sort((left, right) => left.id.localeCompare(right.id))
    const fallback = contentState.content.umas.items
      .filter((candidate) => candidate.id !== trainee.id && !orderedStarters.some((starter) => starter.id === candidate.id))
      .sort((left, right) => left.id.localeCompare(right.id))
    return [...orderedStarters, ...fallback].slice(0, 5).concat(trainee).map((template) => ({
      id: template.id,
      label: template.name,
      asset: getContentAsset(contentState.content, 'uma-icons', template.id),
    }))
  }, [contentState, uma])

  useEffect(() => {
    if (cast.length === 6) console.warn('Spark Match scenario tile set unavailable; using the first five starter Umas by id.')
  }, [cast])

  // Tiles are the cast's standing chibis (T059, D161); each icon stands in until its chibi arrives.
  const chibis = useArtSet(contentState.status === 'ready' ? contentState.content : null, 'chibi', cast.map((identity) => `${identity.id}-a`))
  const face = (slot: number) => {
    const identity = cast[slot]!
    return <SparkTileFace slot={slot} chibi={chibis.get(`${identity.id}-a`) ?? null} asset={identity.asset} label={identity.label} />
  }

  const start = async () => {
    if (!uma || phase !== 'ready') return
    setPhase('reserving')
    setError(null)
    try {
      const reserved = await getMinigameHost().beginRun('spark-match', { kind: 'spark-match', umaId })
      const next = startSparkRun(reserved.seed)
      setTicket(reserved)
      setRun(next)
      setDisplayCells(next.board.cells)
      setPhase('playing')
      setMessage(`Run ${reserved.attemptIndex + 1} reserved · 25 moves to make them count.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Spark Match could not begin')
      setPhase('ready')
    }
  }

  const finish = async (reserved: RunTicket, completed: SparkRunState) => {
    if (committedRun.current === reserved.runId) return
    committedRun.current = reserved.runId
    setPhase('committing')
    setMessage('Saving this run…')
    try {
      const nextReward = await getMinigameHost().commitRun(reserved.runId, {
        kind: 'spark-match',
        score: completed.score,
        moves: completed.moves,
      })
      setReward(nextReward)
      setPhase('complete')
    } catch (reason) {
      committedRun.current = null
      setError(reason instanceof Error ? reason.message : 'Spark Match reward could not be saved')
      setPhase('playing')
      setMessage('The board is complete. Retry saving when ready.')
    }
  }

  const chooseTile = async (index: number) => {
    if (phase !== 'playing' || !run || !ticket || animating) return
    setHint(null)
    if (selected === null) {
      setSelected(index)
      setMessage('Now choose a neighboring tile.')
      return
    }
    if (selected === index) {
      setSelected(null)
      setMessage('Selection cleared.')
      return
    }
    if (!sparkAdjacent(selected, index)) {
      setSelected(index)
      setMessage('Tiles must share an edge. This tile is selected instead.')
      return
    }
    const move = playSparkMove(run, selected, index)
    setSelected(null)
    if (!move.accepted) {
      setMessage('No spark there — the move was free. Try another pair.')
      return
    }
    const currentAnimation = ++animationId.current
    setAnimating(true)
    const clearDelay = reducedMotion ? 0 : 150
    const fallDelay = reducedMotion ? 0 : 110
    for (const step of move.steps) {
      if (currentAnimation !== animationId.current) return
      setDisplayCells(step.before)
      setClearing(new Set(step.cleared))
      setMessage(step.cascade === 0
        ? `Spark +${step.rawPoints}`
        : `Cascade ×${step.multiplier.toFixed(2)} · +${step.rawPoints}`)
      await delay(clearDelay)
      if (currentAnimation !== animationId.current) return
      setClearing(new Set())
      setDisplayCells(step.after)
      await delay(fallDelay)
    }
    if (currentAnimation !== animationId.current) return
    setRun(move.state)
    setDisplayCells(move.state.board.cells)
    setMessage(move.reshuffled
      ? `+${move.score} points · no moves remained, so the board reshuffled.`
      : `+${move.score} points · ${SPARK_RUN_MOVES - move.state.moves} moves left.`)
    setAnimating(false)
    if (move.state.status === 'complete') await finish(ticket, move.state)
  }

  const showHint = () => {
    if (!run || phase !== 'playing' || animating) return
    const move = legalSparkMoves(run.board)[0]
    if (!move) return
    setHint([move.from, move.to])
    setSelected(null)
    setMessage('Try the two glowing tiles.')
  }

  const retryCommit = () => {
    if (run?.status === 'complete' && ticket) void finish(ticket, run)
  }

  if (contentState.status !== 'ready' || gameStatus !== 'ready' || !uma || cast.length !== 6) {
    const title = contentState.status === 'signed-out' || gameStatus === 'signed-out'
      ? 'Sign in to play Spark Match'
      : contentState.status === 'empty'
        ? 'Content is not imported'
        : !uma && gameStatus === 'ready'
          ? 'Uma not found'
          : 'Preparing Spark Match…'
    return (
      <div className="flex h-dvh items-center justify-center bg-stage p-5 text-ink-on-dark">
        <div className="max-w-sm text-center"><h1 className="text-xl">{title}</h1><Link to="/stable" className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-display font-semibold text-ink">Back to Stable</Link></div>
      </div>
    )
  }

  const trainee = cast[5]!
  const crossedLevels = reward?.trainingLevelBefore !== undefined && reward.trainingLevelAfter !== undefined
    ? Array.from({ length: Math.max(0, reward.trainingLevelAfter - reward.trainingLevelBefore) }, (_, index) => reward.trainingLevelBefore! + index + 1)
    : []
  const running = phase === 'playing' || phase === 'committing'

  return (
    <div className={`flex h-dvh flex-col bg-stage text-ink-on-dark ${running ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <header className="pt-safe flex min-h-16 shrink-0 items-center gap-3 border-b border-hairline-dark bg-stage/95 px-3 py-2">
        <Link to={`/stable/${encodeURIComponent(umaId)}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-hairline-dark bg-stage-soft text-xl" aria-label="Back to Uma profile">←</Link>
        <div className="h-11 w-11 shrink-0">{face(5)}</div>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold tracking-[0.16em] text-accent uppercase">Spark Match</p><h1 className="truncate text-lg">{trainee.label}</h1></div>
        {run && <div className="text-right"><p className="text-[10px] font-bold text-ink-on-dark-soft uppercase">Score</p><p className="font-display text-xl font-bold text-accent">{run.score.toLocaleString()}</p></div>}
      </header>

      {phase === 'ready' || phase === 'reserving' ? (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-safe">
          <div className="rounded-lg border border-hairline-dark bg-stage-soft p-4 shadow-3">
            <p className="text-xs font-bold tracking-[0.14em] text-accent uppercase">25 moves · no timer</p>
            <h2 className="mt-1 text-3xl">Line up the Stable</h2>
            <p className="mt-2 text-sm text-ink-on-dark-soft">Tap one tile, then a neighbor. Matches score; trainee matches score double. A run costs {formatTickets(SPARK_MATCH_TICKET_COST)} when it begins.</p>
            <div className="mt-5 grid grid-cols-6 gap-2" aria-label="Spark Match tile cast">
              {cast.map((identity, slot) => <div key={identity.id} className="min-w-0">{face(slot)}<p className="mt-1 truncate text-center text-[9px] text-ink-on-dark-soft">{identity.id === trainee.id ? 'Trainee' : identity.label}</p></div>)}
            </div>
            <p className="mt-4 rounded-sm border border-warning/40 bg-warning/10 p-2 text-xs text-ink-on-dark-soft">Scenario tile casts are not published yet. This preview uses the first five starter Umas by id.</p>
            {error && <p role="alert" className="mt-3 rounded-sm bg-danger/20 p-2 text-sm font-semibold text-red-200">{error}</p>}
            <button type="button" disabled={phase === 'reserving'} onClick={() => void start()} className="mt-5 min-h-12 w-full rounded-sm bg-accent px-5 font-display text-lg font-bold text-ink shadow-2 disabled:opacity-50">{phase === 'reserving' ? 'Reserving run…' : `Begin · ${formatTickets(SPARK_MATCH_TICKET_COST)}`}</button>
          </div>
        </main>
      ) : phase === 'complete' && reward && run ? (
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-5 pb-safe">
          <div className="rounded-lg bg-panel p-5 text-ink shadow-3">
            <p className="text-xs font-bold tracking-[0.14em] text-accent-strong uppercase">Run complete</p>
            <h2 className="mt-1 text-3xl">{run.score.toLocaleString()} points</h2>
            <p className="mt-1 text-sm text-ink-soft">{reward.ticketsSpent} tickets spent · attempt {ticket?.attemptIndex !== undefined ? ticket.attemptIndex + 1 : '—'}</p>
            <section className="mt-5 rounded-sm bg-accent-wash p-4">
              <h3 className="text-lg">Training progress</h3>
              {crossedLevels.length > 0 ? <p className="mt-1 font-semibold">Levels crossed: {crossedLevels.map((level) => `TL${level}`).join(' · ')}</p> : <p className="mt-1 font-semibold">Progress banked toward the next Training Level.</p>}
              {reward.trainingLevelAfter !== undefined && <p className="mt-1 text-sm text-ink-soft">Now Training Level {reward.trainingLevelAfter}</p>}
            </section>
            <section className="mt-4">
              <h3 className="text-lg">Constellation nodes opened</h3>
              {reward.nodesUnlocked && reward.nodesUnlocked.length > 0 ? (
                <div className="mt-2 grid gap-2">
                  {reward.nodesUnlocked.map((node, index) => (
                    <Link key={`${node}:${index}`} to={`/constellation/${encodeURIComponent(umaId)}`} className="flex min-h-11 items-center justify-between rounded-sm border border-hairline bg-page px-3 font-semibold"><span>{node}</span><span aria-hidden>→</span></Link>
                  ))}
                </div>
              ) : <p className="mt-1 text-sm text-ink-soft">No node opened this run; every point still carried forward.</p>}
            </section>
            <div className="mt-5 grid grid-cols-2 gap-2"><Link to={`/constellation/${encodeURIComponent(umaId)}`} className="flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel px-3 font-display font-semibold">Constellation</Link><Link to={`/stable/${encodeURIComponent(umaId)}`} className="flex min-h-12 items-center justify-center rounded-sm bg-accent px-3 font-display font-semibold">Uma profile</Link></div>
          </div>
        </main>
      ) : run ? (
        <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col items-center px-3 pb-safe">
          <div className="flex w-full shrink-0 items-center gap-2 py-2">
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between text-xs font-bold"><span>Moves</span><span>{run.moves}/{SPARK_RUN_MOVES}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stage-soft"><div className="h-full w-full origin-left bg-accent transition-transform duration-150" style={{ transform: `scaleX(${run.moves / SPARK_RUN_MOVES})` }} /></div></div>
            <button type="button" disabled={phase !== 'playing' || animating} onClick={showHint} className="min-h-11 rounded-sm border border-hairline-dark bg-stage-soft px-4 text-sm font-bold disabled:opacity-40">Hint</button>
          </div>
          <div className="grid aspect-[7/8] w-full max-w-[358px] shrink grid-cols-7 gap-1 rounded-lg border border-hairline-dark bg-[#0b121a] p-1 shadow-3" aria-label="Spark Match board">
            {displayCells.map((tile, index) => {
              const identity = cast[tile]!
              const active = selected === index
              const hinted = hint?.includes(index) ?? false
              const isClearing = clearing.has(index)
              return (
                <m.button
                  key={index}
                  type="button"
                  disabled={phase !== 'playing' || animating}
                  onClick={() => void chooseTile(index)}
                  aria-label={`${identity.label} (${SPARK_TILE_COLOR_NAMES[tile]}), row ${Math.floor(index / SPARK_BOARD_WIDTH) + 1}, column ${index % SPARK_BOARD_WIDTH + 1}`}
                  aria-pressed={active}
                  className={`relative aspect-square min-h-11 min-w-0 rounded-full p-px ${active ? 'z-10 bg-white shadow-[0_0_0_3px_rgb(255_255_255_/_0.9)]' : hinted ? 'bg-white/70 shadow-[0_0_14px_rgb(255_255_255_/_0.8)]' : ''}`}
                  animate={{ opacity: isClearing ? 0 : 1, scale: isClearing ? 0.7 : active ? 1.06 : 1 }}
                  whileTap={reducedMotion ? undefined : { scale: 0.94 }}
                  transition={{ duration: reducedMotion ? 0 : 0.14 }}
                >
                  {face(tile)}
                  {tile === 5 && <span className="absolute right-0 bottom-0 rounded-sm bg-accent px-1 text-[8px] font-black text-ink">2×</span>}
                </m.button>
              )
            })}
          </div>
          <div className="flex min-h-24 w-full flex-1 flex-col justify-center py-2 text-center">
            <p aria-live="polite" className="text-sm font-semibold text-ink-on-dark">{message}</p>
            <p className="mt-1 text-xs text-ink-on-dark-soft">Trainee tiles carry the gold 2× marker.</p>
            {error && <div><p role="alert" className="mt-2 text-sm font-semibold text-red-200">{error}</p><button type="button" onClick={retryCommit} className="mt-2 min-h-11 rounded-sm bg-accent px-5 font-bold text-ink">Retry save</button></div>}
          </div>
        </main>
      ) : null}
    </div>
  )
}
