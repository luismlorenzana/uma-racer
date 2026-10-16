// An Uma's profile (docs/game/11-hub-and-places.md §3.1; docs/game/03-uma-progression.md §2, §6–§8, §12; Collection
// "Uma album"; T138): her header with "T1 · URA Finale · Racing Lv 1 · Farm Lv 1", both EXP bars, what she's doing and
// T142's target slot; Previous, Next and a swipe through the Stable's filtered order; Overview (the preset switch and
// that preset's stats, her build per facility, Collect, her career, Advance or Promote, Feature her), Needs (T142's;
// layer progress until it lands), Skills (library and loadout) and Racing (race defaults, career record, latest
// results, the Trophy Hall). An unknown or locked id says `unknown-uma`'s words with a way back.
import { hubWords } from '@racer/domain/hub'
import { layerProgress } from '@racer/domain/planner'
import { racePreferencesOf, TIER_REFUSALS } from '@racer/domain/tiers'
import { deriveUmaPreset } from '@racer/domain/training'
import type { DistanceCategory, Grade } from '@racer/domain'
import type { RaceResultRow } from '@racer/domain/save'
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { Crest } from '../../ui/Crest'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon } from '../../ui/icons'
import { Meter } from '../../ui/Meter'
import { Panel } from '../../ui/Panel'
import { useGame, useHub, useNow, useRuntime } from '../../app/game'
import { useAlbumPrefs } from '../../ui/albumPrefs'
import { TierCrest, UiMark } from '../../ui/UiMark'
import { UmaSquare } from '../../ui/ArtSquare'
import {
  amount, DISTANCE_LABEL, DISTANCES, STAT_KEYS, STAT_LABEL, STYLE_LABEL, STYLES, SURFACE_KEYS, SURFACE_LABEL,
} from '../../ui/labels'
import { PlaceHeader } from '../../ui/PlaceHeader'
import { Tabs } from '../../ui/Tabs'
import { TapNoteLine, useTap, type Tap } from '../../ui/work'
import { PROFILE_UI, type PageProps } from '../registry'
import {
  buildStableAlbum, careerOf, doingNow, doingWords, farmBar, latestResults, moved, ordinal, profileLine, queryStable, racingBar, readiness,
  skillsView, STABLE_ALBUM, STABLE_DEFAULT_QUERY, STABLE_FACETS, STABLE_SORTS,
} from './model'

type Tab = 'overview' | 'needs' | 'skills' | 'racing'
const SCHEMA = { fallback: STABLE_DEFAULT_QUERY, facets: STABLE_FACETS, sorts: STABLE_SORTS }
const FACILITY_NAME = { observatory: 'Observatory', 'lineage-hall': 'Lineage Hall', gym: 'Gym', dojo: 'Dojo' } as const

function Bar({ label, fill, text, color }: { label: string; fill: number; text: string; color: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="flex justify-between text-[11px] text-ink-soft"><span>{label}</span><span>{text}</span></p>
      <Meter value={fill} color={color} motion="linear" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel className="p-3" aria-label={title}>
      <h2 className="text-micro mb-2">{title}</h2>
      {children}
    </Panel>
  )
}

function PresetSwitch({ umaId, preset, tap }: { umaId: string; preset: DistanceCategory; tap: Tap }) {
  return (
    <Tabs
      label="Preset"
      value={preset}
      onChange={(selectedPreset) => void tap.run('set-race-defaults', { umaId, selectedPreset }, 'set-race-defaults')}
      options={DISTANCES.map((value) => ({ value, label: DISTANCE_LABEL[value] }))}
    />
  )
}

export default function Profile({ place, rest, umaId, tab: routeTab }: PageProps & { umaId: string; tab: 'skills' | 'needs' | null }) {
  const location = useLocation()
  const navigate = useNavigate()
  const now = useNow()
  const view = useHub()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const prefs = useAlbumPrefs(STABLE_ALBUM, SCHEMA)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const uma = state?.umas[umaId] ?? null
  const content = env?.content ?? null
  const tab: Tab = routeTab ?? (new URLSearchParams(location.search).get('tab') === 'racing' ? 'racing' : 'overview')

  // Opening her profile is what clears her NEW mark (ux "Shared behaviours"). A phone that has never opened the Stable
  // first takes every Uma it owns as seen, as the Stable would, so only later arrivals read NEW there.
  useEffect(() => {
    if (uma === null || state === null) return
    prefs.see(prefs.fresh ? Object.keys(state.umas) : [umaId])
    // Once per Uma.
  }, [umaId, uma !== null])

  const order = useMemo(() => {
    if (state === null || content === null) return []
    return queryStable(buildStableAlbum(state, content, prefs.seen), 'owned', prefs.query).entries.map((entry) => entry.id)
  }, [state, content, prefs.query, prefs.seen])
  const doing = useMemo(() => (state === null || env === null || uma === null ? null : doingNow(state, umaId, now, env)), [state, env, uma, umaId, now])

  if (state === null || content === null) return <PlaceHeader place={place} rest={rest} />
  if (uma === null) {
    return (
      <div>
        <PlaceHeader place={place} rest={rest} title="Uma" />
        <Panel className="m-4 text-center">
          <p className="text-[15px]" data-g2="unknown-uma">{TIER_REFUSALS['unknown-uma']}</p>
          <Link to="/town/stable" replace className="font-display mt-3 inline-flex min-h-12 items-center rounded-sm bg-accent px-5 font-semibold text-ink shadow-1">Open the Stable</Link>
        </Panel>
      </div>
    )
  }

  const name = content.umas.get(umaId)?.name ?? umaId
  const at = order.indexOf(umaId)
  const sub = tab === 'skills' ? '/skills' : tab === 'needs' ? '/needs' : tab === 'racing' ? '?tab=racing' : ''
  const step = (by: -1 | 1) => {
    const next = order[at + by]
    if (next !== undefined) navigate(`/town/stable/outfit/${encodeURIComponent(next)}${sub}`, { replace: true, state: location.state })
  }
  const racing = racingBar(uma)
  const farm = farmBar(uma)
  const base = `/town/stable/outfit/${encodeURIComponent(umaId)}`
  const tabs: readonly [Tab, string, string][] = [
    ['overview', 'Overview', base], ['needs', 'Needs', `${base}/needs`], ['skills', 'Skills', `${base}/skills`], ['racing', 'Racing', `${base}?tab=racing`],
  ]
  const Target = PROFILE_UI.TargetToggle
  const Needs = PROFILE_UI.Needs
  const arrow = 'flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft disabled:opacity-30'

  return (
    <div
      data-place-page="profile"
      data-uma={umaId}
      onPointerDown={(event) => { swipe.current = { x: event.clientX, y: event.clientY } }}
      onPointerUp={(event) => {
        const from = swipe.current
        swipe.current = null
        if (from === null) return
        const dx = event.clientX - from.x
        if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(event.clientY - from.y)) step(dx < 0 ? 1 : -1)
      }}
    >
      <PlaceHeader place={place} rest={rest} title={name}>
        <button type="button" className={arrow} disabled={at <= 0} onClick={() => step(-1)} aria-label="Previous Uma"><ChevronLeftIcon /></button>
        <button type="button" className={arrow} disabled={at < 0 || at >= order.length - 1} onClick={() => step(1)} aria-label="Next Uma"><ChevronRightIcon /></button>
      </PlaceHeader>
      <div className="space-y-3 px-4 pt-3 pb-24">
        <header className="flex gap-3" data-g2="profile-header">
          <span className="w-24 shrink-0">
            <UmaSquare outfitId={umaId} name={name} className={uma.hallOfFame !== null ? 'border-2 border-tier-gold' : ''} overlay={<TierCrest tier={uma.tier} />} />
          </span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[14px] leading-snug font-semibold" data-g2="profile-line">{profileLine(uma)}</p>
              {Target !== undefined && <Suspense fallback={null}><Target umaId={umaId} /></Suspense>}
            </div>
            {uma.hallOfFame !== null && <Crest tone="accent">Hall of Fame</Crest>}
            <div className="flex gap-3">
              <Bar label="Racing EXP" fill={racing.fill} text={racing.toNext === null ? 'Max' : `${racing.exp}/${racing.toNext}`} color="var(--color-accent)" />
              <Bar label="Farm EXP" fill={farm.fill} text={farm.toNext === null ? 'Max' : `${farm.exp}/${farm.toNext}`} color="var(--color-turf)" />
            </div>
            {doing !== null && <p className="text-[13px] text-ink-soft" data-g2="doing">{doingWords(doing, now)}</p>}
          </div>
        </header>
        <nav aria-label="Profile" className="flex gap-1 rounded-sm bg-sunken p-1">
          {tabs.map(([key, label, to]) => (
            <Link key={key} to={to} replace state={location.state} aria-current={tab === key ? 'page' : undefined}
              className={`flex min-h-11 flex-1 items-center justify-center rounded-xs text-[13px] font-semibold ${tab === key ? 'bg-panel text-ink shadow-1' : 'text-ink-soft'}`}>
              {label}
            </Link>
          ))}
        </nav>
        {tab === 'overview' && <Overview umaId={umaId} featured={view?.featured === umaId} ready={doing?.kind === 'ready'} />}
        {tab === 'needs' && (Needs !== undefined ? <Suspense fallback={null}><Needs umaId={umaId} /></Suspense> : <NeedsFallback umaId={umaId} />)}
        {tab === 'skills' && <Skills umaId={umaId} />}
        {tab === 'racing' && <Racing umaId={umaId} />}
      </div>
    </div>
  )
}

function useRaceResults(umaId: string): readonly RaceResultRow[] {
  const { game } = useRuntime()
  const state = useGame((snapshot) => snapshot.state)
  const [results, setResults] = useState<readonly RaceResultRow[]>([])
  useEffect(() => {
    let live = true
    void game.logs?.raceResults(umaId).then((rows) => { if (live) setResults(rows) }).catch(() => {})
    return () => { live = false }
  }, [game, umaId, state])
  return results
}

function useUma(umaId: string) {
  const uma = useGame((snapshot) => snapshot.state?.umas[umaId] ?? null)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  return { uma: uma!, content: content! }
}

function Overview({ umaId, featured, ready }: { umaId: string; featured: boolean; ready: boolean }) {
  const tap = useTap()
  const { uma, content } = useUma(umaId)
  const state = useGame((snapshot) => snapshot.state)!
  const preset = uma.raceDefaults.selectedPreset
  const derived = useMemo(() => deriveUmaPreset(uma, preset, content), [uma, preset, content])
  const progress = layerProgress(uma)
  const career = careerOf(uma, content)
  const next = readiness(state, uma)
  const id = encodeURIComponent(umaId)
  return (
    <div className="space-y-3" data-g2="overview">
      <Section title="Preset">
        <PresetSwitch umaId={umaId} preset={preset} tap={tap} />
        <dl className="mt-3 grid grid-cols-5 gap-1 text-center" data-g2="preset-stats">
          {STAT_KEYS.map((stat) => (
            <div key={stat}>
              <dt className="text-[11px] text-ink-soft">{STAT_LABEL[stat]}</dt>
              <dd className="font-display text-[15px] font-semibold tabular-nums">{derived.stats[stat]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 flex flex-wrap gap-x-3 text-[13px]">
          <span><span className="text-ink-soft">SP</span> <strong>{amount(derived.skillPoints)}</strong></span>
          <span><span className="text-ink-soft">Distance</span> {DISTANCES.map((d) => `${DISTANCE_LABEL[d]} ${derived.aptitudes.distance[d]}`).join(' · ')}</span>
          <span><span className="text-ink-soft">Surface</span> {SURFACE_KEYS.map((s) => `${SURFACE_LABEL[s]} ${derived.aptitudes.surface[s]}`).join(' · ')}</span>
          <span><span className="text-ink-soft">Style</span> {STYLES.map((s) => `${STYLE_LABEL[s].split(' ')[0]} ${derived.aptitudes.strategy[s]}`).join(' · ')}</span>
        </p>
      </Section>
      <Section title="Build">
        <ul className="grid grid-cols-2 gap-1.5">
          {progress.map((row) => (
            <li key={row.facility}>
              <Link to={`/training/${row.facility}/${id}`} state={{ back: true }}
                className="flex min-h-11 items-center justify-between rounded-sm bg-sunken/60 px-3 text-[13px] font-semibold">
                <span>{FACILITY_NAME[row.facility]}</span>
                <span className="tabular-nums">{row.done}/{row.total}</span>
              </Link>
            </li>
          ))}
        </ul>
        {ready && (
          <div className="mt-2">
            <Button size="sm" disabled={tap.pending !== null} onClick={() => void tap.run('collect', { outfitId: umaId }, 'collect')}>Collect</Button>
          </div>
        )}
      </Section>
      <Section title={`Career · ${career.stage}`}>
        <p className="mb-2 text-[13px] text-ink-soft">{career.won} of {career.goals.length} goals won{career.closed > 0 ? ` · ${career.closed} earlier careers` : ''}</p>
        <ul className="space-y-1" data-g2="career-goals">
          {career.goals.map((goal) => (
            <li key={goal.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate"><span className="text-ink-soft">{goal.stage}</span> {goal.race}</span>
              <span className={goal.status === 'completed' ? 'text-success' : goal.status === 'missed' ? 'text-danger' : 'text-ink-soft'}>
                {goal.status === 'completed' ? 'Won' : goal.status === 'missed' ? 'Missed' : 'Open'}
              </span>
            </li>
          ))}
        </ul>
        {next !== null && (
          <Link to={`/racing/scenario-gate/${id}`} state={{ back: true }}
            className="font-display mt-3 flex min-h-12 items-center justify-center rounded-sm bg-accent font-semibold text-ink shadow-1">
            {next === 'advance' ? 'Advance' : 'Promote'}
          </Link>
        )}
      </Section>
      {!featured && (
        <div>
          <Button variant="secondary" className="w-full" disabled={tap.pending !== null} onClick={() => void tap.run('feature-uma', { outfitId: umaId }, 'feature-uma')}>
            Feature her
          </Button>
        </div>
      )}
      {featured && <p className="text-center text-[13px] text-ink-soft">{hubWords('featured-title')}</p>}
      <TapNoteLine tap={tap} />
    </div>
  )
}

/** T142's Needs tab takes this route's slot; until then, her layer progress alone (T138 spec). */
function NeedsFallback({ umaId }: { umaId: string }) {
  const { uma } = useUma(umaId)
  return (
    <Section title="Layer progress">
      <ul className="space-y-1.5" data-g2="layer-progress">
        {layerProgress(uma).map((row) => (
          <li key={row.facility} className="flex items-center gap-3 text-[13px]">
            <span className="w-24 font-semibold">{FACILITY_NAME[row.facility]}</span>
            <span className="flex-1"><Meter value={row.total === 0 ? 1 : row.done / row.total} color="var(--color-accent)" motion="linear" /></span>
            <span className="w-12 text-right tabular-nums">{row.done}/{row.total}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Skills({ umaId }: { umaId: string }) {
  const tap = useTap()
  const { uma, content } = useUma(umaId)
  const preset = uma.raceDefaults.selectedPreset
  const view = useMemo(() => skillsView(uma, preset, content), [uma, preset, content])
  const set = (skillIds: readonly string[]) => void tap.run('set-loadout', { umaId, preset, skillIds: [...skillIds] }, 'set-loadout')
  const small = 'flex size-11 items-center justify-center rounded-sm text-ink-soft disabled:opacity-30'
  return (
    <div className="space-y-3" data-g2="skills">
      <PresetSwitch umaId={umaId} preset={preset} tap={tap} />
      <p className={`text-[14px] font-semibold ${view.cost > view.skillPoints ? 'text-danger' : ''}`} data-g2="sp-line">
        SP {amount(view.cost)} / {amount(view.skillPoints)}
      </p>
      <TapNoteLine tap={tap} />
      <Section title="Equipped">
        <ul className="space-y-1">
          {view.equipped.map((skill, i) => (
            <li key={skill.skillId} className="flex min-h-11 items-center gap-2 text-[14px]">
              <span className={`min-w-0 flex-1 truncate ${skill.gold ? 'font-semibold text-accent-strong' : ''}`}>{skill.name}</span>
              {skill.unique ? <span className="text-[12px] text-ink-soft">Her unique · always on</span> : (
                <>
                  <button type="button" className={small} aria-label={`Move ${skill.name} up`} disabled={tap.pending !== null || i <= 1}
                    onClick={() => set(moved(view.loadout, skill.skillId, -1))}><ChevronUpIcon /></button>
                  <button type="button" className={small} aria-label={`Move ${skill.name} down`} disabled={tap.pending !== null || i >= view.equipped.length - 1}
                    onClick={() => set(moved(view.loadout, skill.skillId, 1))}><ChevronDownIcon /></button>
                  <Button size="sm" variant="secondary" disabled={tap.pending !== null} onClick={() => set(view.loadout.filter((id) => id !== skill.skillId))}>Unequip</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Library">
        {view.library.length === 0 && <p className="text-[13px] text-ink-soft">Every skill she knows is equipped.</p>}
        <ul className="space-y-1">
          {view.library.map((skill) => (
            <li key={skill.skillId} className="flex min-h-11 items-center gap-2 text-[14px]">
              <span className={`min-w-0 flex-1 truncate ${skill.gold ? 'font-semibold text-accent-strong' : ''}`}>{skill.name}</span>
              {skill.adds === null ? <span className="text-[12px] text-ink-soft">Can't race yet</span> : (
                <Button size="sm" disabled={tap.pending !== null} onClick={() => set([...view.loadout, skill.skillId])} aria-label={`Equip ${skill.name} for ${skill.adds} SP`}>
                  Equip · {skill.adds} SP
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Racing({ umaId }: { umaId: string }) {
  const { uma, content } = useUma(umaId)
  const tap = useTap()
  const results = useRaceResults(umaId)
  const preferences = racePreferencesOf(uma, content)
  const recommended = uma.raceDefaults.preferences === null
  const career = careerOf(uma, content)
  const latest = latestResults(results, umaId, content)
  const set = (change: Partial<typeof preferences>) =>
    void tap.run('set-race-defaults', { umaId, preferences: { ...preferences, ...change } }, 'set-race-defaults')
  const row = <K extends string>(label: string, keys: readonly K[], names: Record<K, string>, value: K, field: 'strategy' | 'distance' | 'surface', grades: Record<K, Grade>) => (
    <div>
      <p className="text-micro mb-1">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {keys.map((key) => (
          <Chip key={key} selected={value === key} className="min-h-11" disabled={tap.pending !== null} onClick={() => set({ [field]: key } as Partial<typeof preferences>)}>
            {names[key]} <span className="text-ink-faint">{grades[key]}</span>
          </Chip>
        ))}
      </div>
    </div>
  )
  const template = content.umas.get(umaId)!
  return (
    <div className="space-y-3" data-g2="racing">
      <Section title={recommended ? 'Race defaults · recommended' : 'Race defaults'}>
        <div className="space-y-2">
          {row('Running style', STYLES, STYLE_LABEL, preferences.strategy, 'strategy', template.aptitudes.strategy)}
          {row('Distance', DISTANCES, DISTANCE_LABEL, preferences.distance, 'distance', template.aptitudes.distance)}
          {row('Surface', SURFACE_KEYS, SURFACE_LABEL, preferences.surface, 'surface', template.aptitudes.surface)}
        </div>
        {!recommended && (
          <Button size="sm" variant="tertiary" className="mt-2" disabled={tap.pending !== null}
            onClick={() => void tap.run('set-race-defaults', { umaId, preferences: null }, 'set-race-defaults')}>
            Use the recommendation
          </Button>
        )}
        <TapNoteLine tap={tap} className="mt-2" />
      </Section>
      <Section title="Career record">
        <p className="text-[14px]">{career.stage === 'Complete' ? 'This career is complete.' : `${career.stage}: ${career.won} of ${career.goals.length} goals won.`}</p>
        <p className="text-[13px] text-ink-soft">{career.closed} earlier career{career.closed === 1 ? '' : 's'} closed · {uma.tierHistory.length} tier{uma.tierHistory.length === 1 ? '' : 's'} left behind</p>
      </Section>
      <Section title="Latest results">
        {latest.length === 0 ? <p className="text-[13px] text-ink-soft">No races yet.</p> : (
          <ul className="space-y-1" data-g2="latest-results">
            {latest.map((result) => (
              <li key={result.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate">{result.race}</span>
                <span className="shrink-0 tabular-nums">{result.place === null ? '' : ordinal(result.place)} · <UiMark mark="currency/prize-money" /><span className="sr-only">Prize Money</span> {amount(result.paid)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Link to={`/racing/trophy-hall/uma/${encodeURIComponent(umaId)}`} state={{ back: true }}
        className="font-display flex min-h-12 items-center justify-center rounded-sm border border-hairline-strong bg-panel font-semibold shadow-1">
        Titles, Prestige and showcase · Trophy Hall
      </Link>
    </div>
  )
}
