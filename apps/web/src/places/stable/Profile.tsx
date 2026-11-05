// An Uma's profile (docs/game/11-hub-and-places.md §3.1; D386), `/town/stable/outfit/:umaId`, in uma-kit's profile
// frame: her bust, name and outfit; her career (the one in progress with a link to it, or **Start career**, which
// commits `start-career` for URA Finale, T = 1, and opens it); her racing builds, one per completed career, each the
// five stats, her aptitudes and her skills; and her template's aptitudes and growth rates. A locked Uma shows the
// unlock sheet's button instead of a career.
import { UmaBust } from '@luismlorenzana/uma-kit/album'
import { ProfileFrame } from '@luismlorenzana/uma-kit/places'
import { Button, ChevronRightIcon, Panel, TrophyIcon, UiMark } from '@luismlorenzana/uma-kit/ui'
import { careerSeasonLine, hubWords, nextObjective, type Place } from '@racer/domain/hub'
import { careerId as careerIdOf } from '@racer/domain/save'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useGame, useRun } from '../../app/game'
import { careerPath } from '../../hub/nav'
import { AptitudeGrid, GrowthRow, SkillNames, StatRow } from '../../ui/BuildFacts'
import { PlacePageHeader } from '../PlacePageHeader'
import { racingBuilds, runningCareer, stableWords } from './model'
import { UnlockSheet } from './UnlockSheet'

/** The T this release's careers run in: URA Finale. */
const URA_FINALE = 1

function CareerPanel({ umaId, owned, onUnlock }: { umaId: string; owned: boolean; onUnlock: () => void }) {
  const run = useRun()
  const navigate = useNavigate()
  const careers = useGame((snapshot) => snapshot.state?.careers ?? {})
  const races = useGame((snapshot) => snapshot.env?.content.races ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!owned) {
    return (
      <Button className="w-full" onClick={onUnlock}>
        <span className="flex items-center justify-center gap-1.5"><UiMark mark="currency/uma-ticket" />{stableWords('unlock')}</span>
      </Button>
    )
  }
  const running = runningCareer(umaId, careers)
  if (running !== null) {
    const next = nextObjective(running.career)
    const race = next === null ? null : races.find((each) => each.id === next.raceId)
    return (
      <Panel className="space-y-1 p-3" aria-label={stableWords('career')} data-racer="profile-career">
        <h3 className="text-micro">{stableWords('career')}</h3>
        <p className="font-display text-[15px] font-semibold">{careerSeasonLine(running.career)}</p>
        <p className="text-[13px] text-ink-soft">{next === null ? hubWords('next-finale') : hubWords('next-objective', { race: race?.name ?? next.raceId })}</p>
        <Link to={careerPath(running.id)} state={{ back: true }}
          className="mt-1 flex min-h-11 items-center justify-between rounded-sm bg-accent px-3 font-semibold text-accent-ink">
          {stableWords('open-career')}
          <ChevronRightIcon size={20} />
        </Link>
      </Panel>
    )
  }
  if (careers[careerIdOf(umaId, URA_FINALE)] !== undefined) {
    return <p className="rounded-md bg-sunken p-3 text-[13px] text-ink-soft">{stableWords('finished-all')}</p>
  }
  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      const answer = await run<{ careerId: string }>('start-career', { umaId, T: URA_FINALE }, `start-career:${umaId}`)
      if (answer.kind === 'done') navigate(careerPath(answer.receipt.careerId), { state: { back: true } })
      else setError(answer.text)
    } catch {
      setError(stableWords('start-failed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-1.5" data-racer="profile-start">
      <Button className="w-full" disabled={busy} onClick={() => void start()}>{stableWords('start-career')}</Button>
      <p className="text-[12px] text-ink-soft">{stableWords('start-note')}</p>
      {error !== null && <p role="alert" className="text-[13px] text-danger">{error}</p>}
    </div>
  )
}

export function Profile({ place, rest, umaId }: { place: Place; rest: string; umaId: string }) {
  const uma = useGame((snapshot) => snapshot.env?.content.umas.get(umaId))
  const skills = useGame((snapshot) => snapshot.env?.content.skills ?? null)
  const owned = useGame((snapshot) => snapshot.state?.umas[umaId] !== undefined)
  const careers = useGame((snapshot) => snapshot.state?.careers ?? {})
  const [unlocking, setUnlocking] = useState(false)
  const name = uma?.name ?? umaId
  const builds = racingBuilds(umaId, careers)

  return (
    <div data-place-page="stable" data-racer="profile" data-uma={umaId}>
      <PlacePageHeader place={place} rest={rest} />
      {uma === undefined ? (
        <p className="px-4 py-6 text-[14px] text-ink-soft">{stableWords('unknown-uma')}</p>
      ) : (
        <ProfileFrame
          portrait={<UmaBust outfitId={umaId} label={name} size={112} locked={!owned} className="size-full" />}
          name={name}
          title={uma.outfit}
          locked={!owned}
          lockedLabel={stableWords('profile-locked')}
          summary={<CareerPanel umaId={umaId} owned={owned} onUnlock={() => setUnlocking(true)} />}
        >
          <section className="space-y-2" aria-label={stableWords('racing-builds')}>
            <h3 className="font-display text-[15px] font-semibold">{stableWords('racing-builds')}</h3>
            {builds.length === 0 && <p className="text-[13px] text-ink-soft">{stableWords('no-builds')}</p>}
            {builds.map(({ careerId, scenario, build }) => (
              <Panel key={careerId} className="space-y-3 p-3" data-racer="racing-build" data-career={careerId}>
                <p className="flex items-center gap-1.5 font-display text-[15px] font-semibold">
                  <TrophyIcon size={20} className="text-tier-gold" />{scenario}
                </p>
                <StatRow stats={build.stats} />
                <AptitudeGrid aptitudes={build.aptitudes} />
                <SkillNames ids={build.skills} skills={skills} empty={stableWords('no-skills')} />
              </Panel>
            ))}
          </section>
          <section className="space-y-2" aria-label={stableWords('template')}>
            <h3 className="font-display text-[15px] font-semibold">{stableWords('template')}</h3>
            <Panel className="space-y-3 p-3">
              <AptitudeGrid aptitudes={uma.aptitudes} />
              <GrowthRow growth={uma.growthRates} />
            </Panel>
          </section>
        </ProfileFrame>
      )}
      <UnlockSheet umaId={unlocking ? umaId : null} onClose={() => setUnlocking(false)} onProfile={() => setUnlocking(false)} />
    </div>
  )
}
