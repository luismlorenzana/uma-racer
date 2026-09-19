import {
  PROMOTION_BONUS_PER_STAT,
  SCENARIOS,
  baselineStatCap,
  badgeStateId,
  parentFingerprint,
  projectGrandparents,
  projectParentCandidates,
  projectPinkSparks,
  scenarioForTier,
  suggestPinkSparkSelections,
  tierOfLevel,
  umaPromotionCost,
  type AptitudeCategory,
  type NewUmaScenarioStartResult,
  type ParentFingerprint,
  type ParentSnapshot,
  type ScenarioPromotionResult,
  type ScenarioStartSelection,
  type SkillUnlock,
} from '@racer/domain'
import { m, useReducedMotion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { startScenario } from '../game/actions'
import { buildFlairFanfare, buildTrainerFlairFanfare } from '../game/flair-view'
import { startMemoryScenario } from '../game/promotion'
import { useGame } from '../game/store'
import { AtlasSprite } from '../ui/AtlasSprite'
import { GameButton } from '../ui/GameButton'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'
import { FlairCards } from '../ui/FlairCards'

const STEPS = ['Parents', 'Automatic', 'Grandparents', 'Pink sparks', 'Confirm'] as const
const ISSUE_LABEL: Record<string, string> = {
  'no-snapshot': 'No completed snapshot', 'self-character': 'Same character as the child',
  'already-selected-character': 'That character is already selected', 'malformed-snapshot': 'Snapshot is malformed',
  'missing-content': 'Private content is missing', 'missing-skill': 'Referenced skill is missing',
  'unsafe-id': 'Snapshot id is unsafe', 'stale-fingerprint': 'Snapshot changed — review again',
}

function snapshotAge(takenAt: number): string {
  const days = Math.max(0, Math.floor((Date.now() - takenAt) / 86_400_000))
  return days === 0 ? 'today' : `${days}d ago`
}

function permanentLibrary(templateId: string, uniqueSkillId: string | null, awakeningSkillIds: readonly string[], completedTier: number): SkillUnlock[] {
  const result: SkillUnlock[] = uniqueSkillId ? [{ skillId: uniqueSkillId, origin: 'own-unique', sourceId: templateId }] : []
  for (const skillId of awakeningSkillIds.slice(0, Math.min(completedTier, 4))) result.push({ skillId, origin: 'awakening', sourceId: templateId })
  return result
}

export function ScenarioStartScreen() {
  const { umaId = '' } = useParams()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const lifecycleError = useGame((state) => state.error)
  const profile = useGame((state) => state.profile)
  const umas = useGame((state) => state.umas)
  const uma = umas[umaId]
  const cards = useGame((state) => state.cards)
  const persistent = useGame((state) => state.persistent)
  const badges = useGame((state) => state.badges)
  const flairEvents = useGame((state) => state.flairEvents)
  const [step, setStep] = useState(0)
  const [parents, setParents] = useState<ParentFingerprint[]>([])
  const [grandUniques, setGrandUniques] = useState<string[]>([])
  const [grandWhites, setGrandWhites] = useState<string[]>([])
  const [pinkSparks, setPinkSparks] = useState<(AptitudeCategory | null)[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState<ScenarioPromotionResult | NewUmaScenarioStartResult | null>(null)
  const [earnedFlairEventIds, setEarnedFlairEventIds] = useState<string[]>([])

  const ready = contentState.status === 'ready' && status === 'ready' && profile && uma
  const template = ready ? contentState.content.umas.byId.get(umaId) : null
  const completedTier = uma ? (uma.scenarioStarted ? tierOfLevel(uma.level) : 0) : 0
  const permanent = template ? permanentLibrary(template.id, template.uniqueSkillId, template.awakeningSkillIds, completedTier) : []
  const candidates = useMemo(() => {
    if (!ready || !template) return []
    return projectParentCandidates({
      child: uma, childTemplate: template, ownedUmas: Object.values(umas), umaTemplates: contentState.content.umas.byId,
      skills: contentState.content.skills.byId, selected: parents, permanentSkillIds: new Set(permanent.map((skill) => skill.skillId)),
    })
  }, [contentState, parents, permanent, ready, template, uma, umas])
  const selectedSnapshots = parents.flatMap((fingerprint): ParentSnapshot[] => {
    const row = candidates.find((candidate) => candidate.umaId === fingerprint.umaId)
    return row?.snapshot ? [row.snapshot] : []
  })
  const automaticIds = new Set(permanent.map((skill) => skill.skillId))
  for (const parent of selectedSnapshots) {
    if (parent.inheritedUniqueSkillId) automaticIds.add(parent.inheritedUniqueSkillId)
    parent.inheritableWhiteSkillIds.forEach((id) => automaticIds.add(id))
  }
  const grandparents = ready && template
    ? projectGrandparents({ childCharaId: template.charaId, parents: selectedSnapshots, skills: contentState.content.skills.byId, excludedSkillIds: automaticIds })
    : null
  const selection: ScenarioStartSelection = { parents, grandparentUniqueSkillIds: grandUniques, grandparentWhiteSkillIds: grandWhites, pinkSparks }
  const preview = useMemo(() => {
    if (!ready || !template || selectedSnapshots.length !== parents.length || pinkSparks.length !== parents.length) return null
    try {
      const cost = uma.scenarioStarted ? umaPromotionCost(tierOfLevel(uma.level)) : 0
      return startMemoryScenario(
        contentState.content, { ...profile, tickets: Math.max(profile.tickets, cost) }, uma, Object.values(umas), cards, selection, 0,
      ).result
    } catch (reason) {
      return reason instanceof Error ? reason : new Error('Scenario could not be prepared')
    }
  }, [cards, contentState, parents.length, pinkSparks.length, profile, ready, selectedSnapshots.length, selection, template, uma, umas])

  if (contentState.status === 'signed-out' || status === 'signed-out') return <ScreenState title="Sign in to start a scenario" detail="Scenario progress belongs to your private save." />
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before starting an Uma." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={lifecycleError ?? 'The local save could not be opened.'} />
  if (!ready) return <ScreenState title="Preparing scenario…" detail="Checking your save and private content." />
  if (!template) return <ScreenState title="Content reference missing" detail="This saved Uma is preserved until her content is restored." />

  const promotedOnReload = uma.scenarioStarted && uma.level % 10 !== 0 && uma.parentSnapshot?.completedTier === tierOfLevel(uma.level) - 1
  if (completed || promotedOnReload) {
    const tier = completed ? ('fromTier' in completed ? completed.toTier : 1) : tierOfLevel(uma.level)
    const promotion = completed && 'fromTier' in completed ? completed : null
    const badge = badges[badgeStateId(umaId)]
    const earnedFlair = badge?.scope === 'uma'
      ? buildFlairFanfare(contentState.content, badge, flairEvents, earnedFlairEventIds)
      : []
    const trainer = badges.trainer
    const trainerEarnedFlair = trainer?.scope === 'trainer'
      ? buildTrainerFlairFanfare(contentState.content, trainer, flairEvents, earnedFlairEventIds)
      : []
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-violet-950 via-sky-deep to-sky px-4 pt-safe pb-safe text-white">
        <m.div initial={reducedMotion ? false : { opacity: 0, scale: 0.86, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-md rounded-[2rem] border-2 border-white/60 bg-white/15 p-5 text-center shadow-2xl backdrop-blur">
          <p className="text-sm font-extrabold tracking-[0.2em] text-gold uppercase">Scenario started</p>
          <h1 className="mt-2 text-3xl font-extrabold text-outline">{scenarioForTier(tier)?.name ?? `Tier ${tier}`}</h1>
          <p className="mt-3 text-xl font-extrabold">{template.name} · {uma.currentParents.length} parent{uma.currentParents.length === 1 ? '' : 's'}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm font-bold">
            <div className="rounded-xl bg-white/15 p-2">Training Level 1</div>
            <div className="rounded-xl bg-white/15 p-2">{promotion ? `+${PROMOTION_BONUS_PER_STAT} all stats` : 'Free tier-1 start'}</div>
            <div className="rounded-xl bg-white/15 p-2">Cap {baselineStatCap(tier)}</div>
            <div className="rounded-xl bg-white/15 p-2">{uma.skillLibrary.length} skills ready</div>
          </div>
          {earnedFlair.length > 0 && <div className="mt-4 text-left text-ink"><FlairCards title="Flair earned" items={earnedFlair} animate={!reducedMotion} /></div>}
          {trainerEarnedFlair.length > 0 && <div className="mt-4 text-left text-ink"><FlairCards title="Trainer achievements" items={trainerEarnedFlair} animate={!reducedMotion} /></div>}
          <GameButton className="mt-5" variant="go" onClick={() => navigate(`/training/${encodeURIComponent(umaId)}`, { replace: true })}>Opening Training</GameButton>
          {!persistent && <p className="mt-3 text-xs font-bold text-amber-100">Memory only — this start lasts for this session.</p>}
        </m.div>
      </div>
    )
  }

  const isPending = !uma.scenarioStarted
  const atGate = uma.level % 10 === 0 && uma.level < SCENARIOS.length * 10
  if (!isPending && !atGate) return <ScreenState title={uma.level >= SCENARIOS.length * 10 ? 'Latest scenario complete' : 'Scenario already active'} detail={uma.level >= SCENARIOS.length * 10 ? 'This Uma has completed every available scenario.' : 'Finish the current scenario before starting another.'} action={{ label: 'Back to profile', to: `/stable/${encodeURIComponent(umaId)}` }} />

  const cost = isPending ? 0 : umaPromotionCost(tierOfLevel(uma.level))
  const affordable = profile.tickets >= cost
  const toggleParent = (fingerprint: ParentFingerprint) => {
    setError(null)
    setGrandUniques([]); setGrandWhites([]); setPinkSparks([])
    setParents((current) => current.some((item) => item.umaId === fingerprint.umaId)
      ? current.filter((item) => item.umaId !== fingerprint.umaId)
      : current.length < 2 ? [...current, fingerprint] : current)
  }
  const continueFromParents = () => {
    setPinkSparks(suggestPinkSparkSelections(uma.aptitudes, selectedSnapshots))
    setStep(1)
  }
  const toggleCapped = (id: string, selected: string[], cap: number, setter: (ids: string[]) => void) => {
    setter(selected.includes(id) ? selected.filter((item) => item !== id) : selected.length < cap ? [...selected, id] : selected)
  }
  const commit = () => {
    if (busy || !affordable || preview instanceof Error || preview === null) return
    setBusy(true); setError(null)
    void startScenario(umaId, selection).then((mutation) => {
      setEarnedFlairEventIds(mutation.earnedFlairEventIds)
      setCompleted(mutation.result ?? preview)
    }).catch((reason: unknown) => {
      const message = reason instanceof Error ? reason.message : 'Scenario could not be saved'
      setError(message)
      if (/stale|changed/i.test(message)) setStep(0)
    }).finally(() => setBusy(false))
  }
  const pinkProjection = pinkSparks.length === parents.length ? (() => {
    try { return projectPinkSparks(uma.aptitudes, selectedSnapshots, pinkSparks).projections } catch { return [] }
  })() : []

  return (
    <div className="min-h-dvh overflow-y-auto bg-gradient-to-b from-sky-top via-[#e6f6ff] to-cream text-ink">
      <header className="pt-safe sticky top-0 z-20 border-b-2 border-white bg-sky-deep/95 px-3 pb-2 text-white backdrop-blur">
        <div className="flex min-h-14 items-center gap-2">
          <Link to={`/stable/${encodeURIComponent(umaId)}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/20 text-xl" aria-label="Back without starting">←</Link>
          <div className="min-w-0 flex-1"><h1 className="font-extrabold text-outline">Scenario Start</h1><p className="truncate text-xs font-bold text-white/80">{step + 1}/5 · {STEPS[step]} · leaving saves nothing</p></div>
        </div>
        <div className="grid grid-cols-5 gap-1">{STEPS.map((label, index) => <div key={label} className={`h-1.5 rounded-full ${index <= step ? 'bg-gold' : 'bg-white/25'}`} />)}</div>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {step === 0 && <>
          <Panel><h2 className="text-lg font-extrabold">Choose up to two parents</h2><p className="mt-1 text-sm text-ink-soft">Only completed, frozen snapshots count. Order sets inheritance priority.</p></Panel>
          {candidates.map((candidate) => {
            const chosen = parents.some((item) => item.umaId === candidate.umaId)
            const display = contentState.content.umas.byId.get(candidate.umaId)
            const atlas = contentState.content.atlases['uma-icons']
            const assetFor = (id: string) => { const frame = atlas.descriptor.frames[id]; const page = frame ? atlas.descriptor.pages[frame.page] : undefined; const url = frame ? atlas.pageUrls[frame.page] : undefined; return frame && page && url ? { frame, url, pageWidth: page.width, pageHeight: page.height } : null }
            const asset = assetFor(candidate.privateArtId)
            return <button key={candidate.umaId} type="button" disabled={!candidate.eligible && !chosen} onClick={() => candidate.fingerprint && toggleParent(candidate.fingerprint)} className={`min-h-20 rounded-2xl border-2 p-3 text-left shadow-sm ${chosen ? 'border-violet-500 bg-violet-50' : candidate.eligible ? 'border-white bg-white' : 'border-slate-200 bg-slate-100 opacity-70'}`}>
              <div className="flex items-center gap-3"><AtlasSprite asset={asset} decorative className="w-12 shrink-0 rounded-xl bg-sky-100" fallback={<div className="flex h-full items-center justify-center">?</div>} /><div className="min-w-0 flex-1"><p className="truncate font-extrabold">{display?.name ?? candidate.umaId}</p><p className="text-xs font-bold text-ink-soft">{candidate.snapshot ? `Tier ${candidate.snapshot.completedTier} · ${snapshotAge(candidate.snapshot.takenAt)}` : 'No snapshot'}</p>{candidate.frozenParentMiniIds.length > 0 && <div className="mt-1 flex gap-1">{candidate.frozenParentMiniIds.map((id) => <AtlasSprite key={id} asset={assetFor(id)} decorative className="w-6 rounded-full bg-white" fallback={<div className="flex h-full items-center justify-center text-[8px]">?</div>} />)}</div>}</div><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-extrabold">{chosen ? `Parent ${parents.findIndex((item) => item.umaId === candidate.umaId) + 1}` : `+${candidate.newAutomaticUniqueCount} unique · +${candidate.newAutomaticWhiteCount} white`}</span></div>
              {candidate.issues.length > 0 && <p className="mt-2 text-xs font-bold text-danger">{candidate.issues.map((issue) => ISSUE_LABEL[issue]).join(' · ')}</p>}
            </button>
          })}
          {candidates.length === 0 && <Panel><p className="text-sm font-bold">No completed snapshots yet. Starting without parents is always valid.</p></Panel>}
        </>}

        {step === 1 && <Panel><h2 className="text-lg font-extrabold">Automatic inheritance</h2>{selectedSnapshots.length === 0 ? <p className="mt-2 text-sm text-ink-soft">No parents selected. Your permanent skills are unchanged.</p> : selectedSnapshots.map((parent, index) => <div key={parent.umaId} className="mt-3 rounded-xl bg-sky-50 p-3"><p className="font-extrabold">Parent {index + 1} · {contentState.content.umas.byId.get(parent.umaId)?.name ?? parent.umaId}</p><p className="mt-1 text-sm font-bold text-violet-700">{parent.inheritedUniqueSkillId ? '1 inherited unique' : 'No inherited unique'} · {parent.inheritableWhiteSkillIds.length} white</p><div className="mt-2 flex flex-wrap gap-1">{[parent.inheritedUniqueSkillId, ...parent.inheritableWhiteSkillIds].filter(Boolean).map((id) => <span key={id} className="rounded-full bg-white px-2 py-1 text-xs font-bold">{contentState.content.skills.byId.get(id!)?.name ?? id}</span>)}</div></div>)}</Panel>}

        {step === 2 && <>
          <Panel><h2 className="text-lg font-extrabold">Grandparent skills</h2><p className="mt-1 text-sm text-ink-soft">Choose {grandUniques.length}/{grandparents?.uniquePickCap ?? 0} uniques and {grandWhites.length}/{grandparents?.whitePickCap ?? 0} whites.</p></Panel>
          <Panel><h3 className="font-extrabold">Inherited uniques</h3><div className="mt-2 grid gap-2">{grandparents?.uniquePool.map((option) => <button key={option.skillId} type="button" onClick={() => toggleCapped(option.skillId, grandUniques, grandparents.uniquePickCap, setGrandUniques)} className={`min-h-11 rounded-xl px-3 text-left text-sm font-bold ${grandUniques.includes(option.skillId) ? 'bg-violet-600 text-white' : 'bg-sky-50'}`}>{contentState.content.skills.byId.get(option.skillId)?.name ?? option.skillId}</button>)}{grandparents?.uniquePool.length === 0 && <p className="text-sm text-ink-soft">No eligible grandparent uniques.</p>}</div></Panel>
          <Panel><h3 className="font-extrabold">White skills</h3><div className="mt-2 grid gap-2">{grandparents?.whitePool.map((option) => <button key={option.skillId} type="button" onClick={() => toggleCapped(option.skillId, grandWhites, grandparents.whitePickCap, setGrandWhites)} className={`min-h-11 rounded-xl px-3 text-left text-sm font-bold ${grandWhites.includes(option.skillId) ? 'bg-violet-600 text-white' : 'bg-sky-50'}`}>{contentState.content.skills.byId.get(option.skillId)?.name ?? option.skillId}</button>)}{grandparents?.whitePool.length === 0 && <p className="text-sm text-ink-soft">No eligible grandparent whites.</p>}</div></Panel>
          {grandparents?.contributors.some((item) => !item.eligible) && <Panel><h3 className="font-extrabold">Excluded lineage</h3>{grandparents.contributors.filter((item) => !item.eligible).map((item) => <p key={`${item.parentUmaId}:${item.snapshot.umaId}`} className="mt-1 text-xs font-bold text-ink-soft">{item.snapshot.umaId}: {item.issues.join(', ')}</p>)}</Panel>}
        </>}

        {step === 3 && <Panel><h2 className="text-lg font-extrabold">Pink sparks</h2>{selectedSnapshots.length === 0 ? <p className="mt-2 text-sm text-ink-soft">No parents means no aptitude upgrades this scenario.</p> : pinkProjection.map((projection, parentIndex) => <div key={projection.parentUmaId} className="mt-4"><p className="font-extrabold">Parent {parentIndex + 1}</p>{projection.options.length === 0 ? <p className="mt-1 text-sm text-ink-soft">No available upgrade.</p> : <div className="mt-2 grid grid-cols-2 gap-2">{projection.options.map((option) => <button key={option.category} type="button" onClick={() => setPinkSparks((current) => current.map((value, index) => index === parentIndex ? option.category : value))} className={`min-h-11 rounded-xl px-2 text-sm font-bold ${pinkSparks[parentIndex] === option.category ? 'bg-pink-500 text-white' : 'bg-pink-50'}`}>{option.category.replace(':', ' · ')} {option.before}→{option.after}</button>)}</div>}</div>)}</Panel>}

        {step === 4 && <>
          <Panel><p className="text-xs font-extrabold tracking-wider text-violet-700 uppercase">{isPending ? 'Free first scenario' : `Tier ${tierOfLevel(uma.level)} complete`}</p><h2 className="mt-1 text-xl font-extrabold">{isPending ? scenarioForTier(1)?.name : `${scenarioForTier(tierOfLevel(uma.level))?.name} → ${scenarioForTier(tierOfLevel(uma.level) + 1)?.name}`}</h2><p className="mt-2 text-sm font-bold text-ink-soft">{parents.length} parents · {grandUniques.length + grandWhites.length} grandparent picks · {pinkSparks.filter(Boolean).length} aptitude upgrades</p></Panel>
          <Panel><h3 className="font-extrabold">Refreshed library</h3>{preview && !(preview instanceof Error) && <div className="mt-2 flex flex-wrap gap-1">{preview.uma.skillLibrary.map((unlock) => <span key={unlock.skillId} className="rounded-full bg-sky-50 px-2 py-1 text-xs font-bold">{contentState.content.skills.byId.get(unlock.skillId)?.name ?? unlock.skillId}</span>)}</div>}<p className="mt-3 text-sm text-ink-soft">Training Level 1 · Opening Training required before racing · parents stay frozen for this scenario.</p></Panel>
          {!isPending && preview && !(preview instanceof Error) && 'fromTier' in preview && <Panel><h3 className="font-extrabold">Promotion gains</h3><p className="mt-1 text-sm text-ink-soft">+{PROMOTION_BONUS_PER_STAT} all stats, card Initial Stats, snapshot captured, and {preview.cost} tickets.</p></Panel>}
        </>}

        <Panel className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-20 mx-auto max-w-xl bg-white/95 backdrop-blur">
          {error && <p role="alert" className="mb-2 rounded-xl bg-red-50 p-2 text-sm font-bold text-danger">{error} · Nothing was changed.</p>}
          {preview instanceof Error && step === 4 && <p className="mb-2 rounded-xl bg-amber-50 p-2 text-sm font-bold">{preview.message}</p>}
          <div className="flex gap-2">{step > 0 && <GameButton variant="secondary" onClick={() => setStep((value) => value - 1)}>Back</GameButton>}<GameButton variant="go" disabled={busy || (step === 4 && (!affordable || preview === null || preview instanceof Error))} onClick={() => step === 0 ? continueFromParents() : step < 4 ? setStep((value) => value + 1) : commit()}>{busy ? 'Starting…' : step < 4 ? (step === 0 && parents.length === 0 ? 'Skip · Continue' : 'Continue') : isPending ? 'Start free' : `Spend ${cost} · Start`}</GameButton></div>
          {!persistent && <p className="mt-1 text-center text-[11px] font-bold text-amber-800">Memory only — this change cannot persist or sync.</p>}
        </Panel>
      </main>
    </div>
  )
}
