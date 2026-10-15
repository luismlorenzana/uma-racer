// The run and its result (T141 "Run", "Result"; docs/game/09-racing-rewards-and-exchange.md §7, §8; 11 §6), full
// screen at `/racing/racecourse/run?result=:id`. It always plays a committed result: the `raceResults` row's run,
// rebuilt and simulated on engine v9, so a reload or a reopen lands on the same race. Today's RaceRunScreen behaviour,
// ported: the PixiJS scene (lazy, with this chunk), HUD, feed, speeds, step, pause, Skip, the wake lock and
// `window.__raceScene` in dev builds. The result reads the row's receipt, so a reload shows exactly what was paid; only
// the first showing on this device plays the fanfare, and the prize flies into the Prize Money chip, shown alone.
import { badgeStateId, COURSE_ROTATION } from '@racer/domain'
import { formatMargin } from '@racer/race'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { buildFlairFanfare, buildTrainerFlairFanfare } from '../flair-view'
import { buildResultGoalView } from '../goals-view'
import type { RaceHudState, RaceScene, SceneRunner } from '../../../scenes/race/RaceScene'
import { staminaStory, TURN_RACE_RATE, type RacePresentationStage } from '../../../scenes/race/presentation'
import { Button } from '../../../ui/Button'
import { FlairCards } from '../../../ui/FlairCards'
import { ChevronLeftIcon, ChevronRightIcon, HonorsIcon, PauseIcon, PlayIcon, RibbonIcon, SkipIcon } from '../../../ui/icons'
import { Meter } from '../../../ui/Meter'
import { useGame, useRuntime } from '../../../app/game'
import { useLeave } from '../../../hub/nav'
import { AnimatedNumber } from '../../../ui/AnimatedNumber'
import { CoinIcon } from '../../../ui/icons'
import { UmaFace } from '../../../ui/UmaArt'
import { useRaceContent } from '../content'
import { eventsOfCommit } from '../flair'
import { replayOf, simulate } from '../prepare'
import { useRecords } from '../records'
import { startRace, takeFanfare } from '../race'
import { recordOf, rowsOf, umaSaveOf } from '../today'
import { canAdvance, featuredView, finishLines, gradeWords, holdLine, localDayAt, nextUma, prizeLines, stripOrder } from '../view'
import { amount, ordinal, racingWords } from '../words'
import { RaceFeed } from './RaceFeed'
import { STRATEGY_LABEL } from './labels'

const PHASES = ['phase-opening', 'phase-middle', 'phase-final', 'phase-spurt'] as const
const TURN_SPEEDS = [{ value: 1 / 3, label: racingWords('slow') }, { value: 1, label: racingWords('speed-1') }, { value: 2, label: racingWords('speed-2') }] as const
const TIME_SPEEDS = [{ value: 1, label: racingWords('speed-1') }, { value: 2, label: racingWords('speed-2') }] as const
const RIVAL_COLORS = [0x5b8def, 0xef6f6c, 0x8e6cef, 0x3cb4a4, 0xf29e4c, 0x6c8ea4, 0xd96fb6, 0x7bbf4a]
const CONFETTI = Array.from({ length: 14 }, (_, index) => ({
  left: 7 + (index * 37) % 88,
  x: ((index * 29) % 70) - 35,
  y: 65 + (index * 23) % 90,
  color: ['#ffc42e', '#ff5a5f', '#2fa8f5', '#8e6cef', '#2ec27e'][index % 5]!,
}))

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`

function stageBanner(stage: RacePresentationStage, runners: number, raceName: string): { eyebrow: string; title: string } | null {
  if (stage === 'field') return { eyebrow: racingWords('banner-runners', { n: runners }), title: raceName }
  if (stage === 'staged') return { eyebrow: racingWords('banner-gates'), title: racingWords('banner-set') }
  if (stage === 'ready') return { eyebrow: racingWords('banner-ready'), title: racingWords('banner-ready-title') }
  if (stage === 'go') return { eyebrow: racingWords('banner-start'), title: racingWords('banner-go') }
  if (stage === 'photo') return { eyebrow: racingWords('banner-finish'), title: racingWords('banner-photo') }
  return null
}

function Message({ title, action }: { title: string; action: { label: string; onClick: () => void } }) {
  return (
    <div className="game-surface fixed inset-0 flex items-center justify-center bg-gradient-to-b from-page to-turf px-6 pt-safe pb-safe">
      <div className="w-full max-w-sm rounded-lg border border-hairline bg-panel/95 p-5 text-center shadow-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="mt-5"><Button size="lg" onClick={action.onClick}>{action.label}</Button></div>
      </div>
    </div>
  )
}

export default function RunPage() {
  const navigate = useNavigate()
  const reducedMotion = Boolean(useReducedMotion())
  const [params] = useSearchParams()
  const resultId = params.get('result') ?? ''
  const { game } = useRuntime()
  const status = useGame((snapshot) => snapshot.status)
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const records = useRecords()
  const content = useRaceContent()
  const row = records?.raceResults[resultId]
  const [fresh] = useState(() => takeFanfare(resultId))
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RaceScene | null>(null)
  const [hud, setHud] = useState<RaceHudState | null>(null)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [showResults, setShowResults] = useState(!fresh)
  const [again, setAgain] = useState<'idle' | 'busy' | 'failed'>('idle')

  const replay = useMemo(() => (row ? replayOf(row) : null), [row])
  const timeline = useMemo(() => (replay ? simulate(replay) : null), [replay])
  const race = row && content ? content.races.byId.get(row.raceId) : undefined

  useEffect(() => {
    const host = hostRef.current
    if (!host || !replay || !timeline) return
    setHud(null)
    const runners: SceneRunner[] = replay.input.runners.map((runner, index) => ({
      label: runner.label,
      color: index === replay.playerIndex ? 0xff8a3d : RIVAL_COLORS[index % RIVAL_COLORS.length]!,
      isPlayer: index === replay.playerIndex,
      lane: runner.gate,
    }))
    // PixiJS loads with the scene, only once there is a committed race to play.
    let live = true
    let scene: RaceScene | null = null
    void import('../../../scenes/race/RaceScene').then(({ RaceScene: Scene }) => {
      if (!live) return
      scene = new Scene(timeline, runners, replay.playerIndex, setHud, () => setShowResults(true), reducedMotion,
        replay.input.course.layout, replay.input.course.rotation ?? (race ? COURSE_ROTATION[race.direction] : undefined))
      sceneRef.current = scene
      if (!fresh) scene.seek(Number.POSITIVE_INFINITY)
      if (import.meta.env.DEV) (window as unknown as { __raceScene?: RaceScene }).__raceScene = scene
      void scene.mount(host)
    })
    return () => {
      live = false
      scene?.destroy()
      sceneRef.current = null
    }
    // The scene is built once per committed race; content refreshes never rebuild it mid-race.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replay, timeline, reducedMotion])

  const turnRace = timeline?.tickRate === 1
  useEffect(() => {
    sceneRef.current?.setSpeed(paused ? 0 : speed * (turnRace ? TURN_RACE_RATE : 1))
  }, [paused, speed, timeline, turnRace])
  const step = (direction: -1 | 1) => {
    const scene = sceneRef.current
    if (!scene) return
    const at = scene.position
    scene.seek(direction > 0 ? Math.floor(at + 1e-6) + 1 : Math.max(0, Math.ceil(at - 1e-6) - 1))
  }

  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    navigator.wakeLock?.request('screen').then((value) => { lock = value }).catch(() => undefined)
    return () => void lock?.release()
  }, [])

  const leave = useLeave()
  // Back where the run was opened from (race select), else to race select on her.
  const toRaces = (umaId: string) => leave(`/racing/racecourse?uma=${encodeURIComponent(umaId)}`)
  if (status === 'booting' || content === null || records === null) return null
  if (!row || !replay || !timeline || !race || !state || !env) {
    return <Message title={racingWords('no-result')} action={{ label: racingWords('races'), onClick: () => navigate('/racing/racecourse', { replace: true }) }} />
  }

  const uma = state.umas[row.umaId]
  const template = content.umas.byId.get(row.umaId)
  const her = timeline.results.find((result) => result.runner === replay.playerIndex)!
  const placement = row.run.field.find((runner) => runner.isPlayer)!.placement
  const remaining = hud ? Math.max(0, race.distance - hud.playerDistance) : race.distance
  const banner = hud ? stageBanner(hud.stage, replay.input.runners.length, race.name) : null
  const stamina = staminaStory(timeline, replay.playerIndex)
  const hudSeconds = hud?.seconds ?? 0
  const running = hud?.stage === 'running' || hud?.stage === 'photo' || hud?.stage === 'finished'
  const emptyNow = running && stamina.emptySeconds !== null && hudSeconds >= stamina.emptySeconds && (hud?.playerHp ?? 1) <= 0.001
  const spurtNow = running && stamina.spurtSeconds !== null && hudSeconds >= stamina.spurtSeconds
  const hpNote = emptyNow ? { text: racingWords('hp-out'), tone: 'text-danger', color: '#ff5a5f' }
    : spurtNow && !stamina.fullSpurt ? { text: racingWords('hp-held'), tone: 'text-warning', color: '#f0a92e' }
      : spurtNow ? { text: racingWords('hp-full'), tone: 'text-accent-strong', color: 'linear-gradient(90deg,#2ec27e,#8be07a)' }
        : null

  // The result, from the stored row alone, except what reads her now: the hold and Advance, for her latest race.
  const rows = rowsOf(records.raceResults, row.umaId)
  const latest = rows.at(-1)?.opId === row.opId
  const finish = finishLines(row.commit, row.commit.grade, placement)
  const prize = prizeLines(row.commit.prize, row.commit.grade, placement)
  const hold = latest && uma ? holdLine(uma) : null
  const advance = latest && uma !== undefined && canAdvance(uma)
  const record = recordOf(row, rows.findIndex((entry) => entry.opId === row.opId))
  const goals = uma ? buildResultGoalView(record, umaSaveOf(uma), content, fresh) : null
  const events = eventsOfCommit(records, row.umaId, row.at)
  const badge = records.badges[badgeStateId(row.umaId)]
  const flair = badge?.scope === 'uma' ? buildFlairFanfare(content, badge, events, events.filter((event) => event.scope === 'uma').map((event) => event.id)) : []
  const trainer = records.badges.trainer
  const trainerFlair = trainer?.scope === 'trainer' ? buildTrainerFlairFanfare(content, trainer, events, events.map((event) => event.id)) : []
  const balance = state.profile.prizeMoney
  const animate = fresh && !reducedMotion
  const name = (umaId: string) => content.umas.byId.get(umaId)?.name ?? umaId

  const raceAgain = async () => {
    if (again === 'busy') return
    setAgain('busy')
    const now = game.now()
    const localDay = localDayAt(now, game.utcOffsetMin(now))
    const answer = await startRace({
      game, state, env, content, umaId: row.umaId, raceId: row.raceId, strategy: row.run.strategy, localDay,
      board: featuredView(state.profile, localDay, content.races.items).board,
    })
    if (answer.kind === 'done') navigate(`/racing/racecourse/run?result=${encodeURIComponent(answer.id)}`, { replace: true })
    else setAgain('failed')
  }
  const next = () => {
    const now = game.now()
    const strip = stripOrder(state, name, now, game.utcOffsetMin(now))
    navigate(`/racing/racecourse?uma=${encodeURIComponent(nextUma(strip, row.umaId) ?? row.umaId)}`, { replace: true })
  }

  return (
    <div className="game-surface fixed inset-0 flex flex-col bg-gradient-to-b from-page via-page-deep to-turf" data-g2="race-run">
      <div className="pt-safe px-3">
        <div className="flex items-center justify-between gap-2 py-2">
          <button type="button" onClick={() => toRaces(row.umaId)} className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-panel/85" aria-label={racingWords('back-to-races')}>
            <ChevronLeftIcon size={20} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-lg leading-tight font-semibold text-white text-outline">{race.name}</p>
            <p className="text-xs font-semibold text-white/90 text-outline">{gradeWords(race.grade)} · {race.distance}m · {STRATEGY_LABEL[row.run.strategy]}</p>
          </div>
          <button type="button" onClick={() => sceneRef.current?.skipToEnd()} className="flex h-11 min-w-11 items-center justify-center rounded-full border border-hairline bg-panel/85 px-2" aria-label={racingWords('skip')}>
            <SkipIcon size={20} variant="solid" />
          </button>
        </div>
        <div className="flex items-center justify-between rounded-md border border-hairline/80 bg-ink/35 px-3 py-1.5 text-white">
          <div className="min-w-0">
            <m.p key={hud?.phase ?? 0} initial={reducedMotion ? false : { x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={`font-semibold ${hud?.phase === 3 ? 'text-accent' : ''}`}>
              {racingWords(PHASES[hud?.phase ?? 0] ?? 'phase-opening')}
            </m.p>
            {hud?.courseLabel && <p className="text-[10px] font-bold text-white/80">{hud.courseLabel}</p>}
          </div>
          <div className="text-right">
            {hud?.turn != null && hud.turns != null && <p className="text-xs font-semibold tabular-nums">{racingWords('turn-of', { turn: hud.turn, turns: hud.turns })}</p>}
            <p className="font-semibold tabular-nums">{racingWords('meters-left', { m: Math.round(remaining) })}</p>
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <m.div
          ref={hostRef}
          className="absolute inset-0 overflow-hidden"
          animate={!reducedMotion && hud?.phase === 3 && hud.stage === 'running' ? { scale: 1.015, opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
        {hud && banner && (
          <div className="pointer-events-none absolute inset-x-0 top-[12%] z-20 flex justify-center px-6">
            <div key={hud.stage} className={`race-banner-in max-w-full rounded-2xl px-4 py-1.5 text-center shadow-2 ${hud.stage === 'photo' ? 'bg-accent text-ink' : 'bg-ink/80 text-white'}`}>
              <p className={`text-[10px] font-bold tracking-widest uppercase ${hud.stage === 'photo' ? 'text-ink/75' : 'text-accent'}`}>{banner.eyebrow}</p>
              <p className="truncate text-lg leading-6 font-semibold">{banner.title}</p>
            </div>
          </div>
        )}
        {hud && <RaceFeed cues={hud.cues} seconds={hud.seconds} content={content} runners={replay.runners} />}
      </div>

      <div className="pb-safe px-3">
        <div className="mb-2 rounded-md border border-hairline bg-panel/90 p-3 shadow-2">
          <div className="relative mb-3 h-3 rounded-full bg-ink/10">
            {(hud?.shares ?? replay.input.runners.map(() => 0)).map((share, index) => (
              <span
                key={index}
                className={`absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border border-hairline ${index === replay.playerIndex ? 'z-10 h-4 w-4 bg-[#ff8a3d]' : 'h-2.5 w-2.5 bg-ink/45'}`}
                style={{ left: `${Math.min(1, share) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 text-2xl font-semibold tabular-nums">{hud ? ordinal(hud.playerPosition) : '—'}</span>
            <div className="flex-1">
              <p className="mb-1 flex justify-between gap-2 text-xs font-semibold text-ink-soft">
                <span>{racingWords('hp')}</span>
                {hpNote && <span className={`truncate font-bold ${hpNote.tone}`}>{hpNote.text}</span>}
              </p>
              <Meter value={hud?.playerHp ?? 1} color={hpNote?.color ?? 'linear-gradient(90deg,#2ec27e,#8be07a)'} height={12} motion="linear" />
            </div>
            <span className="w-16 text-right text-sm font-semibold tabular-nums text-ink-soft">{formatTime(hud?.seconds ?? 0)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => step(-1)} disabled={!paused || hud?.stage !== 'running'} aria-label={racingWords('step-back')} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-hairline-strong bg-panel disabled:opacity-35"><ChevronLeftIcon size={20} /></button>
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                disabled={!hud || hud.finished}
                aria-label={racingWords(paused ? 'play' : 'pause')}
                className={`flex h-11 w-11 items-center justify-center rounded-full border-2 disabled:opacity-35 ${paused ? 'border-accent bg-accent text-ink' : 'border-hairline-strong bg-panel'}`}
              >{paused ? <PlayIcon size={20} variant="solid" /> : <PauseIcon size={20} variant="solid" />}</button>
              <button type="button" onClick={() => step(1)} disabled={!paused || hud?.stage !== 'running'} aria-label={racingWords('step-on')} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-hairline-strong bg-panel disabled:opacity-35"><ChevronRightIcon size={20} /></button>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label={racingWords('playback-speed')}>
              {(turnRace ? TURN_SPEEDS : TIME_SPEEDS).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => { setSpeed(option.value); setPaused(false) }}
                  aria-pressed={speed === option.value && !paused}
                  className={`h-11 min-w-11 rounded-full border-2 px-2 text-sm font-semibold ${speed === option.value && !paused ? 'border-accent bg-accent text-ink' : 'border-hairline-strong bg-panel'}`}
                >{option.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showResults && (
          <m.div className="fixed inset-0 z-40 flex flex-col bg-ink/45" initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} data-g2="race-result" data-fanfare={fresh ? "yes" : "no"}>
            <div className="pt-safe flex justify-end px-3 py-2">
              <span className="relative flex min-h-11 items-center" aria-label={racingWords('prize-money')} role="status">
                <span className="flex h-8 items-center gap-1 rounded-full border border-hairline bg-panel/95 px-2 text-[13px] text-ink shadow-1">
                  <CoinIcon size={20} variant="duotone" />
                  <span className="font-display font-semibold"><ChipBalance balance={balance} added={prize.total} animate={animate} /></span>
                </span>
                {animate && prize.total > 0 && (
                  <m.span
                    aria-hidden
                    className="font-display absolute top-full right-2 rounded-full bg-accent px-2 text-[13px] font-bold text-ink shadow-1"
                    initial={{ y: 160, opacity: 0 }}
                    animate={{ y: [160, 120, 0], opacity: [0, 1, 0] }}
                    transition={{ duration: 1.1, delay: 0.7, times: [0, 0.2, 1] }}
                  >+{amount(prize.total)}</m.span>
                )}
              </span>
            </div>
            <m.div
              className="pb-safe relative mt-auto max-h-[calc(100dvh-4rem)] w-full overflow-y-auto rounded-t-lg border-t-2 border-hairline bg-panel px-4 pt-4"
              initial={animate ? { y: '100%' } : false}
              animate={{ y: 0 }}
              transition={animate ? { type: 'spring', stiffness: 380, damping: 34 } : { duration: 0 }}
            >
              {placement === 1 && animate && CONFETTI.map((piece, index) => (
                <m.i
                  key={index}
                  aria-hidden="true"
                  className="pointer-events-none absolute top-12 z-10 h-3 w-2 rounded-sm"
                  style={{ left: `${piece.left}%`, backgroundColor: piece.color }}
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                  animate={{ x: piece.x, y: piece.y, rotate: 240 + index * 31, opacity: 0 }}
                  transition={{ duration: 1.1 + (index % 3) * 0.15, delay: index * 0.025 }}
                />
              ))}
              <m.p
                className={`text-center text-6xl font-semibold text-outline ${placement === 1 ? 'text-accent' : 'text-accent-strong'}`}
                initial={animate ? { scale: 2.2, rotate: -10, opacity: 0 } : false}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={animate ? { type: 'spring', stiffness: 300, damping: 12, delay: 0.1 } : { duration: 0 }}
              >
                {placement === 1 ? racingWords('winner') : ordinal(placement)}
              </m.p>
              <p className="mt-1 text-center text-sm font-semibold text-ink-soft">{racingWords('result-time', { name: template?.name ?? row.umaId, time: formatTime(her.finishTime) })}</p>

              <section aria-label={racingWords('finishing-order')} className="mt-3">
                <ol className="max-h-[24dvh] overflow-y-auto rounded-md border border-hairline bg-panel">
                  {row.run.field.map((runner, index) => (
                    <m.li
                      key={`${runner.gate}:${runner.umaId}`}
                      initial={animate ? { x: 30, opacity: 0 } : false}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: animate ? 0.2 + index * 0.025 : 0 }}
                      className={`flex min-h-11 items-center gap-3 border-b border-ink/5 px-3 py-1.5 ${runner.isPlayer ? 'bg-accent/20' : ''}`}
                    >
                      <span className="w-7 font-semibold tabular-nums">{runner.placement}</span>
                      <UmaFace outfitId={runner.umaId} size={32} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{runner.isPlayer ? '★ ' : ''}{name(runner.umaId)}<span className="ml-2 text-xs text-ink-soft">{STRATEGY_LABEL[runner.strategy]}</span></span>
                      <span className="text-sm text-ink-soft">{formatMargin(runner.marginLengths)}</span>
                    </m.li>
                  ))}
                </ol>
              </section>

              <section aria-label={racingWords('racing-exp')} className="mt-3 rounded-md bg-sunken px-3 py-2">
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{racingWords('racing-exp')}</p>
                <p className="font-display text-lg font-semibold text-accent-strong" data-result-exp>{finish.exp}</p>
                {finish.levels.map((line) => (
                  <m.p key={line} className="font-display inline-block rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-ink" initial={animate ? { scale: 0.6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ delay: animate ? 0.5 : 0, type: animate ? 'spring' : undefined }}>
                    {line}
                  </m.p>
                ))}
                {hold && <p className="mt-1 text-[13px] font-semibold text-ink-soft">{hold}</p>}
                {finish.shard && <p className="mt-1 text-[13px] font-semibold text-accent-strong">{finish.shard}</p>}
              </section>

              <section aria-label={racingWords('prize-money')} className="mt-2 rounded-md bg-sunken px-3 py-2">
                <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">{racingWords('prize-money')}</p>
                <p className="font-display text-lg font-semibold" data-result-prize>{prize.main}</p>
                {prize.lines.map((line) => <p key={line} className="text-[13px] font-semibold text-ink-soft">{line}</p>)}
              </section>

              {goals && goals.completions.length > 0 && (
                <section aria-label={racingWords('goals')} className="mt-3 grid gap-2">
                  {goals.completions.map((goal, index) => (
                    <m.div
                      key={goal.id}
                      className="rounded-md border-2 border-accent bg-gradient-to-r from-accent-wash to-panel px-4 py-3 text-center"
                      initial={goals.animate && !reducedMotion ? { scaleX: 0.25, opacity: 0 } : false}
                      animate={{ scaleX: 1, opacity: 1 }}
                      transition={goals.animate && !reducedMotion ? { delay: 0.35 + index * 0.3, type: 'spring', stiffness: 320, damping: 22 } : { duration: 0 }}
                    >
                      <p className="text-xs font-semibold tracking-widest text-accent-strong uppercase">{racingWords('goal-complete', { stage: goal.label })}</p>
                      <p className="mt-1 flex items-center justify-center gap-1.5 text-lg font-semibold"><RibbonIcon size={20} className="text-accent-strong" />{goal.raceName}</p>
                      <p className="text-xs font-bold text-ink-soft">{racingWords('goals-progress', { won: goals.completed, total: goals.total })}</p>
                      {goal.pips.length > 0 && (
                        <p className="mt-1 flex justify-center gap-1" aria-hidden>
                          {goal.pips.map((pip) => <span key={pip.key} className={`h-2 w-5 rounded-full ${pip.status === 'completed' ? 'bg-accent' : 'bg-ink/15'}`} />)}
                        </p>
                      )}
                    </m.div>
                  ))}
                  {goals.honors && <p className="flex items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2 text-center font-semibold text-white text-outline"><HonorsIcon size={20} />{racingWords('honors', { total: goals.total })}</p>}
                </section>
              )}

              {flair.length > 0 && <div className="mt-3"><FlairCards title={racingWords(fresh ? 'flair-earned' : 'flair-stored')} items={flair} animate={animate} /></div>}
              {trainerFlair.length > 0 && <div className="mt-3"><FlairCards title={racingWords('trainer-flair')} items={trainerFlair} animate={animate} /></div>}

              {again === 'failed' && <p role="alert" className="mt-3 rounded-sm bg-danger/10 px-3 py-2 text-center text-[13px] font-semibold text-danger">{racingWords('that-failed')}</p>}
              <div className={`mt-3 grid gap-2 pb-4 ${advance ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {advance && (
                  <Button className="col-span-2" onClick={() => navigate(`/racing/scenario-gate/${encodeURIComponent(row.umaId)}?sheet=advance`)}>{racingWords('advance')}</Button>
                )}
                <Button variant="secondary" onClick={() => toRaces(row.umaId)}>{racingWords('races')}</Button>
                <Button variant="secondary" disabled={again === 'busy'} onClick={() => void raceAgain()}>{racingWords(again === 'busy' ? 'starting' : 'race-again')}</Button>
                <Button variant={advance ? 'secondary' : 'primary'} className={advance ? 'col-span-2' : ''} onClick={next}>{racingWords('next-uma')}</Button>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The Prize Money chip's balance: on the fanfare it moves from before this race's prize to after, once it lands. */
function ChipBalance({ balance, added, animate }: { balance: number; added: number; animate: boolean }) {
  const [shown, setShown] = useState(animate ? balance - added : balance)
  useEffect(() => {
    if (!animate) {
      setShown(balance)
      return
    }
    const timer = setTimeout(() => setShown(balance), 1500)
    return () => clearTimeout(timer)
  }, [animate, balance])
  return <AnimatedNumber value={shown} />
}

