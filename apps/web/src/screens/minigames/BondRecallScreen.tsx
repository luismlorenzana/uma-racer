import {
  BOND_RECALL_TICKET_COST,
  MAX_SCENARIO_TIER,
  MAX_STARS,
  cardNodeValue,
  cardStars,
  scenarioForTier,
} from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import type { LoadedContent } from '../../content/runtime'
import { safeReturnPath } from '../../game/bond-links'
import { getMinigameHost, type RunReward, type RunTicket } from '../../game/minigame-host'
import {
  BOND_FLIP_BACK_MS,
  bondRecallConfig,
  bondMismatchesRemaining,
  flipBondTile,
  hideBondMismatch,
  startBondRecall,
  type BondRecallState,
} from '../../game/minigames/bond-recall'
import { useGame } from '../../game/store'
import { formatTickets } from '../../ui/tickets'
import { BondBoard, CardArt } from './BondBoard'

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

function useCardArt(content: LoadedContent | null, cardIds: readonly string[]): ReadonlyMap<string, string> {
  const [art, setArt] = useState<ReadonlyMap<string, string>>(new Map())
  const key = cardIds.join('\u0000')

  useEffect(() => {
    if (!content || key.length === 0) {
      setArt(new Map())
      return
    }
    let cancelled = false
    const ids = [...new Set(cardIds)]
    void Promise.all(ids.map(async (id) => {
      if (!content.art.has('card', id)) return null
      try {
        const url = await content.art.load('card', id)
        return url ? ([id, url] as const) : null
      } catch {
        return null
      }
    })).then((loaded) => {
      if (!cancelled) setArt(new Map(loaded.filter((entry): entry is readonly [string, string] => entry !== null)))
    })
    return () => { cancelled = true }
  }, [content, key])

  return art
}

/** The card's stars after the run, the one just earned popping in. */
function GainedStars({ before, after }: { before: number; after: number }) {
  const reducedMotion = useReducedMotion()
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${after} of ${MAX_STARS} stars`}>
      {Array.from({ length: MAX_STARS }, (_, index) => {
        const filled = index < after
        const gained = index >= before && filled
        return (
          <m.svg
            key={index}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`h-6 w-6 ${filled ? 'text-accent' : 'text-hairline-strong'}`}
            initial={gained && !reducedMotion ? { opacity: 0, scale: 0.35 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.24, delay: gained && !reducedMotion ? index * 0.06 : 0 }}
          >
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor" />
          </m.svg>
        )
      })}
    </span>
  )
}

export function BondRecallScreen() {
  const { cardId = '' } = useParams()
  const [params] = useSearchParams()
  // A break belongs to one scenario, so the run has to name it (D127).
  const tier = Math.max(1, Math.min(MAX_SCENARIO_TIER, Number(params.get('tier') ?? '1') || 1))
  // Every entry names where it came from, and every exit goes back there (M016).
  const umaParam = params.get('uma')
  const returnTo = safeReturnPath(params.get('return'), umaParam ? `/constellation/${encodeURIComponent(umaParam)}/cards` : '/cards')
  const contentState = useContent()
  const gameStatus = useGame((state) => state.status)
  const cards = useGame((state) => state.cards)
  const umas = useGame((state) => state.umas)
  const card = cards[cardId]
  const template = contentState.status === 'ready' && card ? contentState.content.cards.byId.get(card.templateId) : undefined
  const ownedEntries = useMemo(() => Object.entries(cards).sort(([left], [right]) => left.localeCompare(right)), [cards])
  const ownedCardIds = useMemo(() => ownedEntries.map(([, save]) => save.templateId), [ownedEntries])
  const activeCardIds = useMemo(() => {
    // Faces come from the set the run was launched from, else the first set anyone holds in this scenario.
    const named = umaParam ? umas[umaParam]?.scenarios.find((run) => run.tier === tier) : undefined
    const any = Object.values(umas)
      .sort((left, right) => left.templateId.localeCompare(right.templateId))
      .flatMap((uma) => uma.scenarios.filter((run) => run.tier === tier && run.cardSetIds.length > 0))[0]
    return (named && named.cardSetIds.length > 0 ? named : any)?.cardSetIds.filter((id) => ownedCardIds.includes(id)) ?? []
  }, [ownedCardIds, tier, umaParam, umas])
  const boardCardIds = activeCardIds.length > 0 ? activeCardIds : ownedCardIds.slice(0, 6)
  const [ticket, setTicket] = useState<RunTicket | null>(null)
  const [run, setRun] = useState<BondRecallState | null>(null)
  const [phase, setPhase] = useState<'ready' | 'reserving' | 'playing' | 'committing' | 'commit-error' | 'complete'>('ready')
  const [reward, setReward] = useState<RunReward | null>(null)
  const [message, setMessage] = useState('Find every matching pair before the mismatch counter reaches zero.')
  const [error, setError] = useState<string | null>(null)
  const animationId = useRef(0)
  const committedRun = useRef<string | null>(null)
  // The card being bonded is shown whether or not it is one of the board's faces.
  const faceIds = useMemo(() => [...new Set([cardId, ...(run ? run.tiles.map((tile) => tile.cardId) : boardCardIds)])], [boardCardIds, cardId, run])
  const readyContent = contentState.status === 'ready' ? contentState.content : null
  const art = useCardArt(readyContent, faceIds)

  useEffect(() => () => { animationId.current += 1 }, [])

  const finish = async (reserved: RunTicket, completed: BondRecallState) => {
    if (committedRun.current === reserved.runId) return
    committedRun.current = reserved.runId
    setPhase('committing')
    setMessage(completed.status === 'won' ? 'Every pair found. Saving the star…' : 'Run over. Saving the result…')
    try {
      const nextReward = await getMinigameHost().commitRun(reserved.runId, {
        kind: 'bond-recall',
        cleared: completed.status === 'won',
        mismatches: completed.mismatches,
      })
      setReward(nextReward)
      setPhase('complete')
    } catch (reason) {
      committedRun.current = null
      setError(reason instanceof Error ? reason.message : 'Bond Recall result could not be saved')
      setPhase('commit-error')
      setMessage('The run is finished. Retry saving when ready.')
    }
  }

  const start = async () => {
    if (!card || cardStars(card, tier) >= MAX_STARS || phase !== 'ready') return
    setPhase('reserving')
    setError(null)
    try {
      const reserved = await getMinigameHost().beginRun('bond-recall', { kind: 'bond-recall', cardId, tier })
      const next = startBondRecall(reserved.seed, cardStars(card, tier), boardCardIds, ownedCardIds)
      setTicket(reserved)
      setRun(next)
      setPhase('playing')
      setMessage(`Run ${reserved.attemptIndex + 1} reserved · tap two cards to find a pair.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Bond Recall could not begin')
      setPhase('ready')
    }
  }

  const chooseTile = async (index: number) => {
    if (phase !== 'playing' || !run || !ticket || run.status !== 'playing') return
    const flip = flipBondTile(run, index)
    if (!flip.accepted) return
    setRun(flip.state)
    if (flip.result === 'first') {
      setMessage('Choose one more card.')
      return
    }
    if (flip.result === 'match') {
      setMessage(flip.state.status === 'won' ? 'All bonds recalled!' : `Match · ${flip.state.matched.length / 2} of ${flip.state.config.pairs} pairs found.`)
      if (flip.state.status === 'won') await finish(ticket, flip.state)
      return
    }
    const currentAnimation = ++animationId.current
    setMessage(flip.state.status === 'lost'
      ? 'No mismatches remain.'
      : `Not a match · ${bondMismatchesRemaining(flip.state)} chances remain.`)
    await delay(BOND_FLIP_BACK_MS)
    if (currentAnimation !== animationId.current) return
    if (flip.state.status === 'lost') {
      await finish(ticket, flip.state)
      return
    }
    setRun(hideBondMismatch(flip.state))
  }

  const again = () => {
    animationId.current += 1
    committedRun.current = null
    setReward(null)
    setRun(null)
    setTicket(null)
    setError(null)
    setPhase('ready')
    setMessage('Find every matching pair before the mismatch counter reaches zero.')
  }

  const retryCommit = () => {
    if (run && ticket && (run.status === 'won' || run.status === 'lost')) void finish(ticket, run)
  }

  if (contentState.status !== 'ready' || gameStatus !== 'ready') {
    const title = contentState.status === 'signed-out' || gameStatus === 'signed-out'
      ? 'Sign in to play Bond Recall'
      : contentState.status === 'empty'
        ? 'Content is not imported'
        : 'Preparing Bond Recall…'
    return <div className="flex h-dvh items-center justify-center bg-stage p-5 text-ink-on-dark"><div className="text-center"><h1 className="text-xl">{title}</h1><Link to="/cards" className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-display font-semibold text-ink">Back to Cards</Link></div></div>
  }

  // A bond belongs to a card and a scenario, so a run without a card has nothing to name (M016).
  if (!cardId) return <Navigate to="/cards" replace />

  if (!card || !template) {
    return <div className="flex h-dvh items-center justify-center bg-stage p-5 text-ink-on-dark"><div className="text-center"><h1 className="text-xl">Owned card not found</h1><Link to={returnTo} className="mt-4 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-display font-semibold text-ink">Back</Link></div></div>
  }

  if (cardStars(card, tier) >= MAX_STARS && phase === 'ready') {
    return <div className="flex h-dvh items-center justify-center bg-stage p-5 text-ink-on-dark"><div className="max-w-sm rounded-lg border border-hairline-dark bg-stage-soft p-5 text-center"><h1 className="text-2xl">{MAX_STARS}★ · Max</h1><p className="mt-2 text-sm text-ink-on-dark-soft">{template.charName} already has {MAX_STARS}★ in {scenarioForTier(tier)?.name ?? `Tier ${tier}`}.</p><Link to={returnTo} className="mt-5 inline-flex min-h-11 items-center rounded-sm bg-accent px-5 font-display font-semibold text-ink">Back</Link></div></div>
  }

  const running = phase === 'playing' || phase === 'committing' || phase === 'commit-error'
  const before = reward?.starsBefore ?? cardStars(card, tier)
  const after = reward?.starsAfter ?? before
  const advanced = after > before
  const perNode = (stars: number) => Math.round(cardNodeValue(tier, { template, stars }))

  return (
    <div className={`flex h-dvh flex-col bg-stage text-ink-on-dark ${running ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      <header className="pt-safe flex min-h-16 shrink-0 items-center gap-3 border-b border-hairline-dark bg-stage/95 px-3 py-2">
        <Link to={returnTo} className="flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-hairline-dark bg-stage-soft text-xl" aria-label="Back">←</Link>
        <div className="h-12 w-9 shrink-0 overflow-hidden rounded-[5px] shadow-2 ring-1 ring-accent/60"><CardArt content={contentState.content} cardId={template.id} art={art.get(template.id) ?? null} /></div>
        <div className="min-w-0 flex-1"><p className="text-[10px] font-bold tracking-[0.16em] text-accent uppercase">Bond Recall</p><h1 className="truncate text-lg">{template.charName}</h1></div>
        <div className="text-right"><p className="text-[10px] font-bold text-ink-on-dark-soft uppercase">Bond</p><p className="font-display text-xl font-bold text-accent">{cardStars(card, tier)}</p></div>
      </header>

      {phase === 'ready' || phase === 'reserving' ? (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-4 pb-safe">
          <div className="mx-auto mb-4 aspect-[3/4] h-[min(28dvh,13rem)] shrink-0 overflow-hidden rounded-[10px] shadow-3 ring-2 ring-accent/70">
            <CardArt content={contentState.content} cardId={template.id} art={art.get(template.id) ?? null} />
          </div>
          <div className="rounded-lg border border-hairline-dark bg-stage-soft p-4 shadow-3">
            <p className="text-xs font-bold tracking-[0.14em] text-accent uppercase">
              {scenarioForTier(tier)?.name ?? `Tier ${tier}`} · {bondRecallConfig(cardStars(card, tier)).pairs} pairs
            </p>
            <h2 className="mt-1 text-3xl">Remember the bonds</h2>
            <p className="mt-2 text-sm text-ink-on-dark-soft">Flip two cards. Matches stay; misses spend one chance. Clear every pair to take {template.charName} to {cardStars(card, tier) + 1}★ in this scenario — every Uma racing here gets it.</p>
            <div className="mt-4 flex items-center justify-between rounded-sm border border-hairline-dark p-3"><span className="text-sm font-semibold">Each node it fills</span><span className="font-display font-bold text-accent">{perNode(cardStars(card, tier))} → {perNode(cardStars(card, tier) + 1)}</span></div>
            {activeCardIds.length === 0 && <p className="mt-4 rounded-sm border border-warning/40 bg-warning/10 p-2 text-xs text-ink-on-dark-soft">No card set in this scenario yet, so the faces are your other cards.</p>}
            {error && <p role="alert" className="mt-3 rounded-sm bg-danger/20 p-2 text-sm font-semibold text-red-200">{error}</p>}
            <button type="button" disabled={phase === 'reserving'} onClick={() => void start()} className="mt-5 min-h-12 w-full rounded-sm bg-accent px-5 font-display text-lg font-bold text-ink shadow-2 disabled:opacity-50">{phase === 'reserving' ? 'Reserving run…' : `Begin · ${formatTickets(BOND_RECALL_TICKET_COST)}`}</button>
          </div>
        </main>
      ) : phase === 'complete' && reward && run ? (
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-5 pb-safe">
          <div className="rounded-lg bg-panel p-5 text-ink shadow-3">
            <div className="flex items-center gap-4">
              <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-[8px] shadow-2 ring-1 ring-hairline-strong">
                <CardArt content={contentState.content} cardId={template.id} art={art.get(template.id) ?? null} />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold tracking-[0.14em] uppercase ${advanced ? 'text-success' : 'text-danger'}`}>{advanced ? 'Star earned' : 'Run ended'}</p>
                <h2 className="mt-1 text-2xl leading-tight">{advanced ? `${before}★ → ${after}★` : 'Stars unchanged'}</h2>
                <p className="mt-1 text-sm text-ink-soft">{reward.ticketsSpent} tickets spent · {run.mismatches} mismatches</p>
              </div>
            </div>
            <section className="mt-5 rounded-sm bg-accent-wash p-4"><div className="flex items-center justify-between gap-3"><span className="font-display font-bold">{after}★</span><GainedStars before={before} after={after} /></div></section>
            <section className="mt-4 rounded-sm border border-hairline bg-page p-4">
              <h3 className="text-lg">Constellation value</h3>
              {advanced ? <><p className="mt-1 font-display text-2xl font-bold text-accent-strong">{perNode(before)} → {perNode(after)} per node</p><p className="mt-1 text-sm text-ink-soft">Every node this card fills in {scenarioForTier(tier)?.name ?? `Tier ${tier}`} now pays more, for every Uma racing there.</p></> : <p className="mt-1 text-sm text-ink-soft">Each node it fills still pays {perNode(after)}. Try again to strengthen it.</p>}
            </section>
            {reward.couponGranted && <p className="mt-4 rounded-sm border border-accent bg-accent-wash p-3 font-display font-bold text-accent-strong">{MAX_STARS}★ · Card Select Coupon awarded</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">{after < MAX_STARS ? <button type="button" onClick={again} className="flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel px-3 text-center font-display font-semibold">Bond again</button> : <span />}<Link to={returnTo} className="flex min-h-12 items-center justify-center rounded-sm bg-accent px-3 font-display font-semibold">Done</Link></div>
          </div>
        </main>
      ) : run ? (
        <main className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col items-center px-4 pb-safe">
          <div className="flex w-full shrink-0 items-center gap-3 py-2">
            <div className="flex-1"><p className="text-[10px] font-bold tracking-[0.12em] text-ink-on-dark-soft uppercase">Pairs</p><p className="font-display text-lg font-bold">{run.matched.length / 2} / {run.config.pairs}</p></div>
            <div className="text-right"><p className="text-[10px] font-bold tracking-[0.12em] text-ink-on-dark-soft uppercase">Mismatches left</p><p className={`font-display text-lg font-bold ${bondMismatchesRemaining(run) <= 2 ? 'text-red-300' : 'text-accent'}`}>{bondMismatchesRemaining(run)} / {run.config.mismatchLimit}</p></div>
          </div>
          <BondBoard
            content={contentState.content}
            run={run}
            art={art}
            interactive={phase === 'playing' && run.status === 'playing'}
            onChoose={(index) => void chooseTile(index)}
          />
          <div className="flex min-h-16 w-full shrink-0 flex-col justify-center py-2 text-center"><p aria-live="polite" className="text-sm font-semibold">{message}</p>{phase === 'commit-error' && <div><p role="alert" className="mt-2 text-sm font-semibold text-red-200">{error}</p><button type="button" onClick={retryCommit} className="mt-2 min-h-11 rounded-sm bg-accent px-5 font-bold text-ink">Retry save</button></div>}</div>
        </main>
      ) : null}
    </div>
  )
}
