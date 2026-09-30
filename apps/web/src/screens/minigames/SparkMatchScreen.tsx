import {
  MAX_TRAINING_LEVEL,
  SPARK_MATCH_TICKET_COST,
  SPARK_RIVAL_CLEAR_BONUS,
  SPARK_RIVAL_COMBO_BONUS_CAP,
  SPARK_RIVAL_DRIVE_BONUS_CAP,
  SPARK_RIVAL_WAVE_EXP,
  scenarioForTier,
  trainedScenario,
  addTrainingExp,
  constellationTemplate,
  nodesUnlockedBetween,
  sparkRivalStateHash,
  trainingExpToNext,
  type SparkOrb,
} from '@racer/domain'
import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { getContentAsset } from '../../content/runtime'
import { safeReturnPath } from '../../game/bond-links'
import { constellationNodeHref } from '../../game/constellation-links'
import { getMinigameHost, type RunReward } from '../../game/minigame-host'
import { getMinigameJournal, type SparkRunView } from '../../game/minigame-journal'
import { useChosenTier } from '../../game/scenario-choice'
import { useGame } from '../../game/store'
import { SparkRivalScene, type SparkRivalHud, type SparkSceneArt } from '../../scenes/spark-rival/SparkRivalScene'
import { sparkProofCast } from '../../scenes/spark-rival/proof-cast'
import { useArtSet } from '../../ui/album/useArt'
import { Button } from '../../ui/Button'
import { ChevronRightIcon, SparkIcon } from '../../ui/icons'
import { MinigameGauge } from '../../ui/minigames/MinigameGauge'
import { MinigameResult } from '../../ui/minigames/MinigameResult'
import { MinigameHeader, MinigameShell } from '../../ui/minigames/MinigameShell'
import { MinigameStart } from '../../ui/minigames/MinigameStart'
import { SPARK_ORB_COLORS, SPARK_STRATEGY_LABELS } from '../../ui/minigames/spark-rival-presentation'
import {
  rememberSparkRivalGuideSeen,
  SparkRivalGuide,
  sparkRivalGuideSeen,
  type SparkRivalGuidePageId,
} from './SparkRivalGuide'

type Phase = 'loading' | 'ready' | 'reserving' | 'playing' | 'committing' | 'complete'

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
  const [resumeAvailable, setResumeAvailable] = useState(false)
  const [guide, setGuide] = useState<{ open: boolean; startAt: SparkRivalGuidePageId }>({ open: false, startAt: 'circuit' })
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SparkRivalScene | null>(null)
  const committingRef = useRef(false)
  const content = contentState.status === 'ready' ? contentState.content : null
  const returnTo = safeReturnPath(params.get('return'), `/constellation/${encodeURIComponent(umaId)}`)
  // The scenario chosen for her (D190): an earlier trained unit keeps training toward TL10.
  const chosenTier = useChosenTier(uma)
  const scenario = uma && chosenTier !== null ? trainedScenario(uma, chosenTier) : null
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
    setResumeAvailable(false)
    void getMinigameHost().findOpenRun({ kind: 'spark-match', umaId, tier: scenario.tier }).then(async (open) => {
      if (cancelled) return
      if (!open) {
        setPhase('ready')
        if (!sparkRivalGuideSeen()) setGuide({ open: true, startAt: 'circuit' })
        return
      }
      setResumeAvailable(true)
      const restored = await getMinigameJournal().load(open.runId)
      if (restored.engine !== 'spark-rival-v1') throw new Error('The saved run belongs to another minigame')
      if (cancelled) return
      setView(restored)
      setResumeAvailable(false)
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
    if (!uma || !scenario) return
    setPhase('reserving')
    setError(null)
    try {
      const ticket = await getMinigameHost().beginRun('spark-match', { kind: 'spark-match', umaId, tier: scenario.tier })
      setResumeAvailable(true)
      const loaded = await getMinigameJournal().load(ticket.runId)
      if (loaded.engine !== 'spark-rival-v1') throw new Error('The saved run belongs to another minigame')
      setView(loaded)
      setResumeAvailable(false)
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
        const next = await getMinigameJournal().append(view.ticket.runId, expected, action)
        if (next.engine !== 'spark-rival-v1') throw new Error('The saved run belongs to another minigame')
        setView(next)
        return next
      },
      restore: async () => {
        const restored = await getMinigameJournal().load(view.ticket.runId)
        if (restored.engine !== 'spark-rival-v1') throw new Error('The saved run belongs to another minigame')
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
    setResumeAvailable(false)
    await reserve()
  }

  if (!content || gameStatus !== 'ready' || !uma || !scenario || !template) {
    const title = contentState.status === 'signed-out' || gameStatus === 'signed-out'
      ? 'Sign in to play Spark Match'
      : contentState.status === 'empty' ? 'Content is not imported' : !uma ? 'Uma not found' : 'Preparing Spark Match…'
    return <div className="flex h-dvh items-center justify-center bg-stage p-5 text-ink-on-dark"><div className="max-w-sm text-center"><h1 className="text-xl">{title}</h1><Link to="/stable" className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-display font-semibold text-ink">Back to Stable</Link></div></div>
  }

  // Her current scenario trains once started; an earlier trained unit always can, until TL10 (D190).
  const trainable = scenario.started || scenario.tier < uma.unlockedTier
  if ((!trainable || scenario.trainingLevel >= MAX_TRAINING_LEVEL) && !view && !reward) {
    return (
      <div className="flex h-dvh items-center justify-center bg-stage p-5 text-ink-on-dark">
        <div className="max-w-sm rounded-lg border border-hairline-dark bg-stage-soft p-5 text-center shadow-3">
          <h1 className="text-2xl">{trainable ? 'Training Level maxed' : 'Start this scenario first'}</h1>
          <p className="mt-2 text-sm text-ink-on-dark-soft">{trainable ? 'This constellation is already at TL10.' : 'Spark Match trains the scenario once it has started.'}</p>
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
    <MinigameShell playing={battle}>
      <MinigameHeader
        backTo={returnTo}
        backLabel="Pause and leave Spark Match"
        eyebrow="Spark Match · Rival Circuit"
        title={template.name}
        onGuide={() => setGuide({ open: true, startAt: battle ? 'intent' : 'circuit' })}
        guideLabel="How to play Spark Match"
        headline={battle ? { label: 'Wave', value: `${wave}/3`, ariaLabel: `Wave ${wave} of 3` } : undefined}
      />

      {phase === 'loading' ? (
        <section className="grid flex-1 place-items-center px-5 text-center"><p>Restoring the saved circuit…</p></section>
      ) : phase === 'ready' || phase === 'reserving' ? (
        <MinigameStart
          artwork={(
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              {['Training Rival I', 'Training Rival II', 'Circuit Boss'].map((label, index) => <div key={label} className="rounded-sm border border-hairline-dark bg-black/15 p-2"><span className="numeral text-accent">{index + 1}</span><p className="mt-1 font-semibold">{label}</p></div>)}
            </div>
          )}
          eyebrow="Three waves · 6 × 5 board · no turn timer"
          title="Enter the Rival Circuit"
          subtitle={`${template.name} · ${scenarioForTier(scenario.tier)?.name ?? `Scenario ${scenario.tier}`}`}
          stake={(
            <>
              <MinigameGauge label={`TL ${scenario.trainingLevel} Training EXP`} value={scenario.trainingExp} maximum={trainingExpToNext(scenario.trainingLevel)} tone="accent" />
              <p className="mt-2 text-xs text-ink-on-dark-soft">A strong clear can earn up to {maxClearExp.toLocaleString()} EXP{possibleNodes > 0 ? ` and open ${possibleNodes} constellation node${possibleNodes === 1 ? '' : 's'}` : ''}.</p>
            </>
          )}
          rules={[
            'Drag one Chibi orb through neighboring cells to build several matches.',
            'Use the matchup ring, Spark Shift and Recovery to break Resolve while protecting Drive.',
            'The paid run freezes its seeded board and rivals; leaving and returning never rerolls it.',
          ]}
          cost={SPARK_MATCH_TICKET_COST}
          tickets={tickets}
          resume={resumeAvailable}
          pending={phase === 'reserving'}
          pendingLabel={resumeAvailable ? 'Restoring circuit…' : 'Reserving circuit…'}
          error={error}
          onBegin={start}
          onGuide={() => setGuide({ open: true, startAt: 'circuit' })}
        />
      ) : phase === 'complete' && reward && outcome ? (
        <MinigameResult
          outcome={outcome.kind === 'clear' ? 'cleared' : 'lost'}
          eyebrow={outcome.kind === 'clear' ? 'Victory' : 'Progress saved'}
          headline={outcome.reason === 'circuit-cleared' ? 'Circuit cleared' : outcome.reason === 'drive-depleted' ? 'Drive depleted' : 'Turn limit reached'}
          reason={<><strong className="text-ink-on-dark">+{reward.trainingExpEarned?.toLocaleString() ?? outcome.trainingExp.toLocaleString()} Training EXP</strong><span className="block">{outcome.reason === 'circuit-cleared' ? 'All three rivals defeated.' : 'Resolve progress was banked for this constellation.'}</span></>}
          artwork={<div className={`relative flex h-24 w-24 items-center justify-center rounded-full border text-accent ${outcome.kind === 'clear' ? 'border-accent bg-accent/20 shadow-[0_0_36px_rgba(242,189,85,0.35)]' : 'border-hairline-dark bg-stage-soft'}`}><span className="absolute inset-2 rounded-full border border-current/30" aria-hidden /><SparkIcon size={32} /></div>}
          reward={(
            <>
              <div className="flex items-center justify-between gap-2"><h3 className="text-lg">Training progress</h3><strong>TL {reward.trainingLevelBefore} → {reward.trainingLevelAfter}</strong></div>
              <div className="mt-3"><MinigameGauge label="Training EXP" value={reward.trainingExpAfter ?? 0} maximum={reward.trainingLevelAfter === MAX_TRAINING_LEVEL ? 1 : trainingExpToNext(reward.trainingLevelAfter ?? 1)} tone="accent" /></div>
              <p className="mt-2 text-sm text-ink-on-dark-soft">EXP {reward.trainingExpBefore ?? 0} → {reward.trainingExpAfter ?? 0}{crossedLevels.length > 0 ? ` · crossed ${crossedLevels.map((level) => `TL${level}`).join(', ')}` : ''}</p>
              <section className="mt-4"><h3 className="text-lg">Nodes opened</h3>{reward.nodesUnlocked?.length ? <div className="mt-2 grid gap-2">{reward.nodesUnlocked.map((node) => <Link key={node.id} to={constellationNodeHref(umaId, scenario.tier, node.id)} className="flex min-h-11 items-center justify-between rounded-sm border border-hairline-dark bg-black/15 px-3 font-semibold text-ink-on-dark"><span>{node.label}</span><ChevronRightIcon size={20} aria-hidden /></Link>)}</div> : <p className="mt-1 text-sm text-ink-on-dark-soft">No node opened this run; every EXP point carried forward.</p>}</section>
            </>
          )}
          doneTo={returnTo}
          again={{
            label: 'Run again',
            cost: SPARK_MATCH_TICKET_COST,
            tickets,
            disabled: (reward.trainingLevelAfter ?? MAX_TRAINING_LEVEL) >= MAX_TRAINING_LEVEL,
            onClick: () => void runAgain(),
          }}
        />
      ) : view ? (
        <>
          <section className="grid shrink-0 grid-cols-[1fr_auto] gap-3 border-b border-hairline-dark bg-stage-soft/90 px-3 py-2" aria-label="Battle status">
            <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2"><MinigameGauge label="Rival Resolve" value={hud?.resolve ?? view.replay.state.rival.resolve} maximum={hud?.maxResolve ?? view.replay.state.rival.maxResolve} tone="danger" /><MinigameGauge label="Drive" value={hud?.drive ?? view.replay.state.drive} maximum={hud?.maxDrive ?? view.replay.state.maxDrive} tone="success" /><MinigameGauge label="Spark Shift" value={hud?.sparkCharge ?? view.replay.state.sparkCharge} maximum={hud?.sparkTarget ?? view.replay.state.sparkTarget} tone="accent" /><Button variant="tertiary" size="sm" onClick={() => setGuide({ open: true, startAt: 'advantage' })} className="!flex min-h-11 !items-center !justify-between rounded-xs !border !border-hairline-dark !bg-black/15 !px-2 !py-1 text-left !font-ui text-xs !text-ink-on-dark !shadow-none" style={{ borderColor: SPARK_ORB_COLORS[hud?.rivalStrategy ?? view.replay.state.rival.strategy] }}><span className="min-w-0 truncate"><b>{hud?.rivalLabel ?? view.snapshot.encounter.waves[view.replay.state.waveIndex]!.label}</b><span className="block truncate text-[10px] text-ink-on-dark-soft">{SPARK_STRATEGY_LABELS[hud?.rivalStrategy ?? view.replay.state.rival.strategy]} · Next {hud?.intent ?? '—'}</span></span><span className="numeral ml-2 text-base">{hud?.countdown ?? view.replay.state.rival.countdown}</span></Button></div>
            <div className="flex min-w-14 flex-col items-center justify-center rounded-sm border border-hairline-dark bg-black/20 px-2"><span className="text-[9px] text-ink-on-dark-soft uppercase">Move</span><span className="numeral numeral-on-dark text-xl">{(hud?.waveTurn ?? view.replay.state.waveTurn) + 1}<small className="text-xs text-ink-on-dark-soft">/8</small></span><span className="text-[9px] text-accent">{hud?.movementRemainingMs === null || hud?.movementRemainingMs === undefined ? 'PLAN' : `${(hud.movementRemainingMs / 1_000).toFixed(1)}s`}</span></div>
          </section>
          {view.snapshot.source === 'fallback' && <p className="shrink-0 bg-warning/15 px-3 py-1 text-center text-[10px] text-warning">Authored circuit unavailable; deterministic catalogue rivals are in use.</p>}
          <div ref={hostRef} className="min-h-0 flex-1" aria-describedby="spark-board-help" />
          <section className="shrink-0 border-t border-hairline-dark bg-stage/95 px-3 pt-2 pb-2">
            <p id="spark-board-help" className="sr-only">Touch and drag an orb through adjacent board cells, then release to resolve one turn. The board itself is a pointer-only mechanic.</p>
            <p className="sr-only" aria-live="polite" aria-atomic="true">{hud && `Update ${hud.announcementSerial}. ${hud.announcement}`}</p>
            <p className="min-h-5 truncate text-center text-xs font-semibold">{phase === 'committing' ? 'Saving Training progress…' : error ?? hud?.status ?? 'Restoring battle…'}</p>
            <div className="mt-2 grid grid-cols-2 gap-2"><Button variant="tertiary" size="sm" onClick={() => setGuide({ open: true, startAt: 'advantage' })} className="w-full !border !border-hairline-dark !bg-stage-soft !text-ink-on-dark !shadow-none">Matchups</Button><Button size="sm" disabled={phase !== 'playing' || !hud || hud.inputLocked || hud.dragging || hud.sparkCharge < hud.sparkTarget} onClick={() => sceneRef.current?.triggerShift()} className="w-full">Spark Shift</Button></div>
            {hud?.recoveryNeeded && <div className="mt-2 grid grid-cols-2 gap-2"><Button size="sm" onClick={() => sceneRef.current?.retryRestore()}>Retry run</Button><Link to={returnTo} className="font-display flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark px-3 font-semibold text-ink-on-dark">Return</Link></div>}
            {error && view.replay.outcome && <Button variant="tertiary" size="sm" onClick={retryCommit} className="mt-2 w-full !border !border-accent !text-accent !shadow-none">Retry save</Button>}
          </section>
          <div className="pointer-events-auto fixed inset-0 z-50 hidden flex-col items-center justify-center bg-stage/95 p-6 text-center landscape:flex" role="status">
            <SparkIcon size={32} className="text-accent" />
            <h2 className="mt-3 text-2xl">Rotate to portrait</h2>
            <p className="mt-2 max-w-xs text-sm text-ink-on-dark-soft">Your run is saved at the last completed turn. Rotate back to continue safely.</p>
          </div>
        </>
      ) : null}
      <SparkRivalGuide open={guide.open} startAt={guide.startAt} onClose={closeGuide} />
    </MinigameShell>
  )
}
