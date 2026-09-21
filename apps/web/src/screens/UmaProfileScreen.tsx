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
import { advanceUma, listRaceHistory, setFeaturedUma, setUmaLoadout, startScenario } from '../game/actions'
import { buildDeckView, formatDeckEffect } from '../game/deck-view'
import { buildJourneyView } from '../game/goals-view'
import { buildUmaFlairSummary } from '../game/flair-view'
import { buildUmaBadgeCollection } from '../game/badge-collection-view'
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
  const badgeCollection = useMemo(() => {
    if (contentState.status !== 'ready' || !save) return null
    const state = badges[badgeStateId(save.templateId)]
    return state?.scope === 'uma' ? buildUmaBadgeCollection(contentState.content, state, flairEvents, raceHistory) : null
  }, [badges, contentState, flairEvents, raceHistory, save])

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
  const joined = joinUma(save, contentState.content, cards)
  if (joined.status !== 'ready') {
    return <ScreenState title="Content reference missing" detail={`The save is preserving ${joined.templateId} until its template is restored.`} action={{ label: 'Back to Stable', to: '/stable' }} />
  }
  const uma = joined.value
  const featured = profile.featuredUmaId === save.templateId
  const setupPending = !uma.run.started
  const raceUnlocked = uma.run.started && !isGateLevel(save.level)
  const loadout = summarizeSkillLoadout(uma.derived, uma.template, contentState.content.skills.byId)
  const deck = buildDeckView(save, cards, contentState.content)
  const journey = buildJourneyView(save, contentState.content)
  const selectedJourney = journey.find((item) => item.tier === selectedJourneyTier) ?? null

  const toggleSkill = async (skillId: string) => {
    if (savingSkillId) return
    const next = uma.derived.loadoutSkillIds.includes(skillId)
      ? uma.derived.loadoutSkillIds.filter((id) => id !== skillId)
      : [...uma.derived.loadoutSkillIds, skillId]
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
      <Link to="/stable" className="flex min-h-11 items-center gap-1 px-1 font-semibold text-ink-soft">← Stable</Link>

      <Panel className={`overflow-hidden bg-gradient-to-b from-white to-sky-50 p-0 ${flairSummary?.frame.borderClass ?? ''}`}>
        <div className="relative p-4 pb-3">
          <div className="mx-auto w-48 max-w-[65vw]">
            <AtlasSprite asset={uma.asset} alt={`${uma.template.name} icon`} className={`rounded-[2rem] border-4 bg-sky-100 shadow-[var(--shadow-panel)] ${flairSummary?.frame.borderClass ?? 'border-white'}`} fallback={<div className="flex h-full items-center justify-center text-7xl">🐴</div>} />
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
          <p className="mt-2 font-extrabold text-sky-deep">Uma Lv {save.level} · Training Lv {uma.derived.trainingLevel}</p>
          <p className="text-sm font-bold">Tier {uma.tier} · {uma.scenario?.name ?? 'Future scenario'}</p>
          {uma.readyToAdvance && <p className="mt-2 inline-flex rounded-full bg-gold px-3 py-1 text-sm font-extrabold text-white text-outline">Ready to promote</p>}
        </div>
      </Panel>

      {flairSummary && badgeCollection && <Panel className="bg-gradient-to-br from-white to-violet-50">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-extrabold">Badge showcase</h2><p className="text-xs font-bold text-ink-soft">{flairSummary.activeTitle ?? 'No active title selected'}</p></div>
          <div className="rounded-2xl border-2 border-violet-200 bg-white px-3 py-2 text-center"><p className="text-lg font-extrabold text-violet-700">{flairSummary.prestige}</p><p className="text-[10px] font-extrabold text-ink-soft">{flairSummary.frame.label} · Prestige</p></div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-extrabold">
          <div className="rounded-xl bg-white p-2"><span className="block text-lg text-sky-deep">{flairSummary.badgeCount}</span>Badges</div>
          <div className="rounded-xl bg-white p-2"><span className="block text-lg text-violet-700">{flairSummary.titleCount}</span>Titles</div>
          <div className="rounded-xl bg-white p-2"><span className="block text-lg text-gold-deep">{flairSummary.trophyCount}</span>Trophies</div>
        </div>
        {badgeCollection.pinnedRefs.length > 0 ? <div className="mt-3 grid grid-cols-3 gap-2">{badgeCollection.pinnedRefs.slice(0, 12).map((ref) => { const item = badgeCollection.items.find((candidate) => candidate.awardKey === ref); return <Link key={ref} to={`/badges?uma=${encodeURIComponent(save.templateId)}&detail=${encodeURIComponent(ref)}`} className="flex min-h-16 flex-col justify-center rounded-xl border-2 border-violet-100 bg-white p-2 text-center"><span aria-hidden>{item?.kind === 'title' ? '♕' : item?.kind === 'trophy' ? '♜' : '✦'}</span><span className="line-clamp-2 text-[10px] font-extrabold">{item?.label ?? ref}</span></Link> })}</div> : <Link to={`/badges?uma=${encodeURIComponent(save.templateId)}`} className="mt-3 flex min-h-14 items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-white text-sm font-extrabold text-violet-700">Open pin mode to build a showcase</Link>}
        {flairSummary.recent.length > 0 && <div className="mt-3"><FlairCards title="Recent timeline" items={flairSummary.recent} /></div>}
        <Link to={`/badges?uma=${encodeURIComponent(save.templateId)}`} className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-4 font-extrabold text-white">View all Badges</Link>
      </Panel>}

      {setupPending && <Panel className="border-violet-300 bg-violet-50"><h2 className="font-extrabold">Scenario setup required</h2><p className="mt-1 text-sm text-ink-soft">Choose optional frozen parents before this new Uma can Train or race.</p><GameButton className="mt-3" variant="go" onClick={() => navigate(`/scenario/${encodeURIComponent(save.templateId)}/start`)}>Start scenario</GameButton></Panel>}

      <Panel>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold">Current stats</h2>
          <span className="text-xs font-bold text-ink-soft">Scenario caps</span>
        </div>
        <div className="mt-3 grid gap-2">
          {STATS.map((stat) => {
            const value = uma.derived.stats[stat]
            const over = value > uma.caps[stat]
            return (
              <div key={stat}>
                <div className="flex items-center justify-between text-sm font-extrabold">
                  <span>{statLabel(stat)}</span>
                  <span>{value} / {uma.caps[stat]}{over ? ' carried' : ''}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${over ? 'bg-gold' : statTone[stat]}`} style={{ width: `${Math.min(100, (value / uma.caps[stat]) * 100)}%` }} />
                </div>
              </div>
            )
          })}
          <div className="mt-1 flex min-h-11 items-center justify-between rounded-xl bg-violet-50 px-3 font-extrabold">
            <span>Skill Points</span>
            <span>{uma.derived.skillPoints} / {uma.spCap}</span>
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">Support deck</h2>
            <p className="text-xs font-bold text-ink-soft">{uma.run.cardSetIds.length} / {deck.slotCount} cards · Race Bonus {formatDeckEffect('raceBonus', deck.raceBonus)} · {deck.hintSkillCount} hints</p>
          </div>
          <Link to={`/stable/${encodeURIComponent(save.templateId)}/deck`} className="flex min-h-11 items-center rounded-xl bg-violet-600 px-4 text-sm font-extrabold text-white">Edit</Link>
        </div>
        {uma.run.cardSetIds.length > 0 ? <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
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
          {uma.derived.library.map((unlock) => {
            const skill = contentState.content.skills.byId.get(unlock.skillId)
            if (!skill) return <div key={unlock.skillId} className="rounded-xl bg-red-50 p-3 text-sm font-bold text-danger">Missing skill {unlock.skillId}</div>
            const own = unlock.origin === 'own-unique'
            const supported = raceSkillSupported(compileRaceSkill(skill))
            const equipped = own || uma.derived.loadoutSkillIds.includes(skill.id)
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
          {uma.derived.library.length === 0 && <p className="text-sm text-ink-soft">Train with support cards to discover skills.</p>}
        </div>
        {!loadout.valid && <p className="mt-3 rounded-xl bg-red-50 p-2 text-sm font-bold text-danger">{loadout.errors[0]}</p>}
      </Panel>

      <Panel className="flex flex-col gap-4">
        <h2 className="text-lg font-extrabold">Aptitudes</h2>
        <AptitudeRow label="Surface" entries={SURFACES.map((key) => [titleCase(key), uma.derived.aptitudes.surface[key]])} />
        <AptitudeRow label="Distance" entries={DISTANCE_CATEGORIES.map((key) => [titleCase(key), uma.derived.aptitudes.distance[key]])} />
        <AptitudeRow label="Strategy" entries={STRATEGIES.map((key) => [titleCase(key), uma.derived.aptitudes.strategy[key]])} />
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
                  {item.honors ? <span className="rounded-full bg-gold px-2 py-1 text-xs font-extrabold text-white text-outline">Honors</span> : item.goals.flatMap((goal) => goal.pips.length > 0 ? goal.pips.map((pip) => ({ key: `${goal.id}:${pip.key}`, status: pip.status })) : [{ key: goal.id, status: goal.status }]).map((pip) => <span key={pip.key} className={`h-3 w-3 rounded-full border-2 ${pip.status === 'completed' ? 'border-gold bg-gold' : pip.status === 'missed' ? 'border-slate-400 bg-slate-200' : 'border-sky bg-white'}`} />)}
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
                : `/race?uma=${encodeURIComponent(save.templateId)}${goal.raceId ? `&goal=${encodeURIComponent(goal.raceId)}` : ''}`
              return <Link key={goal.id} to={destination} className="flex min-h-11 items-center gap-2 rounded-xl bg-sky-50 px-3 py-2">
                <span>{goal.status === 'completed' ? '●' : goal.status === 'missed' ? '○' : '◉'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{goal.label} · {goal.raceName}</span><span className="block text-xs text-ink-soft">{goal.rule} · {goal.status}{goal.race ? '' : ' · target missing'}{result ? ' · View result' : ''}</span>{goal.pips.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{goal.pips.map((pip) => <span key={pip.key} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pip.status === 'completed' ? 'bg-gold text-white' : pip.status === 'missed' ? 'bg-slate-200 text-ink-soft' : 'bg-white text-sky-deep'}`}>{pip.raceName}</span>)}</span>}</span>
              </Link>
            })}
          </div>}
        </div>}
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        <Panel className="col-span-2 p-3">
          <p className="text-sm font-extrabold">Lineage</p>
          {uma.derived.lineage.length > 0
            ? <div className="mt-2 grid grid-cols-2 gap-2">{uma.derived.lineage.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-violet-50 p-2">
                <p className="text-xs font-extrabold">{entry.name}</p>
                <p className="text-[11px] text-ink-soft">{entry.awakeningSkillIds.length} baseline skills</p>
              </div>
            ))}</div>
            : <p className="mt-1 text-xs text-ink-soft">Reach Training Level 9 to open the first lineage slot.</p>}
        </Panel>
      </div>

      <div className="sticky bottom-24 z-10 rounded-[1.5rem] border-2 border-white bg-white/95 p-3 shadow-[var(--shadow-panel)] backdrop-blur">
        <p className="mb-3 text-center text-sm font-extrabold">
          {setupPending ? 'Start this scenario before racing.' : uma.readyToAdvance ? 'Ready to unlock the next scenario.' : isGateLevel(save.level) ? 'Latest scenario complete.' : 'Progression races are open.'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <GameButton
            variant="secondary"
            onClick={() => navigate(`/constellation/${encodeURIComponent(save.templateId)}`)}
          >
            Constellation
          </GameButton>
          <GameButton
            variant="go"
            disabled={!raceUnlocked}
            onClick={() => navigate(`/race?uma=${encodeURIComponent(save.templateId)}`)}
          >
            Race
          </GameButton>
          <GameButton
            variant="primary"
            disabled={!setupPending && !uma.readyToAdvance}
            onClick={() => void (setupPending ? startScenario(save.templateId) : advanceUma(save.templateId))}
          >
            {setupPending ? 'Start' : uma.readyToAdvance ? 'Next scenario' : 'At gate'}
          </GameButton>
        </div>
        <p className="mt-2 text-center text-xs text-ink-soft">Unlocking the next scenario spends tickets and opens a fresh constellation at Training Level 1.</p>
      </div>
    </div>
  )
}
