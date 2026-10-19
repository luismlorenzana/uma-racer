// Race select (T141 "Racecourse"; docs/game/11-hub-and-places.md §3.3, §9.2; 09 §3.5, §4): the header with the purse
// bar and the featured bonuses still open, the Uma strip, Today's featured, Next up and every race, then the pre-race
// sheet. `?uma=&race=` preselects; `?goals=open` filters the level-first strip (A03). Racing is never blocked (D328): no
// lock, no cost, and she races as her current scenario (03 §6). Start race commits before it plays (09 §8).
import { BottomSheet, Button, Chip } from '@luismlorenzana/uma-kit/ui'
import {
  DISTANCE_CATEGORIES, STRATEGIES, goalRaceIds, progressionFieldSize, raceExp, recommendedRacePreferences, regularRaceCatalog,
  type DistanceCategory, type RaceTemplate, type Strategy,
} from '@racer/domain'
import type { Place } from '@racer/domain/hub'
import { deriveUmaPreset, type DerivedBuild } from '@racer/domain/training'
import type { UmaState } from '@racer/domain/state'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { goalsAtStake } from './goals-view'
import { raceStatFit, type StatFitVerdict } from './race-fit'
import { buildRacePlan, type PlannedRace, type RaceMark } from './race-plan'
import { RunningStyleIcon } from '../../ui/CardFocusIcons'
import { IconChoiceRow } from '../../ui/IconChoiceRow'
import { PresetBadge } from '../../ui/PresetBadge'
import { RaceMarkIcon } from '../../ui/RaceMarkIcon'
import { Collapsible, SectionHeading } from '../../ui/Section'
import { TypeIcon } from '../../ui/TypeIcon'
import type { LoadedContent } from '../../content/view'
import { useGame, useNow, useRuntime, type G2Records } from '../../app/game'
import { PlacePageHeader } from '../PlacePageHeader'
import { UmaBust } from './UmaBust'
import { FaceTile } from '@luismlorenzana/uma-kit/album'
import { RacerUmaPicker } from '../../ui/racerAlbum'
import { useRaceContent } from './content'
import { prepareRace } from './prepare'
import { useRecords } from './records'
import { startRace } from './race'
import { STRATEGY_LABEL } from './run/labels'
import { historyOf, resultCount, resultPath, umaSaveOf } from './today'
import { featuredView, gradeWords, localDayAt, prizePreview, purseBar, stripOrder, type FeaturedView, type PurseBar, type StripTile } from './view'
import { amount, racingWords } from './words'

const MARK_TONE: Record<RaceMark['kind'], string> = {
  goal: 'bg-accent-wash text-accent-strong',
  set: 'bg-sunken text-ink',
  trophy: 'bg-sunken text-ink-soft',
}
const MARK_NAME: Record<RaceMark['kind'], string> = { goal: 'Career goal', set: 'G1 set leg', trophy: 'First G1 win' }
const STAT_NAME = { speed: 'Speed', stamina: 'Stamina', power: 'Power', guts: 'Guts', wit: 'Wit' } as const
const VERDICT: Record<StatFitVerdict, { word: 'stat-good' | 'stat-average' | 'stat-bad'; className: string }> = {
  good: { word: 'stat-good', className: 'bg-success/10 text-success' },
  average: { word: 'stat-average', className: 'bg-sunken text-ink-soft' },
  bad: { word: 'stat-bad', className: 'bg-danger/10 text-danger' },
}
const PRESET_NAME: Record<DistanceCategory, string> = { sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long' }

function MarkChip({ mark }: { mark: RaceMark }) {
  return (
    <span className={`inline-flex min-h-5 items-center gap-1 rounded-xs px-1.5 text-[11px] font-semibold ${MARK_TONE[mark.kind]}`}>
      <RaceMarkIcon kind={mark.kind} label={MARK_NAME[mark.kind]} />
      {mark.kind === 'set' ? `${mark.label} ${mark.won}/${mark.total}` : mark.label}
    </span>
  )
}

const raceLine = (race: RaceTemplate, raced = 0): string =>
  racingWords('race-line', { venue: race.venue, surface: racingWords(race.surface === 'turf' ? 'turf' : 'dirt'), meters: race.distance, runners: progressionFieldSize(race) })
  + (raced > 0 ? racingWords('race-run', { n: raced }) : '')

function RaceCard({ race, marks = [], raced = 0, raceBonus, ribbon, onPick }: {
  race: RaceTemplate
  marks?: readonly RaceMark[]
  raced?: number
  raceBonus: number
  ribbon?: { readonly text: string; readonly paid: boolean }
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      data-race={race.id}
      className={`relative flex min-h-16 w-full min-w-0 items-center gap-3 rounded-md border bg-panel px-3 py-2 text-left shadow-1 transition-transform active:scale-[0.98] ${ribbon && !ribbon.paid ? 'border-tier-gold' : 'border-hairline'}`}
    >
      <span className="font-display flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-sunken text-[13px] font-semibold text-ink">{gradeWords(race.grade)}</span>
      <span className="min-w-0 flex-1">
        {(ribbon || marks.length > 0) && (
          <span className="mb-1 flex flex-wrap gap-1">
            {ribbon && (
              <span className={`inline-flex min-h-5 items-center rounded-xs px-1.5 text-[11px] font-bold ${ribbon.paid ? 'bg-sunken text-ink-soft' : 'bg-tier-gold text-ink'}`} data-ribbon={ribbon.paid ? 'paid' : 'open'}>
                {ribbon.text}
              </span>
            )}
            {marks.map((mark) => <MarkChip key={`${mark.kind}:${mark.label}`} mark={mark} />)}
          </span>
        )}
        <span className="block truncate text-[15px] font-semibold text-ink">{race.name}</span>
        <span className="block truncate text-[12px] text-ink-soft">{raceLine(race, raced)}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="font-display block text-[15px] font-semibold text-ink">{racingWords('win-exp', { exp: raceExp(race.grade, 1, raceBonus) })}</span>
        <span className="text-micro block">{racingWords('exp')}</span>
      </span>
    </button>
  )
}

function PurseHeader({ bar, featured }: { bar: PurseBar; featured: FeaturedView }) {
  return (
    <div className="border-b border-hairline bg-panel/95 px-3 pt-2 pb-2.5" data-g2="purse-bar" data-band={bar.band}>
      <p className="text-[13px] font-semibold text-ink" aria-live="polite" data-purse-words>{bar.words}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-ink/10" aria-hidden>
          <div
            className={`h-full origin-left rounded-full transition-transform duration-500 ${bar.band === 'full' ? 'bg-success' : bar.band === 'tired' ? 'bg-warning' : 'bg-danger'}`}
            style={{ transform: `scaleX(${Math.max(0, Math.min(1, bar.fill))})` }}
          />
        </div>
        {featured.open > 0 && (
          <span className="font-display shrink-0 rounded-full bg-tier-gold px-2 text-[11px] leading-5 font-bold text-ink" data-featured-open={featured.open}>
            {featured.open === 1 ? racingWords('featured-open-one') : racingWords('featured-open', { n: featured.open })}
          </span>
        )}
      </div>
    </div>
  )
}

function Strip({ tiles, selected, onPick }: { tiles: readonly StripTile[]; selected: string; onPick: (umaId: string) => void }) {
  const [open, setOpen] = useState(false)
  const tile = tiles.find((row) => row.umaId === selected)
  return (
    <div className="px-3" data-g2="race-uma-control" data-uma={selected}>
      <button type="button" aria-label={racingWords('who-races')} onClick={() => setOpen(true)}
        className="flex min-h-13 w-full items-center gap-3 rounded-sm border border-hairline bg-panel p-2 text-left">
        <FaceTile round label="" outfitId={selected} size={44} className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{tile?.name}</span>
          <span className="block text-[12px] text-ink-soft">{tile === undefined ? '' : racingWords('tile-level', { tier: tile.tier, level: tile.level })}{tile?.work ? ` · ${tile.work}` : ''}</span>
        </span>
        <span className="text-[13px] font-semibold text-accent-strong">Change</span>
      </button>
      <RacerUmaPicker open={open} onClose={() => setOpen(false)} title={racingWords('who-races')}
        candidateIds={tiles.map((row) => row.umaId)} selectedIds={[selected]}
        describe={(entry) => { const one = tiles.find((row) => row.umaId === entry.id); return [one?.work, one?.open === false ? racingWords('tile-done') : null].filter(Boolean).join(' · ') }}
        onPick={onPick} />
    </div>
  )
}

function PreRaceSheet({ race, uma, content, derived, records, onClose }: {
  race: RaceTemplate
  uma: UmaState
  content: LoadedContent
  derived: DerivedBuild
  records: G2Records
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { game } = useRuntime()
  const state = useGame((snapshot) => snapshot.state)!
  const env = useGame((snapshot) => snapshot.env)!
  const now = useNow()
  const template = content.umas.byId.get(uma.outfitId)!
  const defaultStyle = uma.raceDefaults.preferences?.strategy ?? recommendedRacePreferences(template.aptitudes, template, content.races.items).strategy
  const [strategy, setStrategy] = useState<Strategy>(defaultStyle)
  const [starting, setStarting] = useState(false)
  const [failed, setFailed] = useState(false)
  const localDay = localDayAt(now, game.utcOffsetMin(now))
  const preview = useMemo(() => {
    try {
      return prepareRace({ state, env, content, now, umaId: uma.outfitId, raceId: race.id, strategy, sequence: resultCount(records.raceResults, uma.outfitId) })
    } catch {
      return null
    }
  }, [state, env, content, now, uma.outfitId, race.id, strategy, records.raceResults])
  const goals = goalsAtStake(umaSaveOf(uma), race.id, content)
  const raced = preview?.derived ?? derived
  const fits = preview ? raceStatFit({
    stats: preview.input.runners[preview.playerIndex]!.stats,
    rivals: preview.input.runners.filter((_, index) => index !== preview.playerIndex).map((runner) => runner.stats),
    distance: race.distance,
    strategy,
  }) : null
  const skills = [template.uniqueSkillId, ...raced.loadoutSkillIds.filter((id) => id !== template.uniqueSkillId)]
    .flatMap((id) => (id ? [content.skills.byId.get(id)].filter((skill) => skill !== undefined) : []))

  const start = async () => {
    if (starting) return
    setStarting(true)
    setFailed(false)
    const at = game.now()
    const day = localDayAt(at, game.utcOffsetMin(at))
    const snapshot = game.getSnapshot()
    const answer = await startRace({
      game, state: snapshot.state!, env: snapshot.env!, content, umaId: uma.outfitId, raceId: race.id, strategy,
      localDay: day, board: featuredView(snapshot.state!.profile, day, content.races.items).board,
    })
    if (answer.kind === 'done') {
      // The sheet closes behind the run, so leaving the result lands on race select, not on a sheet already raced.
      navigate(`/racing/racecourse?uma=${encodeURIComponent(uma.outfitId)}`, { replace: true })
      navigate(resultPath(answer.id), { state: { back: true } })
      return
    }
    setStarting(false)
    setFailed(true)
  }

  return (
    <div className="flex flex-col gap-4" data-g2="pre-race">
      <div>
        <p className="text-micro">{gradeWords(race.grade)}</p>
        <h2 className="font-display text-2xl font-semibold text-ink">{race.name}</h2>
        <p className="text-[13px] text-ink-soft">{raceLine(race)}</p>
        <p className="font-display mt-1 text-[15px] font-semibold text-ink" data-prize-preview>{prizePreview(state.profile.purse, localDay, race.grade)}</p>
      </div>
      {goals.length > 0 && (
        <div className="rounded-md border border-accent bg-accent-wash p-3">
          <p className="font-display text-[13px] font-semibold text-accent-strong">{racingWords('at-stake')}</p>
          {goals.map((goal) => <p key={goal.id} className="mt-1 text-[13px]"><span className="font-semibold">{goal.label}:</span> {goal.rule}</p>)}
        </div>
      )}
      <div className="flex items-center gap-3 rounded-md bg-sunken p-3">
        <UmaBust outfitId={uma.outfitId} size={48} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 font-semibold">
            <span className="truncate">{template.name} · {racingWords('tile-level', { tier: uma.tier, level: uma.racing.level })}</span>
            <PresetBadge preset={race.distanceCategory} className="shrink-0" />
          </p>
          <p className="text-micro">{racingWords('races-preset', { preset: PRESET_NAME[race.distanceCategory], bonus: Math.round(raced.raceBonus * 100) })}</p>
          {preview !== null && preview.collects > 0 && (
            <p className="text-[12px] font-semibold text-accent-strong" data-collects={preview.collects}>
              {preview.collects === 1 ? racingWords('collects-one') : racingWords('collects-many', { n: preview.collects })}
            </p>
          )}
        </div>
      </div>
      <div>
        <p className="font-display mb-2 text-[13px] font-semibold">{racingWords('running-style', { style: STRATEGY_LABEL[strategy] })}</p>
        <IconChoiceRow
          label={racingWords('running-style', { style: STRATEGY_LABEL[strategy] })}
          value={strategy}
          onChange={(value) => { setStrategy(value); setFailed(false) }}
          options={STRATEGIES.map((value) => ({
            value, name: STRATEGY_LABEL[value], badge: raced.aptitudes.strategy[value], icon: <RunningStyleIcon style={value} size={32} />,
          }))}
        />
      </div>
      {failed && <p role="alert" className="rounded-sm bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{racingWords('that-failed')}</p>}
      <Button size="lg" disabled={starting} onClick={() => void start()} data-start-race>{racingWords(starting ? 'starting' : 'start-race')}</Button>
      <div className="grid grid-cols-3 gap-2 text-center">
        {([
          ['aptitude-surface', raced.aptitudes.surface[race.surface]],
          ['aptitude-distance', raced.aptitudes.distance[race.distanceCategory]],
          ['aptitude-style', raced.aptitudes.strategy[strategy]],
        ] as const).map(([word, grade]) => (
          <div key={word} className="rounded-sm border border-hairline bg-panel p-2">
            <p className="text-micro">{racingWords(word)}</p>
            <p className="font-display text-xl font-semibold text-ink">{grade}</p>
          </div>
        ))}
      </div>
      {fits && (
        <div>
          <p className="font-display mb-2 text-[13px] font-semibold">{racingWords('her-stats')}</p>
          <div className="flex min-w-0 flex-col gap-1">
            {fits.map((fit) => (
              <div key={fit.stat} className="flex min-h-9 min-w-0 items-center gap-1.5 rounded-sm bg-sunken px-2">
                <TypeIcon type={fit.stat} size={20} />
                <span className="w-14 shrink-0 text-[13px] font-semibold">{STAT_NAME[fit.stat]}</span>
                <span className="font-display w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums">{fit.value}</span>
                <span className={`w-16 shrink-0 rounded-xs py-0.5 text-center text-[11px] font-semibold ${VERDICT[fit.verdict].className}`}>{racingWords(VERDICT[fit.verdict].word)}</span>
                <span className="min-w-0 flex-1 truncate text-right text-[11px] text-ink-soft">
                  {fit.stat === 'stamina' ? racingWords('stamina-needs', { n: amount(fit.reference) }) : racingWords('beats-field', { n: Math.floor(fit.ahead ?? 0), of: fit.rivals })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div>
        <p className="font-display mb-2 text-[13px] font-semibold">{racingWords('race-skills')}</p>
        {skills.length === 0 ? <p className="text-micro">{racingWords('no-skills')}</p> : (
          <div className="grid gap-1">
            {skills.map((skill) => (
              <div key={skill.id} className="flex min-h-9 items-center gap-2 rounded-sm bg-sunken px-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-semibold">{skill.name}</span>
                <span className="text-micro shrink-0">{skill.id === template.uniqueSkillId ? racingWords('skill-free') : racingWords('skill-cost', { sp: skill.costSp ?? 0 })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {preview && (
        <div>
          <p className="font-display mb-2 text-[13px] font-semibold">{racingWords('field')}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {preview.runners.map((runner, gate) => (
              <div key={`${gate}:${runner.templateId}`} className={`w-14 shrink-0 rounded-sm border p-1 text-center ${runner.isPlayer ? 'border-accent bg-accent-wash' : 'border-hairline bg-panel'}`}>
                <span className="flex justify-center"><UmaBust outfitId={runner.templateId} size={36} /></span>
                <p className="mt-1 truncate text-[9px] font-semibold">{gate + 1}. {runner.isPlayer ? racingWords('you') : content.umas.byId.get(runner.templateId)?.name ?? runner.templateId}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <Button variant="secondary" onClick={onClose}>{racingWords('close')}</Button>
    </div>
  )
}

export function RaceSelect({ place }: { place: Place }) {
  const [params, setParams] = useSearchParams()
  const { game } = useRuntime()
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const records = useRecords()
  const now = useNow()
  const content = useRaceContent()
  const offset = game.utcOffsetMin(now)
  const localDay = localDayAt(now, offset)
  const name = (umaId: string) => content?.umas.byId.get(umaId)?.name ?? umaId
  const allStrip = useMemo(() => (state ? stripOrder(state, name, now, (id) => content?.umas.byId.get(id)?.jpRelease ?? '') : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, content, now])
  const openGoals = params.get('goals') === 'open'
  const strip = openGoals ? allStrip.filter((tile) => tile.open) : allStrip
  const asked = params.get('uma')
  const umaId = strip.find((tile) => tile.umaId === asked)?.umaId ?? strip[0]?.umaId ?? null
  const uma = umaId === null ? undefined : state?.umas[umaId]
  const raceParam = params.get('race')
  const presets = useMemo(() => (uma && env
    ? Object.fromEntries(DISTANCE_CATEGORIES.map((distance) => [distance, deriveUmaPreset(uma, distance, env.content)])) as Record<DistanceCategory, DerivedBuild>
    : null), [uma, env])

  if (!state || !env || !content || !records) return <PlacePageHeader place={place} />
  const bar = purseBar(state.profile.purse, localDay)
  const featured = featuredView(state.profile, localDay, content.races.items)
  const header = <PlacePageHeader place={place} lines={bar.about} />
  const filter = allStrip.length === 0 ? null : (
    <div className="px-3 pt-3">
      <Chip selected={openGoals} className="min-h-11" onClick={() => {
        const next = new URLSearchParams(params)
        if (openGoals) next.delete('goals')
        else next.set('goals', 'open')
        const shown = openGoals ? allStrip : allStrip.filter((tile) => tile.open)
        const selected = shown.find((tile) => tile.umaId === umaId) ?? shown[0]
        if (selected) next.set('uma', selected.umaId)
        else next.delete('uma')
        // A pre-race sheet belongs to the Uma it opened for, never the filter's new first choice.
        next.delete('race')
        setParams(next, { replace: true })
      }}>{racingWords('open-goals')}</Chip>
    </div>
  )

  if (!uma || !presets) {
    return (
      <div data-place-page="racecourse">
        {header}
        <PurseHeader bar={bar} featured={featured} />
        {filter}
        <p className="px-4 py-8 text-center text-[13px] text-ink-soft">{racingWords(allStrip.length > 0 && openGoals ? 'no-open-goals' : 'no-umas')}</p>
      </div>
    )
  }

  const template = content.umas.byId.get(uma.outfitId)
  const save = umaSaveOf(uma)
  const activeGoalRaces = uma.career.goals.filter((goal) => goal.status === 'active')
    .flatMap((goal) => (goal.series ? goal.series.legs.filter((leg) => leg.status === 'active').map((leg) => leg.raceId) : goalRaceIds(goal)))
  const plan = template ? buildRacePlan({
    uma: save,
    template,
    aptitudes: presets[uma.raceDefaults.selectedPreset].aptitudes,
    aptitudesFor: (distance) => presets[distance].aptitudes,
    races: regularRaceCatalog(content.races.items, activeGoalRaces),
    history: historyOf(records.raceResults, uma.outfitId),
  }) : null
  const picked = raceParam === null ? null : content.races.byId.get(raceParam) ?? null
  const pick = (raceId: string | null) => {
    const next = new URLSearchParams(params)
    next.set('uma', uma.outfitId)
    if (raceId === null) next.delete('race')
    else next.set('race', raceId)
    setParams(next, { replace: true })
  }
  const chooseUma = (id: string) => {
    const next = new URLSearchParams(params)
    next.set('uma', id)
    next.delete('race')
    setParams(next, { replace: true })
  }
  const bonusOf = (race: RaceTemplate) => presets[race.distanceCategory].raceBonus
  const tracker = plan?.tracker
  const current = tracker?.stages.find((stage) => stage.state === 'current')

  return (
    <div data-place-page="racecourse" className="pb-6">
      {header}
      <PurseHeader bar={bar} featured={featured} />
      {filter}
      <div className="pt-3"><Strip tiles={strip} selected={uma.outfitId} onPick={chooseUma} /></div>
      <div className="flex flex-col gap-3 px-3 pt-3">
        {tracker && (
          <p className="text-[13px] font-semibold text-ink-soft" data-career>
            {tracker.complete ? racingWords('career-complete') : current ? racingWords('career-stage', { stage: current.label, won: current.won, total: current.total }) : null}
          </p>
        )}
        {featured.cards.length > 0 && (
          <section aria-label={racingWords('featured')} className="flex flex-col gap-2" data-g2="featured">
            <SectionHeading label={racingWords('featured')} />
            {featured.cards.map((card) => (
              <RaceCard
                key={card.race.id}
                race={card.race}
                raceBonus={bonusOf(card.race)}
                ribbon={{ text: card.paid ? racingWords('bonus-paid') : racingWords('featured-bonus', { n: amount(card.bonus) }), paid: card.paid }}
                onPick={() => pick(card.race.id)}
              />
            ))}
          </section>
        )}
        <section aria-label={racingWords('next-up')} className="flex flex-col gap-2" data-g2="next-up">
          <SectionHeading label={racingWords('next-up')} hint={plan ? String(plan.nextUp.length) : undefined} />
          {plan?.nextUp.map((entry: PlannedRace) => (
            <RaceCard key={entry.race.id} race={entry.race} marks={entry.marks} raced={entry.raced} raceBonus={bonusOf(entry.race)} onPick={() => pick(entry.race.id)} />
          ))}
          {plan?.nextUp.length === 0 && <p className="text-[13px] text-ink-soft">{racingWords('nothing-fits')}</p>}
        </section>
        {plan && plan.won.length > 0 && (
          <Collapsible label={racingWords('won-here')} count={plan.won.length}>
            <div className="grid grid-cols-1 gap-2">
              {plan.won.map((entry) => <RaceCard key={entry.race.id} race={entry.race} marks={entry.marks} raced={entry.raced} raceBonus={bonusOf(entry.race)} onPick={() => pick(entry.race.id)} />)}
            </div>
          </Collapsible>
        )}
        {plan && (
          <Collapsible label={racingWords('every-race')} count={plan.all.length}>
            <div className="grid grid-cols-1 gap-2">
              {plan.all.map((entry) => <RaceCard key={entry.race.id} race={entry.race} marks={entry.marks} raced={entry.raced} raceBonus={bonusOf(entry.race)} onPick={() => pick(entry.race.id)} />)}
            </div>
          </Collapsible>
        )}
      </div>
      <BottomSheet open={picked !== null} onClose={() => pick(null)} label={picked?.name}>
        {picked && <PreRaceSheet key={`${uma.outfitId}:${picked.id}`} race={picked} uma={uma} content={content} derived={presets[picked.distanceCategory]} records={records} onClose={() => pick(null)} />}
      </BottomSheet>
    </div>
  )
}
