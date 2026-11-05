// The calendar strip (D387): the twelve seasons and the Finale in one row, the current season raised in the accent,
// finished ones checked, and each objective marked on its season by its grade (in the success ink once won). Years are
// named under their four seasons. Nothing on it is a tap target: the season card below is the season.
import { CheckIcon, TrophyIcon } from '@luismlorenzana/uma-kit/ui'
import type { RaceTemplate } from '@racer/domain'
import { seasonName, YEARS } from '@racer/domain/career'
import { FINALE_SEASON, type CareerRecord } from '@racer/domain/save'
import { calendarCells, careersWords, cellLabel, GRADE_LABEL, type CalendarCell } from './model'

function Cell({ cell, races }: { cell: CalendarCell; races: readonly RaceTemplate[] }) {
  const finale = cell.season === FINALE_SEASON
  const tone = cell.state === 'now' ? 'bg-accent text-accent-ink shadow-1' : cell.state === 'done' ? 'bg-sunken text-ink-soft' : 'bg-panel text-ink'
  return (
    <li
      aria-label={cellLabel(cell, races)}
      aria-current={cell.state === 'now' ? 'step' : undefined}
      data-season={cell.season}
      data-state={cell.state}
      className={`flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xs border border-hairline ${tone}`}
    >
      <span aria-hidden className="flex h-4 items-center">
        {finale
          ? <TrophyIcon size={16} className={cell.state === 'now' ? '' : 'text-tier-gold'} />
          : cell.state === 'done' && cell.objectives.length === 0 ? <CheckIcon size={16} className="text-success" /> : null}
      </span>
      <span aria-hidden className="flex flex-col items-center leading-none">
        {cell.objectives.map((objective) => (
          <span key={objective.raceId} data-objective-mark={objective.raceId}
            className={`text-[11px] font-bold ${objective.won ? (cell.state === 'now' ? '' : 'text-success') : ''}`}>
            {objective.grade === null ? '•' : GRADE_LABEL[objective.grade]}
          </span>
        ))}
      </span>
    </li>
  )
}

export function CalendarStrip({ career, races }: { career: Pick<CareerRecord, 'season' | 'objectives' | 'completedAt'>; races: readonly RaceTemplate[] }) {
  const cells = calendarCells(career, races)
  return (
    <section aria-label={careersWords('calendar')} data-racer="calendar">
      <ol className="grid grid-cols-[repeat(12,minmax(0,1fr))_1.4fr] gap-0.5">
        {cells.map((cell) => <Cell key={cell.season} cell={cell} races={races} />)}
      </ol>
      <div aria-hidden className="mt-0.5 grid grid-cols-[repeat(12,minmax(0,1fr))_1.4fr] gap-0.5 text-[11px] font-semibold text-ink-soft">
        {YEARS.map((year) => <span key={year} className="col-span-4 border-t border-hairline-strong pt-0.5 text-center">{year}</span>)}
        <span className="border-t border-tier-gold pt-0.5 text-center">{seasonName(FINALE_SEASON)}</span>
      </div>
    </section>
  )
}
