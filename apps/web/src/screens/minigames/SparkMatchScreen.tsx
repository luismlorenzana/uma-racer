import {
  MAX_TRAINING_LEVEL,
  SPARK_MATCH_TICKET_COST,
  SPARK_RIVAL_CLEAR_BONUS,
  SPARK_RIVAL_COMBO_BONUS_CAP,
  SPARK_RIVAL_DRIVE_BONUS_CAP,
  SPARK_RIVAL_WAVE_EXP,
  activeScenario,
  addTrainingExp,
  constellationTemplate,
  nodesUnlockedBetween,
  trainingExpToNext,
} from '@racer/domain'
import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { getContentAsset } from '../../content/runtime'
import { safeReturnPath } from '../../game/bond-links'
import { getMinigameHost, type RunReward } from '../../game/minigame-host'
import { getMinigameJournal, type SparkRunView } from '../../game/minigame-journal'
import { sparkRivalStateHash, type SparkOrb } from '@racer/domain'
import { useGame } from '../../game/store'
import { SparkRivalScene, type SparkRivalHud, type SparkSceneArt } from '../../scenes/spark-rival/SparkRivalScene'
import { sparkProofCast } from '../../scenes/spark-rival/proof-cast'
import { useArtSet } from '../../ui/album/useArt'
import { QuestionIcon, SparkIcon } from '../../ui/icons'
import { SPARK_ORB_COLORS, SPARK_STRATEGY_LABELS } from '../../ui/minigames/spark-rival-presentation'
import { formatTickets } from '../../ui/tickets'
import {
  rememberSparkRivalGuideSeen,
  SparkRivalGuide,
  sparkRivalGuideSeen,
  type SparkRivalGuidePageId,
} from './SparkRivalGuide'

type Phase = 'loading' | 'ready' | 'reserving' | 'playing' | 'committing' | 'complete'

const ratio = (value: number, maximum: number) => maximum <= 0 ? 0 : Math.max(0, Math.min(1, value / maximum))

function Gauge({ label, value, maximum, color }: { label: string; value: number; maximum: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[10px] font-bold tracking-[0.08em] uppercase">
        <span>{label}</span><span className="numeral text-xs">{value}/{maximum}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/35" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={maximum} aria-valuenow={value}>
        <div className={`h-full origin-left rounded-full ${color}`} style={{ transform: `scaleX(${ratio(value, maximum)})` }} />
      </div>
    </div>
  )
}

export function SparkMatchScreen() {
  const { umaId = '' } = useParams()
  const [params] = useSearchParams()
  const reducedMotion = Boolean(useReducedMotion())
  const contentState = useContent()
  const gameStatus = useGame((state) => state.status)
  const uma = useGame((state) => state.umas[umaId])
  const tickets = useGame((state) => state.profile?.tickets ?? 0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [view, setView] = useState<SparkRunView | null>(null)
  const [hud, setHud] = useState<SparkRivalHud | null>(null)
  const [reward, setReward] = useState<RunReward | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guide, setGuide] = useState<{ open: boolean; startAt: SparkRivalGuidePageId }>({ open: false, startAt: 'circuit' })
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SparkRivalScene | null>(null)
  const committingRef = useRef(false)
  const content = contentState.status === 'ready' ? contentState.content : null
  const returnTo = safeReturnPath(params.get('return'), `/constellation/${encodeURIComponent(umaId)}`)
  const scenario = uma ? activeScenario(uma) : null
  const template = content?.umas.byId.get(umaId) ?? null

  const finish = useCallback(async (terminal: SparkRunView) => {
    if (!terminal.replay.outcome || committingRef.current) return
    committingRef.current = true
    setPhase('committing')
    setError(null)
    try {
      const next = await getMinigameHost().commitRun(terminal.ticket.runId, {
        kind: 'spark-match',
        engine: 'spark-rival-v1',
        actionCount: terminal.actions.length,
        stateHash: sparkRivalStateHash(terminal.replay.state),
      })
      setReward(next)
      setPhase('complete')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Training progress could not be saved')
      setPhase('playing')
    } finally {
      committingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!content || gameStatus !== 'ready' || !uma || !scenario) return
    let cancelled = false
    setPhase('loading')
    void getMinigameHost().findOpenRun({ kind: 'spark-match', umaId }).then(async (open) => {
      if (cancelled) return
      if (!open) {
        setPhase('ready')
        if (!sparkRivalGuideSeen()) setGuide({ open: true, startAt: 'circuit' })
        return
      }
      const restored = await getMinigameJournal().loadSpark(open.runId)
      if (cancelled) return
      setView(restored)
      setPhase(restored.replay.outcome ? 'committing' : 'playing')
      if (restored.replay.outcome) void finish(restored)
    }).catch((reason: unknown) => {
      if (cancelled) return
      setError(reason instanceof Error ? reason.message : 'Saved Spark Match could not be restored')
      setPhase('ready')
    })
    return () => { cancelled = true }
  }, [content, finish, gameStatus, scenario?.tier, uma?.templateId, umaId])

  const reserve = async () => {
    if (!uma) return
    setPhase('reserving')
    setError(null)
    try {
      const ticket = await getMinigameHost().beginRun('spark-match', { kind: 'spark-match', umaId })
      const loaded = await getMinigameJournal().loadSpark(ticket.runId)
      setView(loaded)
      setPhase(loaded.replay.outcome ? 'committing' : 'playing')
      if (loaded.replay.outcome) await finish(loaded)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Spark Match could not begin')
      setPhase('ready')
    }
  }
  const start = () => { if (phase === 'ready') void reserve() }

  const cast = useMemo(() => content && view ? sparkProofCast(content.umas.items, view.snapshot.encounter.trainee.templateId) : null, [content, view])
  const artIds = useMemo(() => {
    if (!view || !cast) return []
    return [...new Set([
      ...Object.values(cast.orbs),
      ...view.snapshot.encounter.waves.map((wave) => wave.id).filter((id) => content?.umas.byId.has(id)),
    ])].map((id) => `${id}-a`)
  }, [cast, content, view])
  const chibis = useArtSet(content, 'chibi', artIds)
  const orbArt = useMemo<Partial<Record<SparkOrb, SparkSceneArt>>>(() => cast ? Object.fromEntries(
    Object.entries(cast.orbs).map(([orb, id]) => [orb, chibis.get(`${id}-a`) ?? (content ? getContentAsset(content, 'uma-icons', id) : null)]),
  ) : {}, [cast, chibis, content])
  const rivalArt = useMemo<Readonly<Record<string, SparkSceneArt>>>(() => view ? Object.fromEntries(
    view.snapshot.encounter.waves.map((wave) => [wave.id, chibis.get(`${wave.id}-a`) ?? (content ? getContentAsset(content, 'uma-icons', wave.id) : null)]),
  ) : {}, [chibis, content, view])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !view || phase === 'complete') return
    const scene = new SparkRivalScene(setHud, {
      encounter: view.snapshot.encounter,
      seed: view.ticket.seed,
      actions: view.actions,
      append: async (expected, action) => {
        const next = await getMinigameJournal().appendSpark(view.ticket.runId, expected, action)
        setView(next)
        return next
      },
      restore: async () => {
        const restored = await getMinigameJournal().loadSpark(view.ticket.runId)
        setView(restored)
        return restored
      },
      onTerminal: (terminal) => { setView(terminal); void finish(terminal) },
    })
    sceneRef.current = scene
    scene.setReducedMotion(reducedMotion)
    void scene.mount(host).then(() => scene.setArt(orbArt, rivalArt))
    return () => {
      sceneRef.current = null
      scene.destroy()
    }
    // A scene owns one immutable run snapshot; journal updates stay inside it rather than remounting the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.ticket.runId, phase === 'complete'])

  useEffect(() => sceneRef.current?.setReducedMotion(reducedMotion), [reducedMotion])
  useEffect(() => { void sceneRef.current?.setArt(orbArt, rivalArt) }, [orbArt, rivalArt])

  const closeGuide = () => {
    rememberSparkRivalGuideSeen()
    setGuide((current) => ({ ...current, open: false }))
  }
  const retryCommit = () => { if (view?.replay.outcome) void finish(view) }
  const runAgain = async () => {
    setView(null)
    setReward(null)
    setHud(null)
    setError(null)
    await reserve()
  }

  if (!content || gameStatus !== 'ready' || !uma || !scenario || !template) {
    const title = contentState.status === 'signed-out' || gameStatus === 'signed-out'
      ? 'Sign in to play Spark Match'
      : contentState.status === 'empty' ? 'Content is not imported' : !uma ? 'Uma not found' : 'Preparing Spark Match…'
    return <div className="flex h-dvh items-center justify-center bg-stage p-5 text-ink-on-dark"><div className="max-w-sm text-center"><h1 className="text-xl">{title}</h1><Link to="/stable" className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-display font-semibold text-ink">Back to Stable</Link></div></div>
  }

  if ((!scenario.started || scenario.trainingLevel >= MAX_TRAINING_LEVEL) && !view && !reward) {
    return (
      <div className="flex h-dvh items-center justify-center bg-stage p-5 text-ink-on-dark">
        <div className="max-w-sm rounded-lg border border-hairline-dark bg-stage-soft p-5 text-center shadow-3">
          <h1 className="text-2xl">{scenario.started ? 'Training Level maxed' : 'Start this scenario first'}</h1>
          <p className="mt-2 text-sm text-ink-on-dark-soft">{scenario.started ? 'This constellation is already at TL10.' : 'Spark Match trains the active scenario constellation.'}</p>
          <Link to={`/constellation/${encodeURIComponent(umaId)}`} className="mt-5 inline-flex min-h-12 items-center rounded-sm bg-accent px-5 font-display font-bold text-ink">Back to Training</Link>
        </div>
      </div>
    )
  }

  const maxClearExp = SPARK_RIVAL_WAVE_EXP.reduce((sum, value) => sum + value, 0) + SPARK_RIVAL_CLEAR_BONUS + SPARK_RIVAL_COMBO_BONUS_CAP + SPARK_RIVAL_DRIVE_BONUS_CAP
  const possible = addTrainingExp(scenario.trainingLevel, scenario.trainingExp, maxClearExp)
  const possibleNodes = nodesUnlockedBetween(constellationTemplate(scenario.tier), scenario.trainingLevel, possible.trainingLevel).length
  const crossedLevels = reward?.trainingLevelBefore !== undefined && reward.trainingLevelAfter !== undefined
    ? Array.from({ length: Math.max(0, reward.trainingLevelAfter - reward.trainingLevelBefore) }, (_, index) => reward.trainingLevelBefore! + index + 1)
    : []
  const battle = phase === 'playing' || phase === 'committing'
  const outcome = view?.replay.outcome
  const wave = hud?.wave ?? ((view?.replay.state.waveIndex ?? 0) + 1)

  return (
    <main className={`game-surface flex h-dvh w-full flex-col bg-stage pt-safe pb-safe text-ink-on-dark ${battle ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-hairline-dark bg-stage/95 px-3 py-2">
        <Link to={returnTo} className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-hairline-dark bg-stage-soft" aria-label="Leave Spark Match">←</Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/50 bg-accent/15 text-accent"><SparkIcon size={24} /></div>
        <div className="min-w-0 flex-1"><p className="text-[9px] font-bold tracking-[0.16em] text-accent uppercase">Spark Match · Rival Circuit</p><h1 className="truncate text-lg">{template.name}</h1></div>
        <button type="button" onClick={() => setGuide({ open: true, startAt: battle ? 'intent' : 'circuit' })} aria-label="How to play Spark Match" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-hairline-dark bg-stage-soft text-accent"><QuestionIcon size={20} /></button>
        {battle && <div className="rounded-full border border-hairline-dark bg-stage-soft px-3 py-1 text-center"><p className="text-[9px] text-ink-on-dark-soft uppercase">Wave</p><p className="numeral numeral-on-dark text-lg">{wave}/3</p></div>}
      </header>

      {phase === 'loading' ? (
        <section className="grid flex-1 place-items-center px-5 text-center"><p>Restoring the saved circuit…</p></section>
      ) : phase === 'ready' || phase === 'reserving' ? (
        <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-5">
          <div className="rounded-lg border border-hairline-dark bg-stage-soft p-4 shadow-3">
            <p className="text-xs font-bold tracking-[0.14em] text-accent uppercase">Three waves · 6 × 5 board · no turn timer</p>
            <h2 className="mt-1 text-3xl">Enter the Rival Circuit</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              {['Training Rival I', 'Training Rival II', 'Circuit Boss'].map((label, index) => <div key={label} className="rounded-sm border border-hairline-dark bg-black/15 p-2"><span className="numeral text-accent">{index + 1}</span><p className="mt-1 font-semibold">{label}</p></div>)}
            </div>
            <div className="mt-4 rounded-sm bg-black/15 p-3 text-sm">
              <div className="flex justify-between"><span>Current progress</span><strong>TL {scenario.trainingLevel} · {scenario.trainingExp}/{trainingExpToNext(scenario.trainingLevel)} EXP</strong></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/35"><div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${ratio(scenario.trainingExp, trainingExpToNext(scenario.trainingLevel))})` }} /></div>
              <p className="mt-2 text-xs text-ink-on-dark-soft">A strong clear can earn up to {maxClearExp.toLocaleString()} EXP{possibleNodes > 0 ? ` and open ${possibleNodes} constellation node${possibleNodes === 1 ? '' : 's'}` : ''}.</p>
            </div>
            <p className="mt-3 text-sm text-ink-on-dark-soft">Drag one Chibi orb through neighboring cells, build several matches, exploit the matchup ring and protect Drive. The seeded lineup appears when the paid run is reserved.</p>
            {error && <p role="alert" className="mt-3 rounded-sm bg-danger/20 p-2 text-sm font-semibold text-red-200">{error}</p>}
            <button type="button" disabled={phase === 'reserving' || tickets < SPARK_MATCH_TICKET_COST} onClick={start} className="mt-5 min-h-12 w-full rounded-sm bg-accent px-5 font-display text-lg font-bold text-ink shadow-2 disabled:opacity-50">{phase === 'reserving' ? 'Reserving circuit…' : tickets < SPARK_MATCH_TICKET_COST ? `Need ${formatTickets(SPARK_MATCH_TICKET_COST)}` : `Begin · ${formatTickets(SPARK_MATCH_TICKET_COST)}`}</button>
          </div>
        </section>
      ) : phase === 'complete' && reward && outcome ? (
        <section className="mx-auto w-full max-w-md flex-1 px-4 py-5">
          <div className="rounded-lg bg-panel p-5 text-ink shadow-3">
            <p className="text-xs font-bold tracking-[0.14em] text-accent-strong uppercase">{outcome.kind === 'clear' ? 'Circuit cleared' : 'Training banked'}</p>
            <h2 className="mt-1 text-3xl">+{reward.trainingExpEarned?.toLocaleString() ?? outcome.trainingExp.toLocaleString()} Training EXP</h2>
            <p className="mt-1 text-sm text-ink-soft">{outcome.reason === 'circuit-cleared' ? 'All three rivals defeated.' : outcome.reason === 'drive-depleted' ? 'Drive was depleted; Resolve progress still paid out.' : 'The wave turn limit was reached; Resolve progress still paid out.'}</p>
            <section className="mt-5 rounded-sm bg-accent-wash p-4">
              <div className="flex items-center justify-between"><h3 className="text-lg">Training progress</h3><strong>TL {reward.trainingLevelBefore} → {reward.trainingLevelAfter}</strong></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full origin-left bg-accent" style={{ transform: `scaleX(${ratio(reward.trainingExpAfter ?? 0, reward.trainingLevelAfter === MAX_TRAINING_LEVEL ? 1 : trainingExpToNext(reward.trainingLevelAfter ?? 1))})` }} /></div>
              <p className="mt-2 text-sm text-ink-soft">EXP {reward.trainingExpBefore ?? 0} → {reward.trainingExpAfter ?? 0}{crossedLevels.length > 0 ? ` · crossed ${crossedLevels.map((level) => `TL${level}`).join(', ')}` : ''}</p>
            </section>
            <section className="mt-4"><h3 className="text-lg">Constellation nodes opened</h3>{reward.nodesUnlocked?.length ? <div className="mt-2 grid gap-2">{reward.nodesUnlocked.map((node) => <Link key={node.id} to={`/constellation/${encodeURIComponent(umaId)}?node=${encodeURIComponent(node.id)}`} className="flex min-h-11 items-center justify-between rounded-sm border border-hairline bg-page px-3 font-semibold"><span>{node.label}</span><span aria-hidden>→</span></Link>)}</div> : <p className="mt-1 text-sm text-ink-soft">No node opened this run; every EXP point carried forward.</p>}</section>
            <div className="mt-5 grid grid-cols-2 gap-2"><Link to={returnTo} className="flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong px-3 font-display font-semibold">Done</Link><button type="button" disabled={(reward.trainingLevelAfter ?? MAX_TRAINING_LEVEL) >= MAX_TRAINING_LEVEL || tickets < SPARK_MATCH_TICKET_COST} onClick={() => void runAgain()} className="min-h-12 rounded-sm bg-accent px-3 font-display font-semibold disabled:opacity-40">Run again · {formatTickets(SPARK_MATCH_TICKET_COST)}</button></div>
          </div>
        </section>
      ) : view ? (
        <>
          <section className="grid shrink-0 grid-cols-[1fr_auto] gap-3 border-b border-hairline-dark bg-stage-soft/90 px-3 py-2" aria-label="Battle status">
            <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2"><Gauge label="Rival Resolve" value={hud?.resolve ?? view.replay.state.rival.resolve} maximum={hud?.maxResolve ?? view.replay.state.rival.maxResolve} color="bg-danger" /><Gauge label="Drive" value={hud?.drive ?? view.replay.state.drive} maximum={hud?.maxDrive ?? view.replay.state.maxDrive} color="bg-success" /><Gauge label="Spark Shift" value={hud?.sparkCharge ?? view.replay.state.sparkCharge} maximum={hud?.sparkTarget ?? view.replay.state.sparkTarget} color="bg-accent" /><button type="button" onClick={() => setGuide({ open: true, startAt: 'advantage' })} className="flex min-h-11 items-center justify-between rounded-xs border border-hairline-dark bg-black/15 px-2 py-1 text-left text-xs" style={{ borderColor: SPARK_ORB_COLORS[hud?.rivalStrategy ?? view.replay.state.rival.strategy] }}><span className="min-w-0 truncate"><b>{hud?.rivalLabel ?? view.snapshot.encounter.waves[view.replay.state.waveIndex]!.label}</b><span className="block truncate text-[10px] text-ink-on-dark-soft">{SPARK_STRATEGY_LABELS[hud?.rivalStrategy ?? view.replay.state.rival.strategy]} · Next {hud?.intent ?? '—'}</span></span><span className="numeral ml-2 text-base">{hud?.countdown ?? view.replay.state.rival.countdown}</span></button></div>
            <div className="flex min-w-14 flex-col items-center justify-center rounded-sm border border-hairline-dark bg-black/20 px-2"><span className="text-[9px] text-ink-on-dark-soft uppercase">Move</span><span className="numeral numeral-on-dark text-xl">{(hud?.waveTurn ?? view.replay.state.waveTurn) + 1}<small className="text-xs text-ink-on-dark-soft">/8</small></span><span className="text-[9px] text-accent">{hud?.movementRemainingMs === null || hud?.movementRemainingMs === undefined ? 'PLAN' : `${(hud.movementRemainingMs / 1_000).toFixed(1)}s`}</span></div>
          </section>
          {view.snapshot.source === 'fallback' && <p className="shrink-0 bg-warning/15 px-3 py-1 text-center text-[10px] text-warning">Authored circuit unavailable; deterministic catalogue rivals are in use.</p>}
          <div ref={hostRef} className="min-h-0 flex-1" aria-describedby="spark-board-help" />
          <section className="shrink-0 border-t border-hairline-dark bg-stage/95 px-3 pt-2 pb-2"><p id="spark-board-help" className="sr-only">Touch and drag an orb through adjacent board cells, then release to resolve one turn.</p><p className="min-h-5 truncate text-center text-xs font-semibold" role="status" aria-live="polite">{phase === 'committing' ? 'Saving Training progress…' : error ?? hud?.status ?? 'Restoring battle…'}</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setGuide({ open: true, startAt: 'advantage' })} className="min-h-11 rounded-sm border border-hairline-dark bg-stage-soft px-3 text-sm font-bold">Matchups</button><button type="button" disabled={phase !== 'playing' || !hud || hud.inputLocked || hud.dragging || hud.sparkCharge < hud.sparkTarget} onClick={() => sceneRef.current?.triggerShift()} className="min-h-11 rounded-sm bg-accent px-3 text-sm font-bold text-ink disabled:opacity-40">Spark Shift</button></div>{error && view.replay.outcome && <button type="button" onClick={retryCommit} className="mt-2 min-h-11 w-full rounded-sm border border-accent text-sm font-bold text-accent">Retry save</button>}</section>
        </>
      ) : null}
      <SparkRivalGuide open={guide.open} startAt={guide.startAt} onClose={closeGuide} />
    </main>
  )
}
