// A career race's run and result (docs/game/11-hub-and-places.md §6; D387), full screen at
// `/career/careers/:careerId/race/:operationId`. It plays the committed race: the `raceResults` row the operation wrote
// under its id holds the run (the course, the seed and every runner by gate with her stats, aptitudes and skills), so
// the engine's input is rebuilt from it exactly and `@racer/race`'s `simulateRace` replays the same race, which the
// PixiJS race scene (lazy) plays back with the HUD (phase, metres to go, her place and HP), the feed, pause, 1× or 2×
// (this phone's default) and Skip. A reload or a reopen lands on the same race. The result reads the operation's
// receipt: her place, the objective's status or the round's, what the win paid, and the field in finishing order.
// A loss offers **Retry** at once (the next attempt, a new seeded race); a win **Continue**s to her career, and winning
// the final shows her completion's tickets first. Nothing here reads a clock: the scene keeps its own playback time.
import { useLeave } from '@luismlorenzana/uma-kit/shell'
import { Button, CloseIcon, IconButton, PauseIcon, PlayIcon, SkipIcon, useReducedMotionSetting } from '@luismlorenzana/uma-kit/ui'
import { COURSE_ROTATION, type RaceRun } from '@racer/domain'
import { FINALE_ROUND_NAMES, FINALE_ROUNDS, type RunFinaleReceipt, type RunRaceReceipt } from '@racer/domain/career'
import type { RaceResultRecord } from '@racer/domain/save'
import { formatMargin, simulateRace, type RaceInput, type RaceTimeline } from '@racer/race'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useLoadedContent } from '../../app/content'
import { useGame, useRuntime } from '../../app/game'
import { careerPath, racePath } from '../../hub/nav'
import { holdRaceBusts } from '../../race/art'
import { STRATEGY_LABEL } from '../../race/labels'
import { RaceFeed } from '../../race/RaceFeed'
import { UmaBust } from '../../race/UmaBust'
import type { RaceHudState, RaceScene, SceneRunner } from '../../scenes/race/RaceScene'
import { TURN_RACE_RATE } from '../../scenes/race/presentation'
import { useWakeLock } from '../../stages/wakeLock'
import { Meter } from '../../ui/Meter'
import { raceSpeed, RACE_SPEEDS, startingSpeed } from '../../ui/devicePrefs'
import { TicketsEarned } from './Completion'
import { careersWords, nextAttempt, ordinal, type CareersWord } from './model'

type RaceReceipt = RunRaceReceipt | RunFinaleReceipt

const isFinaleReceipt = (receipt: RaceReceipt): receipt is RunFinaleReceipt => 'round' in receipt
const PLAYER_COLOR = 0xffc42e
const RIVAL_COLORS = [0x5b8def, 0xef6f6c, 0x8e6cef, 0x3cb4a4, 0xf29e4c, 0x6c8ea4, 0xd96fb6, 0x7bbf4a]
const PHASES: readonly CareersWord[] = ['phase-0', 'phase-1', 'phase-2', 'phase-3']

/** The engine's input, rebuilt from a stored run: the field by gate, as the operation prepared it. */
export interface Replay {
  readonly input: RaceInput
  readonly playerIndex: number
  /** Each gate's Uma. */
  readonly umaIds: readonly string[]
}

export function replayOf(run: RaceRun): Replay {
  const byGate = [...run.field].sort((a, b) => a.gate - b.gate)
  const course = run.course as RaceInput['course']
  return {
    input: {
      course,
      seed: run.seed,
      runners: byGate.map((runner) => ({
        id: runner.umaId, label: String(runner.gate + 1), stats: { ...runner.stats }, strategy: runner.strategy, gate: runner.gate,
        aptitude: { ...runner.aptitude }, skills: [...(runner.skills ?? [])],
      })),
    },
    playerIndex: byGate.findIndex((runner) => runner.isPlayer),
    umaIds: byGate.map((runner) => runner.umaId),
  }
}

function Message({ text, onBack }: { text: string; onBack: () => void }) {
  return (
    <div className="pt-safe pb-safe flex min-h-full flex-col items-center justify-center gap-4 bg-page px-6 text-center" data-racer="race-run" data-phase="missing">
      <p className="text-[15px]">{text}</p>
      <Button size="lg" onClick={onBack}>{careersWords('run-back')}</Button>
    </div>
  )
}

export default function RunPage({ careerId, operationId }: { careerId: string; operationId: string }) {
  const { game } = useRuntime()
  const navigate = useNavigate()
  const leave = useLeave()
  const reducedMotion = useReducedMotionSetting()
  const content = useLoadedContent()
  const career = useGame((snapshot) => snapshot.state?.careers[careerId])
  const env = useGame((snapshot) => snapshot.env)
  const [loaded, setLoaded] = useState<{ readonly row: RaceResultRecord | null; readonly receipt: RaceReceipt | null } | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RaceScene | null>(null)
  const [artScene, setArtScene] = useState<RaceScene | null>(null)
  const rateRef = useRef(1)
  const [hud, setHud] = useState<RaceHudState | null>(null)
  const [speed, setSpeed] = useState(() => startingSpeed(RACE_SPEEDS, raceSpeed()))
  const [paused, setPaused] = useState(false)
  const [showResult, setShowResult] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The committed race and its receipt, read once from the save's logs.
  useEffect(() => {
    let live = true
    void Promise.all([
      game.logs?.raceResult(operationId) ?? Promise.resolve(null),
      game.logs?.receipt(operationId) ?? Promise.resolve(null),
    ]).then(([row, receipt]) => {
      if (live) setLoaded({ row, receipt: (receipt ?? null) as RaceReceipt | null })
    }).catch(() => {
      if (live) setLoaded({ row: null, receipt: null })
    })
    return () => {
      live = false
    }
  }, [game, operationId])

  const replay = useMemo(() => (loaded?.row ? replayOf(loaded.row.run) : null), [loaded])
  const timeline = useMemo((): RaceTimeline | null => (replay === null ? null : simulateRace(replay.input)), [replay])
  const race = loaded?.row ? env?.content.races.find((each) => each.id === loaded.row!.raceId) : undefined

  useEffect(() => {
    const host = hostRef.current
    if (host === null || replay === null || timeline === null) return
    setHud(null)
    const runners: SceneRunner[] = replay.input.runners.map((runner, index) => ({
      label: runner.label,
      color: index === replay.playerIndex ? PLAYER_COLOR : RIVAL_COLORS[index % RIVAL_COLORS.length]!,
      isPlayer: index === replay.playerIndex,
      lane: runner.gate,
    }))
    // PixiJS loads with the scene, only once there is a committed race to play.
    let live = true
    let scene: RaceScene | null = null
    void import('../../scenes/race/RaceScene').then(({ RaceScene: Scene }) => {
      if (!live) return
      scene = new Scene(timeline, runners, replay.playerIndex, setHud, () => setShowResult(true), reducedMotion,
        replay.input.course.layout, replay.input.course.rotation ?? (race ? COURSE_ROTATION[race.direction] : undefined))
      sceneRef.current = scene
      setArtScene(scene)
      scene.setSpeed(rateRef.current)
      if (import.meta.env.DEV) (window as unknown as { __raceScene?: RaceScene }).__raceScene = scene
      void scene.mount(host)
    }).catch(() => {
      if (live) setShowResult(true)
    })
    return () => {
      live = false
      scene?.destroy()
      sceneRef.current = null
    }
    // The scene is built once per committed race; content refreshes never rebuild it mid-race.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, timeline, reducedMotion])

  useEffect(() => {
    if (artScene === null || replay === null || content === null) return
    const art = holdRaceBusts(content.art, replay.umaIds)
    let live = true
    void art.urls.then((urls) => {
      if (live) void artScene.setBusts(urls)
    })
    return () => {
      live = false
      art.release()
    }
  }, [artScene, content, replay])

  const turnRace = timeline?.tickRate === 1
  const rate = paused ? 0 : speed * (turnRace ? TURN_RACE_RATE : 1)
  rateRef.current = rate
  useEffect(() => {
    sceneRef.current?.setSpeed(rate)
  }, [rate, artScene])
  useWakeLock(!showResult && timeline !== null)

  const back = () => leave(careerPath(careerId))
  const skip = () => {
    if (sceneRef.current === null) setShowResult(true)
    else sceneRef.current.skipToEnd()
  }

  if (loaded === null || env === null) return <div className="min-h-full bg-page" data-racer="race-run" data-phase="loading" />
  const { row, receipt } = loaded
  if (row === null || replay === null || timeline === null) return <Message text={careersWords('no-run')} onBack={back} />

  const name = (umaId: string) => env.content.umas.get(umaId)?.name ?? umaId
  const placement = row.placement
  const won = placement === 1
  const finale = row.kind === 'finale'
  const round = receipt !== null && isFinaleReceipt(receipt) ? receipt.round : career?.finale.step ?? 0
  const title = finale ? FINALE_ROUND_NAMES[FINALE_ROUNDS[round] ?? 'final'] : race?.name ?? row.raceId
  const completed = receipt !== null && isFinaleReceipt(receipt) && receipt.completed
  const open = career !== undefined && career.completedAt === null && (finale
    ? career.finale.step === round
    : career.objectives.some((objective) => objective.raceId === row.raceId && objective.status === 'open' && objective.season === career.season))
  const status = finale
    ? won ? completed ? careersWords('final-won') : careersWords('round-won', { round: FINALE_ROUND_NAMES[FINALE_ROUNDS[round + 1] ?? 'final'] }) : careersWords('not-won')
    : won ? careersWords('objective-won') : careersWords('not-won')
  const reward = receipt?.reward ?? null

  const retry = async () => {
    if (career === undefined || retrying) return
    setRetrying(true)
    setError(null)
    try {
      const rows = await (game.logs?.raceResults(career.umaId) ?? Promise.resolve([]))
      const attempt = nextAttempt(rows, careerId, row.kind, row.raceId, receipt?.attempt ?? null)
      const answer = finale
        ? await game.run('run-finale', { careerId, round, attempt, strategy: row.run.strategy }, `race:${careerId}`)
        : await game.run('run-race', { careerId, raceId: row.raceId, attempt, strategy: row.run.strategy }, `race:${careerId}`)
      if (answer.kind === 'done') navigate(racePath(careerId, answer.id), { replace: true, state: { back: true } })
      else setError(answer.text)
    } catch {
      setError(careersWords('race-failed'))
    } finally {
      setRetrying(false)
    }
  }

  const position = hud?.playerPosition ?? null
  const remaining = hud === null ? row.run.course.distance : Math.max(0, row.run.course.distance - hud.playerDistance)
  return (
    <div className="fixed inset-0 flex flex-col bg-stage text-ink-on-dark" data-racer="race-run" data-phase={showResult ? 'result' : 'running'} data-placement={placement}>
      <div className="pt-safe px-3">
        <div className="flex items-center gap-2 py-2">
          <IconButton aria-label={careersWords('run-back')} onClick={back} className="text-ink-on-dark"><CloseIcon size={24} /></IconButton>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-display text-lg font-semibold leading-tight" data-racer="run-title">{title}</p>
            <p className="text-[12px] font-semibold text-ink-on-dark-soft">{row.run.course.distance.toLocaleString('en-US')} m · {STRATEGY_LABEL[row.run.strategy]}</p>
          </div>
          <IconButton aria-label={careersWords('skip')} onClick={skip} disabled={showResult} className="text-ink-on-dark"><SkipIcon size={24} variant="solid" /></IconButton>
        </div>
        <div className="flex items-center justify-between rounded-md bg-scrim/40 px-3 py-1.5 text-[14px] font-semibold">
          <m.span key={hud?.phase ?? 0} initial={reducedMotion ? false : { x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
            {careersWords(PHASES[hud?.phase ?? 0] ?? 'phase-0')}
          </m.span>
          <span className="numeral">{careersWords('meters-left', { m: Math.round(remaining) })}</span>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="absolute inset-0 overflow-hidden" data-racer="race-host" />
        {hud !== null && content !== null && <RaceFeed cues={hud.cues} seconds={hud.seconds} content={content} runners={replay.umaIds.map((id, i) => ({ templateId: id, isPlayer: i === replay.playerIndex }))} />}
      </div>

      <div className="pb-safe px-3">
        <div className="mb-2 flex items-center gap-3 rounded-md bg-panel p-3 text-ink shadow-2">
          <span className="w-14 font-display text-2xl font-semibold" aria-label={position === null ? undefined : ordinal(position)}>{position === null ? '-' : ordinal(position)}</span>
          <span className="min-w-0 flex-1" aria-label={`${careersWords('hp')} ${Math.round((hud?.playerHp ?? 1) * 100)}%`}>
            <span aria-hidden className="mb-1 block text-[12px] font-semibold text-ink-soft">{careersWords('hp')}</span>
            <Meter value={hud?.playerHp ?? 1} color="var(--color-success)" height={10} motion="linear" />
          </span>
          <IconButton aria-label={careersWords(paused ? 'play-run' : 'pause')} onClick={() => setPaused((now) => !now)} disabled={showResult}>
            {paused ? <PlayIcon size={24} variant="solid" /> : <PauseIcon size={24} variant="solid" />}
          </IconButton>
          <div role="group" aria-label={careersWords('speed')} className="flex gap-1">
            {RACE_SPEEDS.map((value) => (
              <button key={value} type="button" aria-pressed={speed === value} onClick={() => { setSpeed(value); setPaused(false) }}
                className={`min-h-11 min-w-11 rounded-full border-2 text-[14px] font-semibold ${speed === value ? 'border-accent bg-accent text-accent-ink' : 'border-hairline-strong bg-panel'}`}>
                {value}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showResult && (
          <m.div className="fixed inset-0 z-40 flex flex-col bg-scrim/50" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}
            data-racer="race-result" data-won={won} data-completed={completed}>
            <m.div
              className="pb-safe mt-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-lg border-t border-hairline bg-panel px-4 pt-4 text-ink"
              initial={reducedMotion ? false : { y: '100%' }}
              animate={{ y: 0 }}
              transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
            >
              <div className="flex items-center gap-3">
                <UmaBust outfitId={row.umaId} size={72} />
                <div className="min-w-0">
                  <m.p className={`font-display text-5xl font-bold leading-none ${won ? 'text-accent-strong' : 'text-ink'}`} data-racer="placement"
                    initial={reducedMotion ? false : { scale: 1.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 14 }}>
                    {won ? careersWords('win') : ordinal(placement)}
                  </m.p>
                  <p className="mt-1 text-[14px] font-semibold" data-racer="race-status">{status}</p>
                  <p className="truncate text-[12px] text-ink-soft">{title}</p>
                </div>
              </div>
              {reward !== null && !completed && (reward.cardTickets > 0 || reward.sp > 0) && (
                <ul className="mt-3 flex flex-wrap gap-2 text-[14px] font-semibold" aria-label={careersWords('earned')} data-racer="reward">
                  {reward.cardTickets > 0 && <li className="rounded-full bg-accent-wash px-3 py-1">{careersWords('earned-card', { n: reward.cardTickets })}</li>}
                  {reward.sp > 0 && <li className="rounded-full bg-accent-wash px-3 py-1">{careersWords('earned-sp', { n: reward.sp })}</li>}
                </ul>
              )}
              {completed && (
                <div className="mt-3 space-y-2">
                  <TicketsEarned />
                  <p className="rounded-sm bg-sunken px-3 py-2 text-[14px] font-semibold">{careersWords('next-scenario')}</p>
                </div>
              )}
              <section aria-label={careersWords('finishing-order')} className="mt-3">
                <h3 className="text-micro">{careersWords('finishing-order')}</h3>
                <ol className="mt-1 max-h-[30dvh] overflow-y-auto rounded-md border border-hairline">
                  {row.run.field.map((runner) => (
                    <li key={runner.gate} className={`flex min-h-11 items-center gap-2 border-b border-hairline px-2 py-1 last:border-b-0 ${runner.isPlayer ? 'bg-accent-wash' : ''}`}
                      data-runner={runner.umaId} data-placement={runner.placement}>
                      <span className="numeral w-6 text-center font-semibold">{runner.placement}</span>
                      <UmaBust outfitId={runner.umaId} size={32} />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{name(runner.umaId)}</span>
                      <span className="shrink-0 text-[12px] text-ink-soft">{runner.placement === 1 ? '' : formatMargin(runner.marginLengths)}</span>
                    </li>
                  ))}
                </ol>
              </section>
              <div className="sticky bottom-0 grid gap-2 bg-panel py-3">
                {error !== null && <p role="alert" className="text-[13px] text-danger">{error}</p>}
                {!won && open ? (
                  <>
                    <Button size="lg" onClick={() => void retry()} disabled={retrying} data-racer="retry">{careersWords('retry')}</Button>
                    <Button size="lg" variant="secondary" onClick={back}>{careersWords('run-back')}</Button>
                  </>
                ) : (
                  <Button size="lg" onClick={back} data-racer="continue">{careersWords('continue')}</Button>
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
