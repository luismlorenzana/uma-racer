import {
  flairSeriesLegId,
  generateScenarioJourney,
  type Aptitudes,
  type DistanceCategory,
  type RaceGrade,
  type RaceResultRecord,
  type RaceTemplate,
  type ScenarioJourney,
  type UmaTemplate,
} from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { umaFixture, withRun } from './__fixtures__/save'
import { buildRacePlan, NEXT_UP_MAX, NEXT_UP_MIN } from './race-plan'

let family = 500
function race(grade: RaceGrade, distanceCategory: DistanceCategory, extra: Partial<RaceTemplate> = {}): RaceTemplate {
  family += 1
  const id = extra.id ?? `${grade}-${distanceCategory}-${family}`
  return {
    id, familyId: String(family), name: id, grade, surface: 'turf', distance: 2000, distanceCategory, direction: 'left',
    venue: 'Test Track', venueKey: 'test-track', venueTags: [], series: [], seriesLegs: [], courseId: 'course-1', season: 1,
    fieldSize: 12, ...extra,
  }
}
const leg = (id: string, key: string, distanceCategory: DistanceCategory) =>
  race('g1', distanceCategory, { id, series: ['triple-crown'], seriesLegs: [flairSeriesLegId('triple-crown', key)] })

const RACES: RaceTemplate[] = [
  leg('satsuki', 'satsuki-sho', 'medium'), leg('derby', 'tokyo-yushun', 'medium'), leg('kikuka', 'kikuka-sho', 'long'),
  ...(['g3', 'g2', 'g1', 'op'] as const).flatMap((grade) =>
    (['sprint', 'mile', 'medium', 'long'] as const).flatMap((distance) => [0, 1, 2, 3].map(() => race(grade, distance)))),
]

const aptitudes: Aptitudes = {
  surface: { turf: 'A', dirt: 'G' },
  distance: { sprint: 'C', mile: 'B', medium: 'A', long: 'A' },
  strategy: { front: 'B', pace: 'A', late: 'A', end: 'C' },
}
const template: UmaTemplate = {
  id: 'colt', charaId: 'chara-colt', name: 'Colt', outfit: null, jpRelease: '2000-01-01', globalRelease: null, starter: true,
  baseStats: { speed: 100, stamina: 100, power: 100, guts: 100, wit: 100 },
  growthRates: { speed: 0, stamina: 0, power: 0, guts: 0, wit: 0 },
  aptitudes, uniqueSkillId: null, awakeningSkillIds: [], realHorseSex: 'male', signatureRaceFamilyIds: [],
  imageSource: 'https://invalid.test/synthetic.png',
}

const base = umaFixture(template)
const journey = generateScenarioJourney({ uma: base, umaTemplate: template, aptitudes, races: RACES })
const uma = withRun(base, { journey })
const plan = (history: RaceResultRecord[] = [], save = uma) => buildRacePlan({ uma: save, template, aptitudes, races: RACES, history })

function win(raceId: string, sequence: number, placement = 1): RaceResultRecord {
  return { raceId, umaId: 'colt', sequence, startLevel: 1, playerPlacement: placement, createdAt: 100 + sequence } as RaceResultRecord
}

const complete = (j: ScenarioJourney, slots: string[]): ScenarioJourney => ({
  ...j,
  goals: j.goals.map((goal) => !slots.includes(goal.slot) ? goal : {
    ...goal, status: 'completed', completedRaceResultId: 'race:colt:0', completedAt: 10,
    series: goal.series ? { ...goal.series, legs: goal.series.legs.map((entry) => ({ ...entry, status: 'completed' as const, completedRaceResultId: 'race:colt:0', completedAt: 10 })) } : null,
  }),
})

describe('race plan', () => {
  it('opens on her Maiden goal, then races graded for her stage in her profile', () => {
    const { nextUp, tracker } = plan()
    expect(tracker).toMatchObject({ stage: 'maiden', complete: false, holdLevel: 2, profile: 'Medium · Long · Turf' })
    expect(nextUp[0]!.race.id).toBe(journey.goals[0]!.raceId)
    expect(nextUp[0]!.marks[0]).toMatchObject({ kind: 'goal', stage: 'maiden', label: 'Maiden goal' })
    expect(nextUp.length).toBeGreaterThanOrEqual(NEXT_UP_MIN)
    expect(nextUp.length).toBeLessThanOrEqual(NEXT_UP_MAX)
    // Trials and main goals wait in the tracker: a G1 is not a race to run at level 1.
    expect(nextUp.some((entry) => entry.race.grade === 'g1')).toBe(false)
    expect(nextUp.slice(1).every((entry) => ['g3', 'op'].includes(entry.race.grade) && ['medium', 'long'].includes(entry.race.distanceCategory))).toBe(true)
    expect(new Set(nextUp.map((entry) => entry.race.familyId)).size).toBe(nextUp.length)
  })

  it('moves on with the career, and marks set legs and first-win G1s', () => {
    const atMain = withRun(uma, { journey: complete(journey, ['maiden', 'trials']) })
    const { nextUp, tracker } = plan([], atMain)
    expect(tracker?.stage).toBe('main')
    expect(nextUp.slice(0, 3).map((entry) => entry.race.id)).toEqual(['satsuki', 'derby', 'kikuka'])
    expect(nextUp[0]!.marks).toEqual(expect.arrayContaining([
      { kind: 'set', label: 'Triple Crown', won: 0, total: 3 },
      { kind: 'trophy', label: 'First win' },
    ]))
  })

  it('collapses races won this scenario and keeps every race in All races', () => {
    const maidenRace = journey.goals[0]!.raceId!
    const { won, all, nextUp } = plan([win(maidenRace, 0), win('satsuki', 1, 4)])
    expect(won.map((entry) => entry.race.id)).toEqual([maidenRace])
    expect(all).toHaveLength(RACES.length)
    expect(all.find((entry) => entry.race.id === 'satsuki')?.raced).toBe(1)
    // A race she has already won drops behind fresh ones of the same grade.
    expect(nextUp.findIndex((entry) => entry.race.id === maidenRace)).toBe(0)
  })

  it('shows no tracker for a journey frozen before careers', () => {
    const legacy = withRun(uma, { journey: {
      tier: 1, tracking: 'tracked', state: 'active', completedAt: null,
      goals: [{ id: 'goal:1:aptitude', slot: 'aptitude', raceId: 'derby', kind: 'win', series: null, minimumMarginLengths: 0, status: 'active', completedRaceResultId: null, completedAt: null }],
    } })
    const { tracker, nextUp } = plan([], legacy)
    expect(tracker).toBeNull()
    expect(nextUp[0]).toMatchObject({ race: { id: 'derby' }, marks: expect.arrayContaining([{ kind: 'goal', stage: null, label: 'Aptitude goal' }]) })
  })
})
