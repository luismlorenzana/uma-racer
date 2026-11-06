// The season's Play (docs/game/11-hub-and-places.md §8; D387, D391): every game the season offers (`seasonStages`, in
// `CAREER_GAMES`' order), the main one as the big Play step and each other under "Another game" as a smaller row, each
// a link to its play with Resume while one is open on this phone, or its grade once played, and the one "Pays at A"
// line every game shares. Either game played checks the step, since each pays the same. One component, so a later
// season card (T162) can move it as a whole.
import { CardsIcon, PlayIcon } from '@luismlorenzana/uma-kit/ui'
import type { RaceTemplate } from '@racer/domain'
import { STAGE_PAY_AT_A, type SeasonStage } from '@racer/domain/career'
import { FINALE_SEASON } from '@racer/domain/save'
import { STAGE_NAMES, type StageGrade } from '@racer/domain/stages'
import { Link } from 'react-router'
import { playPath } from '../../hub/nav'
import { STAT_LABEL } from '../../ui/labels'
import { TypeIcon } from '../../ui/TypeIcon'
import { careersWords } from './model'
import { useSeasonPlays } from './plays'
import { stepFrame, StepHead, usePlayOpen, type StepState } from './steps'

/** What a game plays this season, in a line. */
function stageLine(stage: SeasonStage, season: number, races: readonly RaceTemplate[]): string {
  if (stage.game === 'training-yard') return careersWords('play-yard', { stat: STAT_LABEL[stage.focus] })
  if (season === FINALE_SEASON) return careersWords('play-finale')
  const race = stage.raceId === null ? undefined : races.find((each) => each.id === stage.raceId)
  return race === undefined ? careersWords('play-furlong') : `${STAGE_NAMES['furlong-hand']} · ${race.name}`
}

const stageIcon = (stage: SeasonStage, size: 20 | 24) =>
  (stage.game === 'training-yard' ? <TypeIcon type={stage.focus} size={size} /> : <CardsIcon size={size} />)

/** Resume, the grade once played, or nothing. */
function Mark({ open, grade }: { open: boolean; grade: StageGrade | undefined }) {
  if (open) return <span className="rounded-full bg-accent px-2.5 py-1 text-[12px] font-bold text-accent-ink">{careersWords('resume')}</span>
  if (grade !== undefined) return <span className="rounded-full bg-sunken px-2.5 py-1 text-[12px] font-bold" data-grade={grade}>{careersWords('played', { grade })}</span>
  return null
}

const status = (open: boolean, grade: StageGrade | undefined): string =>
  (open ? `, ${careersWords('resume')}` : grade !== undefined ? `, ${careersWords('played', { grade })}` : '')

/** The main game: the season's big Play step, checked once any of the season's games is played. */
function MainGame({ careerId, stage, line, state, grade, played }: {
  careerId: string; stage: SeasonStage; line: string; state: StepState; grade: StageGrade | undefined; played: boolean
}) {
  const open = usePlayOpen(careerId, stage.game)
  const done = played && !open
  const shown: StepState = done ? 'done' : state
  return (
    <Link to={playPath(careerId, stage.game)} state={{ back: true }} className={stepFrame(shown)} data-step="play" data-game={stage.game}
      data-state={shown} aria-label={`${careersWords('step-play')}: ${line}${status(open, grade)}`}>
      <StepHead n={1} state={shown} icon={stageIcon(stage, 24)} title={careersWords('step-play')} line={line}
        end={open || done ? <Mark open={open} grade={grade} /> : <PlayIcon size={20} variant="solid" className="text-accent-strong" />} />
    </Link>
  )
}

/** Another game: a smaller row under the Play step, paying the same. */
function OtherGame({ careerId, stage, line, grade }: { careerId: string; stage: SeasonStage; line: string; grade: StageGrade | undefined }) {
  const open = usePlayOpen(careerId, stage.game)
  const label = careersWords('another-game', { game: line })
  return (
    <Link to={playPath(careerId, stage.game)} state={{ back: true }} data-racer="other-game" data-game={stage.game}
      aria-label={`${label}${status(open, grade)}`}
      className="flex min-h-11 items-center gap-2 rounded-sm px-2 text-[13px] text-ink-soft active:bg-sunken">
      <span aria-hidden className="shrink-0">{stageIcon(stage, 20)}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Mark open={open} grade={grade} />
    </Link>
  )
}

/** The season's games: the main one as Play, the others under it, and their shared pay. */
export function SeasonGames({ careerId, season, stages, races, state }: {
  careerId: string; season: number; stages: readonly SeasonStage[]; races: readonly RaceTemplate[]; state: StepState
}) {
  const plays = useSeasonPlays(careerId, season)
  const [main, ...others] = stages
  if (main === undefined) return null
  return (
    <div className="space-y-0.5" data-racer="season-games">
      <MainGame careerId={careerId} stage={main} line={stageLine(main, season, races)} state={state} grade={plays[main.game]}
        played={stages.some((stage) => plays[stage.game] !== undefined)} />
      {others.map((stage) => (
        <OtherGame key={stage.game} careerId={careerId} stage={stage} line={stageLine(stage, season, races)} grade={plays[stage.game]} />
      ))}
      <p className="px-2 text-[12px] text-ink-faint" data-racer="pays-at-a">
        {careersWords(others.length > 0 ? 'each-pays-at-a' : 'pays-at-a', { drills: STAGE_PAY_AT_A.drills, bond: STAGE_PAY_AT_A.bond, sp: STAGE_PAY_AT_A.sp })}
      </p>
    </div>
  )
}
