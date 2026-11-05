// Every career (docs/game/11-hub-and-places.md §3.2; D386, D387), `/career/careers`: **Start a career** (the kit's
// `UmaPicker` over the owned Umas free to start one, then one sheet with her bust and the objectives she will race,
// committing `start-career` for URA Finale and opening it), the careers in progress (a tap opens one), and the
// completed ones (a tap opens her profile's racing build).
import { UmaBust, UmaPicker, type UmaPickerRow } from '@luismlorenzana/uma-kit/album'
import { Button, PlusIcon, Sheet } from '@luismlorenzana/uma-kit/ui'
import type { UmaTemplate } from '@racer/domain'
import { newCareer, seasonName } from '@racer/domain/career'
import type { Place } from '@racer/domain/hub'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useGame, useRun } from '../../app/game'
import { careerPath, profilePath, stablePath } from '../../hub/nav'
import { PlacePageHeader } from '../PlacePageHeader'
import { CareerRowLink } from './CareerRowLink'
import { careerRows, careersWords, freeUmas, GRADE_LABEL, START_T } from './model'

const pickerRow = (uma: UmaTemplate): UmaPickerRow => ({
  id: uma.id, name: uma.name, releasedAt: uma.jpRelease, level: 1, search: uma.name.toLowerCase(), facets: {}, sorts: {},
})

/** The confirm sheet: her bust, and the objectives `start-career` will freeze, before it does. */
function StartSheet({ uma, onClose }: { uma: UmaTemplate | null; onClose: () => void }) {
  const run = useRun()
  const navigate = useNavigate()
  const races = useGame((snapshot) => snapshot.env?.content.races ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The same pure generator the operation runs: the objectives shown are the ones she gets.
  const objectives = useMemo(() => {
    if (uma === null) return []
    try {
      return newCareer(uma, START_T, races, 0).objectives
    } catch {
      return []
    }
  }, [races, uma])
  const start = async () => {
    if (uma === null) return
    setBusy(true)
    setError(null)
    try {
      const answer = await run<{ careerId: string }>('start-career', { umaId: uma.id, T: START_T }, `start-career:${uma.id}`)
      if (answer.kind === 'done') {
        onClose()
        navigate(careerPath(answer.receipt.careerId), { state: { back: true } })
      } else setError(answer.text)
    } catch {
      setError(careersWords('start-failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={uma !== null} onClose={onClose} title={uma?.name ?? ''}
      footer={(
        <div className="space-y-1.5">
          {error !== null && <p role="alert" className="text-[13px] text-danger">{error}</p>}
          <Button size="lg" className="w-full" disabled={busy} onClick={() => void start()} data-racer="start-confirm">{careersWords('start-confirm')}</Button>
        </div>
      )}>
      {uma !== null && (
        <div className="space-y-3" data-racer="start-sheet" data-uma={uma.id}>
          <div className="flex items-center gap-3">
            <span className="block size-20 shrink-0 overflow-hidden rounded-md bg-sunken"><UmaBust outfitId={uma.id} label={uma.name} size={80} className="size-full" /></span>
            <p className="text-[14px] text-ink-soft">{careersWords('start-note')}</p>
          </div>
          <ul className="divide-y divide-hairline rounded-md border border-hairline" aria-label={careersWords('objectives')}>
            {objectives.map((objective) => {
              const race = races.find((each) => each.id === objective.raceId)
              return (
                <li key={objective.raceId} className="flex min-h-11 items-center gap-2 px-3 text-[14px]" data-objective={objective.raceId}>
                  <span className="w-9 shrink-0 rounded-full bg-accent-wash py-0.5 text-center text-[12px] font-bold">{race === undefined ? '' : GRADE_LABEL[race.grade]}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{race?.name ?? objective.raceId}</span>
                  <span className="shrink-0 text-[12px] text-ink-soft">{seasonName(objective.season)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Sheet>
  )
}

export function Careers({ place }: { place: Place }) {
  const state = useGame((snapshot) => snapshot.state)
  const content = useGame((snapshot) => snapshot.env?.content ?? null)
  const careers = state?.careers ?? {}
  const { running, completed } = careerRows(careers, content?.umas ?? new Map(), content?.races ?? [])
  const free = useMemo(() => (state === null || content === null ? [] : freeUmas(state, content.umas)), [content, state])
  const [picking, setPicking] = useState(false)
  const [picked, setPicked] = useState<UmaTemplate | null>(null)
  const rows = useMemo(() => free.map(pickerRow), [free])
  return (
    <div data-place-page="careers" data-racer="careers">
      <PlacePageHeader place={place} lines={[careersWords('about-careers'), careersWords('about-season')]} />
      <div className="space-y-4 px-4 py-3">
        {free.length > 0 ? (
          <Button size="lg" className="w-full" onClick={() => setPicking(true)} data-racer="start-career">
            <span className="flex items-center justify-center gap-1.5"><PlusIcon size={20} />{careersWords('start-career')}</span>
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border border-hairline bg-panel p-4 text-center" data-racer="careers-empty">
            <p className="text-[14px] text-ink-soft">{careersWords(Object.keys(state?.umas ?? {}).length === 0 ? 'no-umas' : 'pick-none')}</p>
            <Link to={stablePath('locked')} state={{ back: true }}
              className="inline-flex min-h-11 items-center rounded-sm bg-accent px-4 font-semibold text-accent-ink">
              {careersWords('to-stable')}
            </Link>
          </div>
        )}
        <section className="space-y-2" aria-label={careersWords('in-progress')}>
          <h2 className="font-display text-[15px] font-semibold">{careersWords('in-progress')}</h2>
          {running.length === 0
            ? <p className="text-[14px] text-ink-soft">{careersWords('none-running')}</p>
            : running.map((row) => <CareerRowLink key={row.id} row={row} to={careerPath(row.id)} />)}
        </section>
        {completed.length > 0 && (
          <section className="space-y-2" aria-label={careersWords('completed')}>
            <h2 className="font-display text-[15px] font-semibold">{careersWords('completed')}</h2>
            {completed.map((row) => <CareerRowLink key={row.id} row={row} to={profilePath(row.umaId)} />)}
          </section>
        )}
      </div>
      <UmaPicker
        open={picking}
        rows={rows}
        title={careersWords('pick-title')}
        order={(a, b) => b.releasedAt.localeCompare(a.releasedAt) || a.name.localeCompare(b.name)}
        words={{ level: 'Release' }}
        onPick={(ids) => setPicked(free.find((uma) => uma.id === ids[0]) ?? null)}
        onClose={() => setPicking(false)}
      />
      <StartSheet uma={picked} onClose={() => setPicked(null)} />
    </div>
  )
}
