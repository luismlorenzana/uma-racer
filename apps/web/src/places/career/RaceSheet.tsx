// The race sheet (D387): one screen before a career race. The race (grade, surface, distance, venue), her racing build
// as the race reads it (her five stats, this race's surface and distance grades, her skills), her running style with
// her best by aptitude preselected (`bestStrategy`), and the field the race will meet: the same seeded draw the
// operation runs, so the faces shown are the faces she races. **Race** commits `run-race` (or `run-finale` for a URA
// Finals round) with the next attempt's number and opens the run.
import { FaceTile } from '@luismlorenzana/uma-kit/album'
import { Button, DirtIcon, Sheet, TurfIcon } from '@luismlorenzana/uma-kit/ui'
import { bestStrategy, STRATEGIES, type Strategy } from '@racer/domain'
import { deriveRacingBuild } from '@racer/domain/build'
import { FINALE_ROUND_NAMES, FINALE_ROUNDS, finaleRace, finaleSpec, objectiveSpec, prepareCareerRace, type RaceSpec } from '@racer/domain/career'
import type { CareerRecord } from '@racer/domain/save'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useGame, useRuntime } from '../../app/game'
import { racePath } from '../../hub/nav'
import { gradeTone, SkillNames, StatRow } from '../../ui/BuildFacts'
import { DistanceTypeIcon, RunningStyleIcon } from '../../ui/CardFocusIcons'
import { DISTANCE_LABEL, STYLE_LABEL, SURFACE_LABEL } from '../../ui/labels'
import { careersWords, GRADE_LABEL, nextAttempt } from './model'

/** Which race the sheet is for: one of the season's objectives, or the URA Finals' open round. */
export type RaceTarget = { readonly kind: 'objective'; readonly raceId: string } | { readonly kind: 'finale'; readonly round: number }

/** A round's field, as its grade reads: G2, G1, and the final's G1+. */
export const fieldGrade = (spec: Pick<RaceSpec, 'grade' | 'handicap' | 'kind'>): string =>
  `${GRADE_LABEL[spec.grade]}${spec.kind === 'finale' && spec.handicap !== undefined ? '+' : ''}`

export function RaceSheet({ careerId, career, target, onClose }: { careerId: string; career: CareerRecord; target: RaceTarget | null; onClose: () => void }) {
  const { game } = useRuntime()
  const navigate = useNavigate()
  const env = useGame((snapshot) => snapshot.env)
  const bonds = useGame((snapshot) => snapshot.state?.bonds ?? {})
  const uma = env?.content.umas.get(career.umaId)
  const open = target !== null && env !== null && uma !== undefined
  const [strategy, setStrategy] = useState<Strategy | null>(null)
  const [attempt, setAttempt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = target === null ? null : target.kind === 'objective' ? target.raceId : `finale:${target.round}`

  const race = useMemo(() => {
    if (target === null || env === null || uma === undefined) return null
    try {
      return target.kind === 'objective' ? env.content.races.find((each) => each.id === target.raceId) ?? null : finaleRace(uma, career, env.content.races)
    } catch {
      return null
    }
  }, [career, env, target, uma])
  const spec = useMemo((): RaceSpec | null => {
    if (target === null || race === null) return null
    if (target.kind === 'finale') return finaleSpec(race, target.round)
    const objective = career.objectives.find((each) => each.raceId === target.raceId)
    return objective === undefined ? null : objectiveSpec(objective, race)
  }, [career.objectives, race, target])

  // Each opening starts on her best style, and reads her runs of this race for the next attempt's number.
  useEffect(() => {
    if (key === null || uma === undefined || race === null) return
    setStrategy(bestStrategy(uma))
    setAttempt(null)
    setError(null)
    let live = true
    const kind = target!.kind
    void (game.logs?.raceResults(career.umaId) ?? Promise.resolve([]))
      .then((rows) => { if (live) setAttempt(nextAttempt(rows, careerId, kind, race.id)) })
      .catch(() => { if (live) setAttempt(0) })
    return () => {
      live = false
    }
    // The sheet reads the logs once per race it opens on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, race?.id])

  const build = useMemo(() => (env === null || uma === undefined ? null : deriveRacingBuild(career, uma, env.content.cards, bonds)), [bonds, career, env, uma])
  const chosen = strategy ?? (uma === undefined ? 'pace' : bestStrategy(uma))
  const field = useMemo(() => {
    if (spec === null || env === null || attempt === null) return null
    try {
      return prepareCareerRace(career, spec, { strategy: chosen, attempt }, bonds, env.content, env.contentVersion)
    } catch {
      return null
    }
  }, [attempt, bonds, career, chosen, env, spec])

  const go = async () => {
    if (target === null || attempt === null || busy || race === null) return
    setBusy(true)
    setError(null)
    try {
      const answer = target.kind === 'objective'
        ? await game.run('run-race', { careerId, raceId: race.id, attempt, strategy: chosen }, `race:${careerId}`)
        : await game.run('run-finale', { careerId, round: target.round, attempt, strategy: chosen }, `race:${careerId}`)
      if (answer.kind === 'done') {
        onClose()
        navigate(racePath(careerId, answer.id), { state: { back: true } })
      } else setError(answer.text)
    } catch {
      setError(careersWords('race-failed'))
    } finally {
      setBusy(false)
    }
  }

  const title = race === null ? '' : target?.kind === 'finale' ? FINALE_ROUND_NAMES[FINALE_ROUNDS[target.round]!] : race.name
  return (
    <Sheet
      open={open && race !== null && spec !== null}
      onClose={onClose}
      title={title}
      footer={(
        <div className="space-y-1.5">
          {error !== null && <p role="alert" className="text-[13px] text-danger">{error}</p>}
          <Button size="lg" className="w-full" disabled={busy || attempt === null} onClick={() => void go()} data-racer="race-go">
            {careersWords('race')}
          </Button>
        </div>
      )}
    >
      {race !== null && spec !== null && build !== null && uma !== undefined && (
        <div className="space-y-4" data-racer="race-sheet" data-race={race.id}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]" data-racer="race-course">
            <span className="rounded-full bg-accent-wash px-2 py-0.5 text-[12px] font-bold">{fieldGrade(spec)}</span>
            {race.surface === 'turf' ? <TurfIcon size={20} className="text-turf" title={SURFACE_LABEL.turf} /> : <DirtIcon size={20} className="text-dirt" title={SURFACE_LABEL.dirt} />}
            <span className="numeral font-semibold">{race.distance.toLocaleString('en-US')} m</span>
            <DistanceTypeIcon distance={race.distanceCategory} size={20} title={DISTANCE_LABEL[race.distanceCategory]} />
            <span className="text-ink-soft">{race.venue}</span>
            {spec.kind === 'finale' && <span className="w-full text-[12px] text-ink-soft">{race.name}</span>}
          </p>

          <section className="space-y-2" aria-label={careersWords('race-build')}>
            <h3 className="text-micro">{careersWords('race-build')}</h3>
            <StatRow stats={build.stats} />
            <ul className="flex gap-4 text-[14px]" aria-label="This race's aptitudes">
              <li className="flex items-center gap-1" aria-label={`${SURFACE_LABEL[race.surface]} ${build.aptitudes.surface[race.surface]}`}>
                {race.surface === 'turf' ? <TurfIcon size={20} className="text-turf" /> : <DirtIcon size={20} className="text-dirt" />}
                <span aria-hidden className={`font-display font-bold ${gradeTone(build.aptitudes.surface[race.surface])}`}>{build.aptitudes.surface[race.surface]}</span>
              </li>
              <li className="flex items-center gap-1" aria-label={`${DISTANCE_LABEL[race.distanceCategory]} ${build.aptitudes.distance[race.distanceCategory]}`}>
                <DistanceTypeIcon distance={race.distanceCategory} size={20} />
                <span aria-hidden className={`font-display font-bold ${gradeTone(build.aptitudes.distance[race.distanceCategory])}`}>{build.aptitudes.distance[race.distanceCategory]}</span>
              </li>
            </ul>
          </section>

          <section className="space-y-2" aria-label={careersWords('race-style')}>
            <h3 className="text-micro">{careersWords('race-style')}</h3>
            <div role="group" aria-label={careersWords('race-style')} className="grid grid-cols-4 gap-1.5">
              {STRATEGIES.map((style) => {
                const grade = build.aptitudes.strategy[style]
                return (
                  <button key={style} type="button" aria-pressed={chosen === style} aria-label={`${STYLE_LABEL[style]} ${grade}`} onClick={() => setStrategy(style)}
                    data-style={style}
                    className={`flex min-h-12 items-center justify-center gap-1 rounded-sm border ${chosen === style ? 'border-accent bg-accent-wash ring-2 ring-inset ring-accent' : 'border-hairline bg-panel'}`}>
                    <RunningStyleIcon style={style} size={24} />
                    <span aria-hidden className={`font-display text-[15px] font-bold ${gradeTone(grade)}`}>{grade}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="space-y-2" aria-label={careersWords('race-skills')}>
            <h3 className="text-micro">{careersWords('race-skills')}</h3>
            <SkillNames ids={build.skills} skills={env!.content.skills} empty={careersWords('no-skills')} />
          </section>

          {field !== null && (
            <section className="space-y-2" aria-label={careersWords('race-field')} data-racer="race-field">
              <h3 className="text-micro">{careersWords('race-field')}</h3>
              <p className="text-[13px] text-ink-soft">
                {careersWords('race-field-line', { n: field.umaIds.length, grade: fieldGrade(spec), gate: field.playerIndex + 1 })}
              </p>
              <ul className="grid grid-cols-7 gap-1">
                {field.umaIds.map((id, gate) => {
                  const name = env!.content.umas.get(id)?.name ?? id
                  return (
                    <li key={id} aria-label={`${gate + 1}: ${name}`} data-gate={gate} data-her={gate === field.playerIndex || undefined}
                      className={`rounded-sm p-0.5 ${gate === field.playerIndex ? 'bg-accent' : ''}`}>
                      <FaceTile outfitId={id} size={40} label={name} round />
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
          {spec.kind === 'finale' && <p className="text-[12px] text-ink-soft">{careersWords('finale-line')}</p>}
        </div>
      )}
    </Sheet>
  )
}
