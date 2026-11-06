// A career's page (docs/game/11-hub-and-places.md §3.2; D387, D391), `/career/careers/:careerId`: her bust and where she
// stands, the wallet, the calendar strip, then the season card: **Play** (the season's games, `SeasonGames`: Furlong
// Hand as Play and Training Yard under "Another game", each paying the same, Resume while a play is open on this phone,
// checked with its grade once played), **Upgrade** (its badge counts what she can buy now) and
// **Race** (each objective with its grade, course and Race), and **Next season** once every objective is won. At the
// Finale the card is the URA Finals' prep heat and its three rounds, one at a time; once the final is won it is the
// completion. The header's two game buttons are Play again: either game at any time, paying like a first play.
import { UmaBust } from '@luismlorenzana/uma-kit/album'
import {
  Button, CardsIcon, CheckIcon, ChevronRightIcon, DirtIcon, LevelUpIcon, LockedIcon, Panel, RaceIcon, StatsIcon, TurfIcon,
} from '@luismlorenzana/uma-kit/ui'
import type { RaceTemplate } from '@racer/domain'
import { skillPoints } from '@racer/domain/build'
import {
  canAdvance, FINALE_FIELDS, FINALE_ROUND_NAMES, FINALE_ROUNDS, finaleRace, seasonName, seasonObjectives, seasonStages,
} from '@racer/domain/career'
import { careerSeasonLine, hubWords, nextObjective, type Place } from '@racer/domain/hub'
import { FINALE_SEASON, SEASONS, type CareerRecord } from '@racer/domain/save'
import { furlongRaceFor, STAGE_NAMES, type StageKind } from '@racer/domain/stages'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useGame, useRuntime } from '../../app/game'
import { playPath, profilePath, upgradePath, UPGRADE_TABS, type UpgradeTab } from '../../hub/nav'
import { DISTANCE_LABEL, SURFACE_LABEL } from '../../ui/labels'
import { PlacePageHeader } from '../PlacePageHeader'
import { CalendarStrip } from './CalendarStrip'
import { Completion } from './Completion'
import { buildView, careersWords, GRADE_LABEL, raceLabel, upgradeCounts, type UpgradeCounts } from './model'
import { useSeasonPlays } from './plays'
import { fieldGrade, RaceSheet, type RaceTarget } from './RaceSheet'
import { SeasonGames } from './SeasonGames'
import { stepFrame, StepHead, type StepState } from './steps'
import { Wallet } from './Wallet'

/** Her next open objective, or the URA Finals once every objective is won. */
function nextLine(career: CareerRecord, races: readonly RaceTemplate[]): string {
  const next = nextObjective(career)
  return next === null ? hubWords('next-finale') : hubWords('next-objective', { race: raceLabel(next.raceId, races) })
}

const GAME_ICON: Readonly<Record<StageKind, typeof StatsIcon>> = { 'training-yard': StatsIcon, 'furlong-hand': CardsIcon }

/** The header's Play again: both games, each a 44 pt link to its play. */
function GameButtons({ careerId }: { careerId: string }) {
  return (
    <div className="flex items-center" role="group" aria-label={careersWords('play-again')} data-racer="play-again">
      {(['training-yard', 'furlong-hand'] as const).map((kind) => {
        const Icon = GAME_ICON[kind]
        return (
          <Link key={kind} to={playPath(careerId, kind)} state={{ back: true }} aria-label={careersWords('play-game', { game: STAGE_NAMES[kind] })}
            data-game={kind} className="flex size-11 items-center justify-center rounded-full text-ink active:bg-sunken">
            <Icon size={24} />
          </Link>
        )
      })}
    </div>
  )
}

/** The tab Upgrade opens on: the first with something to buy, else the Tree. */
const firstTab = (counts: UpgradeCounts): UpgradeTab => UPGRADE_TABS.find((tab) => counts[tab] > 0) ?? 'tree'

function UpgradeStep({ careerId, counts, state }: { careerId: string; counts: UpgradeCounts; state: StepState }) {
  const line = counts.total > 0 ? careersWords('upgrade-count', { n: counts.total }) : careersWords('upgrade-none')
  return (
    <Link to={upgradePath(careerId, firstTab(counts))} state={{ back: true }} className={stepFrame(state)} data-step="upgrade" data-state={state}
      aria-label={`${careersWords('step-upgrade')}: ${line}`}>
      <StepHead n={2} state={state} icon={<LevelUpIcon size={24} />} title={careersWords('step-upgrade')} line={line}
        end={(
          <span className="flex items-center gap-1">
            {counts.total > 0 && <span className="numeral flex h-6 min-w-6 items-center justify-center rounded-full bg-danger px-1.5 text-[12px] font-bold text-ink-on-dark" data-racer="upgrade-badge">{counts.total}</span>}
            <ChevronRightIcon size={20} className="text-ink-faint" />
          </span>
        )} />
    </Link>
  )
}

/** A race's course in icons: surface, metres, venue. */
function CourseLine({ race }: { race: RaceTemplate }) {
  return (
    <span className="flex items-center gap-1 text-[12px] text-ink-soft">
      {race.surface === 'turf' ? <TurfIcon size={16} className="text-turf" title={SURFACE_LABEL.turf} /> : <DirtIcon size={16} className="text-dirt" title={SURFACE_LABEL.dirt} />}
      <span className="numeral" aria-label={`${race.distance} m, ${DISTANCE_LABEL[race.distanceCategory]}`}>{race.distance.toLocaleString('en-US')} m</span>
      <span className="truncate">· {race.venue}</span>
    </span>
  )
}

/** One race row in the Race step: its grade, name and course, and Race, or Won. */
function RaceRow({ id, round, grade, name, race, won, locked, onRace }: {
  id?: string; round?: number; grade: string; name: string; race: RaceTemplate | undefined; won: boolean; locked?: boolean; onRace: () => void
}) {
  return (
    <li className="flex min-h-14 items-center gap-2 py-1" data-season-race={id} data-round={round} data-status={won ? 'won' : locked ? 'locked' : 'open'}>
      <span className="w-9 shrink-0 rounded-full bg-accent-wash py-0.5 text-center text-[12px] font-bold">{grade}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{name}</span>
        {race !== undefined && <CourseLine race={race} />}
      </span>
      {won
        ? <span className="flex items-center gap-1 text-[13px] font-semibold text-success"><CheckIcon size={16} />{careersWords('won')}</span>
        : locked ? <LockedIcon size={20} className="text-ink-faint" title={careersWords('locked')} />
          : <Button size="sm" onClick={onRace} aria-label={careersWords('race-named', { race: name })}>{careersWords('race')}</Button>}
    </li>
  )
}

function SeasonCard({ careerId, career, counts, onRace }: { careerId: string; career: CareerRecord; counts: UpgradeCounts; onRace: (target: RaceTarget) => void }) {
  const { game } = useRuntime()
  const races = useGame((snapshot) => snapshot.env?.content.races ?? [])
  const uma = useGame((snapshot) => snapshot.env?.content.umas.get(career.umaId))
  const stages = useMemo(() => seasonStages(career, uma === undefined ? null : furlongRaceFor(career, uma, races)?.race.id ?? null), [career, uma, races])
  const objectives = seasonObjectives(career)
  const plays = useSeasonPlays(careerId, career.season)
  const played = stages.some((stage) => plays[stage.game] !== undefined)
  const allWon = objectives.every((objective) => objective.status === 'won')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The step lit as next: Play until played, then Race while an objective is open; in a season without one, Upgrade
  // while something is affordable; then Next season. Upgrade's badge speaks for itself in a racing season.
  const next: 'play' | 'upgrade' | 'race' | 'advance' = !played ? 'play'
    : !allWon ? 'race'
      : objectives.length === 0 && counts.total > 0 ? 'upgrade' : 'advance'
  const stepState = (step: typeof next, done = false): StepState => (done ? 'done' : next === step ? 'next' : 'open')
  const advance = async () => {
    setBusy(true)
    setError(null)
    try {
      const answer = await game.run('next-season', { careerId, season: career.season }, `next-season:${careerId}`)
      if (answer.kind === 'refused') setError(answer.text)
    } catch {
      setError(careersWords('advance-failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel className="space-y-2 p-3" data-racer="season-card" data-season={career.season}>
      <h2 className="flex items-center justify-between font-display text-lg font-bold">
        {seasonName(career.season)}
        <span className="text-[12px] font-semibold text-ink-soft">{careersWords('season', { n: career.season + 1, of: SEASONS })}</span>
      </h2>
      <SeasonGames careerId={careerId} season={career.season} stages={stages} races={races} state={stepState('play')} />
      <UpgradeStep careerId={careerId} counts={counts} state={stepState('upgrade')} />
      <div className={`${stepFrame(stepState('race', objectives.length > 0 && allWon))} flex-col items-stretch`} data-step="race" data-state={stepState('race', objectives.length > 0 && allWon)}>
        <StepHead n={3} state={stepState('race', objectives.length > 0 && allWon)} icon={<RaceIcon size={24} />} title={careersWords('step-race')}
          line={objectives.length === 0 ? careersWords('no-race') : `${objectives.filter((o) => o.status === 'won').length} / ${objectives.length} ${careersWords('won').toLowerCase()}`} />
        {objectives.length > 0 && (
          <ul className="divide-y divide-hairline pl-9">
            {objectives.map((objective) => {
              const race = races.find((each) => each.id === objective.raceId)
              return (
                <RaceRow key={objective.raceId} id={objective.raceId} grade={race === undefined ? '' : GRADE_LABEL[race.grade]} name={race?.name ?? objective.raceId}
                  race={race} won={objective.status === 'won'} onRace={() => onRace({ kind: 'objective', raceId: objective.raceId })} />
              )
            })}
          </ul>
        )}
      </div>
      <div className="space-y-1 pt-1">
        <Button size="lg" className="w-full" variant={next === 'advance' ? 'primary' : 'secondary'} disabled={!canAdvance(career) || busy} onClick={() => void advance()} data-racer="next-season">
          <span className="flex items-center justify-center gap-1.5">
            {career.season === SEASONS - 1 ? careersWords('to-finale') : careersWords('next-season')}<ChevronRightIcon size={20} />
          </span>
        </Button>
        {!canAdvance(career) && <p className="text-center text-[12px] text-ink-soft">{careersWords('win-first')}</p>}
        {error !== null && <p role="alert" className="text-center text-[13px] text-danger">{error}</p>}
      </div>
    </Panel>
  )
}

function FinaleCard({ careerId, career, counts, onRace }: { careerId: string; career: CareerRecord; counts: UpgradeCounts; onRace: (target: RaceTarget) => void }) {
  const env = useGame((snapshot) => snapshot.env)
  const uma = env?.content.umas.get(career.umaId)
  const race = useMemo(() => {
    if (env === null || uma === undefined) return null
    try {
      return finaleRace(uma, career, env.content.races)
    } catch {
      return null
    }
  }, [career, env, uma])
  const plays = useSeasonPlays(careerId, career.season)
  const played = plays['furlong-hand'] !== undefined
  if (race === null) return null
  const stages = seasonStages(career, race.id)
  const next = !played ? 'play' : 'race'
  return (
    <Panel className="space-y-2 p-3" data-racer="finale-card">
      <h2 className="font-display text-lg font-bold">{careersWords('finale')}</h2>
      <p className="text-[12px] text-ink-soft">{careersWords('finale-line')}</p>
      <SeasonGames careerId={careerId} season={career.season} stages={stages} races={env?.content.races ?? []} state={next === 'play' ? 'next' : 'open'} />
      <UpgradeStep careerId={careerId} counts={counts} state="open" />
      <div className={`${stepFrame(next === 'race' ? 'next' : 'open')} flex-col items-stretch`} data-step="race">
        <StepHead n={3} state={next === 'race' ? 'next' : 'open'} icon={<RaceIcon size={24} />} title={careersWords('step-race')} line={<CourseLine race={race} />} />
        <ol className="divide-y divide-hairline pl-9">
          {FINALE_ROUNDS.map((round, index) => (
            <RaceRow key={round} round={index} grade={fieldGrade({ kind: 'finale', ...FINALE_FIELDS[index]! })} name={FINALE_ROUND_NAMES[round]} race={undefined}
              won={career.finale.step > index} locked={career.finale.step < index} onRace={() => onRace({ kind: 'finale', round: index })} />
          ))}
        </ol>
      </div>
    </Panel>
  )
}

/** Every objective, in calendar order, with its season and Won or Open: the strip's marks in words. */
function Objectives({ career, races }: { career: CareerRecord; races: readonly RaceTemplate[] }) {
  return (
    <section className="space-y-2" aria-label={careersWords('objectives')} data-racer="objectives">
      <h3 className="font-display text-[15px] font-semibold">{careersWords('objectives')}</h3>
      <ul className="divide-y divide-hairline rounded-md border border-hairline bg-panel">
        {[...career.objectives].sort((a, b) => a.season - b.season).map((objective) => {
          const race = races.find((each) => each.id === objective.raceId)
          return (
            <li key={objective.raceId} className="flex min-h-12 items-center gap-2 px-3 text-[14px]" data-objective={objective.raceId} data-status={objective.status}>
              <span className="w-9 shrink-0 rounded-full bg-accent-wash py-0.5 text-center text-[12px] font-bold">{race === undefined ? '' : GRADE_LABEL[race.grade]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{race?.name ?? objective.raceId}</span>
                <span className="block text-[12px] text-ink-soft">{seasonName(objective.season)}</span>
              </span>
              {objective.status === 'won'
                ? <span className="flex items-center gap-1 text-[13px] font-semibold text-success"><CheckIcon size={16} />{careersWords('won')}</span>
                : <span className="text-[13px] text-ink-soft">{careersWords('open')}</span>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function CareerPage({ place, rest, careerId }: { place: Place; rest: string; careerId: string }) {
  const career = useGame((snapshot) => snapshot.state?.careers[careerId])
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  const [target, setTarget] = useState<RaceTarget | null>(null)
  const name = career === undefined ? careerId : env?.content.umas.get(career.umaId)?.name ?? career.umaId
  const counts = useMemo(
    () => (career === undefined || state === null || env === null ? null : upgradeCounts(career, state, env)),
    [career, env, state],
  )
  const sp = useMemo(() => {
    if (career === undefined || state === null || env === null) return 0
    const view = buildView(career, state, env)
    return view === null ? career.wallet.sp : skillPoints(career, view).available
  }, [career, env, state])
  const completed = career?.completedAt !== null && career !== undefined

  return (
    <div data-place-page="careers" data-racer="career" data-career={careerId} data-season={career?.season}>
      <PlacePageHeader place={place} rest={rest} title={name}
        lines={[careersWords('about-careers'), careersWords('about-season'), careersWords('about-replay')]}>
        {career !== undefined && <GameButtons careerId={careerId} />}
      </PlacePageHeader>
      {career === undefined || state === null || env === null || counts === null ? (
        <p className="px-4 py-6 text-[14px] text-ink-soft">{careersWords('unknown-career')}</p>
      ) : (
        <div className="space-y-3 px-4 py-3">
          <section className="flex items-center gap-3">
            <Link to={profilePath(career.umaId)} state={{ back: true }} aria-label={careersWords('her-profile')}
              className="block size-14 shrink-0 overflow-hidden rounded-md bg-sunken">
              <UmaBust outfitId={career.umaId} label={name} size={56} className="size-full" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[15px] font-semibold leading-tight">{careerSeasonLine(career)}</p>
              <p className="truncate text-[12px] text-ink-soft" data-racer="next-objective">
                {completed ? careersWords('complete') : nextLine(career, env.content.races)}
              </p>
            </div>
          </section>
          {!completed && <Wallet wallet={career.wallet} sp={sp} />}
          <CalendarStrip career={career} races={env.content.races} />
          {completed
            ? <Completion build={career.racingBuild} skills={env.content.skills} />
            : career.season === FINALE_SEASON
              ? <FinaleCard careerId={careerId} career={career} counts={counts} onRace={setTarget} />
              : <SeasonCard careerId={careerId} career={career} counts={counts} onRace={setTarget} />}
          {!completed && <Objectives career={career} races={env.content.races} />}
          {completed && (
            <Link to={profilePath(career.umaId)} state={{ back: true }}
              className="flex min-h-11 items-center justify-between rounded-sm border border-hairline bg-panel px-3 font-semibold">
              {careersWords('her-profile')}<ChevronRightIcon size={20} />
            </Link>
          )}
          <RaceSheet careerId={careerId} career={career} target={target} onClose={() => setTarget(null)} />
        </div>
      )}
    </div>
  )
}
