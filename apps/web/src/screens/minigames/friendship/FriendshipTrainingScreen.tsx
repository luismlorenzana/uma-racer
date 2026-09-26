import {
  FRIENDSHIP_TRAINING_TICKET_COST,
  FT_STAGES,
  FtActionError,
  MAX_SCENARIO_TIER,
  MAX_STARS,
  cardStars,
  ftApply,
  ftCardDef,
  ftFinished,
  ftReplay,
  ftTwist,
  scenarioForTier,
  type FtAction,
  type FtSetup,
  type FtState,
} from '@racer/domain'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { useContent } from '../../../content/ContentProvider'
import { safeReturnPath } from '../../../game/bond-links'
import { getMinigameHost, type RunReward, type RunTarget, type RunTicket } from '../../../game/minigame-host'
import { useGame } from '../../../game/store'
import { BottomSheet } from '../../../ui/BottomSheet'
import { Button } from '../../../ui/Button'
import { CardsIcon, ChevronLeftIcon } from '../../../ui/icons'
import { Stars } from '../../../ui/Stars'
import { formatTickets } from '../../../ui/tickets'
import { GainedStars } from '../GainedStars'
import { useCardArt } from '../useCardArt'
import { FtCard } from './FtCard'
import { SeasonMap } from './FtScene'
import { BuildView, DeckSheet, EncounterView, FacilityView, RewardView, ShopView, SkillBar, SkillView, runProgress, type ViewProps } from './FtViews'

type Phase = 'start' | 'loading' | 'playing' | 'committing' | 'commit-error' | 'done'

interface Run {
  ticket: RunTicket
  setup: FtSetup
  actions: FtAction[]
  state: FtState
}

const messageOf = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback

/**
 * Friendship Training (M020 T063, D146, D168): train one card through a season of weeks and races; a clear is one star
 * in one scenario. Beta beside Bond Recall until the owner prefers it (T065).
 */
export function FriendshipTrainingScreen() {
  const { cardId = '' } = useParams()
  const [params] = useSearchParams()
  const tier = Math.max(1, Math.min(MAX_SCENARIO_TIER, Number(params.get('tier') ?? '1') || 1))
  const umaParam = params.get('uma')
  const returnTo = safeReturnPath(params.get('return'), `/cards/${encodeURIComponent(cardId)}`)
  const contentState = useContent()
  const gameStatus = useGame((state) => state.status)
  const cardSave = useGame((state) => state.cards[cardId])
  const tickets = useGame((state) => state.profile?.tickets ?? 0)
  const content = contentState.status === 'ready' ? contentState.content : null
  const template = content?.cards.byId.get(cardId)
  const target = useMemo<RunTarget>(() => ({ kind: 'friendship-training', cardId, tier, umaId: umaParam }), [cardId, tier, umaParam])

  const [phase, setPhase] = useState<Phase>('start')
  const [run, setRun] = useState<Run | null>(null)
  const [openRun, setOpenRun] = useState<RunTicket | null | undefined>(undefined)
  const [reward, setReward] = useState<RunReward | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  const [deckOpen, setDeckOpen] = useState(false)
  const saves = useRef<Promise<void>>(Promise.resolve())

  const artIds = useMemo(() => run ? Object.keys(run.setup.cards) : template ? [template.id] : [], [run, template])
  const art = useCardArt(content, artIds)

  useEffect(() => {
    if (gameStatus !== 'ready' || !cardSave) return
    let cancelled = false
    getMinigameHost().findOpenRun(target).then((found) => { if (!cancelled) setOpenRun(found) }).catch(() => { if (!cancelled) setOpenRun(null) })
    return () => { cancelled = true }
  }, [cardSave, gameStatus, target])

  if (gameStatus === 'ready' && contentState.status === 'ready' && (!cardSave || !template)) return <Navigate to="/cards" replace />
  if (!content || !template || !cardSave) {
    return <div className="flex h-dvh items-center justify-center bg-stage text-ink-on-dark-soft" aria-label="Loading Friendship Training">Loading…</div>
  }

  const stars = cardStars(cardSave, tier)
  const scenario = scenarioForTier(tier)
  const twist = ftTwist(tier)

  async function commit(current: Run) {
    setPhase('committing')
    setError(null)
    try {
      await saves.current
      const result = await getMinigameHost().commitRun(current.ticket.runId, {
        kind: 'friendship-training',
        cleared: current.state.phase === 'won',
        actions: current.actions,
      })
      setReward(result)
      setOpenRun(null)
      setPhase('done')
    } catch (reason) {
      setError(messageOf(reason, 'The run could not be saved'))
      setPhase('commit-error')
    }
  }

  async function begin() {
    setPhase('loading')
    setError(null)
    setReward(null)
    try {
      const ticket = await getMinigameHost().beginRun('friendship-training', target)
      const saved = await getMinigameHost().loadRun(ticket.runId)
      if (!saved) throw new Error('This run has no saved setup')
      const next: Run = { ticket, setup: saved.setup, actions: saved.actions, state: ftReplay(saved.setup, saved.actions) }
      setRun(next)
      setOpenRun(ticket)
      if (ftFinished(next.state)) await commit(next)
      else setPhase('playing')
    } catch (reason) {
      setError(messageOf(reason, 'The run could not begin'))
      setPhase('start')
    }
  }

  function act(action: FtAction) {
    if (!run || phase !== 'playing') return
    let state: FtState
    try {
      state = ftApply(run.setup, run.state, action)
    } catch (reason) {
      setError(reason instanceof FtActionError ? reason.message : messageOf(reason, 'That move is not allowed'))
      return
    }
    setError(null)
    const next: Run = { ...run, actions: [...run.actions, action], state }
    setRun(next)
    // Saves run in order, so a reload always resumes from the latest choice.
    const { runId } = run.ticket
    saves.current = saves.current.then(() => getMinigameHost().saveProgress(runId, next.actions)).catch((reason: unknown) => {
      setError(messageOf(reason, 'Could not save this move; a reload resumes from the last saved one'))
    })
    if (ftFinished(state)) void commit(next)
  }

  const view: ViewProps | null = run ? { content, setup: run.setup, state: run.state, art, act, busy: phase !== 'playing' } : null
  const stageCount = FT_STAGES[stars + 1] ?? 0

  return (
    <div className="flex h-dvh flex-col bg-stage text-ink-on-dark pt-safe">
      <header className="flex items-center gap-2 px-4 py-2">
        <Link to={returnTo} className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-hairline-dark bg-stage-soft" aria-label="Back">
          <ChevronLeftIcon size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{template.charName}</p>
          <p className="truncate text-[11px] text-ink-on-dark-soft">
            {run && phase !== 'start' ? runProgress(run.setup, run.state) : `Friendship Training · ${scenario?.name ?? `Tier ${tier}`}`}
          </p>
        </div>
        {run && phase === 'playing' && (
          <>
            <span className="font-display rounded-full bg-white/10 px-2.5 text-[13px] leading-8 font-semibold tabular-nums" aria-label={`${run.state.fans} fans`}>{run.state.fans} fans</span>
            <button type="button" onClick={() => setDeckOpen(true)} className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-hairline-dark bg-stage-soft" aria-label="Deck">
              <CardsIcon size={20} />
            </button>
            <button type="button" onClick={() => setConfirmGiveUp(true)} className="min-h-11 rounded-sm px-2 text-[12px] font-semibold text-ink-on-dark-soft">Give up</button>
          </>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-2">
        {error && <p role="alert" className="rounded-sm bg-danger/20 px-3 py-2 text-[13px]">{error}</p>}

        {(phase === 'start' || phase === 'loading') && (
          <div className="flex flex-1 flex-col gap-3">
            <div className="mx-auto w-40"><FtCard content={content} def={ftCardDef(template, Math.min(stars, MAX_STARS))} art={art.get(template.id) ?? null} /></div>
            <div className="text-center">
              <p className="text-micro text-accent">Friendship Training · beta</p>
              <h1 className="text-xl font-semibold">{template.charName}</h1>
              <p className="text-[12px] text-ink-on-dark-soft">{template.title}</p>
            </div>
            {stars >= MAX_STARS ? (
              <p className="text-center text-[14px]">This card is already 5★ in {scenario?.name}.</p>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 text-[13px]">
                  <Stars value={stars} onDark /> <span className="text-ink-on-dark-soft">now → {stars + 1}★ in {scenario?.name}</span>
                </div>
                <ul className="grid gap-1 rounded-md border border-hairline-dark bg-stage-soft px-3 py-2 text-[13px]">
                  <li>{stageCount} stage{stageCount === 1 ? '' : 's'}: two training weeks and a race each.</li>
                  <li>Play cards in formations to reach each target. Three of the facility’s type make a Rainbow.</li>
                  <li>Train with {template.charName} three times to bond: the card then counts as every type.</li>
                  <li><span className="font-semibold text-accent">{twist.name}:</span> {twist.rule}</li>
                  <li>Clear every week and race for the star. A loss keeps the ticket spent.</li>
                </ul>
                <div className="mt-auto grid gap-2 pb-safe">
                  <Button className="w-full" disabled={phase === 'loading' || openRun === undefined || (!openRun && tickets < FRIENDSHIP_TRAINING_TICKET_COST)} onClick={() => void begin()}>
                    {openRun ? 'Resume' : `Begin · ${formatTickets(FRIENDSHIP_TRAINING_TICKET_COST)}`}
                  </Button>
                  {!openRun && tickets < FRIENDSHIP_TRAINING_TICKET_COST && <p className="text-center text-[12px] text-ink-on-dark-soft">You need {formatTickets(FRIENDSHIP_TRAINING_TICKET_COST)}.</p>}
                </div>
              </>
            )}
          </div>
        )}

        {view && (phase === 'playing' || phase === 'committing' || phase === 'commit-error') && run && !ftFinished(run.state) && (
          <>
            <SeasonMap setup={run.setup} state={run.state} />
            <SkillBar setup={run.setup} state={run.state} />
            {run.state.phase === 'build' && <BuildView {...view} />}
            {run.state.phase === 'facility' && <FacilityView {...view} />}
            {run.state.phase === 'encounter' && <EncounterView {...view} />}
            {run.state.phase === 'reward' && <RewardView {...view} />}
            {run.state.phase === 'skill' && <SkillView {...view} />}
            {run.state.phase === 'shop' && <ShopView {...view} />}
          </>
        )}

        {run && ftFinished(run.state) && phase !== 'start' && phase !== 'loading' && (
          <div className="flex flex-1 flex-col items-center gap-3 pt-4 text-center">
            <div className="w-36"><FtCard content={content} def={run.setup.cards[run.setup.mainCardId]!} art={art.get(run.setup.mainCardId) ?? null} bonded={run.state.phase === 'won'} /></div>
            {run.state.phase === 'won' ? (
              <>
                <p className="text-micro text-accent">Season cleared</p>
                <h2 className="text-2xl font-semibold">{template.charName} bonded</h2>
                {reward && <GainedStars before={reward.starsBefore ?? stars} after={reward.starsAfter ?? stars} onDark />}
                {reward?.couponGranted && <p className="text-[13px] text-accent">5★: a Card Select Coupon is yours.</p>}
              </>
            ) : (
              <>
                <p className="text-micro text-ink-on-dark-soft">Run over</p>
                <h2 className="text-2xl font-semibold">Not this time</h2>
                <p className="text-[14px] text-ink-on-dark-soft">{run.state.lossReason} The ticket stays spent.</p>
              </>
            )}
            {phase === 'committing' && <p className="text-[13px] text-ink-on-dark-soft">Saving…</p>}
            {phase === 'commit-error' && <Button onClick={() => void commit(run)}>Retry saving</Button>}
            {phase === 'done' && (
              <div className="mt-auto grid w-full gap-2 pb-safe">
                {(reward?.starsAfter ?? stars) < MAX_STARS && tickets >= FRIENDSHIP_TRAINING_TICKET_COST && (
                  <Button className="w-full" onClick={() => { setRun(null); void begin() }}>Train again · {formatTickets(FRIENDSHIP_TRAINING_TICKET_COST)}</Button>
                )}
                <Link to={returnTo} className="font-display flex min-h-11 items-center justify-center rounded-sm border border-hairline-dark text-[15px] font-semibold">Done</Link>
              </div>
            )}
          </div>
        )}
      </main>

      {run && view && (
        <DeckSheet content={content} setup={run.setup} state={run.state} art={art} open={deckOpen} title="Your deck" onClose={() => setDeckOpen(false)} />
      )}
      <BottomSheet open={confirmGiveUp} onClose={() => setConfirmGiveUp(false)}>
        <h2 className="text-lg font-semibold">Give up this run?</h2>
        <p className="mt-1 text-[14px] text-ink-soft">It ends as a loss: no star, and the ticket stays spent.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 pb-2">
          <Button variant="secondary" onClick={() => setConfirmGiveUp(false)}>Keep going</Button>
          <Button variant="destructive" onClick={() => { setConfirmGiveUp(false); act({ type: 'give-up' }) }}>Give up</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
