// The Careers place (docs/game/11-hub-and-places.md §3.2; D386), the shell T158 fills: `/career/careers` lists the
// careers in progress (a tap opens one) and the completed ones (a tap opens her profile's racing build);
// `/career/careers/:careerId` shows one career's Uma, where she stands and her objectives, with the season screens
// coming next. A career starts from her profile in the Stable.
import { UmaBust } from '@luismlorenzana/uma-kit/album'
import { CheckIcon, Panel } from '@luismlorenzana/uma-kit/ui'
import { careerSeasonLine, type Place } from '@racer/domain/hub'
import { Link } from 'react-router'
import { useGame } from '../../app/game'
import { careerPath, profilePath, stablePath } from '../../hub/nav'
import { PlacePageHeader } from '../PlacePageHeader'
import type { PageProps } from '../registry'
import { CareerRowLink } from './CareerRowLink'
import { careerRows, careersWords, objectiveSeason, raceLabel } from './model'

function Careers({ place }: { place: Place }) {
  const careers = useGame((snapshot) => snapshot.state?.careers ?? {})
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const { running, completed } = careerRows(careers, content?.umas ?? new Map(), content?.races ?? [])
  return (
    <div data-place-page="careers" data-racer="careers">
      <PlacePageHeader place={place} lines={[careersWords('about-careers'), careersWords('about-next')]} />
      <div className="space-y-4 px-4 py-3">
        <section className="space-y-2" aria-label={careersWords('in-progress')}>
          <h2 className="font-display text-[15px] font-semibold">{careersWords('in-progress')}</h2>
          {running.length === 0 ? (
            <div className="space-y-3 rounded-md border border-hairline bg-panel p-4 text-center" data-racer="careers-empty">
              <p className="text-[14px] text-ink-soft">{careersWords('none-running')}</p>
              <Link to={stablePath('owned')} state={{ back: true }}
                className="inline-flex min-h-11 items-center rounded-sm bg-accent px-4 font-semibold text-accent-ink">
                {careersWords('to-stable')}
              </Link>
            </div>
          ) : running.map((row) => <CareerRowLink key={row.id} row={row} to={careerPath(row.id)} />)}
        </section>
        {completed.length > 0 && (
          <section className="space-y-2" aria-label={careersWords('completed')}>
            <h2 className="font-display text-[15px] font-semibold">{careersWords('completed')}</h2>
            {completed.map((row) => <CareerRowLink key={row.id} row={row} to={profilePath(row.umaId)} />)}
          </section>
        )}
      </div>
    </div>
  )
}

function Career({ place, rest, careerId }: { place: Place; rest: string; careerId: string }) {
  const career = useGame((snapshot) => snapshot.state?.careers[careerId])
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const name = career === undefined ? careerId : content?.umas.get(career.umaId)?.name ?? career.umaId
  return (
    <div data-place-page="careers" data-racer="career" data-career={careerId}>
      <PlacePageHeader place={place} rest={rest} title={name} />
      {career === undefined ? (
        <p className="px-4 py-6 text-[14px] text-ink-soft">{careersWords('unknown-career')}</p>
      ) : (
        <div className="space-y-4 px-4 py-3">
          <section className="flex items-end gap-3">
            <Link to={profilePath(career.umaId)} state={{ back: true }} aria-label={name}
              className="block size-24 shrink-0 overflow-hidden rounded-md bg-sunken">
              <UmaBust outfitId={career.umaId} label={name} size={96} className="size-full" />
            </Link>
            <div className="min-w-0 pb-1">
              <h2 className="text-lg leading-tight">{name}</h2>
              <p className="text-[13px] text-ink-soft">{careerSeasonLine(career)}</p>
            </div>
          </section>
          <section className="space-y-2" aria-label={careersWords('objectives')}>
            <h3 className="font-display text-[15px] font-semibold">{careersWords('objectives')}</h3>
            <ul className="divide-y divide-hairline rounded-md border border-hairline bg-panel">
              {[...career.objectives].sort((a, b) => a.season - b.season).map((objective) => (
                <li key={objective.raceId} className="flex min-h-12 items-center gap-2 px-3 text-[14px]" data-objective={objective.raceId} data-status={objective.status}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{raceLabel(objective.raceId, content?.races ?? [])}</span>
                    <span className="block text-[12px] text-ink-soft">{objectiveSeason(objective.season)}</span>
                  </span>
                  {objective.status === 'won'
                    ? <span className="flex items-center gap-1 text-[13px] font-semibold text-success"><CheckIcon size={16} />{careersWords('won')}</span>
                    : <span className="text-[13px] text-ink-soft">{careersWords('open')}</span>}
                </li>
              ))}
            </ul>
          </section>
          <Panel className="p-3 text-center" data-racer="not-ready">
            <p className="font-display text-[15px] font-semibold text-ink-soft">{careersWords('season-screens')}</p>
          </Panel>
        </div>
      )}
    </div>
  )
}

export default function CareersPage({ place, rest }: PageProps) {
  if (rest === '') return <Careers place={place} />
  // The router hands `rest` decoded: a career's id, `{umaId}:{T}`.
  return <Career key={rest} place={place} rest={rest} careerId={rest} />
}
