import { COURSE_ROTATION, LEVELS_PER_SCENARIO, SCENARIOS, STRATEGIES, awaitingAdvance, badgeStateId, expToNextUmaLevel, isGateLevel, type RaceResultRecord, type RaceSkillEffectKind, type Strategy } from '@racer/domain'
import { formatMargin, type RaceTimeline } from '@racer/race'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { completeRace, prepareRace } from '../../game/actions'
import { buildResultGoalView } from '../../game/goals-view'
import { buildFlairFanfare, buildTrainerFlairFanfare } from '../../game/flair-view'
import { preparedRaceFromRecord, simulatePreparedRace, type PreparedRace } from '../../game/racing'
import { useGame } from '../../game/store'
import { RaceScene, type RaceHudState, type SceneRunner } from '../../scenes/race/RaceScene'
import { summarizePlayerActivations, type RaceCue } from '../../scenes/race/presentation'
import { GameButton } from '../../ui/GameButton'
import { FlairCards } from '../../ui/FlairCards'
import { Meter } from '../../ui/Meter'
import { UmaBust } from '../../ui/UmaBust'
import { GRADE_LABEL, STRATEGY_LABEL } from './labels'

const PHASES = ['Opening', 'Middle leg', 'Final leg', 'Last spurt']
/**
 * Turn races (engine v6, M021) play two turns a second at 1×, so a 2,400 m race runs in about a minute; Slow plays a
 * turn in 1.5 s. Older, time-based replays keep real time at 1×.
 */
const TURN_RACE_RATE = 2
const TURN_SPEEDS = [{ value: 1 / 3, label: 'Slow' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }] as const
const TIME_SPEEDS = [{ value: 1, label: '1×' }, { value: 2, label: '2×' }] as const
const RIVAL_COLORS = [0x5b8def, 0xef6f6c, 0x8e6cef, 0x3cb4a4, 0xf29e4c, 0x6c8ea4, 0xd96fb6, 0x7bbf4a]

const ordinal = (value: number) => {
  const suffix = ['th', 'st', 'nd', 'rd']
  const mod = value % 100
  return `${value}${suffix[(mod - 20) % 10] ?? suffix[mod] ?? 'th'}`
}
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
const CONFETTI = Array.from({ length: 14 }, (_, index) => ({
  left: 7 + (index * 37) % 88,
  x: ((index * 29) % 70) - 35,
  y: 65 + (index * 23) % 90,
  color: ['#ffc42e', '#ff5a5f', '#2fa8f5', '#8e6cef', '#2ec27e'][index % 5]!,
}))

const effectLabel = (effects: readonly RaceSkillEffectKind[]) => {
  const labels: string[] = []
  if (effects.includes('recovery')) labels.push('Stamina recovery')
  if (effects.some((effect) => effect === 'current-speed' || effect === 'current-speed-natural' || effect === 'target-speed')) labels.push('Speed boost')
  if (effects.includes('acceleration')) labels.push('Acceleration')
  if (effects.some((effect) => effect.startsWith('passive-'))) labels.push('Stat boost')
  if (effects.includes('start-delay')) labels.push('Quick start')
  return labels.join(' · ') || 'Activated'
}

function cueText(cue: RaceCue, skillName: string | null, rivalName: string): { eyebrow: string; title: string } {
  if (cue.kind === 'skill') return {
    eyebrow: cue.isPlayer ? 'Your skill' : rivalName,
    title: `${skillName ?? cue.skillId ?? 'Skill'}${cue.additionalCount ? ` · +${cue.additionalCount} rival skill${cue.additionalCount === 1 ? '' : 's'}` : ''}`,
  }
  if (cue.kind === 'late-start') return cue.isPlayer
    ? { eyebrow: 'Start', title: 'Slow start!' }
    : { eyebrow: 'Field start', title: `${cue.additionalCount + 1} rivals started late` }
  if (cue.kind === 'spurt') return { eyebrow: 'Final drive', title: 'Last spurt!' }
  if (cue.kind === 'duel') return { eyebrow: 'Final straight', title: `Duel with ${rivalName}` }
  const eyebrow = cue.packKind === 'Spot struggle' ? 'Early race'
    : cue.packKind === 'Securing lead' || cue.packKind === 'Repositioning' || cue.packKind === 'Saving stamina' ? 'Before the spurt'
      : 'Pack'
  return { eyebrow, title: cue.packKind ?? 'Pack change' }
}

function FullScreenMessage({
  title,
  detail,
  action,
}: {
  title: string
  detail: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="game-surface fixed inset-0 flex items-center justify-center bg-gradient-to-b from-sky-top to-turf px-6 pt-safe pb-safe">
      <div className="w-full max-w-sm rounded-[1.75rem] border-2 border-white bg-white/95 p-5 text-center shadow-[var(--shadow-panel)]">
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{detail}</p>
        {action && <div className="mt-5"><GameButton variant="go" size="lg" onClick={action.onClick}>{action.label}</GameButton></div>}
      </div>
    </div>
  )
}

/** Full-screen saved-Uma race and atomic results flow (docs/design/racing.md). */
export function RaceRunScreen() {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [params] = useSearchParams()
  const queryUmaId = params.get('uma') ?? ''
  const contentState = useContent()
  const gameStatus = useGame((state) => state.status)
  const gameError = useGame((state) => state.error)
  const savedUma = useGame((state) => state.umas[queryUmaId])
  const badges = useGame((state) => state.badges)
  const flairEvents = useGame((state) => state.flairEvents)
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RaceScene | null>(null)
  // The scene reads content for the runners' faces without being rebuilt when content refreshes mid-race.
  const contentRef = useRef(contentState.status === 'ready' ? contentState.content : null)
  contentRef.current = contentState.status === 'ready' ? contentState.content : null
  const recordRef = useRef<RaceResultRecord | null>(null)
  const finishingRef = useRef(false)
  const [attempt, setAttempt] = useState<PreparedRace | null>(null)
  const [timeline, setTimeline] = useState<RaceTimeline | null>(null)
  const [record, setRecord] = useState<RaceResultRecord | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [hud, setHud] = useState<RaceHudState | null>(null)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [againBusy, setAgainBusy] = useState(false)
  const [freshGoalCommit, setFreshGoalCommit] = useState(false)

  const umaId = queryUmaId
  const raceId = params.get('race') ?? ''
  const strategyParam = params.get('strategy') ?? ''
  const strategy = (STRATEGIES as readonly string[]).includes(strategyParam) ? strategyParam as Strategy : null
  const sequenceText = params.get('sequence')
  const sequence = sequenceText !== null ? Number(sequenceText) : Number.NaN
  const validQuery = Boolean(umaId && raceId && strategy && Number.isSafeInteger(sequence) && sequence >= 0)

  useEffect(() => {
    recordRef.current = record
  }, [record])

  useEffect(() => {
    if (contentState.status !== 'ready' || gameStatus !== 'ready') return
    if (!validQuery || !strategy) {
      setLoadError('This race link is incomplete or invalid.')
      return
    }
    let cancelled = false
    setAttempt(null)
    setTimeline(null)
    setRecord(null)
    recordRef.current = null
    setLoadError(null)
    setCommitError(null)
    setShowResults(false)
    setAgainBusy(false)
    setFreshGoalCommit(false)
    finishingRef.current = false
    void prepareRace(umaId, raceId, strategy, sequence).then((preparation) => {
      if (cancelled || contentState.status !== 'ready') return
      if (preparation.status === 'completed') {
        const replay = preparedRaceFromRecord(contentState.content, preparation.record)
        setAttempt(replay)
        setTimeline(simulatePreparedRace(replay))
        setRecord(preparation.record)
        recordRef.current = preparation.record
        setShowResults(true)
      } else {
        setAttempt(preparation.attempt)
        setTimeline(simulatePreparedRace(preparation.attempt))
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setLoadError(reason instanceof Error ? reason.message : 'Could not prepare race')
    })
    return () => { cancelled = true }
  }, [contentState, gameStatus, raceId, sequence, strategy, umaId, validQuery])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !attempt || !timeline) return
    setHud(null)
    const runners: SceneRunner[] = attempt.input.runners.map((runner, index) => ({
      label: runner.label,
      color: index === attempt.playerIndex ? 0xff8a3d : RIVAL_COLORS[index % RIVAL_COLORS.length]!,
      isPlayer: index === attempt.playerIndex,
      lane: runner.gate,
    }))
    const finish = () => {
      if (recordRef.current) {
        setShowResults(true)
        return
      }
      if (finishingRef.current) return
      finishingRef.current = true
      setCommitting(true)
      setCommitError(null)
      void completeRace(attempt).then((completion) => {
        recordRef.current = completion.record
        setRecord(completion.record)
        setFreshGoalCommit(!completion.alreadyRecorded)
        setShowResults(true)
      }).catch((reason: unknown) => {
        setCommitError(reason instanceof Error ? reason.message : 'Could not save race result')
        setShowResults(true)
        finishingRef.current = false
      }).finally(() => setCommitting(false))
    }
    const scene = new RaceScene(
      timeline,
      runners,
      attempt.playerIndex,
      setHud,
      finish,
      Boolean(reducedMotion),
      attempt.input.course.layout,
      // Engine v5 records carry the course's rotation; older ones take it from the race.
      attempt.input.course.rotation ?? (race ? COURSE_ROTATION[race.direction] : undefined),
    )
    sceneRef.current = scene
    if (recordRef.current) scene.seek(Number.POSITIVE_INFINITY)
    if (import.meta.env.DEV) (window as unknown as { __raceScene?: RaceScene }).__raceScene = scene
    void scene.mount(host)
    // Each runner's face (T059), by her character; the numbered dot stays until it arrives, or if there is none.
    const content = contentRef.current
    if (content) {
      void Promise.all(attempt.runners.map((runner) => {
        const chara = content.umas.byId.get(runner.templateId)?.charaId
        return chara && content.art.has('face', chara) ? content.art.load('face', chara).catch(() => null) : Promise.resolve(null)
      })).then((urls) => scene.setFaces(urls))
    }
    return () => {
      scene.destroy()
      sceneRef.current = null
    }
  }, [attempt, reducedMotion, timeline])

  const turnRace = timeline?.tickRate === 1
  useEffect(() => {
    sceneRef.current?.setSpeed(paused ? 0 : speed * (turnRace ? TURN_RACE_RATE : 1))
  }, [paused, speed, timeline, turnRace])
  // Step one turn (a second on older replays) while paused, landing on turn boundaries.
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

  if (contentState.status === 'signed-out' || gameStatus === 'signed-out') {
    return <FullScreenMessage title="Sign in to race" detail="This progression race belongs to your private save." action={{ label: 'Race Select', onClick: () => navigate('/race') }} />
  }
  if (contentState.status === 'error') return <FullScreenMessage title="Content unavailable" detail={contentState.error.message} action={{ label: 'Race Select', onClick: () => navigate('/race') }} />
  if (gameStatus === 'error') return <FullScreenMessage title="Save needs attention" detail={gameError ?? 'The local save could not be opened.'} action={{ label: 'Race Select', onClick: () => navigate('/race') }} />
  if (loadError) return <FullScreenMessage title="Race could not start" detail={loadError} action={{ label: 'Race Select', onClick: () => navigate(`/race?uma=${encodeURIComponent(umaId)}`) }} />
  if (contentState.status !== 'ready' || gameStatus !== 'ready' || !attempt || !timeline) {
    return <FullScreenMessage title="Preparing race…" detail="Building the deterministic field from your current Uma." />
  }

  const content = contentState.content
  const race = content.races.byId.get(attempt.raceId)
  const playerTemplate = content.umas.byId.get(attempt.umaId)
  if (!race || !playerTemplate) {
    return <FullScreenMessage title="Race content changed" detail="The prepared race references content that is no longer available." action={{ label: 'Race Select', onClick: () => navigate('/race') }} />
  }
  const playerTimelineResult = timeline.results.find((result) => result.runner === attempt.playerIndex)!
  const remaining = hud ? Math.max(0, race.distance - hud.playerDistance) : race.distance
  const orderedField = record?.field ?? timeline.results.map((result) => ({
    umaId: attempt.runners[result.runner]!.templateId,
    isPlayer: result.runner === attempt.playerIndex,
    strategy: attempt.input.runners[result.runner]!.strategy,
    gate: attempt.input.runners[result.runner]!.gate,
    stats: attempt.input.runners[result.runner]!.stats,
    aptitude: attempt.input.runners[result.runner]!.aptitude,
    placement: result.placement,
    finishTime: result.finishTime,
    marginLengths: result.marginLengths,
  }))
  const umaExpTarget = savedUma ? expToNextUmaLevel(savedUma.level + (isGateLevel(savedUma.level) ? 1 : 0)) : 1
  // Racing closes at the gate only once her career has nothing left to win there (D137).
  const closed = Boolean(savedUma && awaitingAdvance(savedUma))
  const finalTier = Boolean(savedUma && savedUma.level >= SCENARIOS.length * LEVELS_PER_SCENARIO)
  const promote = closed && !finalTier
  const activeCue = hud?.activeCue ?? null
  const activeCueRunner = activeCue ? attempt.runners[activeCue.runner] : undefined
  const activeCueText = activeCue ? cueText(
    activeCue,
    activeCue.skillId ? content.skills.byId.get(activeCue.skillId)?.name ?? null : null,
    content.umas.byId.get(activeCueRunner?.templateId ?? '')?.name ?? 'Rival skill',
  ) : null
  const activationSummary = summarizePlayerActivations(timeline, attempt.playerIndex)
  const goalResult = record && savedUma ? buildResultGoalView(record, savedUma, content, freshGoalCommit) : null
  const badgeState = badges[badgeStateId(attempt.umaId)]
  const earnedFlair = record?.earnedFlairEventIds && badgeState?.scope === 'uma'
    ? buildFlairFanfare(content, badgeState, flairEvents, record.earnedFlairEventIds)
    : []
  const trainerState = badges.trainer
  const trainerEarnedFlair = record?.earnedFlairEventIds && trainerState?.scope === 'trainer'
    ? buildTrainerFlairFanfare(content, trainerState, flairEvents, record.earnedFlairEventIds)
    : []

  const retryCommit = () => {
    if (committing || record) return
    finishingRef.current = true
    setCommitting(true)
    setCommitError(null)
    void completeRace(attempt).then((completion) => {
      recordRef.current = completion.record
      setRecord(completion.record)
      setFreshGoalCommit(!completion.alreadyRecorded)
    }).catch((reason: unknown) => {
      setCommitError(reason instanceof Error ? reason.message : 'Could not save race result')
      finishingRef.current = false
    }).finally(() => setCommitting(false))
  }

  const raceAgain = async () => {
    if (againBusy || !record) return
    setAgainBusy(true)
    setCommitError(null)
    try {
      const next = await prepareRace(attempt.umaId, attempt.raceId, attempt.strategy)
      if (next.status !== 'prepared') throw new Error('Could not create the next race attempt')
      navigate(`/race/run?uma=${encodeURIComponent(attempt.umaId)}&race=${encodeURIComponent(attempt.raceId)}&strategy=${attempt.strategy}&sequence=${next.attempt.sequence}`, { replace: true })
    } catch (reason) {
      setCommitError(reason instanceof Error ? reason.message : 'Could not prepare another race')
      setAgainBusy(false)
    }
  }

  return (
    <div className="game-surface fixed inset-0 flex flex-col bg-gradient-to-b from-sky-top via-[#bfe6ff] to-turf">
      <div className="pt-safe px-3">
        <div className="flex items-center justify-between gap-2 py-2">
          <button
            type="button"
            onClick={() => navigate(`/race?uma=${encodeURIComponent(attempt.umaId)}`)}
            disabled={committing}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-white/85 text-xl font-extrabold disabled:opacity-50"
            aria-label="Back"
          >‹</button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-lg leading-tight font-extrabold text-white text-outline">{race.name}</p>
            <p className="text-xs font-extrabold text-white/90 text-outline">{GRADE_LABEL[race.grade]} · {race.distance}m · {STRATEGY_LABEL[attempt.strategy]}</p>
          </div>
          <button type="button" onClick={() => sceneRef.current?.skipToEnd()} className="h-11 min-w-11 rounded-full border-2 border-white bg-white/85 px-2 text-sm font-extrabold" aria-label="Skip">⏭</button>
        </div>
        <div className="flex items-center justify-between rounded-2xl border-2 border-white/80 bg-ink/35 px-3 py-1.5 text-white">
          <div className="min-w-0">
            <m.p key={hud?.phase ?? 0} initial={reducedMotion ? false : { x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={`font-extrabold ${hud?.phase === 3 ? 'text-gold' : ''}`}>
              {PHASES[hud?.phase ?? 0]}
            </m.p>
            {hud?.courseLabel && <p className="text-[10px] font-bold text-white/80">{hud.courseLabel}</p>}
          </div>
          <div className="text-right">
            {hud?.turn != null && hud.turns != null && (
              <p className="text-xs font-extrabold tabular-nums">Turn {hud.turn} / {hud.turns}</p>
            )}
            <p className="font-extrabold tabular-nums">{Math.round(remaining)}m left</p>
          </div>
        </div>
      </div>

      <m.div
        ref={hostRef}
        className="relative min-h-0 flex-1 overflow-hidden"
        animate={!reducedMotion && hud?.phase === 3 && hud.stage === 'running' ? { scale: 1.015, opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      />

      <AnimatePresence mode="wait">
        {hud && ['field', 'staged', 'ready', 'go'].includes(hud.stage) && (
          <m.div
            key={hud.stage}
            className="pointer-events-none absolute inset-x-5 top-[28%] z-20 rounded-[1.5rem] border-2 border-white bg-ink/80 px-5 py-4 text-center text-white shadow-[var(--shadow-panel)]"
            initial={reducedMotion ? false : { scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { scale: 1.04, opacity: 0 }}
          >
            <p className="text-xs font-extrabold uppercase tracking-widest text-gold">
              {hud.stage === 'field' ? `${attempt.input.runners.length} runners` : hud.stage === 'staged' ? 'At the gates' : hud.stage === 'ready' ? 'Ready' : 'Start'}
            </p>
            <p className="mt-1 text-2xl font-extrabold text-outline">{hud.stage === 'field' ? race.name : hud.stage === 'staged' ? 'Runners set' : hud.stage === 'ready' ? 'Ready…' : 'GO!'}</p>
          </m.div>
        )}
        {hud?.stage === 'photo' && (
          <m.div key="photo" className="pointer-events-none absolute inset-x-5 top-[28%] z-20 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <span className="inline-block rounded-full border-2 border-white bg-gold px-5 py-2 text-xl font-extrabold text-white text-outline shadow-[var(--shadow-panel)]">Photo finish!</span>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {activeCue && activeCueText && (
          <m.div
            key={`${activeCue.kind}:${activeCue.runner}:${activeCue.tick}`}
            className={`pointer-events-none absolute top-32 left-1/2 z-20 w-[min(86vw,22rem)] -translate-x-1/2 rounded-2xl border-2 px-4 py-2 text-center shadow-[var(--shadow-panel)] ${activeCue.isPlayer ? 'border-gold bg-gold text-white text-outline' : 'border-white bg-white/95 text-ink'}`}
            initial={reducedMotion ? false : { y: 10, scale: 0.9, opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { y: 0, scale: 1, opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: -8, opacity: 0 }}
          >
            <p className="text-xs font-extrabold uppercase">{activeCueText.eyebrow}</p>
            <p className="truncate text-lg font-extrabold">{activeCueText.title}</p>
            {activeCue.kind === 'skill' && activeCue.skillEffects && <p className="text-xs font-bold opacity-85">{effectLabel(activeCue.skillEffects)}</p>}
          </m.div>
        )}
      </AnimatePresence>

      <div className="pb-safe px-3">
        <div className="mb-2 rounded-2xl border-2 border-white bg-white/90 p-3 shadow-[var(--shadow-panel)]">
          <div className="relative mb-3 h-3 rounded-full bg-ink/10">
            {(hud?.shares ?? attempt.input.runners.map(() => 0)).map((share, index) => (
              <span
                key={index}
                className={`absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${index === attempt.playerIndex ? 'z-10 h-4 w-4 bg-[#ff8a3d]' : 'h-2.5 w-2.5 bg-ink/45'}`}
                style={{ left: `${Math.min(1, share) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="w-14 text-2xl font-extrabold tabular-nums">{hud ? ordinal(hud.playerPosition) : '—'}</span>
            <div className="flex-1">
              <p className="mb-1 text-xs font-extrabold text-ink-soft">STAMINA</p>
              <Meter value={hud?.playerHp ?? 1} color={(hud?.playerHp ?? 1) < 0.2 ? '#ff5a5f' : 'linear-gradient(90deg,#2ec27e,#8be07a)'} height={12} motion="linear" />
            </div>
            <span className="w-16 text-right text-sm font-extrabold tabular-nums text-ink-soft">{formatTime(hud?.seconds ?? 0)}</span>
          </div>
          {/* Always laid out, so the course above never changes height mid-race (Pixi sizes to it once). */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={!paused || hud?.stage !== 'running'}
                aria-label={turnRace ? 'Previous turn' : 'Back one second'}
                className="h-11 w-11 rounded-full border-2 border-ink/10 bg-white text-lg font-extrabold disabled:opacity-35"
              >‹</button>
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                disabled={!hud || hud.finished}
                aria-label={paused ? 'Play' : 'Pause'}
                className={`h-11 w-11 rounded-full border-2 text-sm font-extrabold disabled:opacity-35 ${paused ? 'border-sky bg-sky text-white' : 'border-ink/10 bg-white'}`}
              >{paused ? '▶' : '❚❚'}</button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={!paused || hud?.stage !== 'running'}
                aria-label={turnRace ? 'Next turn' : 'Forward one second'}
                className="h-11 w-11 rounded-full border-2 border-ink/10 bg-white text-lg font-extrabold disabled:opacity-35"
              >›</button>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
              {(turnRace ? TURN_SPEEDS : TIME_SPEEDS).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => {
                    setSpeed(option.value)
                    setPaused(false)
                  }}
                  aria-pressed={speed === option.value && !paused}
                  className={`h-11 min-w-11 rounded-full border-2 px-2 text-sm font-extrabold ${speed === option.value && !paused ? 'border-sky bg-sky text-white' : 'border-ink/10 bg-white'}`}
                >{option.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showResults && (
          <m.div className="fixed inset-0 z-40 flex items-end bg-ink/45" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={reducedMotion ? { duration: 0 } : undefined}>
            <m.div
              className="pb-safe relative max-h-dvh w-full overflow-y-auto rounded-t-[1.75rem] border-t-2 border-white bg-cream px-4 pt-4"
              initial={reducedMotion ? false : { y: '100%' }}
              animate={{ y: 0 }}
              transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
            >
              {playerTimelineResult.placement === 1 && !reducedMotion && CONFETTI.map((piece, index) => (
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
                className={`text-center text-6xl font-extrabold text-outline ${playerTimelineResult.placement === 1 ? 'text-gold' : 'text-sky-deep'}`}
                initial={reducedMotion ? false : { scale: 2.2, rotate: -10, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 12, delay: 0.1 }}
              >
                {playerTimelineResult.placement === 1 ? '1st!' : ordinal(playerTimelineResult.placement)}
              </m.p>
              <p className="mt-1 text-center text-sm font-extrabold text-ink-soft">{playerTemplate.name} · {formatTime(playerTimelineResult.finishTime)}</p>

              {committing && <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-center text-sm font-bold">Saving result and rewards…</p>}
              {record && (
                <div className="mt-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <m.div className="rounded-xl bg-white p-2" initial={reducedMotion ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}><p className="text-xs text-ink-soft">Uma EXP</p><p className="font-extrabold text-sky-deep">+{record.expGained}</p></m.div>
                    <m.div className="rounded-xl bg-white p-2" initial={reducedMotion ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: reducedMotion ? 0 : 0.12 }}><p className="text-xs text-ink-soft">Tickets</p><p className="font-extrabold text-gold">+{record.ticketReward}</p></m.div>
                    <m.div className="rounded-xl bg-white p-2" initial={reducedMotion ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: reducedMotion ? 0 : 0.24 }}><p className="text-xs text-ink-soft">Uma Shard</p><p className="font-extrabold text-violet-600">+{record.shardReward}</p></m.div>
                  </div>
                  {savedUma && (
                    <div className="mt-2 rounded-xl bg-white px-3 py-2">
                      <div className="mb-1 flex justify-between text-xs font-extrabold"><span>Uma Lv {savedUma.level}</span><span>{savedUma.exp} / {umaExpTarget}</span></div>
                      <Meter value={savedUma.exp / umaExpTarget} color="linear-gradient(90deg,#2fa8f5,#8e6cef)" height={9} />
                    </div>
                  )}
                  {record.levelsGained.length > 0 && <p className="mt-2 text-center text-sm font-extrabold">Reached Uma Lv {record.levelsGained.join(', ')}</p>}
                  {record.shardReward > 0 && <p className="mt-2 text-center rounded-full bg-gold px-3 py-1 text-sm font-extrabold text-white text-outline">{savedUma && savedUma.level >= SCENARIOS.length * LEVELS_PER_SCENARIO ? 'Latest scenario complete' : 'Ready to promote'}</p>}
                  {goalResult && goalResult.completions.length > 0 && <div className="mt-3 grid gap-2">
                    {goalResult.completions.map((goal, index) => (
                      <m.div
                        key={goal.id}
                        className="rounded-2xl border-2 border-gold bg-gradient-to-r from-amber-50 to-white px-4 py-3 text-center"
                        initial={!goalResult.animate || reducedMotion ? false : { scaleX: 0.25, opacity: 0 }}
                        animate={{ scaleX: 1, opacity: 1 }}
                        transition={!goalResult.animate || reducedMotion ? { duration: 0 } : { delay: 0.35 + index * 0.3, type: 'spring', stiffness: 320, damping: 22 }}
                      >
                        <p className="text-xs font-extrabold uppercase tracking-widest text-amber-800">Goal complete · {goal.label}</p>
                        <p className="mt-1 text-lg font-extrabold">🎗️ {goal.raceName}</p>
                        <p className="text-xs font-bold text-ink-soft">{goal.rule} · {goalResult.completed} / 3 complete</p>
                      </m.div>
                    ))}
                    {goalResult.honors && <m.p initial={!goalResult.animate || reducedMotion ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-full bg-gold px-4 py-2 text-center font-extrabold text-white text-outline">🏵 Scenario Honors · 3 / 3</m.p>}
                    {!goalResult.animate && <p className="text-center text-xs font-bold text-ink-soft">Recorded goal summary</p>}
                  </div>}
                  {earnedFlair.length > 0 && <div className="mt-3"><FlairCards title={freshGoalCommit ? 'Flair earned' : 'Earned in this race'} items={earnedFlair} animate={freshGoalCommit && !reducedMotion} /></div>}
                  {trainerEarnedFlair.length > 0 && <div className="mt-3"><FlairCards title="Trainer achievements" items={trainerEarnedFlair} animate={freshGoalCommit && !reducedMotion} /></div>}
                  <div className="mt-2 rounded-xl bg-white px-3 py-2">
                    <p className="text-xs font-extrabold text-ink-soft">YOUR ACTIVATIONS</p>
                    {activationSummary.length === 0 ? <p className="mt-1 text-sm font-bold text-ink-soft">No player skills activated.</p> : (
                      <ul className="mt-1 space-y-1">
                        {activationSummary.map((activation) => (
                          <li key={activation.skillId} className="flex items-start justify-between gap-3 text-sm">
                            <span className="min-w-0"><strong className="block truncate">{content.skills.byId.get(activation.skillId)?.name ?? activation.skillId}</strong><span className="text-xs text-ink-soft">{effectLabel(activation.effects)}</span></span>
                            <span className="shrink-0 font-extrabold text-sky-deep">×{activation.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {commitError && (
                <div className="mt-3 rounded-xl bg-red-50 p-3 text-center">
                  <p className="text-sm font-bold text-danger">{commitError}</p>
                  {!record && <button type="button" className="mt-2 min-h-11 rounded-xl bg-white px-4 font-extrabold" onClick={retryCommit}>Retry save</button>}
                </div>
              )}

              <ol className="mt-3 max-h-[28dvh] overflow-y-auto rounded-2xl border-2 border-white bg-white">
                {orderedField.map((result, index) => {
                  const name = content.umas.byId.get(result.umaId)?.name ?? result.umaId
                  return (
                    <m.li key={`${result.gate}:${result.umaId}`} initial={reducedMotion ? false : { x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: reducedMotion ? 0 : 0.2 + index * 0.025 }} className={`flex items-center gap-3 border-b border-ink/5 px-3 py-2 ${result.isPlayer ? 'bg-gold/20' : ''}`}>
                      <span className="w-8 font-extrabold tabular-nums">{result.placement}</span>
                      <UmaBust content={content} umaId={result.umaId} className="h-9 w-9 shrink-0 rounded-sm bg-sunken" />
                      <span className="min-w-0 flex-1 truncate font-extrabold">{result.isPlayer ? '★ ' : ''}{name}<span className="ml-2 text-xs text-ink-soft">{STRATEGY_LABEL[result.strategy]}</span></span>
                      <span className="text-sm text-ink-soft">{formatMargin(result.marginLengths)}</span>
                    </m.li>
                  )
                })}
              </ol>
              <div className="mt-3 grid grid-cols-3 gap-2 pb-4">
                <GameButton variant="secondary" disabled={!record || committing} onClick={() => navigate(promote ? `/stable/${encodeURIComponent(attempt.umaId)}` : `/race?uma=${encodeURIComponent(attempt.umaId)}`)}>{promote ? 'Promote' : 'Races'}</GameButton>
                <GameButton variant="secondary" disabled={!record || committing || finalTier} onClick={() => navigate(promote ? `/stable/${encodeURIComponent(attempt.umaId)}` : `/constellation/${encodeURIComponent(attempt.umaId)}`)}>{promote ? 'Promote' : 'Train'}</GameButton>
                <GameButton variant="go" disabled={!record || againBusy || closed} onClick={() => void raceAgain()}>
                  {closed ? (finalTier ? 'Complete' : 'Promote first') : againBusy ? 'Preparing…' : 'Race again'}
                </GameButton>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
