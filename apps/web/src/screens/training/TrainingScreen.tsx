import {
  EXP_TO_NEXT_TRAINING_LEVEL,
  MAX_TRAINING_LEVEL,
  STATS,
  isGateLevel,
  type Facility,
  type GainKey,
  type StatKey,
  type TrainingTurnResult,
} from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useContent } from '../../content/ContentProvider'
import { ensureTrainingDeck, trainUma } from '../../game/actions'
import { useGame } from '../../game/store'
import { buildTrainingView, type TrainingCardView } from '../../game/training-view'
import { AtlasSprite } from '../../ui/AtlasSprite'
import { GameButton } from '../../ui/GameButton'
import { Meter } from '../../ui/Meter'
import { ScreenState } from '../../ui/ScreenState'

const STAT_LABEL: Record<StatKey, string> = {
  speed: 'Speed',
  stamina: 'Stamina',
  power: 'Power',
  guts: 'Guts',
  wit: 'Wit',
}
const GAIN_LABEL: Record<GainKey, string> = {
  speed: 'SPD',
  stamina: 'STA',
  power: 'PWR',
  guts: 'GUT',
  wit: 'WIT',
  sp: 'SP',
}
const STAT_COLOR: Record<StatKey, string> = {
  speed: '#2f8cff',
  stamina: '#ff5a5f',
  power: '#ff9f1c',
  guts: '#ff6fb5',
  wit: '#2ec27e',
}
const FACILITY_TONE: Record<StatKey, string> = {
  speed: 'from-blue-50 to-blue-100 border-blue-300',
  stamina: 'from-red-50 to-red-100 border-red-300',
  power: 'from-orange-50 to-orange-100 border-orange-300',
  guts: 'from-pink-50 to-pink-100 border-pink-300',
  wit: 'from-emerald-50 to-emerald-100 border-emerald-300',
}

function CardIcon({ card, friendship = false }: { card: TrainingCardView; friendship?: boolean }) {
  return (
    <div className={`relative h-8 w-8 shrink-0 rounded-lg border-2 bg-white shadow-sm ${friendship ? 'border-gold ring-2 ring-gold/35' : 'border-white'}`}>
      <AtlasSprite asset={card.asset} alt={`${card.template.charName} support card`} className="rounded-md" fallback={<div className="h-full bg-slate-100" />} />
      {friendship && <span className="absolute -right-1 -bottom-1 rounded bg-gold px-1 text-[8px] leading-3 font-extrabold text-white">F</span>}
    </div>
  )
}

function GainText({ gains }: { gains: Partial<Record<GainKey, number>> }) {
  const entries = Object.entries(gains).filter((entry): entry is [GainKey, number] => typeof entry[1] === 'number' && entry[1] > 0)
  return (
    <span className="flex flex-wrap justify-center gap-x-1 text-[9px] leading-3 font-extrabold text-ink-soft">
      {entries.map(([key, value]) => <span key={key}>+{value} {GAIN_LABEL[key]}</span>)}
    </span>
  )
}

function ResultPanel({ result, skillNames }: { result: TrainingTurnResult; skillNames: ReadonlyMap<string, string> }) {
  const reducedMotion = useReducedMotion()
  const leveledCards = result.cards.filter((card) => card.levelsGained.length > 0)
  return (
    <m.section
      aria-live="polite"
      className="rounded-2xl border-2 border-white bg-white/95 px-3 py-2 shadow-[var(--shadow-panel)]"
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-extrabold">
        <span className="rounded-full bg-sky/10 px-2 py-1">+{result.trainingExpGained} Training EXP</span>
        {result.trainingLevelsGained > 0 && <span className="rounded-full bg-gold/20 px-2 py-1">Training Level +{result.trainingLevelsGained}</span>}
        {result.ticketReward > 0 && <span className="rounded-full bg-gold/20 px-2 py-1">+{result.ticketReward} tickets</span>}
        {result.cardCouponReward > 0 && <span className="rounded-full bg-violet-100 px-2 py-1">+{result.cardCouponReward} Card Coupon</span>}
        {result.hintResults.map((hint) => (
          <span key={hint.cardId} className="rounded-full bg-violet-100 px-2 py-1">
            {hint.learnedSkillId ? `Hint: ${skillNames.get(hint.learnedSkillId) ?? hint.learnedSkillId}` : `Known hint +${hint.fallbackSp} SP`}
          </span>
        ))}
      </div>
      <p className="mt-1 text-center text-[11px] font-bold text-ink-soft">
        Cards +{result.cards.map((card) => card.expGained).join(' / ')} EXP
        {leveledCards.length > 0 ? ` · ${leveledCards.length} leveled up` : ''}
      </p>
    </m.section>
  )
}

export function TrainingScreen() {
  const navigate = useNavigate()
  const { umaId = '' } = useParams()
  const reducedMotion = useReducedMotion()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const persistent = useGame((state) => state.persistent)
  const profile = useGame((state) => state.profile)
  const uma = useGame((state) => state.umas[umaId])
  const cards = useGame((state) => state.cards)
  const [preparing, setPreparing] = useState(false)
  const [prepareAttempt, setPrepareAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TrainingTurnResult | null>(null)

  useEffect(() => {
    if (contentState.status !== 'ready' || status !== 'ready' || !uma || uma.deckCardIds.length > 0) return
    setPreparing(true)
    setError(null)
    void ensureTrainingDeck(uma.templateId)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not prepare Training')
      })
      .finally(() => {
        setPreparing(false)
      })
  }, [contentState.status, prepareAttempt, status, uma?.deckCardIds.length, uma?.templateId])

  const view = useMemo(() => {
    if (contentState.status !== 'ready' || !profile || !uma) return null
    return buildTrainingView(profile, uma, cards, contentState.content)
  }, [cards, contentState, profile, uma])

  if (contentState.status === 'signed-out' || status === 'signed-out') {
    return <ScreenState title="Sign in to train" detail="Training changes your private saved Stable." action={{ label: 'Open Settings', to: '/settings' }} />
  }
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before Training." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={lifecycleError ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) return <ScreenState title="Opening Training…" detail="Loading private content and your local save." />
  if (!uma) return <ScreenState title="Uma not found" detail="This Uma is not owned in your Stable." action={{ label: 'Back to Stable', to: '/stable' }} />
  if (preparing) return <ScreenState title="Preparing Training…" detail="Equipping a stable starter deck for this Uma." />
  if (view?.status === 'empty-deck' && error) {
    return (
      <div className="flex h-dvh items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-3xl border-2 border-white bg-white/95 p-5 text-center shadow-[var(--shadow-panel)]">
          <h1 className="text-xl font-extrabold">Training could not be prepared</h1>
          <p className="mt-2 text-sm text-ink-soft">{error}</p>
          <div className="mt-4 grid gap-3">
            <GameButton onClick={() => { setError(null); setPrepareAttempt((attempt) => attempt + 1) }}>Retry</GameButton>
            <Link to={`/stable/${encodeURIComponent(umaId)}`} className="flex min-h-11 items-center justify-center font-extrabold text-sky-deep">Back to profile</Link>
          </div>
        </div>
      </div>
    )
  }
  if (view?.status === 'empty-deck') return <ScreenState title="Preparing Training…" detail="Equipping a stable starter deck for this Uma." />
  if (!view || view.status === 'error') {
    return <ScreenState title="Training needs attention" detail={error ?? (view?.status === 'error' ? view.message : 'Training could not be prepared.')} action={{ label: 'Back to profile', to: `/stable/${encodeURIComponent(umaId)}` }} />
  }

  const model = view.value
  const noTickets = profile.tickets < 1
  const skillNames = new Map(contentState.content.skills.items.map((skill) => [skill.id, skill.name]))
  const choose = (facility: Facility) => {
    if (busy || noTickets) return
    setBusy(true)
    setError(null)
    setResult(null)
    void trainUma(umaId, facility)
      .then(setResult)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Training could not be saved'))
      .finally(() => setBusy(false))
  }

  return (
    <div className="h-dvh overflow-y-auto bg-gradient-to-b from-sky-top via-[#dff3ff] to-cream text-ink">
      <header className="pt-safe sticky top-0 z-20 border-b-2 border-white/80 bg-sky-deep/95 text-white shadow-sm backdrop-blur">
        <div className="flex min-h-14 items-center gap-2 px-3 py-2">
          <Link to={`/stable/${encodeURIComponent(umaId)}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/20 text-xl font-extrabold" aria-label="Back to Uma profile">←</Link>
          <AtlasSprite asset={model.umaAsset} decorative className="h-10 w-10 shrink-0 rounded-full border-2 border-white bg-sky-100" fallback={<div />} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold text-outline">{model.template.name}</h1>
            <p className="truncate text-[11px] font-bold text-white/85">{model.scenarioName} · Turn {model.uma.trainingsThisScenario + 1}</p>
          </div>
          <div className="rounded-xl bg-white/20 px-2 py-1 text-center">
            <p className="text-[9px] font-extrabold tracking-wide uppercase">Tickets</p>
            <m.p key={profile.tickets} initial={reducedMotion ? false : { opacity: 0, scale: 1.35 }} animate={{ opacity: 1, scale: 1 }} className="text-lg leading-5 font-extrabold">{profile.tickets}</m.p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 pb-2">
          <span className="text-[11px] font-extrabold">TL {model.uma.trainingLevel}</span>
          <Meter value={model.trainingExpToNext === 0 ? 1 : model.uma.trainingExp / EXP_TO_NEXT_TRAINING_LEVEL} color="linear-gradient(90deg,#ffd65a,#fff1a8)" height={8} />
          <span className="text-[10px] font-bold">{model.uma.trainingLevel === MAX_TRAINING_LEVEL ? 'MAX' : `${model.uma.trainingExp}/100`}</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-col gap-2.5 px-3 py-3 pb-safe">
        {!persistent && <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs font-extrabold">Memory only — Training works, but progress cannot persist or sync.</div>}
        {error && <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-800">{error} · Your current deal is unchanged.</div>}

        <section className="rounded-2xl border-2 border-white bg-white/90 px-3 py-2 shadow-[var(--shadow-panel)]">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {STATS.map((stat) => {
              const gain = result?.preview.appliedGains[stat]
              return (
                <div key={stat} className={stat === 'wit' ? 'col-span-1' : ''}>
                  <div className="flex items-center justify-between text-[11px] font-extrabold">
                    <span>{STAT_LABEL[stat]}</span>
                    <span className="relative">{model.uma.stats[stat]}<span className="text-ink-soft">/{model.statCap}</span>
                      {gain !== undefined && gain > 0 && (
                        <m.span
                          key={`${model.uma.trainingsThisScenario}-${stat}`}
                          className="absolute right-0 text-gold-deep"
                          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
                          animate={reducedMotion ? { opacity: 1, y: 0 } : { opacity: [0, 1, 0], y: [14, -2, -15] }}
                          transition={{ duration: reducedMotion ? 0 : 1.2 }}
                        >+{gain}</m.span>
                      )}
                    </span>
                  </div>
                  <Meter value={model.uma.stats[stat] / model.statCap} color={STAT_COLOR[stat]} height={7} />
                </div>
              )
            })}
            <div>
              <div className="flex items-center justify-between text-[11px] font-extrabold"><span>Skill Points</span><span>{model.uma.skillPoints}<span className="text-ink-soft">/{model.spCap}</span></span></div>
              <Meter value={model.uma.skillPoints / model.spCap} color="#8b5cf6" height={7} />
            </div>
          </div>
        </section>

        <section aria-label="Training facilities">
          <div className="grid grid-cols-5 gap-1.5">
            {STATS.map((facility) => {
              const facilityView = model.facilities[facility]
              return (
                <m.button
                  key={facility}
                  type="button"
                  disabled={busy || noTickets}
                  onClick={() => choose(facility)}
                  whileTap={busy || noTickets ? undefined : { scale: 0.95, y: 3 }}
                  className={`relative flex min-h-40 min-w-0 flex-col items-center rounded-2xl border-2 bg-gradient-to-b px-1 py-2 shadow-sm disabled:opacity-50 ${FACILITY_TONE[facility]} ${facilityView.friendship ? 'ring-2 ring-gold ring-offset-1' : ''}`}
                >
                  <span className="text-[10px] leading-3 font-extrabold">{STAT_LABEL[facility]}</span>
                  {facilityView.friendship && <span className="mt-0.5 rounded-full bg-gold px-1 text-[8px] font-extrabold text-white">FRIEND</span>}
                  <div className="mt-1 flex min-h-16 flex-col items-center gap-0.5">
                    {facilityView.cards.map((card) => <CardIcon key={card.save.templateId} card={card} friendship={card.template.type === facility} />)}
                  </div>
                  <span className="mt-auto"><GainText gains={facilityView.appliedGains} /></span>
                </m.button>
              )
            })}
          </div>
        </section>

        <section className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-white bg-white/75 px-3 py-1.5">
          <p className="shrink-0 text-[10px] font-extrabold tracking-wide text-ink-soft uppercase">Bench</p>
          <div className="flex gap-1.5">
            {model.bench.length > 0 ? model.bench.map((card) => <CardIcon key={card.save.templateId} card={card} />) : <span className="text-xs font-bold text-ink-soft">All cards are at facilities</span>}
          </div>
        </section>

        {result && <ResultPanel result={result} skillNames={skillNames} />}
        {noTickets && <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-extrabold">No Training Tickets. The next local-day grant restores up to 50.</div>}

        <div className="grid grid-cols-2 gap-2 pb-3">
          <GameButton variant="secondary" disabled>{busy ? 'Saving…' : 'Choose a facility'}</GameButton>
          <GameButton variant="go" disabled={model.uma.trainingsThisScenario < 1 || isGateLevel(model.uma.level) || busy} onClick={() => navigate(`/race?uma=${encodeURIComponent(model.uma.templateId)}`)}>Race</GameButton>
        </div>
        <p className="-mt-2 pb-3 text-center text-[11px] font-bold text-ink-soft">
          {model.uma.trainingsThisScenario > 0 ? 'Opening Training complete — progression races are unlocked.' : 'Train once to unlock this Uma’s race flow.'}
        </p>
      </main>
    </div>
  )
}
