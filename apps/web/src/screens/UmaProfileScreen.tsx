import {
  DISTANCE_CATEGORIES,
  SCENARIOS,
  STATS,
  STRATEGIES,
  SURFACES,
  compileRaceSkill,
  isGateLevel,
  raceSkillSupported,
  summarizeSkillLoadout,
  type Grade,
  type StatKey,
} from '@racer/domain'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { setFeaturedUma, setUmaLoadout } from '../game/actions'
import { useGame } from '../game/store'
import { joinUma } from '../game/view'
import { AtlasSprite } from '../ui/AtlasSprite'
import { GameButton } from '../ui/GameButton'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'

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
  const pushToast = useGame((state) => state.pushToast)
  const [savingSkillId, setSavingSkillId] = useState<string | null>(null)

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
  const raceUnlocked = save.trainingsThisScenario >= 1 && !isGateLevel(save.level)
  const loadout = summarizeSkillLoadout(save, uma.template, contentState.content.skills.byId)

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
          <p className="text-sm text-ink-soft">{uma.template.outfit ?? 'Standard outfit'}</p>
          <p className="mt-2 font-extrabold text-sky-deep">Uma Lv {save.level} · Training Lv {save.trainingLevel}</p>
          <p className="text-sm font-bold">Tier {uma.tier} · {uma.scenario?.name ?? 'Future scenario'}</p>
          {uma.readyToPromote && <p className="mt-2 inline-flex rounded-full bg-gold px-3 py-1 text-sm font-extrabold text-white text-outline">Ready to promote</p>}
        </div>
      </Panel>

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
          {Array.from({ length: uma.tier }, (_, index) => index + 1).map((tier) => (
            <div key={tier} className={`min-w-28 rounded-2xl border-2 p-3 ${tier === uma.tier ? 'border-sky bg-sky/10' : 'border-turf/30 bg-turf/5'}`}>
              <p className="text-xs font-extrabold text-ink-soft">Tier {tier}</p>
              <p className="mt-1 text-sm font-extrabold">{SCENARIOS[tier - 1]?.name ?? 'Future scenario'}</p>
              <p className="mt-2 text-xs font-bold">{tier === uma.tier ? 'Current' : 'Completed'}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        {['Goals & Honors', 'Badges & Record', 'Lineage', 'Deck & Loadout'].map((label) => (
          <Panel key={label} className="p-3 text-center opacity-65">
            <p className="text-sm font-extrabold">{label}</p>
            <p className="mt-1 text-xs text-ink-soft">Coming in a later milestone</p>
          </Panel>
        ))}
      </div>

      <div className="sticky bottom-24 z-10 rounded-[1.5rem] border-2 border-white bg-white/95 p-3 shadow-[var(--shadow-panel)] backdrop-blur">
        <p className="mb-3 text-center text-sm font-extrabold">
          {isGateLevel(save.level) ? 'Ready to promote before racing again.' : raceUnlocked ? 'Progression races are open.' : 'Train once to unlock races in this scenario.'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <GameButton variant="secondary" onClick={() => navigate(`/training/${encodeURIComponent(save.templateId)}`)}>Train</GameButton>
          <GameButton variant="go" disabled={!raceUnlocked} onClick={() => navigate(`/race?uma=${encodeURIComponent(save.templateId)}`)}>Race</GameButton>
          <GameButton variant="secondary" disabled>Promote · locked</GameButton>
        </div>
        <p className="mt-2 text-center text-xs text-ink-soft">Races grant Uma EXP; promotion remains locked for a later milestone.</p>
      </div>
    </div>
  )
}
