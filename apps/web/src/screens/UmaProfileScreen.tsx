import {
  DISTANCE_CATEGORIES,
  STATS,
  STRATEGIES,
  SURFACES,
  badgeStateId,
  compileRaceSkill,
  isGateLevel,
  raceSkillSupported,
  summarizeSkillLoadout,
  type Grade,
  type StatKey,
  type RaceResultRecord,
} from '@racer/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { listRaceHistory, setFeaturedUma, setUmaLoadout } from '../game/actions'
import { buildDeckView, formatDeckEffect } from '../game/deck-view'
import { buildLineageView } from '../game/lineage-view'
import { buildJourneyView } from '../game/goals-view'
import { buildUmaFlairSummary } from '../game/flair-view'
import { useGame } from '../game/store'
import { joinUma } from '../game/view'
import { AtlasSprite } from '../ui/AtlasSprite'
import { GameButton } from '../ui/GameButton'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'
import { FlairCards } from '../ui/FlairCards'

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const statLabel = (stat: StatKey) => (stat === 'wit' ? 'Wit' : titleCase(stat))
const statTone: Record<StatKey, string> = {
  speed: 'bg-stat-speed',
  stamina: 'bg-stat-stamina',
  power: 'bg-stat-power',
  guts: 'bg-stat-guts',
  wit: 'bg-stat-wit',
}
const gradeTone: Record<Grade, string> = {
  S: 'bg-gold text-white text-outline',
  A: 'bg-turf text-white text-outline',
  B: 'bg-sky text-white text-outline',
  C: 'bg-sky/20 text-sky-deep',
  D: 'bg-slate-200 text-ink',
  E: 'bg-slate-200 text-ink-soft',
  F: 'bg-slate-100 text-ink-soft',
  G: 'bg-slate-100 text-ink-soft',
}

function AptitudeRow({ label, entries }: { label: string; entries: readonly [string, Grade][] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-extrabold tracking-wide text-ink-soft uppercase">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([name, grade]) => (
          <div key={name} className="flex min-h-11 items-center justify-between rounded-xl bg-sky-50 px-3">
            <span className="text-sm font-bold">{name}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full font-extrabold ${gradeTone[grade]}`}>{grade}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function UmaProfileScreen() {
  const navigate = useNavigate()
  const { umaId = '' } = useParams()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const error = useGame((state) => state.error)
  const profile = useGame((state) => state.profile)
  const save = useGame((state) => state.umas[umaId])
  const cards = useGame((state) => state.cards)
  const badges = useGame((state) => state.badges)
  const flairEvents = useGame((state) => state.flairEvents)
  const pushToast = useGame((state) => state.pushToast)
  const [savingSkillId, setSavingSkillId] = useState<string | null>(null)
  const [selectedJourneyTier, setSelectedJourneyTier] = useState<number | null>(null)
  const [raceHistory, setRaceHistory] = useState<RaceResultRecord[]>([])

  const flairSummary = useMemo(() => {
    if (contentState.status !== 'ready' || !save) return null
    const state = badges[badgeStateId(save.templateId)]
    return state?.scope === 'uma' ? buildUmaFlairSummary(contentState.content, state, flairEvents) : null
  }, [badges, contentState, flairEvents, save])

  useEffect(() => {
    if (status !== 'ready' || !save) return
    let cancelled = false
    void listRaceHistory(10_000).then((records) => { if (!cancelled) setRaceHistory(records) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [save, status])

  if (contentState.status === 'signed-out' || status === 'signed-out') {
    return <ScreenState title="Sign in to view this Uma" detail="Profiles are part of your private save." action={{ label: 'Open Settings', to: '/settings' }} />
  }
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private content before opening profiles." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <ScreenState title="Save needs attention" detail={error ?? 'The local save could not be opened.'} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) return <ScreenState title="Opening profile…" detail="Loading private content and save data." />
  if (!save) return <ScreenState title="Uma not found" detail="This Uma is not owned in your Stable." action={{ label: 'Back to Stable', to: '/stable' }} />
  const joined = joinUma(save, contentState.content)
  if (joined.status !== 'ready') {
    return <ScreenState title="Content reference missing" detail={`The save is preserving ${joined.templateId} until its template is restored.`} action={{ label: 'Back to Stable', to: '/stable' }} />
  }
  const uma = joined.value
  const featured = profile.featuredUmaId === save.templateId
  const setupPending = !save.scenarioStarted
  const raceUnlocked = save.scenarioStarted && save.trainingsThisScenario >= 1 && !isGateLevel(save.level)
  const loadout = summarizeSkillLoadout(save, uma.template, contentState.content.skills.byId)
  const deck = buildDeckView(save, cards, contentState.content)
  const lineage = buildLineageView(save, contentState.content)
  const journey = buildJourneyView(save, contentState.content)
  const selectedJourney = journey.find((item) => item.tier === selectedJourneyTier) ?? null

  const toggleSkill = async (skillId: string) => {
    if (savingSkillId) return
    const next = save.loadoutSkillIds.includes(skillId)
      ? save.loadoutSkillIds.filter((id) => id !== skillId)
      : [...save.loadoutSkillIds, skillId]
    setSavingSkillId(skillId)
    try {
      await setUmaLoadout(save.templateId, next)
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : 'Could not update skill loadout')
    } finally {
      setSavingSkillId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Link to="/stable" className="flex min-h-11 items-center gap-1 px-1 font-extrabold text-white text-outline">← Stable</Link>

      <Panel className="overflow-hidden bg-gradient-to-b from-white to-sky-50 p-0">
        <div className="relative p-4 pb-3">
          <div className="mx-auto w-48 max-w-[65vw]">
            <AtlasSprite asset={uma.asset} alt={`${uma.template.name} icon`} className="rounded-[2rem] border-4 border-white bg-sky-100 shadow-[var(--shadow-panel)]" fallback={<div className="flex h-full items-center justify-center text-7xl">🐴</div>} />
          </div>
          <button
            type="button"
            aria-pressed={featured}
            disabled={featured}
            className={`absolute top-4 right-4 min-h-11 rounded-full border-2 px-3 text-sm font-extrabold ${featured ? 'border-gold bg-gold text-white text-outline' : 'border-white bg-white text-ink'}`}
            onClick={() => {
              void setFeaturedUma(save.templateId).catch((reason: unknown) => {
                pushToast(reason instanceof Error ? reason.message : 'Could not update featured Uma')
              })
            }}
          >
            {featured ? '★ Featured' : '☆ Set featured'}
          </button>
        </div>
        <div className="border-t-2 border-white bg-white/70 px-4 py-4 text-center">
          <h1 className="text-2xl font-extrabold">{uma.template.name}</h1>
          {flairSummary?.activeTitle && <p className="mt-1 text-sm font-extrabold text-violet-700">{flairSummary.activeTitle}</p>}
          <p className="text-sm text-ink-soft">{uma.template.outfit ?? 'Standard outfit'}</p>
          <p className="mt-2 font-extrabold text-sky-deep">Uma Lv {save.level} · Training Lv {save.trainingLevel}</p>
          <p className="text-sm font-bold">Tier {uma.tier} · {uma.scenario?.name ?? 'Future scenario'}</p>
          {uma.readyToPromote && <p className="mt-2 inline-flex rounded-full bg-gold px-3 py-1 text-sm font-extrabold text-white text-outline">Ready to promote</p>}
        </div>
      </Panel>

      {flairSummary && <Panel className="bg-gradient-to-br from-white to-violet-50">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-extrabold">Flair archive</h2><p className="text-xs font-bold text-ink-soft">Full Badge page arrives in the next milestone task.</p></div>
          <div className="rounded-2xl border-2 border-violet-200 bg-white px-3 py-2 text-center"><p className="text-lg font-extrabold text-violet-700">{flairSummary.prestige}</p><p className="text-[10px] font-extrabold text-ink-soft">{flairSummary.frame.label} · Prestige</p></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-extrabold">
          <div className="rounded-xl bg-white p-2"><span className="block text-lg text-sky-deep">{flairSummary.badgeCount}</span>Badges</div>
          <div className="rounded-xl bg-white p-2"><span className="block text-lg text-violet-700">{flairSummary.titleCount}</span>Titles</div>
          <div className="rounded-xl bg-white p-2"><span className="block text-lg text-gold-deep">{flairSummary.trophyCount}</span>Trophies</div>
        </div>
        {flairSummary.recent.length > 0 && <div className="mt-3"><FlairCards title="Recent awards" items={flairSummary.recent} /></div>}
      </Panel>}

      {setupPending && <Panel className="border-violet-300 bg-violet-50"><h2 className="font-extrabold">Scenario setup required</h2><p className="mt-1 text-sm text-ink-soft">Choose optional frozen parents before this new Uma can Train or race.</p><GameButton className="mt-3" variant="go" onClick={() => navigate(`/scenario/${encodeURIComponent(save.templateId)}/start`)}>Start scenario</GameButton></Panel>}

      <Panel>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Current stats</h2>
          <span className="text-xs font-bold text-ink-soft">TL cap {uma.currentStatCap} · baseline {uma.baselineStatCap}</span>
        </div>
        <div className="mt-3 grid gap-2">
          {STATS.map((stat) => {
            const value = save.stats[stat]
            const over = value > uma.currentStatCap
            return (
              <div key={stat}>
                <div className="flex items-center justify-between text-sm font-extrabold">
                  <span>{statLabel(stat)}</span>
                  <span>{value} / {uma.currentStatCap}{over ? ' carried' : ''}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${over ? 'bg-gold' : statTone[stat]}`} style={{ width: `${Math.min(100, (value / uma.currentStatCap) * 100)}%` }} />
                </div>
              </div>
            )
          })}
          <div className="mt-1 flex min-h-11 items-center justify-between rounded-xl bg-violet-50 px-3 font-extrabold">
            <span>Skill Points</span>
            <span>{save.skillPoints} / {uma.currentSpCap}</span>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Support deck</h2>
            <p className="text-xs font-bold text-ink-soft">{save.deckCardIds.length} / {deck.slotCount} cards · Race Bonus {formatDeckEffect('raceBonus', deck.raceBonus)} · {deck.hintSkillCount} hints</p>
          </div>
          <Link to={`/stable/${encodeURIComponent(save.templateId)}/deck`} className="flex min-h-11 items-center rounded-xl bg-violet-600 px-4 text-sm font-extrabold text-white">Edit</Link>
        </div>
        {save.deckCardIds.length > 0 ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {deck.slots.filter((slot) => slot.card).map((slot) => <div key={slot.index} className="w-20 shrink-0">
            <AtlasSprite asset={slot.card!.asset} decorative className="rounded-xl bg-slate-100" fallback={<div className="flex h-full items-center justify-center">?</div>} />
            <p className="mt-1 truncate text-center text-[10px] font-extrabold">{slot.card!.template?.charName ?? 'Missing'}</p>
          </div>)}
        </div> : <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">Choose at least one owned stat card before Training or racing.</p>}
        {deck.validationErrors.length > 0 && <p className="mt-3 rounded-xl bg-red-50 p-2 text-sm font-bold text-danger">{deck.validationErrors[0]}</p>}
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Race skills</h2>
            <p className="text-xs font-bold text-ink-soft">Own unique is free · tap supported skills to equip</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-extrabold ${loadout.valid ? 'bg-violet-100 text-violet-700' : 'bg-red-100 text-danger'}`}>
            {loadout.cost} / {loadout.cap} SP
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {save.skillLibrary.map((unlock) => {
            const skill = contentState.content.skills.byId.get(unlock.skillId)
            if (!skill) return <div key={unlock.skillId} className="rounded-xl bg-red-50 p-3 text-sm font-bold text-danger">Missing skill {unlock.skillId}</div>
            const own = unlock.origin === 'own-unique'
            const supported = raceSkillSupported(compileRaceSkill(skill))
            const equipped = own || save.loadoutSkillIds.includes(skill.id)
            return (
              <button
                key={skill.id}
                type="button"
                aria-pressed={equipped}
                disabled={own || (!supported && !equipped) || savingSkillId !== null}
                onClick={() => void toggleSkill(skill.id)}
                className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-3 py-2 text-left ${equipped ? 'border-violet-400 bg-violet-50' : 'border-slate-100 bg-white'} disabled:opacity-70`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-extrabold ${equipped ? 'bg-violet-500 text-white' : 'bg-slate-100'}`}>
                  {equipped ? '✓' : '+'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-extrabold">{skill.name}</span>
                  <span className="block text-xs font-bold text-ink-soft">
                    {own
                      ? supported
                        ? 'Own unique · always equipped'
                        : 'Own unique · waits for later race-depth mechanics'
                      : supported
                        ? `${skill.costSp ?? '—'} SP · ${skill.kind}`
                        : 'Needs later race-depth mechanics'}
                  </span>
                </span>
              </button>
            )
          })}
          {save.skillLibrary.length === 0 && <p className="text-sm text-ink-soft">Train with support cards to discover skills.</p>}
        </div>
        {!loadout.valid && <p className="mt-3 rounded-xl bg-red-50 p-2 text-sm font-bold text-danger">{loadout.errors[0]}</p>}
      </Panel>

      <Panel className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">Aptitudes</h2>
        <AptitudeRow label="Surface" entries={SURFACES.map((key) => [titleCase(key), save.aptitudes.surface[key]])} />
        <AptitudeRow label="Distance" entries={DISTANCE_CATEGORIES.map((key) => [titleCase(key), save.aptitudes.distance[key]])} />
        <AptitudeRow label="Strategy" entries={STRATEGIES.map((key) => [titleCase(key), save.aptitudes.strategy[key]])} />
      </Panel>

      <Panel>
        <h2 className="text-lg font-extrabold">Journey</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {journey.map((item) => (
            <button key={item.tier} type="button" onClick={() => setSelectedJourneyTier(item.tier)} className={`min-h-28 min-w-32 rounded-2xl border-2 p-3 text-left ${item.tier === uma.tier ? 'border-sky bg-sky/10' : 'border-turf/30 bg-turf/5'}`}>
              <p className="text-xs font-extrabold text-ink-soft">Tier {item.tier}</p>
              <p className="mt-1 text-sm font-extrabold">{item.name}</p>
              {item.tracking === 'legacy-untracked' ? <p className="mt-2 text-xs font-bold text-ink-soft">— Not tracked</p> : item.tracking === 'missing' ? <p className="mt-2 text-xs font-bold text-danger">Plan unavailable</p> : (
                <div className="mt-2 flex items-center gap-1" aria-label={`${item.completed} completed, ${item.missed} missed, ${item.active} active`}>
                  {item.honors ? <span className="rounded-full bg-gold px-2 py-1 text-xs font-extrabold text-white text-outline">Honors</span> : item.goals.map((goal) => <span key={goal.id} className={`h-3 w-3 rounded-full border-2 ${goal.status === 'completed' ? 'border-gold bg-gold' : goal.status === 'missed' ? 'border-slate-400 bg-slate-200' : 'border-sky bg-white'}`} />)}
                </div>
              )}
            </button>
          ))}
        </div>
        {selectedJourney && <div className="mt-3 rounded-2xl bg-white p-3">
          <div className="flex items-center justify-between gap-2"><p className="font-extrabold">{selectedJourney.name}</p><button type="button" className="min-h-11 px-2 text-sm font-extrabold text-sky-deep" onClick={() => setSelectedJourneyTier(null)}>Close</button></div>
          {selectedJourney.tracking === 'legacy-untracked' ? <p className="text-sm text-ink-soft">Not tracked — this completed tier predates goal plans, so no wins or misses were invented.</p> : selectedJourney.goals.length === 0 ? <p className="text-sm text-danger">Goal plan unavailable.</p> : <div className="grid gap-2">
            {selectedJourney.goals.map((goal) => {
              const result = goal.completedRaceResultId ? raceHistory.find((record) => `race:${record.umaId}:${record.sequence}` === goal.completedRaceResultId) : undefined
              const destination = result
                ? `/race/run?uma=${encodeURIComponent(result.umaId)}&race=${encodeURIComponent(result.raceId)}&strategy=${result.strategy}&sequence=${result.sequence}`
                : `/race?uma=${encodeURIComponent(save.templateId)}&goal=${encodeURIComponent(goal.raceId)}`
              return <Link key={goal.id} to={destination} className="flex min-h-11 items-center gap-2 rounded-xl bg-sky-50 px-3 py-2">
                <span>{goal.status === 'completed' ? '●' : goal.status === 'missed' ? '○' : '◉'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{goal.label} · {goal.raceName}</span><span className="block text-xs text-ink-soft">{goal.rule} · {goal.status}{goal.race ? '' : ' · target missing'}{result ? ' · View result' : ''}</span></span>
              </Link>
            })}
          </div>}
        </div>}
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Panel className="col-span-2 p-3 text-center opacity-65">
          <p className="text-sm font-extrabold">Badges & Record</p>
          <p className="mt-1 text-xs text-ink-soft">Coming in a later milestone</p>
        </Panel>
        <Panel className="col-span-2 p-3">
          <p className="text-sm font-extrabold">Lineage</p>
          {lineage.activeParents.length > 0 ? <div className="mt-2 grid grid-cols-2 gap-2">{lineage.activeParents.map((parent) => <div key={parent.umaId} className="rounded-xl bg-violet-50 p-2"><p className="text-xs font-extrabold">{parent.name} · T{parent.completedTier}</p><p className="text-[11px] text-ink-soft">{parent.uniqueCount} unique · {parent.whiteCount} whites</p>{parent.grandparents.map((grandparent) => <p key={grandparent.umaId} className="mt-1 border-l-2 border-violet-300 pl-2 text-[10px] font-bold">↳ {grandparent.name} · T{grandparent.completedTier}</p>)}</div>)}</div> : <p className="mt-1 text-xs text-ink-soft">No parents in the active scenario.</p>}
          {lineage.latestSnapshot ? <p className="mt-3 text-xs font-bold text-violet-700">Latest self snapshot: Tier {lineage.latestSnapshot.completedTier} · {lineage.latestSnapshot.whiteCount} inheritable whites · {lineage.latestSnapshot.grandparents.length} frozen parents.</p> : <p className="mt-3 text-xs font-bold text-violet-700">Complete a scenario to become an available parent.</p>}
        </Panel>
      </div>

      <div className="sticky bottom-24 z-10 rounded-[1.5rem] border-2 border-white bg-white/95 p-3 shadow-[var(--shadow-panel)] backdrop-blur">
        <p className="mb-3 text-center text-sm font-extrabold">
          {setupPending ? 'Choose lineage before Training or racing.' : uma.readyToPromote ? 'Ready to promote before racing again.' : isGateLevel(save.level) ? 'Latest scenario complete.' : raceUnlocked ? 'Progression races are open.' : 'Train once to unlock races in this scenario.'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <GameButton variant="secondary" disabled={!setupPending && isGateLevel(save.level) && !uma.readyToPromote} onClick={() => navigate(setupPending || uma.readyToPromote ? `/scenario/${encodeURIComponent(save.templateId)}/start` : `/training/${encodeURIComponent(save.templateId)}`)}>{setupPending ? 'Set up' : uma.readyToPromote ? 'Promote' : 'Train'}</GameButton>
          <GameButton variant="go" disabled={!setupPending && !raceUnlocked && !uma.readyToPromote} onClick={() => navigate(setupPending || uma.readyToPromote ? `/scenario/${encodeURIComponent(save.templateId)}/start` : `/race?uma=${encodeURIComponent(save.templateId)}`)}>{setupPending ? 'Start' : uma.readyToPromote ? 'Promote' : 'Race'}</GameButton>
          <GameButton variant="primary" disabled={!setupPending && !uma.readyToPromote} onClick={() => navigate(`/scenario/${encodeURIComponent(save.templateId)}/start`)}>{setupPending ? 'Lineage' : uma.readyToPromote ? 'Next tier' : isGateLevel(save.level) ? 'Complete' : 'At gate'}</GameButton>
        </div>
        <p className="mt-2 text-center text-xs text-ink-soft">Promotion spends tickets atomically and starts at Training Level 1.</p>
      </div>
    </div>
  )
}
