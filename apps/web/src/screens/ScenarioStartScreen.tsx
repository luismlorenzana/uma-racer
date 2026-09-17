import {
  PROMOTION_BONUS_PER_STAT,
  SCENARIOS,
  STATS,
  baselineStatCap,
  scenarioForTier,
  tierOfLevel,
  umaPromotionCost,
  type ScenarioPromotionResult,
} from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { promoteUma } from '../game/actions'
import { promoteMemoryUma } from '../game/promotion'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { GameButton } from '../ui/GameButton'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'

const LABEL = { speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit' } as const

export function ScenarioStartScreen() {
  const { umaId = '' } = useParams()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const profile = useGame((state) => state.profile)
  const uma = useGame((state) => state.umas[umaId])
  const cards = useGame((state) => state.cards)
  const persistent = useGame((state) => state.persistent)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<ScenarioPromotionResult | null>(null)

  const preview = useMemo(() => {
    if (contentState.status !== 'ready' || !profile || !uma || uma.level % 10 !== 0 || uma.level >= SCENARIOS.length * 10) return null
    try {
      const cost = umaPromotionCost(tierOfLevel(uma.level))
      return promoteMemoryUma(contentState.content, { ...profile, tickets: Math.max(profile.tickets, cost) }, uma, cards, 0).result
    } catch (reason) {
      return reason instanceof Error ? reason : new Error('Promotion could not be prepared')
    }
  }, [cards, contentState, profile, uma])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to start a scenario" detail="Scenario progress belongs to your private save." />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before promoting an Uma." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={lifecycleError ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) return <ScreenState title="Preparing scenario…" detail="Checking your promotion and private content." />
  if (!uma) return <ScreenState title="Uma not found" detail="This Uma is not owned in your Stable." action={{ label: 'Back to Stable', to: '/stable' }} />
  const template = contentState.content.umas.byId.get(umaId)
  if (!template) return <ScreenState title="Content reference missing" detail="This saved Uma is preserved until her content is restored." />

  const promotedOnReload = uma.level % 10 !== 0 && uma.parentSnapshot?.completedTier === tierOfLevel(uma.level) - 1
  const result = completed
  const newTier = result?.toTier ?? tierOfLevel(uma.level)
  if (completed || promotedOnReload) {
    const awakeningId = result?.awakeningSkillId
    const awakening = awakeningId ? contentState.content.skills.byId.get(awakeningId) : null
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-violet-950 via-sky-deep to-sky px-4 pt-safe pb-safe text-white">
        <m.div initial={reducedMotion ? false : { opacity: 0, scale: 0.86, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-md rounded-[2rem] border-2 border-white/60 bg-white/15 p-5 text-center shadow-2xl backdrop-blur">
          <p className="text-sm font-extrabold tracking-[0.2em] text-gold uppercase">Scenario started</p>
          <h1 className="mt-2 text-3xl font-extrabold text-outline">{scenarioForTier(newTier)?.name ?? `Tier ${newTier}`}</h1>
          <div className="mx-auto mt-5 w-32"><AtlasSprite asset={(() => { const frame = contentState.content.atlases['uma-icons'].descriptor.frames[umaId]; const page = frame ? contentState.content.atlases['uma-icons'].descriptor.pages[frame.page] : undefined; const url = frame ? contentState.content.atlases['uma-icons'].pageUrls[frame.page] : undefined; return frame && page && url ? { frame, url, pageWidth: page.width, pageHeight: page.height } : null })()} alt={`${template.name} icon`} className="rounded-full border-4 border-white bg-sky-100" fallback={<div className="text-7xl">🐴</div>} /></div>
          <p className="mt-3 text-xl font-extrabold">{template.name} · Lv {uma.level}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold">
            <div className="rounded-xl bg-white/15 p-2">Training Level 1</div>
            <div className="rounded-xl bg-white/15 p-2">+{PROMOTION_BONUS_PER_STAT} all stats</div>
            <div className="rounded-xl bg-white/15 p-2">Cap {baselineStatCap(newTier)}</div>
            <div className="rounded-xl bg-white/15 p-2">{awakening ? awakening.name : 'Skills refreshed'}</div>
          </div>
          <GameButton className="mt-5" variant="go" onClick={() => navigate(`/training/${encodeURIComponent(umaId)}`, { replace: true })}>Opening Training</GameButton>
          {!persistent && <p className="mt-3 text-xs font-bold text-amber-100">Memory only — this promotion lasts for this session.</p>}
        </m.div>
      </div>
    )
  }

  if (preview instanceof Error) return <ScreenState title="Promotion needs attention" detail={preview.message} action={{ label: 'Back to profile', to: `/stable/${encodeURIComponent(umaId)}` }} />
  if (!preview) {
    const final = uma.level >= SCENARIOS.length * 10
    return <ScreenState title={final ? 'Latest scenario complete' : 'Not ready to promote'} detail={final ? 'This Uma has completed every currently available scenario.' : 'Reach the current scenario gate before starting the next tier.'} action={{ label: 'Back to profile', to: `/stable/${encodeURIComponent(umaId)}` }} />
  }

  const affordable = profile.tickets >= preview.cost
  const currentScenario = scenarioForTier(preview.fromTier)
  const nextScenario = scenarioForTier(preview.toTier)
  const start = () => {
    if (busy || !affordable) return
    setBusy(true)
    setError(null)
    void promoteUma(umaId).then((mutation) => {
      setCompleted(mutation.result ?? preview)
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Promotion could not be saved')
    }).finally(() => setBusy(false))
  }

  return (
    <div className="min-h-dvh overflow-y-auto bg-gradient-to-b from-sky-top via-[#e6f6ff] to-cream text-ink">
      <header className="pt-safe sticky top-0 z-20 border-b-2 border-white bg-sky-deep/95 px-3 pb-2 text-white backdrop-blur">
        <div className="flex min-h-14 items-center gap-2">
          <Link to={`/stable/${encodeURIComponent(umaId)}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/20 text-xl" aria-label="Back without promoting">←</Link>
          <div><h1 className="font-extrabold text-outline">Scenario Start</h1><p className="text-xs font-bold text-white/80">Review only · Back saves nothing</p></div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-3 py-4 pb-safe">
        <Panel className="bg-gradient-to-br from-violet-50 to-white text-center">
          <p className="text-xs font-extrabold tracking-wider text-violet-700 uppercase">Tier {preview.fromTier} complete</p>
          <h2 className="mt-1 text-xl font-extrabold">{currentScenario?.name} → {nextScenario?.name}</h2>
          <p className="mt-2 text-sm font-bold text-ink-soft">Lv {uma.level} → Lv {preview.uma.level}{preview.overflowLevel ? ` · full EXP bank creates Lv ${preview.overflowLevel}` : preview.uma.exp ? ` · ${preview.uma.exp} EXP carried` : ''}</p>
        </Panel>

        <Panel>
          <h2 className="font-extrabold">Completed snapshot</h2>
          <p className="mt-1 text-sm text-ink-soft">{preview.snapshot.inheritableWhiteSkillIds.length} inheritable white skill{preview.snapshot.inheritableWhiteSkillIds.length === 1 ? '' : 's'} · {preview.snapshot.inheritedUniqueSkillId ? 'inherited unique ready' : 'no inherited unique'}.</p>
          <p className="mt-2 rounded-xl bg-sky-50 p-3 text-sm font-extrabold">Start without parents</p>
          <p className="mt-1 text-xs text-ink-soft">Parent selection arrives in the next Milestone 5 step. Zero-parent starts remain supported.</p>
        </Panel>

        <Panel>
          <h2 className="font-extrabold">Starting gains</h2>
          <div className="mt-3 grid grid-cols-5 gap-1 text-center">{STATS.map((stat) => <div key={stat} className="rounded-xl bg-sky-50 px-1 py-2"><p className="text-[10px] font-bold text-ink-soft">{LABEL[stat]}</p><p className="font-extrabold">+{PROMOTION_BONUS_PER_STAT + preview.cardBonuses.filter((bonus) => bonus.stat === stat).reduce((sum, bonus) => sum + bonus.amount, 0)}</p></div>)}</div>
          <div className="mt-3 grid gap-2">{preview.cardBonuses.map((bonus) => <div key={bonus.cardId} className="flex min-h-11 items-center justify-between rounded-xl bg-white px-3 text-sm font-bold shadow-sm"><span>{contentState.content.cards.byId.get(bonus.cardId)?.charName ?? bonus.cardId}</span><span>+{bonus.amount} {LABEL[bonus.stat]}</span></div>)}</div>
        </Panel>

        <Panel>
          <h2 className="font-extrabold">New scenario rules</h2>
          <ul className="mt-2 grid gap-2 text-sm font-bold text-ink-soft">
            <li>Training Level resets to 1; complete Opening Training before racing.</li>
            <li>Stats, Skill Points, and the equipped deck carry forward.</li>
            <li>Skill library refreshes to the own unique and unlocked awakenings.</li>
            <li>Tier {preview.toTier} permits support-card era {preview.toTier} and earlier · baseline cap {baselineStatCap(preview.toTier)}.</li>
          </ul>
        </Panel>

        <Panel className="sticky bottom-3 z-10 bg-white/95 backdrop-blur">
          <div className="mb-3 flex items-center justify-between font-extrabold"><span>Training Tickets</span><span>{profile.tickets} → {profile.tickets - preview.cost}{preview.overflowLevel ? ' + 5' : ''}</span></div>
          {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-danger">{error} · Nothing was changed.</p>}
          {!affordable && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-bold">Need {preview.cost - profile.tickets} more tickets.</p>}
          <GameButton variant="go" disabled={busy || !affordable} onClick={start}>{busy ? 'Starting scenario…' : `Spend ${preview.cost} · Start without parents`}</GameButton>
          {!persistent && <p className="mt-2 text-center text-xs font-bold text-amber-800">Memory only — this change cannot persist or sync.</p>}
        </Panel>
      </main>
    </div>
  )
}

