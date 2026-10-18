// The Racing page's Peeks (docs/game/11-hub-and-places.md §1, §3.3; T141): the Scenario Gate's (the featured Uma's
// goals in progress and the Umas ready to advance), the Expedition Map's (how many could start an Expedition) and the
// Trophy Hall's (recent flair). The Racecourse is `direct` and has none: its header carries what a Peek would.
import { Link } from 'react-router'
import { useGame, useHub } from '../../app/game'
import { UmaBust } from './UmaBust'
import { useRaceContent } from './content'
import { careerRow, careerRows, mapRows } from './gate'
import { useRecords } from './records'
import { recentFlair } from './trophy'
import { racingWords } from './words'

export function GatePeek() {
  const state = useGame((snapshot) => snapshot.state)
  const content = useRaceContent()
  const hub = useHub()
  if (!state || !content) return null
  const name = (umaId: string) => content.umas.byId.get(umaId)?.name ?? umaId
  const race = (raceId: string) => content.races.byId.get(raceId)?.name ?? raceId
  const featured = hub?.featured ? state.umas[hub.featured] : undefined
  const row = featured ? careerRow(featured, name, race) : null
  const ready = careerRows(state, name, race).filter((entry) => entry.ready)
  return (
    <div className="flex flex-col gap-3 py-1" data-g2="gate-peek">
      {row && (
        <div>
          <p className="font-display text-[13px] font-semibold">{racingWords('in-progress')} · {row.name}</p>
          <p className="text-[12px] text-ink-soft">{row.stage}</p>
          <ul className="mt-1 grid gap-0.5">
            {row.goals.filter((goal) => !goal.won).slice(0, 3).map((goal) => <li key={`${goal.raceId}:${goal.set ?? ''}`} className="truncate text-[13px]">{goal.name}</li>)}
          </ul>
        </div>
      )}
      {ready.length > 0 && (
        <div>
          <p className="font-display text-[13px] font-semibold">{racingWords('ready-to-advance')}</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {ready.map((entry) => (
              <li key={entry.umaId}>
                <Link to={`/racing/scenario-gate/${encodeURIComponent(entry.umaId)}?sheet=advance`} state={{ back: true }} className="flex min-h-11 items-center gap-2 rounded-full border border-accent bg-accent-wash pr-3 pl-1 text-[13px] font-semibold">
                  <UmaBust outfitId={entry.umaId} size={32} />{entry.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function MapPeek() {
  const state = useGame((snapshot) => snapshot.state)
  const env = useGame((snapshot) => snapshot.env)
  if (!state || !env) return null
  const ready = mapRows(state, (umaId) => umaId, env).filter((row) => row.ready).length
  return (
    <p className="py-2 text-[13px] text-ink" data-g2="map-peek">
      {ready > 0 ? racingWords('map-peek-ready', { n: ready }) : racingWords('map-peek-none')}
    </p>
  )
}

export function TrophyPeek() {
  const records = useRecords()
  const content = useRaceContent()
  if (!content || !records) return null
  const recent = recentFlair(content, records, 5)
  if (recent.length === 0) return <p className="py-2 text-[13px] text-ink-soft">{racingWords('no-flair')}</p>
  return (
    <ul className="grid gap-1 py-1" aria-label={racingWords('recent-flair')} data-g2="trophy-peek">
      {recent.map((entry) => (
        <li key={entry.id} className="flex min-h-9 items-center gap-2 rounded-sm bg-sunken px-3 text-[13px]">
          <span className="min-w-0 flex-1 truncate font-semibold">{entry.label}</span>
          <span className="shrink-0 text-[11px] text-ink-soft">{entry.owner}</span>
        </li>
      ))}
    </ul>
  )
}
