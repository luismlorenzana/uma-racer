import { STRATEGIES, expToNextUmaLevel, isGateLevel, type RaceResultRecord, type Strategy } from '@racer/domain'
import { formatMargin, simulateRace, type RaceTimeline } from '@racer/race'
import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { completeRace, prepareRace } from '../../game/actions'
import { preparedRaceFromRecord, type PreparedRace } from '../../game/racing'
import { useGame } from '../../game/store'
import { RaceScene, type RaceHudState, type SceneRunner } from '../../scenes/race/RaceScene'
import { GameButton } from '../../ui/GameButton'
import { Meter } from '../../ui/Meter'
import { GRADE_LABEL, STRATEGY_LABEL } from './labels'

const PHASES = ['Opening', 'Middle leg', 'Final leg', 'Last spurt']
const RIVAL_COLORS = [0x5b8def, 0xef6f6c, 0x8e6cef, 0x3cb4a4, 0xf29e4c, 0x6c8ea4, 0xd96fb6, 0x7bbf4a]

const ordinal = (value: number) => {
  const suffix = ['th', 'st', 'nd', 'rd']
  const mod = value % 100
  return `${value}${suffix[(mod - 20) % 10] ?? suffix[mod] ?? 'th'}`
}
const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`

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

/** Full-screen saved-Uma race and atomic results flow (docs/tasks/T005-progression-races-and-rewards.md). */
export function RaceRunScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const queryUmaId = params.get('uma') ?? ''
  const contentState = useContent()
  const gameStatus = useGame((state) => state.status)
  const gameError = useGame((state) => state.error)
  const savedUma = useGame((state) => state.umas[queryUmaId])
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<RaceScene | null>(null)
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
  const [showResults, setShowResults] = useState(false)
  const [againBusy, setAgainBusy] = useState(false)

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
    finishingRef.current = false
    void prepareRace(umaId, raceId, strategy, sequence).then((preparation) => {
      if (cancelled || contentState.status !== 'ready') return
      if (preparation.status === 'completed') {
        const replay = preparedRaceFromRecord(contentState.content, preparation.record)
        setAttempt(replay)
        setTimeline(simulateRace(replay.input))
        setRecord(preparation.record)
        recordRef.current = preparation.record
        setShowResults(true)
      } else {
        setAttempt(preparation.attempt)
        setTimeline(simulateRace(preparation.attempt.input))
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
        setShowResults(true)
      }).catch((reason: unknown) => {
        setCommitError(reason instanceof Error ? reason.message : 'Could not save race result')
        setShowResults(true)
        finishingRef.current = false
      }).finally(() => setCommitting(false))
    }
    const scene = new RaceScene(timeline, runners, attempt.playerIndex, setHud, finish)
    sceneRef.current = scene
    if (import.meta.env.DEV) (window as unknown as { __raceScene?: RaceScene }).__raceScene = scene
    void scene.mount(host)
    return () => {
      scene.destroy()
      sceneRef.current = null
    }
  }, [attempt, timeline])

  useEffect(() => {
    sceneRef.current?.setSpeed(speed)
  }, [speed, timeline])

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

  const retryCommit = () => {
    if (committing || record) return
    finishingRef.current = true
    setCommitting(true)
    setCommitError(null)
    void completeRace(attempt).then((completion) => {
      recordRef.current = completion.record
      setRecord(completion.record)
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
          <div className="flex gap-1">
            {[1, 2].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSpeed(value)}
                className={`h-11 min-w-11 rounded-full border-2 border-white px-2 text-sm font-extrabold ${speed === value ? 'bg-sky text-white' : 'bg-white/85'}`}
              >{value}×</button>
            ))}
            <button type="button" onClick={() => sceneRef.current?.skipToEnd()} className="h-11 min-w-11 rounded-full border-2 border-white bg-white/85 px-2 text-sm font-extrabold" aria-label="Skip">⏭</button>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border-2 border-white/80 bg-ink/35 px-3 py-1.5 text-white">
          <m.span key={hud?.phase ?? 0} initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={`font-extrabold ${hud?.phase === 3 ? 'text-gold' : ''}`}>
            {PHASES[hud?.phase ?? 0]}
          </m.span>
          <span className="font-extrabold tabular-nums">{Math.round(remaining)}m left</span>
        </div>
      </div>

      <div ref={hostRef} className="relative min-h-0 flex-1" />

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
        </div>
      </div>

      <AnimatePresence>
        {showResults && (
          <m.div className="fixed inset-0 z-40 flex items-end bg-ink/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <m.div className="pb-safe w-full rounded-t-[1.75rem] border-t-2 border-white bg-cream px-4 pt-4" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
              <m.p
                className={`text-center text-6xl font-extrabold text-outline ${playerTimelineResult.placement === 1 ? 'text-gold' : 'text-sky-deep'}`}
                initial={{ scale: 2.2, rotate: -10, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.1 }}
              >
                {playerTimelineResult.placement === 1 ? '1st!' : ordinal(playerTimelineResult.placement)}
              </m.p>
              <p className="mt-1 text-center text-sm font-extrabold text-ink-soft">{playerTemplate.name} · {formatTime(playerTimelineResult.finishTime)}</p>

              {committing && <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-center text-sm font-bold">Saving result and rewards…</p>}
              {record && (
                <div className="mt-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white p-2"><p className="text-xs text-ink-soft">Uma EXP</p><p className="font-extrabold text-sky-deep">+{record.expGained}</p></div>
                    <div className="rounded-xl bg-white p-2"><p className="text-xs text-ink-soft">Tickets</p><p className="font-extrabold text-gold">+{record.ticketReward}</p></div>
                    <div className="rounded-xl bg-white p-2"><p className="text-xs text-ink-soft">Uma Shard</p><p className="font-extrabold text-violet-600">+{record.shardReward}</p></div>
                  </div>
                  {savedUma && (
                    <div className="mt-2 rounded-xl bg-white px-3 py-2">
                      <div className="mb-1 flex justify-between text-xs font-extrabold"><span>Uma Lv {savedUma.level}</span><span>{savedUma.exp} / {umaExpTarget}</span></div>
                      <Meter value={savedUma.exp / umaExpTarget} color="linear-gradient(90deg,#2fa8f5,#8e6cef)" height={9} />
                    </div>
                  )}
                  {record.levelsGained.length > 0 && <p className="mt-2 text-center text-sm font-extrabold">Reached Uma Lv {record.levelsGained.join(', ')}</p>}
                  {record.shardReward > 0 && <p className="mt-2 text-center rounded-full bg-gold px-3 py-1 text-sm font-extrabold text-white text-outline">Ready to promote</p>}
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
                    <m.li key={`${result.gate}:${result.umaId}`} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 + index * 0.025 }} className={`flex items-center gap-3 border-b border-ink/5 px-3 py-2 ${result.isPlayer ? 'bg-gold/20' : ''}`}>
                      <span className="w-8 font-extrabold tabular-nums">{result.placement}</span>
                      <span className="min-w-0 flex-1 truncate font-extrabold">{result.isPlayer ? '★ ' : ''}{name}<span className="ml-2 text-xs text-ink-soft">{STRATEGY_LABEL[result.strategy]}</span></span>
                      <span className="text-sm text-ink-soft">{formatMargin(result.marginLengths)}</span>
                    </m.li>
                  )
                })}
              </ol>
              <div className="mt-3 grid grid-cols-2 gap-3 pb-4">
                <GameButton variant="secondary" disabled={committing} onClick={() => navigate(`/race?uma=${encodeURIComponent(attempt.umaId)}`)}>Races</GameButton>
                <GameButton variant="go" disabled={!record || againBusy || record.shardReward > 0} onClick={() => void raceAgain()}>
                  {record?.shardReward ? 'Promote first' : againBusy ? 'Preparing…' : 'Race again'}
                </GameButton>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
