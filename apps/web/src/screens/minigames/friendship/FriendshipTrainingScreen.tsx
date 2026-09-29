import {
  FRIENDSHIP_TRAINING_TICKET_COST,
  FT_STAGES,
  MAX_SCENARIO_TIER,
  MAX_STARS,
  cardStars,
  ftCardDef,
  ftFinished,
  ftStateHash,
  ftTwist,
  scenarioForTier,
  type FtAction,
  type FtSetup,
  type FtState,
} from '@racer/domain'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router'
import { useContent } from '../../../content/ContentProvider'
import { safeReturnPath } from '../../../game/bond-links'
import { getMinigameHost, type RunReward, type RunTarget, type RunTicket } from '../../../game/minigame-host'
import { getMinigameJournal, type FriendshipRunView } from '../../../game/minigame-journal'
import { useGame } from '../../../game/store'
import { BottomSheet } from '../../../ui/BottomSheet'
import { Button, IconButton } from '../../../ui/Button'
import { CardsIcon, MoreIcon } from '../../../ui/icons'
import { MinigameResult } from '../../../ui/minigames/MinigameResult'
import { MinigameHeader, MinigameShell } from '../../../ui/minigames/MinigameShell'
import { MinigameStart } from '../../../ui/minigames/MinigameStart'
import { Stars } from '../../../ui/Stars'
import { GainedStars } from '../GainedStars'
import { useCardArt } from '../useCardArt'
import { FtCard } from './FtCard'
import { FtGuide, guideSeen, rememberGuideSeen, type GuidePageId } from './FtGuide'
import { SeasonMap } from './FtScene'
import { BuildView, DeckSheet, EncounterView, FacilityView, RewardView, ShopView, SkillBar, SkillView, runProgress, type ViewProps } from './FtViews'

type Phase = 'start' | 'loading' | 'playing' | 'saving' | 'committing' | 'commit-error' | 'done'

interface Run {
  ticket: RunTicket
  setup: FtSetup
  actions: FtAction[]
  state: FtState
}

/** The guide page that explains what the run is asking for right now. */
const guidePageFor = (state: FtState): GuidePageId => {
  switch (state.phase) {
    case 'build':
    case 'facility': return 'facility'
    case 'encounter': return state.encounter?.kind === 'race' ? 'races' : 'train'
    case 'reward': return 'points'
    case 'skill':
    case 'shop': return 'skills'
    default: return 'goal'
  }
}

const messageOf = (reason: unknown, fallback: string) => reason instanceof Error ? reason.message : fallback

const runFromView = (view: FriendshipRunView): Run => ({
  ticket: view.ticket,
  setup: view.snapshot.setup,
  actions: [...view.actions],
  state: view.replay,
})

/**
 * Friendship Training (M020 T063, D146, D168): train one card through a season of weeks and races; a clear is one star
 * in one scenario. It is the card minigame: every Bond button opens it (D177).
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
  const [menuOpen, setMenuOpen] = useState(false)
  // The guide opens by itself on a device's first visit, then from the start screen and the run's menu.
  const [guide, setGuide] = useState<{ open: boolean; startAt: GuidePageId }>(() => ({ open: !guideSeen(), startAt: 'goal' }))
  const closeGuide = () => {
    rememberGuideSeen()
    setGuide((current) => ({ ...current, open: false }))
  }
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
      const result = await getMinigameHost().commitRun(current.ticket.runId, {
        kind: 'friendship-training',
        engine: 'friendship-training-v1',
        actionCount: current.actions.length,
        stateHash: ftStateHash(current.state),
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
      const saved = await getMinigameJournal().load(ticket.runId)
      if (saved.engine !== 'friendship-training-v1') throw new Error('The saved run belongs to another minigame')
      const next = runFromView(saved)
      setRun(next)
      setOpenRun(ticket)
      if (ftFinished(next.state)) await commit(next)
      else setPhase('playing')
    } catch (reason) {
      setError(messageOf(reason, 'The run could not begin'))
      setPhase('start')
    }
  }

  async function persistAction(action: FtAction) {
    if (!run || phase !== 'playing') return
    setPhase('saving')
    setError(null)
    try {
      const saved = await getMinigameJournal().append(run.ticket.runId, run.actions.length, action)
      if (saved.engine !== 'friendship-training-v1') throw new Error('The saved run belongs to another minigame')
      const next = runFromView(saved)
      setRun(next)
      if (ftFinished(next.state)) await commit(next)
      else setPhase('playing')
    } catch (reason) {
      try {
        const restored = await getMinigameJournal().load(run.ticket.runId)
        if (restored.engine !== 'friendship-training-v1') throw new Error('The saved run belongs to another minigame')
        const next = runFromView(restored)
        setRun(next)
        setError(`${messageOf(reason, 'That move could not be saved')} The run was restored.`)
        if (ftFinished(next.state)) await commit(next)
        else setPhase('playing')
      } catch (restoreReason) {
        setError(messageOf(restoreReason, 'The saved run could not be restored'))
        setPhase('commit-error')
      }
    }
  }

  function act(action: FtAction) { void persistAction(action) }

  const view: ViewProps | null = run ? { content, setup: run.setup, state: run.state, art, act, busy: phase !== 'playing' } : null
  const stageCount = FT_STAGES[stars + 1] ?? 0
  const playing = Boolean(view && run && !ftFinished(run.state) &&
    (phase === 'playing' || phase === 'saving' || phase === 'committing' || phase === 'commit-error'))
  const showInlineError = Boolean(error && run && !ftFinished(run.state))

  return (
    <MinigameShell playing={playing}>
      <MinigameHeader
        backTo={returnTo}
        backLabel="Leave Friendship Training"
        eyebrow={run && phase !== 'start' ? runProgress(run.setup, run.state) : `Friendship Training · ${scenario?.name ?? `Tier ${tier}`}`}
        title={template.charName}
        onGuide={() => setGuide({ open: true, startAt: run ? guidePageFor(run.state) : 'goal' })}
        guideLabel="How to play Friendship Training"
        headline={playing && run ? { label: 'Fans', value: run.state.fans, ariaLabel: `${run.state.fans} fans` } : undefined}
        trailing={playing && run ? (
          <div className="flex gap-1">
            <IconButton onClick={() => setDeckOpen(true)} className="!border !border-hairline-dark !bg-stage-soft !text-ink-on-dark !shadow-none" aria-label="Deck">
              <CardsIcon size={20} />
            </IconButton>
            <IconButton onClick={() => setMenuOpen(true)} className="!border !border-hairline-dark !bg-stage-soft !text-ink-on-dark !shadow-none" aria-label="Menu">
              <MoreIcon size={20} />
            </IconButton>
          </div>
        ) : undefined}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        {showInlineError && <p role="alert" className="mx-4 rounded-sm bg-danger/20 px-3 py-2 text-[13px]">{error}</p>}

        {(phase === 'start' || phase === 'loading') && (
          stars >= MAX_STARS ? (
            <section className="grid flex-1 place-content-center justify-items-center gap-3 text-center">
              <div className="w-40"><FtCard content={content} def={ftCardDef(template, MAX_STARS)} art={art.get(template.id) ?? null} /></div>
              <h2 className="text-2xl">Already fully bonded</h2>
              <p className="text-[14px] text-ink-on-dark-soft">This card is already 5★ in {scenario?.name}.</p>
            </section>
          ) : (
            <MinigameStart
              artwork={<div className="w-40"><FtCard content={content} def={ftCardDef(template, stars)} art={art.get(template.id) ?? null} /></div>}
              eyebrow="Friendship Training"
              title={template.charName}
              subtitle={template.title}
              stake={<div className="flex items-center justify-center gap-2 text-[13px]"><Stars value={stars} onDark /><span className="text-ink-on-dark-soft">now → {stars + 1}★ in {scenario?.name}</span></div>}
              rules={[
                `${stageCount} stage${stageCount === 1 ? '' : 's'}: two training weeks and a race each.`,
                'Play cards in formations to reach each target. Three of the facility’s type make a Rainbow.',
                `Train with ${template.charName} three times to bond: the card then counts as every type.`,
                <span><span className="font-semibold text-accent">{twist.name}:</span> {twist.rule}</span>,
                'Clear every week and race for the star. A loss keeps the ticket spent.',
              ]}
              cost={FRIENDSHIP_TRAINING_TICKET_COST}
              tickets={tickets}
              resume={Boolean(openRun)}
              pending={phase === 'loading' || openRun === undefined}
              pendingLabel={phase === 'loading' ? 'Loading run…' : 'Checking saved run…'}
              error={error}
              onBegin={() => void begin()}
              onGuide={() => setGuide({ open: true, startAt: 'goal' })}
            />
          )
        )}

        {view && (phase === 'playing' || phase === 'saving' || phase === 'committing' || phase === 'commit-error') && run && !ftFinished(run.state) && (
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-2">
            <SeasonMap setup={run.setup} state={run.state} />
            <SkillBar setup={run.setup} state={run.state} />
            {/* The page never scrolls during play; a phase taller than the phone (the shop, a long reward list) scrolls here. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
              {run.state.phase === 'build' && <BuildView {...view} />}
              {run.state.phase === 'facility' && <FacilityView {...view} />}
              {run.state.phase === 'encounter' && <EncounterView {...view} />}
              {run.state.phase === 'reward' && <RewardView {...view} />}
              {run.state.phase === 'skill' && <SkillView {...view} />}
              {run.state.phase === 'shop' && <ShopView {...view} />}
            </div>
          </div>
        )}

        {run && ftFinished(run.state) && phase !== 'start' && phase !== 'loading' && (
          <MinigameResult
            outcome={run.state.phase === 'won' ? 'cleared' : 'lost'}
            eyebrow={run.state.phase === 'won' ? 'Season cleared' : 'Run over'}
            headline={run.state.phase === 'won' ? `${template.charName} bonded` : 'Not this time'}
            reason={run.state.phase === 'lost' ? `${run.state.lossReason} The ticket stays spent.` : undefined}
            artwork={<div className="w-36"><FtCard content={content} def={run.setup.cards[run.setup.mainCardId]!} art={art.get(run.setup.mainCardId) ?? null} bonded={run.state.phase === 'won'} /></div>}
            reward={reward && run.state.phase === 'won' ? (
              <div className="grid justify-items-center gap-2 text-center">
                <h3 className="text-lg">Scenario stars</h3>
                <GainedStars before={reward.starsBefore ?? stars} after={reward.starsAfter ?? stars} onDark />
                {reward.couponGranted && <p className="text-[13px] text-accent">5★: a Card Select Coupon is yours.</p>}
              </div>
            ) : undefined}
            pending={phase === 'committing'}
            error={phase === 'commit-error' ? error : null}
            onRetry={() => void commit(run)}
            doneTo={returnTo}
            again={(reward?.starsAfter ?? stars) < MAX_STARS ? {
              label: 'Train again',
              cost: FRIENDSHIP_TRAINING_TICKET_COST,
              tickets,
              onClick: () => { setRun(null); void begin() },
            } : undefined}
          />
        )}
      </div>

      {run && view && (
        <DeckSheet content={content} setup={run.setup} state={run.state} art={art} open={deckOpen} title="Your deck" onClose={() => setDeckOpen(false)} />
      )}
      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="grid gap-2 pb-2">
          <Button variant="secondary" className="w-full" onClick={() => { setMenuOpen(false); setGuide({ open: true, startAt: run ? guidePageFor(run.state) : 'goal' }) }}>How to play</Button>
          <Button variant="destructive" className="w-full" onClick={() => { setMenuOpen(false); setConfirmGiveUp(true) }}>Give up this run</Button>
        </div>
      </BottomSheet>
      <FtGuide open={guide.open} tier={tier} startAt={guide.startAt} onClose={closeGuide} />
      <BottomSheet open={confirmGiveUp} onClose={() => setConfirmGiveUp(false)}>
        <h2 className="text-lg font-semibold">Give up this run?</h2>
        <p className="mt-1 text-[14px] text-ink-soft">It ends as a loss: no star, and the ticket stays spent.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 pb-2">
          <Button variant="secondary" onClick={() => setConfirmGiveUp(false)}>Keep going</Button>
          <Button variant="destructive" onClick={() => { setConfirmGiveUp(false); act({ type: 'give-up' }) }}>Give up</Button>
        </div>
      </BottomSheet>
    </MinigameShell>
  )
}
