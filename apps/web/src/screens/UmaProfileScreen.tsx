import {
  DISTANCE_CATEGORIES,
  MAX_TRAINING_LEVEL,
  SPARK_MATCH_TICKET_COST,
  STATS,
  STRATEGIES,
  SURFACES,
  badgeStateId,
  cardStars,
  awaitingAdvance,
  isCareerStage,
  summarizeSkillLoadout,
  type Grade,
  type RaceResultRecord,
  type StatKey,
} from '@racer/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { advanceUma, listRaceHistory, setFeaturedUma, startScenario } from '../game/actions'
import { buildUmaBadgeCollection, type BadgeCollectionItem } from '../game/badge-collection-view'
import { buildDeckView, formatRaceBonus } from '../game/deck-view'
import { buildUmaFlairSummary } from '../game/flair-view'
import { buildJourneyView } from '../game/goals-view'
import { useGame } from '../game/store'
import { joinUma } from '../game/view'
import { AtlasSprite } from '../ui/AtlasSprite'
import { Stars } from '../ui/Stars'
import { Crest } from '../ui/Crest'
import { Button } from '../ui/Button'
import { Meter } from '../ui/Meter'
import { Numeral } from '../ui/Numeral'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'
import { SaveErrorState } from '../ui/SaveErrorState'
import { Collapsible, SectionHeading } from '../ui/Section'
import { SkillKindBadge } from '../ui/SkillKindBadge'
import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons'
import { formatTickets } from '../ui/tickets'

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
const statLabel = (stat: StatKey) => (stat === 'wit' ? 'Wit' : titleCase(stat))
const STAT_TONE: Record<StatKey, string> = {
  speed: 'var(--color-stat-speed)',
  stamina: 'var(--color-stat-stamina)',
  power: 'var(--color-stat-power)',
  guts: 'var(--color-stat-guts)',
  wit: 'var(--color-stat-wit)',
}

/** Strong grades take the accent; weak ones stay quiet, so the eye finds the good ones first. */
const gradeTone = (grade: Grade): string =>
  grade === 'S' || grade === 'A'
    ? 'bg-accent text-white'
    : grade === 'B' || grade === 'C'
      ? 'bg-accent-wash text-ink'
      : 'bg-sunken text-ink-faint'

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
  const [busy, setBusy] = useState(false)
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

  /** Highest-tier earned awards first — the three worth showing beside her name. */
  const topBadges = useMemo((): BadgeCollectionItem[] => {
    if (!badgeCollection) return []
    return badgeCollection.items
      .filter((item) => item.status === 'complete')
      .sort((left, right) =>
        right.tierIndex - left.tierIndex || right.points - left.points || left.label.localeCompare(right.label))
      .slice(0, 3)
  }, [badgeCollection])

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
  if (status === 'error') return <SaveErrorState detail={error} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) return <ScreenState title="Opening profile…" detail="Loading private content and save data." />
  if (!save) return <ScreenState title="Uma not found" detail="This Uma is not owned in your Stable." action={{ label: 'Back to Stable', to: '/stable' }} />

  const joined = joinUma(save, contentState.content, cards)
  if (joined.status !== 'ready') {
    return <ScreenState title="Content reference missing" detail={`The save is preserving ${joined.templateId} until its template is restored.`} action={{ label: 'Back to Stable', to: '/stable' }} />
  }

  const uma = joined.value
  const featured = profile.featuredUmaId === save.templateId
  const setupPending = !uma.run.started
  const atGate = awaitingAdvance(save)
  const sparkAvailable = uma.run.started && uma.derived.trainingLevel < MAX_TRAINING_LEVEL
  const sparkAffordable = profile.tickets >= SPARK_MATCH_TICKET_COST
  const raceUnlocked = uma.run.started && !atGate
  const loadout = summarizeSkillLoadout(uma.derived, uma.template, contentState.content.skills.byId)
  // The profile shows her unique and the equipped inherited uniques and golds; whites wait behind "All equipped".
  const ownUnique = uma.template.uniqueSkillId ? contentState.content.skills.byId.get(uma.template.uniqueSkillId) : undefined
  const equippedSkills = loadout.skills
  const headline = [
    ...(ownUnique ? [{ skill: ownUnique, own: true }] : []),
    ...equippedSkills.filter((skill) => skill.kind === 'inherited-unique').map((skill) => ({ skill, own: false })),
    ...equippedSkills.filter((skill) => skill.kind === 'gold').map((skill) => ({ skill, own: false })),
  ]
  const deck = buildDeckView(save, cards, contentState.content)
  const journey = buildJourneyView(save, contentState.content)
  const currentJourney = journey.find((item) => item.tier === uma.tier) ?? null
  const ownRaces = raceHistory.filter((record) => record.umaId === save.templateId)

  const statusLine = setupPending
    ? 'Start this scenario before racing.'
    : uma.readyToAdvance
      ? 'Ready to unlock the next scenario.'
      : atGate
        ? 'Latest scenario complete.'
        : 'Progression races are open.'

  const runAction = async (action: () => Promise<unknown>, failure: string) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
    } catch (reason) {
      pushToast(reason instanceof Error ? reason.message : failure)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 pt-1">
      <Link to="/stable" className="flex min-h-11 items-center gap-1 px-1 text-sm font-semibold text-ink-soft"><ChevronLeftIcon size={20} />Stable</Link>

      {/* ── Who she is ───────────────────────────────────────────────── */}
      <Panel className="p-3">
        <div className="flex gap-3">
          <AtlasSprite
            asset={uma.asset}
            alt={`${uma.template.name} icon`}
            className="h-20 w-20 shrink-0 rounded-lg bg-sunken"
            fallback={<div className="flex h-full items-center justify-center text-ink-faint">—</div>}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="font-display truncate text-lg leading-tight font-bold">{uma.template.name}</h1>
                <p className="truncate text-[12px] text-ink-soft">{uma.template.outfit ?? 'Standard outfit'}</p>
              </div>
              <button
                type="button"
                aria-pressed={featured}
                aria-label={featured ? 'Featured Uma' : 'Set as featured Uma'}
                disabled={featured || busy}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[13px] ${
                  featured ? 'border-accent bg-accent text-white' : 'border-hairline-strong bg-panel text-ink-soft'
                }`}
                onClick={() => void runAction(() => setFeaturedUma(save.templateId), 'Could not update featured Uma')}
              >
                ★
              </button>
            </div>

            <div className="mt-2 flex items-end gap-3">
              <div>
                <p className="text-micro">Uma level</p>
                <Numeral className="block text-[26px] leading-none">{save.level}</Numeral>
              </div>
              <div className="border-l border-hairline pl-3">
                <p className="text-micro">Prestige</p>
                <Numeral className="block text-[18px] leading-none">{flairSummary?.prestige ?? 0}</Numeral>
              </div>
            </div>
            {flairSummary?.activeTitle && <Crest tone="accent" className="mt-1.5">{flairSummary.activeTitle}</Crest>}
          </div>
        </div>

        {topBadges.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {topBadges.map((item) => (
              <Link
                key={item.awardKey}
                to={`/badges?uma=${encodeURIComponent(save.templateId)}&detail=${encodeURIComponent(item.awardKey)}`}
                className="min-h-14 rounded-md bg-sunken px-2 py-1.5"
              >
                <p className="text-micro truncate">{item.tier === 'one-off' ? 'Feat' : titleCase(String(item.tier ?? ''))}</p>
                <p className="line-clamp-2 text-[11px] leading-tight font-semibold">{item.label}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-md bg-sunken px-3 py-2 text-[12px] text-ink-soft">
            No badges yet — they arrive from racing and scenario completion.
          </p>
        )}
      </Panel>

      {/* ── This scenario ────────────────────────────────────────────── */}
      <SectionHeading label="This scenario" hint={`Tier ${uma.tier}`} />

      <Panel className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display truncate text-[15px] font-semibold">{uma.scenario?.name ?? 'Future scenario'}</p>
            <p className="text-[12px] text-ink-soft">{statusLine}</p>
          </div>
          <Crest tone="accent">TL {uma.derived.trainingLevel}</Crest>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => navigate(`/constellation/${encodeURIComponent(save.templateId)}`)}>
            Constellation
          </Button>
          <Button variant="primary" disabled={!raceUnlocked || busy} onClick={() => navigate(`/race?uma=${encodeURIComponent(save.templateId)}`)}>
            Race
          </Button>
        </div>

        <div className="mt-2 grid gap-2">
          {setupPending && (
            <Button variant="primary" disabled={busy} onClick={() => void runAction(() => startScenario(save.templateId), 'Could not start this scenario')}>
              Start scenario
            </Button>
          )}
          {sparkAvailable && (
            <Button
              variant="primary"
              disabled={!sparkAffordable || busy}
              onClick={() => navigate(`/minigames/spark-match/${encodeURIComponent(save.templateId)}?return=${encodeURIComponent(`/stable/${save.templateId}`)}`)}
            >
              {sparkAffordable
                ? `Spark Match · ${formatTickets(SPARK_MATCH_TICKET_COST)}`
                : `Spark Match · need ${formatTickets(SPARK_MATCH_TICKET_COST)}`}
            </Button>
          )}
          {uma.readyToAdvance && (
            <Button variant="primary" disabled={busy} onClick={() => void runAction(() => advanceUma(save.templateId), 'Could not unlock the next scenario')}>
              Unlock the next scenario
            </Button>
          )}
        </div>
      </Panel>

      <Panel className="p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold">Stats</h3>
          <span className="text-micro">against this scenario&rsquo;s caps</span>
        </div>
        <div className="mt-2 grid gap-1.5">
          {STATS.map((stat) => (
            <div key={stat}>
              <div className="flex items-baseline justify-between text-[12px] font-semibold">
                <span>{statLabel(stat)}</span>
                <span className="text-ink-soft"><Numeral className="text-ink">{uma.derived.stats[stat]}</Numeral> / {uma.caps[stat]}</span>
              </div>
              <Meter value={uma.derived.stats[stat] / uma.caps[stat]} color={STAT_TONE[stat]} height={4} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-hairline pt-2 text-[12px] font-semibold">
          <span>Skill points</span>
          <span className="text-ink-soft"><Numeral className="text-ink">{uma.derived.skillPoints}</Numeral> / {uma.spCap}</span>
        </div>
      </Panel>

      <Panel className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold">Card set</h3>
            <p className="text-micro">
              {uma.run.cardSetIds.length} / {deck.slotCount} · Race Bonus {formatRaceBonus(deck.raceBonus)}
            </p>
          </div>
          <Link to={`/constellation/${encodeURIComponent(save.templateId)}/cards`} className="flex min-h-9 shrink-0 items-center rounded-md bg-sunken px-3 text-[12px] font-semibold">Manage · Bond</Link>
        </div>
        {uma.run.cardSetIds.length > 0 ? (
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {deck.slots.filter((slot) => slot.card).map((slot) => (
              <div key={slot.index} className="w-14 shrink-0">
                <AtlasSprite asset={slot.card!.asset} decorative className="rounded-md bg-sunken" fallback={<div className="flex h-full items-center justify-center text-ink-faint">?</div>} />
                <p className="mt-0.5 truncate text-center text-[9px] font-semibold">{slot.card!.template?.charName ?? 'Missing'}</p>
                {slot.card!.save && <Stars value={cardStars(slot.card!.save, uma.tier)} className="mt-0.5 justify-center" />}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-md bg-sunken px-3 py-2 text-[12px] text-ink-soft">
            Empty — and cards pay nothing until they sit on constellation nodes.
          </p>
        )}
        {deck.validationErrors.length > 0 && (
          <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{deck.validationErrors[0]}</p>
        )}
      </Panel>

      <Panel className="p-3">
        <h3 className="text-[13px] font-semibold">Aptitudes</h3>
        <div className="mt-2 grid gap-2">
          {([
            ['Surface', SURFACES.map((key) => [titleCase(key), uma.derived.aptitudes.surface[key]] as const)],
            ['Distance', DISTANCE_CATEGORIES.map((key) => [titleCase(key), uma.derived.aptitudes.distance[key]] as const)],
            ['Strategy', STRATEGIES.map((key) => [titleCase(key), uma.derived.aptitudes.strategy[key]] as const)],
          ] as const).map(([label, entries]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-micro w-14 shrink-0">{label}</span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                {entries.map(([name, grade]) => (
                  <span key={name} className={`inline-flex min-h-7 items-center gap-1 rounded-xs px-1.5 text-[11px] font-semibold ${gradeTone(grade)}`}>
                    {name} <span className="font-display">{grade}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {currentJourney && currentJourney.goals.length > 0 && (
        <Panel className="p-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[13px] font-semibold">{currentJourney.goals.every((goal) => isCareerStage(goal.slot)) ? 'Career' : 'Goals'}</h3>
            <span className="text-micro">{currentJourney.completed} of {currentJourney.goals.length} done</span>
          </div>
          <div className="mt-2 grid gap-1.5">
            {currentJourney.goals.map((goal) => {
              const result = goal.completedRaceResultId
                ? ownRaces.find((record) => `race:${record.umaId}:${record.sequence}` === goal.completedRaceResultId)
                : undefined
              const destination = result
                ? `/race/run?uma=${encodeURIComponent(result.umaId)}&race=${encodeURIComponent(result.raceId)}&strategy=${result.strategy}&sequence=${result.sequence}`
                : `/race?uma=${encodeURIComponent(save.templateId)}${goal.raceId ? `&goal=${encodeURIComponent(goal.raceId)}` : ''}`
              return (
                <Link key={goal.id} to={destination} className="flex min-h-11 items-center gap-2 rounded-md bg-sunken px-2 py-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold">{goal.label} · {goal.raceName}</span>
                    <span className="text-micro block truncate">
                      {goal.rule}
                      {result ? ' · view result' : goal.race ? '' : ' · target missing'}
                    </span>
                  </span>
                  <Crest tone={goal.status === 'completed' ? 'accent' : 'neutral'}>{goal.status}</Crest>
                </Link>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Skills: what she carries, at a glance; the whole library lives on its own page (D175). */}
      <Panel className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[13px] font-semibold">Skills</h3>
          <span className={`rounded-xs px-2 py-0.5 text-[11px] font-semibold ${loadout.valid ? 'bg-sunken text-ink' : 'bg-danger/10 text-danger'}`}>
            {loadout.cost} / {loadout.cap} SP
          </span>
        </div>
        <div className="mt-2 grid gap-1">
          {headline.map(({ skill, own }) => (
            <div key={skill.id} className="flex min-h-9 items-center gap-2 rounded-sm bg-sunken px-2">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{skill.name}</span>
              <SkillKindBadge kind={skill.kind} />
              <span className="text-micro w-12 shrink-0 text-right">{own ? 'free' : `${skill.costSp} SP`}</span>
            </div>
          ))}
          {headline.length === 0 && <p className="text-[12px] text-ink-soft">No skills yet. Slot cards onto her constellation to earn some.</p>}
        </div>
        {equippedSkills.length > headline.filter((entry) => !entry.own).length && (
          <Collapsible label="All equipped" count={equippedSkills.length}>
            <div className="grid gap-1">
              {equippedSkills.map((skill) => (
                <div key={skill.id} className="flex min-h-9 items-center gap-2 rounded-sm bg-sunken px-2">
                  <span className="min-w-0 flex-1 truncate text-[13px]">{skill.name}</span>
                  <SkillKindBadge kind={skill.kind} />
                  <span className="text-micro w-12 shrink-0 text-right">{skill.costSp} SP</span>
                </div>
              ))}
            </div>
          </Collapsible>
        )}
        {!loadout.valid && (
          <p className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">
            {loadout.cost > loadout.cap ? `Over budget: ${loadout.cost} SP equipped, ${loadout.cap} SP earned.` : loadout.errors[0]}
          </p>
        )}
        <Link to={`/stable/${encodeURIComponent(save.templateId)}/skills`} className="font-display mt-2 flex min-h-11 items-center justify-between rounded-md border border-hairline bg-panel px-3 text-[14px] font-semibold">
          <span>Manage skills <span className="text-[12px] font-normal text-ink-soft">· {uma.derived.library.length} in her library</span></span>
          <ChevronRightIcon size={20} className="text-ink-faint" />
        </Link>
      </Panel>

      {/* ── Everything else ──────────────────────────────────────────── */}
      <SectionHeading label="Archive" hint="history and collections" />

      <Collapsible label="All badges" count={flairSummary?.badgeCount ?? 0}>
        <div className="mb-2 grid grid-cols-3 gap-1.5 text-center">
          {([
            ['Badges', flairSummary?.badgeCount ?? 0],
            ['Titles', flairSummary?.titleCount ?? 0],
            ['Trophies', flairSummary?.trophyCount ?? 0],
          ] as const).map(([label, value]) => (
            <div key={label} className="rounded-md bg-sunken px-2 py-1.5">
              <Numeral className="block text-[15px] leading-none">{value}</Numeral>
              <span className="text-micro">{label}</span>
            </div>
          ))}
        </div>
        {badgeCollection && badgeCollection.items.some((item) => item.status === 'complete') ? (
          <div className="grid gap-1">
            {badgeCollection.items.filter((item) => item.status === 'complete').map((item) => (
              <Link
                key={item.awardKey}
                to={`/badges?uma=${encodeURIComponent(save.templateId)}&detail=${encodeURIComponent(item.awardKey)}`}
                className="flex min-h-9 items-center justify-between gap-2 rounded-md bg-sunken px-2"
              >
                <span className="min-w-0 truncate text-[12px] font-semibold">{item.label}</span>
                <span className="text-micro shrink-0">{item.tier === 'one-off' ? 'Feat' : titleCase(String(item.tier ?? ''))}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-ink-soft">Nothing earned yet.</p>
        )}
        <Link to={`/badges?uma=${encodeURIComponent(save.templateId)}`} className="mt-2 flex min-h-11 items-center justify-center rounded-md bg-accent text-[13px] font-semibold text-white">
          Open the Badge page
        </Link>
      </Collapsible>

      <Collapsible label="Scenario history" count={journey.length}>
        <div className="grid gap-1.5">
          {journey.map((item) => (
            <div key={item.tier} className={`rounded-md px-2 py-1.5 ${item.tier === uma.tier ? 'bg-accent-wash' : 'bg-sunken'}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] font-semibold">Tier {item.tier} · {item.name}</span>
                <span className="text-micro shrink-0">
                  {item.tracking === 'legacy-untracked' ? 'untracked' : `${item.completed}/${item.goals.length || 3}`}
                  {item.honors ? ' · honors' : ''}
                </span>
              </div>
              {item.goals.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.goals.map((goal) => (
                    <Crest key={goal.id} tone={goal.status === 'completed' ? 'accent' : 'neutral'}>{goal.raceName}</Crest>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible label="Lineage" count={uma.derived.lineage.length}>
        {uma.derived.lineage.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {uma.derived.lineage.map((entry) => (
              <div key={entry.id} className="rounded-md bg-sunken px-2 py-1.5">
                <p className="truncate text-[12px] font-semibold">{entry.name}</p>
                <p className="text-micro">{entry.awakeningSkillIds.length} baseline skills</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-ink-soft">Reach Training Level 9 to open the first lineage slot.</p>
        )}
      </Collapsible>

      <Collapsible label="Races run" count={ownRaces.length}>
        {ownRaces.length > 0 ? (
          <div className="grid gap-1">
            {[...ownRaces].reverse().slice(0, 20).map((record) => (
              <div key={`${record.umaId}:${record.sequence}`} className="flex min-h-9 items-center justify-between gap-2 rounded-md bg-sunken px-2">
                <span className="min-w-0 truncate text-[12px] font-semibold">
                  {contentState.content.races.byId.get(record.raceId)?.name ?? record.raceId}
                </span>
                <span className="text-micro shrink-0">
                  {record.playerPlacement === 1 ? 'won' : `${record.playerPlacement}th`} · +{record.expGained} EXP
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-ink-soft">No races yet.</p>
        )}
      </Collapsible>
    </div>
  )
}
