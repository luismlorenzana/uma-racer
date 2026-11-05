// The Careers quick look (docs/game/11-hub-and-places.md §2.6; D386): the careers in progress, the latest started first,
// each with where she stands and her next objective, a tap opening it; or how to start one.
import { hubWords } from '@racer/domain/hub'
import { useGame } from '../../app/game'
import { careerPath } from '../../hub/nav'
import { CareerRowLink } from './CareerRowLink'
import { careerRows } from './model'

const SHOWN = 3

export default function CareersPeek() {
  const careers = useGame((snapshot) => snapshot.state?.careers ?? {})
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const { running } = careerRows(careers, content?.umas ?? new Map(), content?.races ?? [])
  return (
    <div className="space-y-2 py-2" data-racer="careers-peek">
      <h3 className="text-micro">{hubWords('peek-careers')}</h3>
      {running.length === 0
        ? <p className="text-[14px] text-ink-soft">{hubWords('peek-no-careers')}</p>
        : running.slice(0, SHOWN).map((row) => <CareerRowLink key={row.id} row={row} to={careerPath(row.id)} />)}
    </div>
  )
}
