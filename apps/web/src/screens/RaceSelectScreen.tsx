import {
  deriveUma,
  isPastScenario,
  trainedScenario,
  STRATEGIES,
  SCENARIOS,
  compileRaceSkill,
  equippedRaceBonus,
  goalRaceIds,
  awaitingAdvance,
  raceExp,
  progressionFieldSize,
  recommendedRacePreferences,
  regularRaceCatalog,
  raceSkillCompatibleWithCourse,
  raceSkillSupported,
  skillAimsAtOthers,
  racingSkillCosts,
  summarizeSkillLoadout,
  supportDeckIssueMessage,
  validateSupportDeck,
  type RaceResultRecord,
  type RaceTemplate,
  type Strategy,
  type UmaSave,
} from '@racer/domain'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { useContent } from '../content/ContentProvider'
import { listRaceHistory, listUmaRaceHistory, prepareRace } from '../game/actions'
import { goalsAtStake } from '../game/goals-view'
import { buildRacePlan, scenarioLevel, type CareerTracker, type PlannedRace, type RaceMark } from '../game/race-plan'
import type { PreparedRace } from '../game/racing'
import { useGame } from '../game/store'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { RaceMarkIcon } from '../ui/RaceMarkIcon'
import { ScreenState } from '../ui/ScreenState'
import { SaveErrorState } from '../ui/SaveErrorState'
import { Collapsible, SectionHeading } from '../ui/Section'
import { SkillKindBadge } from '../ui/SkillKindBadge'
import { SkillIcon } from '../ui/SkillIcon'
import { UmaBust } from '../ui/UmaBust'
import { UmaPickerSheet } from '../ui/album/UmaPickerSheet'
import { umaIdsByLevel } from '../game/uma-order'
import { useChosenTier } from '../game/scenario-choice'
import { ScenarioSwitch } from '../ui/ScenarioSwitch'
import { CheckIcon, ChevronRightIcon } from '../ui/icons'
import { GRADE_LABEL, STRATEGY_LABEL } from './race/labels'

const ordinal = (value: number) => {
  const suffix = ['th', 'st', 'nd', 'rd']
  const mod = value % 100
  return `${value}${suffix[(mod - 20) % 10] ?? suffix[mod] ?? 'th'}`
}

function raceLockReason(save: UmaSave, tier: number, race: RaceTemplate, opponentCharacters: number): string | null {
  // An earlier scenario races as the finished unit it is: no start, no gate (D190).
  if (!isPastScenario(save, tier)) {
    if (!trainedScenario(save, tier).started) return 'Start this scenario before racing.'
    if (awaitingAdvance(save)) return 'This Uma is ready for the next scenario and cannot race again yet.'
  }
  const fieldSize = progressionFieldSize(race)
  if (opponentCharacters < fieldSize - 1) return `This field needs ${fieldSize - 1} distinct opponents.`
  return null
}

const MARK_TONE: Record<RaceMark['kind'], string> = {
  goal: 'bg-accent-wash text-accent-strong',
  set: 'bg-sunken text-ink',
  trophy: 'bg-sunken text-ink-soft',
}
const MARK_NAME: Record<RaceMark['kind'], string> = { goal: 'Career goal', set: 'G1 set leg', trophy: 'First G1 win' }

function MarkChip({ mark }: { mark: RaceMark }) {
  return (
    <span className={`inline-flex min-h-5 items-center gap-1 rounded-xs px-1.5 text-[11px] font-semibold ${MARK_TONE[mark.kind]}`}>
      <RaceMarkIcon kind={mark.kind} label={MARK_NAME[mark.kind]} />
      {mark.kind === 'set' ? `${mark.label} ${mark.won}/${mark.total}` : mark.label}
    </span>
  )
}

function RaceCard({ entry, raceBonus, past, onPick }: { entry: PlannedRace; raceBonus: number; past: boolean; onPick: () => void }) {
  const { race } = entry
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex min-h-16 w-full min-w-0 items-center gap-3 rounded-md border border-hairline bg-panel px-3 py-2 text-left shadow-1 transition-transform active:scale-[0.98]"
    >
      <span className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-sunken text-[13px] font-semibold text-ink">
        {GRADE_LABEL[race.grade]}
      </span>
      <span className="min-w-0 flex-1">
        {entry.marks.length > 0 && <span className="mb-1 flex flex-wrap gap-1">{entry.marks.map((mark) => <MarkChip key={`${mark.kind}:${mark.label}`} mark={mark} />)}</span>}
        <span className="block truncate text-[15px] font-semibold text-ink">{race.name}</span>
        <span className="block truncate text-[12px] text-ink-soft">
          {race.venue} · {race.surface === 'turf' ? 'Turf' : 'Dirt'} {race.distance} m · {progressionFieldSize(race)} runners
          {entry.raced > 0 ? ` · run ${entry.raced}×` : ''}
        </span>
      </span>
      {/* An earlier scenario's race pays no Uma EXP (D190). */}
      {!past && (
        <span className="shrink-0 text-right">
          <span className="font-display block text-[15px] font-semibold text-ink">+{raceExp(race.grade, 1, raceBonus)}</span>
          <span className="text-micro block">EXP</span>
        </span>
      )}
    </button>
  )
}

function holdNote(tracker: CareerTracker, level: number): string {
  const current = tracker.stages.find((stage) => stage.state === 'current')
  if (tracker.complete) return 'Every goal won. Advance to the next scenario from her profile.'
  if (tracker.held) {
    const left = current ? current.total - current.won : 0
    return `Level ${scenarioLevel(level)} is held until she wins her ${current?.label ?? 'stage'} goal${left > 1 ? 's' : ''}. EXP keeps banking.`
  }
  if (tracker.holdLevel !== null) return `Levels stop at ${scenarioLevel(tracker.holdLevel)} until this stage is won.`
  return 'Win her main goals to unlock the next scenario.'
}

function Tracker({ tracker, level, umaId }: { tracker: CareerTracker; level: number; umaId: string }) {
  const current = tracker.stages.find((stage) => stage.state === 'current')
  return (
    <Panel className="p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold text-ink">
          {tracker.complete ? 'Career complete' : current ? `${current.label} · ${current.won} of ${current.total}` : 'Career'}
        </h2>
        <span className="text-micro truncate">{tracker.profile}</span>
      </div>
      <ol className="mt-2 grid grid-cols-3 gap-1.5" aria-label={`${tracker.scenario} career`}>
        {tracker.stages.map((stage) => (
          <li
            key={stage.stage}
            aria-current={stage.state === 'current' ? 'step' : undefined}
            className={`rounded-sm border px-2 py-1.5 ${stage.state === 'current' ? 'border-accent bg-accent-wash' : stage.state === 'done' ? 'border-hairline bg-sunken' : 'border-hairline bg-panel'}`}
          >
            <p className={`text-[12px] font-semibold ${stage.state === 'ahead' ? 'text-ink-faint' : 'text-ink'}`}>{stage.label}</p>
            <p className="text-micro">{stage.levels} · {stage.won}/{stage.total}</p>
          </li>
        ))}
      </ol>
      {current && (
        <ul className="mt-2 grid gap-1">
          {current.races.map((entry) => (
            <li key={entry.raceId} className="flex min-h-8 items-center gap-2 text-[13px]">
              <RaceMarkIcon kind={entry.set ? 'set' : 'goal'} label={entry.won ? 'Won' : 'To win'} className={`h-4 w-4 shrink-0 ${entry.won ? 'text-accent-strong' : 'text-ink-faint'}`} />
              <span className={`min-w-0 flex-1 truncate ${entry.won ? 'text-ink-soft line-through' : 'font-semibold text-ink'}`}>
                {entry.race?.name ?? entry.raceId}{entry.set ? ` · ${entry.set}` : ''}
              </span>
              {entry.race && <span className="text-micro shrink-0">{GRADE_LABEL[entry.race.grade]}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[12px] text-ink-soft">{holdNote(tracker, level)}</p>
      {tracker.complete && <Link to={`/stable/${encodeURIComponent(umaId)}`} className="mt-1 inline-flex min-h-11 items-center gap-0.5 text-[13px] font-semibold text-accent-strong">Open her profile<ChevronRightIcon size={16} /></Link>}
    </Panel>
  )
}

/** How many Umas the race strip shows before the rest are in the picker. */
const STRIP_SIZE = 12

export function RaceSelectScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const contentState = useContent()
  const status = useGame((state) => state.status)
  const saveError = useGame((state) => state.error)
  const profile = useGame((state) => state.profile)
  const owned = useGame((state) => state.umas)
  const cards = useGame((state) => state.cards)
  const persistent = useGame((state) => state.persistent)
  const [picked, setPicked] = useState<RaceTemplate | null>(null)
  const [strategy, setStrategy] = useState<Strategy>('pace')
  const [history, setHistory] = useState<RaceResultRecord[]>([])
  const [umaHistory, setUmaHistory] = useState<RaceResultRecord[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreparedRace | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  // Highest level first, as every Uma list is (D181).
  const ownedIds = useMemo(() => umaIdsByLevel(owned, contentState.status === 'ready' ? contentState.content : null), [contentState, owned])
  const [umaPickerOpen, setUmaPickerOpen] = useState(false)
  const pickedRef = useRef<HTMLButtonElement | null>(null)
  const requestedUma = params.get('uma')
  const selectedUmaId = requestedUma && owned[requestedUma]
    ? requestedUma
    : profile?.featuredUmaId && owned[profile.featuredUmaId]
      ? profile.featuredUmaId
      : ownedIds[0] ?? null
  const selectedUma = selectedUmaId ? owned[selectedUmaId] : undefined
  const defaultStrategy = useMemo(() => {
    if (!selectedUma || contentState.status !== 'ready') return 'pace'
    if (selectedUma.racePreferences) return selectedUma.racePreferences.strategy
    const template = contentState.content.umas.byId.get(selectedUma.templateId)
    return template ? recommendedRacePreferences(template.aptitudes, template, contentState.content.races.items).strategy : 'pace'
  }, [selectedUma, contentState])
  useEffect(() => { setStrategy(defaultStrategy) }, [selectedUmaId, defaultStrategy])
  // The strip holds the leading few, and her if she is further down; the rest are one tap away in the picker.
  const stripIds = useMemo(() => {
    const leading = ownedIds.slice(0, STRIP_SIZE)
    return selectedUmaId && !leading.includes(selectedUmaId) ? [...leading, selectedUmaId] : leading
  }, [ownedIds, selectedUmaId])
  // Which of her trained units races (D190): her current scenario unless another was chosen for her.
  const tier = useChosenTier(selectedUma) ?? 1
  const loadoutKey = selectedUma ? `${tier}:${trainedScenario(selectedUma, tier).loadoutSkillIds.join('|')}` : ''
  const requestedGoalRace = params.get('goal')

  useEffect(() => {
    pickedRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selectedUmaId, contentState.status])

  useEffect(() => {
    if (contentState.status !== 'ready' || !requestedGoalRace) return
    const target = contentState.content.races.byId.get(requestedGoalRace)
    if (target) setPicked(target)
  }, [contentState, requestedGoalRace])

  // Her own history drives Won this scenario and the repeat counts; it refreshes whenever a race moves her EXP.
  useEffect(() => {
    if (status !== 'ready') return
    let cancelled = false
    void Promise.all([listRaceHistory(20), selectedUmaId ? listUmaRaceHistory(selectedUmaId) : Promise.resolve([])]).then(([recent, own]) => {
      if (!cancelled) {
        setHistory(recent)
        setUmaHistory(own)
        setHistoryError(null)
      }
    }).catch((reason: unknown) => {
      if (!cancelled) setHistoryError(reason instanceof Error ? reason.message : 'Could not read race history')
    })
    return () => { cancelled = true }
  }, [profile?.tickets, profile?.umaShards, selectedUmaId, selectedUma?.level, selectedUma?.exp, status])

  useEffect(() => {
    if (contentState.status !== 'ready' || status !== 'ready' || !picked || !selectedUmaId) {
      setPreview(null)
      setPreviewError(null)
      return
    }
    let cancelled = false
    setPreview(null)
    setPreviewError(null)
    void prepareRace(selectedUmaId, picked.id, strategy, undefined, tier).then((preparation) => {
      if (cancelled) return
      if (preparation.status === 'prepared') setPreview(preparation.attempt)
      else setPreviewError('The next race attempt was already completed.')
    }).catch((reason: unknown) => {
      if (!cancelled) setPreviewError(reason instanceof Error ? reason.message : 'Could not build field preview')
    })
    return () => { cancelled = true }
  }, [contentState, loadoutKey, picked, selectedUmaId, status, strategy, tier])

  if (contentState.status === 'signed-out' || status === 'signed-out') {
    return <ScreenState title="Sign in to race" detail="Progression races use your private Stable and content." action={{ label: 'Open Settings', to: '/settings' }} />
  }
  if (contentState.status === 'empty') return <ScreenState title="Content is not imported" detail="Publish private race content before racing." />
  if (contentState.status === 'error') return <ScreenState title="Content unavailable" detail={contentState.error.message} />
  if (status === 'error') return <SaveErrorState detail={saveError} />
  if (contentState.status !== 'ready' || status !== 'ready' || !profile) return <ScreenState title="Preparing races…" detail="Loading private content and your local save." />
  if (!selectedUma || !selectedUmaId) return <ScreenState title="No owned Uma" detail="Add an Uma to your Stable before entering a race." action={{ label: 'Open Stable', to: '/stable' }} />

  const content = contentState.content
  const umaTemplate = content.umas.byId.get(selectedUmaId)
  if (!umaTemplate) return <ScreenState title="Content reference missing" detail={`The save is preserving ${selectedUmaId} until its template is restored.`} />
  const past = isPastScenario(selectedUma, tier)
  if (!past && !trainedScenario(selectedUma, tier).started) return <ScreenState title="Start this scenario" detail="Start her scenario from her profile before racing." action={{ label: 'Open her profile', to: `/stable/${encodeURIComponent(selectedUmaId)}` }} />
  const derivedUma = deriveUma({
    uma: selectedUma,
    tier,
    umaTemplate,
    cardSaves: new Map(Object.entries(cards)),
    cardTemplates: content.cards.byId,
    umaTemplates: content.umas.byId,
    skillTemplates: content.skills.byId,
  })
  const plan = buildRacePlan({
    uma: selectedUma,
    template: umaTemplate,
    aptitudes: derivedUma.aptitudes,
    races: regularRaceCatalog(
      content.races.items,
      trainedScenario(selectedUma, tier).journey?.goals
        .filter((goal) => goal.status === 'active')
        .flatMap((goal) => goal.series
          ? goal.series.legs.filter((leg) => leg.status === 'active').map((leg) => leg.raceId)
          : goalRaceIds(goal)) ?? [],
    ),
    history: umaHistory,
    tier,
  })
  const pickedGoals = picked && !past ? goalsAtStake(selectedUma, picked.id, content) : []
  const pickedEntry = picked ? plan.all.find((entry) => entry.race.id === picked.id) : undefined
  const opponentCharacters = new Set(content.umas.items.filter((item) => item.charaId !== umaTemplate.charaId).map((item) => item.charaId)).size
  let raceBonus = 0
  let deckError: string | null = null
  try {
    const deck = validateSupportDeck({
      tier,
      orderedCardIds: trainedScenario(selectedUma, tier).cardSetIds,
      ownedCards: Object.values(cards),
      templates: content.cards.byId,
    })
    const issue = deck.issues[0]
    if (issue) throw new Error(supportDeckIssueMessage(issue))
    raceBonus = equippedRaceBonus(tier, deck.cards)
  } catch (reason) {
    deckError = reason instanceof Error ? reason.message : 'Race deck is invalid'
  }
  const skillLoadout = summarizeSkillLoadout(derivedUma, umaTemplate, content.skills.byId)
  const skillCosts = racingSkillCosts(skillLoadout)
  const ownUnique = umaTemplate.uniqueSkillId ? content.skills.byId.get(umaTemplate.uniqueSkillId) : undefined
  const raceSkills = [
    ...(ownUnique ? [{ skill: ownUnique, own: true }] : []),
    ...skillLoadout.skills.map((skill) => ({ skill, own: false })),
  ].map((entry) => ({ ...entry, onCourse: picked ? raceSkillCompatibleWithCourse(compileRaceSkill(entry.skill), picked) : true }))
  const finalTier = selectedUma.level >= SCENARIOS.length * 10
  const advanceRequired = !past && awaitingAdvance(selectedUma) && !finalTier
  const lockReason = picked
    ? raceLockReason(selectedUma, tier, picked, opponentCharacters) ?? deckError ?? (skillLoadout.valid ? null : skillLoadout.errors[0]!)
    : null

  const chooseUma = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('uma', id)
    setParams(next, { replace: true })
    setStartError(null)
  }
  const pick = (race: RaceTemplate) => {
    setPicked(race)
    setStartError(null)
  }

  const start = async () => {
    if (!picked || lockReason || starting) return
    setStarting(true)
    setStartError(null)
    try {
      const preparation = await prepareRace(selectedUmaId, picked.id, strategy, undefined, tier)
      if (preparation.status !== 'prepared') throw new Error('The next race attempt was already completed')
      navigate(`/race/run?uma=${encodeURIComponent(selectedUmaId)}&race=${encodeURIComponent(picked.id)}&strategy=${strategy}&sequence=${preparation.attempt.sequence}&tier=${tier}`)
    } catch (reason) {
      setStartError(reason instanceof Error ? reason.message : 'Could not prepare race')
      setStarting(false)
    }
  }


  return (
    <div className="flex flex-col gap-3 pt-2 pb-4">
      <div className="min-w-0 px-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Races</h1>
        <p className="truncate text-[13px] text-ink-soft">
          {umaTemplate.name} · {SCENARIOS[tier - 1]?.name} · {past ? `TL ${trainedScenario(selectedUma, tier).trainingLevel} · no Uma EXP` : `Lv ${scenarioLevel(selectedUma.level)}/10`}
        </p>
      </div>
      <div role="radiogroup" aria-label="Racing Uma" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {stripIds.map((id) => {
          const picked = id === selectedUmaId
          return (
            <button
              key={id}
              ref={picked ? pickedRef : undefined}
              type="button"
              role="radio"
              aria-checked={picked}
              onClick={() => chooseUma(id)}
              className="w-16 shrink-0 text-center"
            >
              <UmaBust
                content={content}
                umaId={id}
                className={`w-16 rounded-md border bg-gradient-to-b from-panel to-sunken ${picked ? 'border-accent outline outline-2 outline-accent' : 'border-hairline'}`}
              />
              <span className={`mt-1 block truncate text-[10px] font-semibold ${picked ? 'text-accent-strong' : 'text-ink-soft'}`}>
                {content.umas.byId.get(id)?.name ?? id}
              </span>
            </button>
          )
        })}
        <button type="button" onClick={() => setUmaPickerOpen(true)} className="w-16 shrink-0 text-center">
          <span className="flex aspect-square w-16 flex-col items-center justify-center rounded-md border border-dashed border-hairline-strong bg-panel text-[11px] font-semibold text-ink-soft">
            <span className="font-display text-base text-ink">{ownedIds.length}</span>
            All
          </span>
          <span className="mt-1 block truncate text-[10px] font-semibold text-ink-soft">Browse</span>
        </button>
      </div>
      <UmaPickerSheet
        open={umaPickerOpen}
        onClose={() => setUmaPickerOpen(false)}
        title="Choose who races"
        content={content}
        selectedIds={selectedUmaId ? [selectedUmaId] : []}
        selectedLabel="Racing"
        onPick={chooseUma}
      />
      <ScenarioSwitch uma={selectedUma} tier={tier} label="Racing as" />

      {!persistent && <Panel className="border-warning/40 py-3 text-[13px] font-semibold text-warning">Memory only — race progress will not survive a reload or sync.</Panel>}
      {!past && awaitingAdvance(selectedUma) && (
        <Panel className="border-accent text-center">
          <p className="font-display font-semibold">{finalTier ? 'Latest scenario complete' : 'Ready for the next scenario'}</p>
          <p className="text-micro mt-1">
            {finalTier ? 'No later scenario is available yet.' : 'Advance her from her profile to race again.'}
            {selectedUma.scenarios.length > 1 ? ' Her earlier scenarios above can still race.' : ''}
          </p>
          {!finalTier && <Button className="mt-3" onClick={() => navigate(`/stable/${encodeURIComponent(selectedUmaId)}`)}>Open her profile</Button>}
        </Panel>
      )}

      {plan.tracker && <Tracker tracker={plan.tracker} level={selectedUma.level} umaId={selectedUmaId} />}

      <SectionHeading label="Next up" hint={`${plan.nextUp.length} races`} />
      <div className="grid grid-cols-1 gap-2">
        {plan.nextUp.map((entry) => <RaceCard key={entry.race.id} entry={entry} raceBonus={raceBonus} past={past} onPick={() => pick(entry.race)} />)}
        {plan.nextUp.length === 0 && <Panel className="text-center text-[13px] text-ink-soft">No race fits her right now. Every race is still open under All races.</Panel>}
      </div>

      <Collapsible label="Won this scenario" count={plan.won.length}>
        <div className="grid grid-cols-1 gap-2">
          {plan.won.map((entry) => <RaceCard key={entry.race.id} entry={entry} raceBonus={raceBonus} past={past} onPick={() => pick(entry.race)} />)}
          {plan.won.length === 0 && <p className="text-micro">No wins in this scenario yet.</p>}
        </div>
      </Collapsible>

      <Collapsible label="All races" count={plan.all.length}>
        <div className="grid grid-cols-1 gap-2">
          {plan.all.map((entry) => <RaceCard key={entry.race.id} entry={entry} raceBonus={raceBonus} past={past} onPick={() => pick(entry.race)} />)}
        </div>
      </Collapsible>

      <Collapsible label="Recent results" count={history.length}>
        {historyError && <p className="text-[13px] font-semibold text-danger">{historyError}</p>}
        {!historyError && history.length === 0 && <p className="text-micro">No recorded races yet.</p>}
        <div className="grid gap-1.5">
          {history.slice(0, 8).map((record) => (
            <div key={`${record.umaId}:${record.sequence}`} className="flex min-h-11 items-center gap-3 rounded-sm bg-sunken px-3 py-2 text-[13px]">
              <span className="font-display w-9 font-semibold">{ordinal(record.playerPlacement)}</span>
              <span className="min-w-0 flex-1 truncate">{content.umas.byId.get(record.umaId)?.name ?? record.umaId} · {content.races.byId.get(record.raceId)?.name ?? record.raceId}</span>
              <span className="text-micro shrink-0 text-right">+{record.expGained} EXP{record.ticketReward ? ` · +${record.ticketReward} tickets` : ''}</span>
            </div>
          ))}
        </div>
      </Collapsible>

      <BottomSheet open={picked !== null} onClose={() => !starting && setPicked(null)}>
        {picked && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-micro">{GRADE_LABEL[picked.grade]}</p>
              <p className="font-display text-2xl font-semibold text-ink">{picked.name}</p>
              <p className="text-[13px] text-ink-soft">{picked.venue} · {picked.surface === 'turf' ? 'Turf' : 'Dirt'} {picked.distance} m · {progressionFieldSize(picked)} runners</p>
              {pickedEntry && pickedEntry.marks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">{pickedEntry.marks.map((mark) => <MarkChip key={`${mark.kind}:${mark.label}`} mark={mark} />)}</div>
              )}
            </div>
            {pickedGoals.length > 0 && (
              <div className="rounded-md border border-accent bg-accent-wash p-3">
                <p className="font-display text-[13px] font-semibold text-accent-strong">At stake</p>
                {pickedGoals.map((goal) => <p key={goal.id} className="mt-1 text-[13px]"><span className="font-semibold">{goal.label}:</span> {goal.rule}</p>)}
              </div>
            )}
            <div className="flex items-center gap-3 rounded-md bg-sunken p-3">
              <div className="w-14 shrink-0">
                <UmaBust content={content} umaId={selectedUmaId} alt={umaTemplate.name} className="rounded-sm bg-panel" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{umaTemplate.name} · Lv {selectedUma.level}</p>
                <p className="text-micro">{SCENARIOS[tier - 1]?.name} · Training Level {trainedScenario(selectedUma, tier).trainingLevel}{past ? '' : ` · Race Bonus +${Math.round(raceBonus * 100)}%`}</p>
                <p className="text-micro">{past ? 'Earlier scenario: results and badges, no Uma EXP' : `1st place +${raceExp(picked.grade, 1, raceBonus)} EXP`}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ['Surface', derivedUma.aptitudes.surface[picked.surface]],
                ['Distance', derivedUma.aptitudes.distance[picked.distanceCategory]],
                ['Strategy', derivedUma.aptitudes.strategy[strategy]],
              ].map(([label, grade]) => (
                <div key={label} className="rounded-sm border border-hairline bg-panel p-2">
                  <p className="text-micro">{label}</p>
                  <p className="font-display text-xl font-semibold text-ink">{grade}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-display text-[13px] font-semibold">Race skills</p>
                <span className={`rounded-xs px-2 py-0.5 text-[11px] font-semibold ${skillLoadout.valid ? 'bg-sunken text-ink' : 'bg-danger/10 text-danger'}`}>
                  {skillLoadout.cost} / {skillLoadout.cap} SP
                </span>
              </div>
              {/* What she carries into this race; choosing lives on the Skills page (D175). */}
              <div className="grid gap-1">
                {raceSkills.map(({ skill, own, onCourse }) => (
                  <div key={skill.id} className={`flex min-h-9 items-center gap-2 rounded-sm px-2 ${onCourse ? 'bg-accent-wash' : 'bg-sunken'}`}>
                    <SkillIcon skill={skill} size={24} className={onCourse ? '' : 'opacity-50'} />
                    <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${onCourse ? '' : 'text-ink-faint'}`}>{skill.name}</span>
                    <SkillKindBadge kind={skill.kind} />
                    <span className="text-micro w-20 shrink-0 text-right">{onCourse ? own ? 'free' : `${skillCosts.get(skill.id) ?? skill.costSp} SP` : 'won’t trigger'}</span>
                  </div>
                ))}
              </div>
              {raceSkills.some((entry) => !entry.onCourse) && (
                <p className="mt-1 text-[11px] text-ink-soft">Greyed skills can’t trigger on this course; they still cost SP.</p>
              )}
              <Link
                to={`/stable/${encodeURIComponent(selectedUmaId)}/skills?race=${encodeURIComponent(picked.id)}&return=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
                className="font-display mt-2 flex min-h-11 items-center justify-between rounded-md border border-hairline bg-panel px-3 text-[14px] font-semibold"
              >
                <span>Edit skills <span className="text-[12px] font-normal text-ink-soft">· {derivedUma.library.length} in her library</span></span>
                <ChevronRightIcon size={20} className="text-ink-faint" />
              </Link>
            </div>
            <div>
              <p className="font-display mb-2 text-[13px] font-semibold">Field</p>
              {!preview && !previewError && <p className="text-micro">Building the field…</p>}
              {previewError && <p className="rounded-sm bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{previewError}</p>}
              {preview && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {preview.runners.map((runner, gate) => {
                    const template = content.umas.byId.get(runner.templateId)
                    return (
                      <div key={`${gate}:${runner.templateId}`} className={`w-14 shrink-0 rounded-sm border p-1 text-center ${runner.isPlayer ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}>
                        <UmaBust content={content} umaId={runner.templateId} alt={template?.name ?? runner.templateId} className="rounded-xs" />
                        <p className="mt-1 truncate text-[9px] font-semibold">{gate + 1}. {runner.isPlayer ? 'You' : template?.name ?? runner.templateId}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="font-display mb-2 text-[13px] font-semibold">Strategy</p>
              <div className="grid grid-cols-2 gap-2">
                {STRATEGIES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={strategy === value}
                    onClick={() => { setStrategy(value); setStartError(null) }}
                    className={`min-h-12 rounded-sm border px-3 text-[14px] font-semibold transition-transform active:scale-[0.98] ${strategy === value ? 'border-accent bg-accent-wash text-accent-strong' : 'border-hairline bg-panel text-ink'}`}
                  >
                    {STRATEGY_LABEL[value]} · {derivedUma.aptitudes.strategy[value]}
                  </button>
                ))}
              </div>
            </div>
            {(lockReason || startError) && <p className="rounded-sm bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{startError ?? lockReason}</p>}
            <Button size="lg" disabled={!advanceRequired && (Boolean(lockReason) || Boolean(previewError) || !preview || starting)} onClick={() => advanceRequired ? navigate(`/stable/${encodeURIComponent(selectedUmaId)}`) : void start()}>
              {advanceRequired ? 'Open her profile' : starting ? 'Preparing…' : 'Start race'}
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
