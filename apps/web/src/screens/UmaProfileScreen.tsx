import {
  DISTANCE_CATEGORIES,
  STATS,
  STRATEGIES,
  SURFACES,
  badgeStateId,
  careerRaceCatalog,
  cardStars,
  awaitingAdvance,
  isCareerStage,
  recommendedRacePreferences,
  racingSkillCosts,
  scenarioForTier,
  summarizeSkillLoadout,
  type Grade,
  type RaceResultRecord,
  type RacePreferences,
  type StatKey,
} from '@racer/domain'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { advanceUma, listRaceHistory, setActivePreset, setFeaturedUma, setRacePreferences, startScenario } from '../game/actions'
import { buildUmaBadgeCollection, type BadgeCollectionItem } from '../game/badge-collection-view'
import { buildDeckView, formatRaceBonus } from '../game/deck-view'
import { buildUmaFlairSummary } from '../game/flair-view'
import { buildJourneyView } from '../game/goals-view'
import { useFarmView } from '../game/farm/useFarmView'
import { useChosenTier } from '../game/scenario-choice'
import { useGame } from '../game/store'
import { joinUma, presetDistanceGrades } from '../game/view'
import { AtlasSprite } from '../ui/AtlasSprite'
import { Stars } from '../ui/Stars'
import { Crest } from '../ui/Crest'
import { Button } from '../ui/Button'
import { BottomSheet } from '../ui/BottomSheet'
import { Meter } from '../ui/Meter'
import { Numeral } from '../ui/Numeral'
import { Panel } from '../ui/Panel'
import { ScreenState } from '../ui/ScreenState'
import { SaveErrorState } from '../ui/SaveErrorState'
import { Collapsible, SectionHeading } from '../ui/Section'
import { SkillKindBadge } from '../ui/SkillKindBadge'
import { SkillIcon } from '../ui/SkillIcon'
import { ScenarioSwitch } from '../ui/ScenarioSwitch'
import { CarrotIcon, ChevronLeftIcon, ChevronRightIcon, RaceIcon } from '../ui/icons'
import { TypeIcon } from '../ui/TypeIcon'
import { DISTANCE_ICONS, DistanceTypeIcon, RUNNING_STYLE_ICONS, RunningStyleIcon } from '../ui/CardFocusIcons'
import { IconChoiceRow } from '../ui/IconChoiceRow'
import { ClLevelUpButton, useClCutover } from '../ui/puzzles/ClLevelUp'

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
  const clCutover = useClCutover()
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
  // Her Farming Level, from the Farm save; an outfit that never farmed is Lv1 (D239).
  const farm = useFarmView(status === 'ready')
  const farmingLevel = farm.state.view?.workers[umaId]?.level ?? null
  const [raceHistory, setRaceHistory] = useState<RaceResultRecord[]>([])
  const [editingPreferences, setEditingPreferences] = useState<RacePreferences | null>(null)
  // Which of her trained units the page shows (D190): her current scenario unless another was chosen.
  const chosenTier = useChosenTier(save)

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

  const joined = joinUma(save, contentState.content, cards, chosenTier ?? undefined)
  if (joined.status !== 'ready') {
    return <ScreenState title="Content reference missing" detail={`The save is preserving ${joined.templateId} until its template is restored.`} action={{ label: 'Back to Stable', to: '/stable' }} />
  }

  const uma = joined.value
  const presetGrades = presetDistanceGrades(save, contentState.content, cards, chosenTier ?? undefined)
  const featured = profile.featuredUmaId === save.templateId
  // An earlier scenario is a finished trained unit: it races and trains, but has no start, gate or advance (D190).
  const past = uma.past
  const setupPending = !past && !uma.run.started
  const atGate = !past && awaitingAdvance(save)
  const raceUnlocked = past || (uma.run.started && !atGate)
  const loadout = summarizeSkillLoadout(uma.derived, uma.template, contentState.content.skills.byId)
  // The profile shows her unique and the equipped inherited uniques and golds; whites wait behind "All equipped".
  const ownUnique = uma.template.uniqueSkillId ? contentState.content.skills.byId.get(uma.template.uniqueSkillId) : undefined
  const equippedSkills = loadout.skills
  const skillCosts = racingSkillCosts(loadout)
  const headline = [
    ...(ownUnique ? [{ skill: ownUnique, own: true }] : []),
    ...equippedSkills.filter((skill) => skill.kind === 'inherited-unique').map((skill) => ({ skill, own: false })),
    ...equippedSkills.filter((skill) => skill.kind === 'gold').map((skill) => ({ skill, own: false })),
  ]
  const deck = buildDeckView(save, cards, contentState.content, undefined, uma.tier)
  const journey = buildJourneyView(save, contentState.content)
  const currentJourney = journey.find((item) => item.tier === uma.tier) ?? null
  const ownRaces = raceHistory.filter((record) => record.umaId === save.templateId)
  const racePreferences = save.racePreferences ?? recommendedRacePreferences(
    uma.template.aptitudes, uma.template, careerRaceCatalog(contentState.content.races.items),
  )

  const statusLine = past
    ? 'An earlier scenario: it races for its own records, without Uma EXP.'
    : setupPending
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
              {/* Her two levels as icons, no labels (D239): the race flag's Uma Level and the carrot's Farming Level. */}
              <div className="flex items-center gap-1.5">
                <span role="img" aria-label={`Uma level ${save.level}`} className="flex h-8 items-center gap-1 rounded-full bg-sunken pr-2.5 pl-2">
                  <RaceIcon size={16} className="text-accent-strong" />
                  <Numeral className="text-[17px] leading-none">{save.level}</Numeral>
                </span>
                <span role="img" aria-label={farmingLevel === null ? 'Farming level loading' : `Farming level ${farmingLevel}`}
                  className="flex h-8 items-center gap-1 rounded-full bg-sunken pr-2.5 pl-2">
                  <CarrotIcon size={16} variant="duotone" className="text-ink-soft" />
                  <Numeral className="text-[17px] leading-none">{farmingLevel ?? '–'}</Numeral>
                </span>
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

      {/* ── This scenario: one trained unit per unlocked scenario (D190) ── */}
      <SectionHeading label={past ? 'Earlier scenario' : 'This scenario'} hint={`Tier ${uma.tier}`} />
      <ScenarioSwitch uma={save} tier={uma.tier} label="Her scenarios" />

      <Panel className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display truncate text-[15px] font-semibold">{uma.scenario?.name ?? 'Future scenario'}</p>
            <p className="text-[12px] text-ink-soft">{statusLine}</p>
          </div>
          {clCutover ? <ClLevelUpButton outfitId={save.templateId} tier={uma.tier} level={uma.derived.trainingLevel} /> : <Crest tone="accent" className="shrink-0 whitespace-nowrap">TL {uma.derived.trainingLevel}</Crest>}
        </div>

        <div className="mt-3 grid gap-2">
          {setupPending && (
            <Button variant="primary" disabled={busy} onClick={() => void runAction(() => startScenario(save.templateId), 'Could not start this scenario')}>
              Start scenario
            </Button>
          )}
          {!past && uma.readyToAdvance && (
            <Button variant="primary" disabled={busy} onClick={() => void runAction(() => advanceUma(save.templateId), 'Could not unlock the next scenario')}>
              Unlock the next scenario
            </Button>
          )}
        </div>
      </Panel>

      <SectionHeading label="Racing" hint="career & races" />
      <Panel className="p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1.5" aria-label="Race defaults">
            {([racePreferences.strategy, racePreferences.distance, racePreferences.surface] as const).map((value) => (
              <span key={value} className="rounded-full bg-sunken px-2.5 py-1 text-[12px] font-semibold">{titleCase(value)}</span>
            ))}
          </div>
          <button type="button" className="min-h-11 shrink-0 rounded-sm px-2 text-[12px] font-semibold text-accent-strong" onClick={() => setEditingPreferences({ ...racePreferences })}>Edit defaults</button>
        </div>
        {/* Distance presets (D252): each a whole build of this scenario. Her grade at each distance in its corner. */}
        <p className="mb-1.5 text-[12px] font-semibold text-ink-soft">Preset · {DISTANCE_ICONS[save.activePreset].label}</p>
        <IconChoiceRow
          label="Distance preset"
          value={save.activePreset}
          disabled={busy}
          onChange={(preset) => void runAction(() => setActivePreset(save.templateId, preset), 'Could not switch preset')}
          options={DISTANCE_CATEGORIES.map((distance) => ({
            value: distance, name: `${DISTANCE_ICONS[distance].label} preset`, badge: presetGrades[distance],
            icon: <DistanceTypeIcon distance={distance} size={32} />,
          }))}
          className="mb-3"
        />
        <p className="mb-3 text-[12px] text-ink-soft">Style starts selected in Race. Distance and surface shape new scenario careers; this scenario's goals stay as earned. A race uses the preset of its distance.</p>
        <Button variant="primary" className="w-full" disabled={!raceUnlocked || busy} onClick={() => navigate(`/race?uma=${encodeURIComponent(save.templateId)}`)}>
          Open races
        </Button>
      </Panel>

      <BottomSheet open={editingPreferences !== null} onClose={() => setEditingPreferences(null)}>
        {editingPreferences && <div className="grid gap-4 px-4 pb-safe">
          <h2 className="font-display text-lg font-bold">Race defaults</h2>
          {/* Running style and distance pick by icon, her aptitude in each corner (D251). */}
          <fieldset>
            <legend className="mb-1 text-[12px] font-semibold text-ink-soft">Running style · {RUNNING_STYLE_ICONS[editingPreferences.strategy].label}</legend>
            <IconChoiceRow label="Running style" value={editingPreferences.strategy}
              onChange={(strategy) => setEditingPreferences((current) => current ? { ...current, strategy } : null)}
              options={STRATEGIES.map((value) => ({ value, name: RUNNING_STYLE_ICONS[value].label,
                badge: uma.derived.aptitudes.strategy[value], icon: <RunningStyleIcon style={value} size={32} /> }))} />
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-[12px] font-semibold text-ink-soft">Distance · {DISTANCE_ICONS[editingPreferences.distance].label}</legend>
            <IconChoiceRow label="Distance" value={editingPreferences.distance}
              onChange={(distance) => setEditingPreferences((current) => current ? { ...current, distance } : null)}
              options={DISTANCE_CATEGORIES.map((value) => ({ value, name: DISTANCE_ICONS[value].label,
                badge: uma.derived.aptitudes.distance[value], icon: <DistanceTypeIcon distance={value} size={32} /> }))} />
          </fieldset>
          {([
            ['surface', 'Surface', SURFACES],
          ] as const).map(([key, label, options]) => (
            <fieldset key={key}>
              <legend className="mb-1 text-[12px] font-semibold text-ink-soft">{label}</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {options.map((option) => (
                  <button key={option} type="button" aria-pressed={editingPreferences[key] === option}
                    className={`min-h-11 rounded-sm border px-3 text-[13px] font-semibold ${editingPreferences[key] === option ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}
                    onClick={() => setEditingPreferences((current) => current ? { ...current, [key]: option } : null)}>
                    {titleCase(option)}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="text-[12px] text-ink-soft">Changing these does not reset Uma Level, completed wins or rewards. Your current career stays frozen; the distance and surface apply when a new scenario starts.</p>
          <Button variant="primary" disabled={busy} onClick={() => void (async () => {
            if (busy) return
            setBusy(true)
            try {
              await setRacePreferences(save.templateId, editingPreferences)
              setEditingPreferences(null)
            } catch (reason) {
              pushToast(reason instanceof Error ? reason.message : 'Could not save race defaults')
            } finally { setBusy(false) }
          })()}>Save defaults</Button>
        </div>}
      </BottomSheet>

      <SectionHeading label="Training" hint={`build the ${DISTANCE_ICONS[save.activePreset].label} preset`} />
      <div className="grid gap-2">
        {([
          ['Constellation', clCutover ? 'Cards and Constellation Level · spend materials here' : 'Cards and Training Level · enter Spark Match here', `/constellation/${encodeURIComponent(save.templateId)}`],
          ['Inspiration', 'Parents, grandparents, aptitudes and inherited skills', `/constellation/${encodeURIComponent(save.templateId)}/inspiration`],
          ['Extra stats', 'Buy stat nodes with Farm crops and turn on any six', `/constellation/${encodeURIComponent(save.templateId)}/extra-stats`],
          ['Skills', 'Equip skills within the SP this preset earns', `/stable/${encodeURIComponent(save.templateId)}/skills`],
        ] as const).map(([label, detail, to]) => (
          <Link
            key={label}
            to={to}
            className="flex min-h-16 items-center justify-between gap-3 rounded-md border border-hairline bg-panel px-4 py-3 shadow-1"
          >
            <span className="min-w-0"><span className="block font-display text-[15px] font-semibold">{label}</span><span className="block text-[12px] text-ink-soft">{detail}</span></span>
            <ChevronRightIcon size={20} className="shrink-0 text-ink-faint" />
          </Link>
        ))}
      </div>

      <Panel className="p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[13px] font-semibold">Stats</h3>
          <span className="text-micro">against this scenario&rsquo;s caps</span>
        </div>
        <div className="mt-2 grid gap-1.5">
          {STATS.map((stat) => (
            <div key={stat}>
              <div className="flex items-center justify-between text-[12px] font-semibold">
                <span className="inline-flex items-center gap-1.5"><TypeIcon type={stat} size={18} />{statLabel(stat)}</span>
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
                {slot.card!.save && <Stars value={cardStars(slot.card!.save)} className="mt-0.5 justify-center" />}
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
              <SkillIcon skill={skill} size={24} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{skill.name}</span>
              <SkillKindBadge kind={skill.kind} />
              <span className="text-micro w-12 shrink-0 text-right">{own ? 'free' : `${skillCosts.get(skill.id) ?? skill.costSp} SP`}</span>
            </div>
          ))}
          {headline.length === 0 && <p className="text-[12px] text-ink-soft">No skills yet. Slot cards onto her constellation to earn some.</p>}
        </div>
        {equippedSkills.length > headline.filter((entry) => !entry.own).length && (
          <Collapsible label="All equipped" count={equippedSkills.length}>
            <div className="grid gap-1">
              {equippedSkills.map((skill) => (
                <div key={skill.id} className="flex min-h-9 items-center gap-2 rounded-sm bg-sunken px-2">
                  <SkillIcon skill={skill} size={24} />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{skill.name}</span>
                  <SkillKindBadge kind={skill.kind} />
                  <span className="text-micro w-12 shrink-0 text-right">{skillCosts.get(skill.id) ?? skill.costSp} SP</span>
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
                  {record.playerPlacement === 1 ? 'won' : `${record.playerPlacement}th`} · {record.tier
                    ? scenarioForTier(record.tier)?.name ?? `Scenario ${record.tier}`
                    : `+${record.expGained} EXP`}
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
