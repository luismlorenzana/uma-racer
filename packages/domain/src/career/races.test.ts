// A career's races (D383): the prepared field on her racing build, the seed, the season's rivals, the skills she races
// with, the settle, the URA Finals' course and fields, the rewards and the stage pay. Invented content only.
import { describe, expect, it } from 'vitest'
import { CONTENT_ENV, RACES, UMAS, race } from '../__fixtures__/career'
import { testCareer, testSkill } from '../__fixtures__/build'
import { clock } from '../__fixtures__/g3'
import { deriveRacingBuild } from '../build/racing-build'
import type { RaceTemplate, SkillTemplate } from '../content'
import { bestStrategy, raceAttemptSeed, raceFieldSize } from '../race-attempt'
import type { CareerObjective } from '../save/records'
import { finalePair, finaleRace, finaleSpec, FINALE_FIELDS } from './finale'
import { STAGE_PAY_AT_A, stagePay } from './pay'
import { objectiveSpec, prepareCareerRace, prepareObjectiveRace, racingSkills, settleRace } from './races'
import { deckRaceBonus, objectiveReward, OBJECTIVE_SP } from './rewards'

const UMA = UMAS[0]!
const objective = (raceId: string, season: number): CareerObjective => ({ raceId, stage: 'trials', season, status: 'open', wonAt: null })
const career = testCareer(UMA.id, { startedAt: clock('07:00'), objectives: [objective('sim-turf-mile-g2-1', 4), objective('sim-turf-mile-g1-3', 10)] })
const content = CONTENT_ENV.content
const mean = (stats: Record<string, number>) => Object.values(stats).reduce((a, b) => a + b, 0) / 5

describe('prepareObjectiveRace', () => {
  const prepared = prepareObjectiveRace(career, career.objectives[0]!, { attempt: 0 }, {}, content, 'test-content')

  it('runs her racing build in her best style, on the race\'s course, seeded by her career and the attempt', () => {
    const me = prepared.setup.runners[prepared.playerIndex]!
    const build = deriveRacingBuild(career, UMA, content.cards, {})
    expect(me).toMatchObject({ id: UMA.id, stats: build.stats, strategy: bestStrategy(UMA), aptitude: { distance: 'A', surface: 'A', strategy: 'A' } })
    expect(me.skills.map((skill) => skill.id)).toEqual([UMA.uniqueSkillId])
    expect(prepared.setup.runners).toHaveLength(raceFieldSize(race('sim-turf-mile-g2-1')))
    expect(new Set(prepared.umaIds).size).toBe(prepared.umaIds.length)
    expect(prepared.seed).toBe(raceAttemptSeed(clock('07:00'), 'test-content', UMA.id, 'sim-turf-mile-g2-1', bestStrategy(UMA), 0))
    expect(prepared.setup.course).toMatchObject({ distance: 1600, surface: 'turf', season: 1, grade: 200, rotation: 1 })
    expect(prepareObjectiveRace(career, career.objectives[0]!, { attempt: 0 }, {}, content, 'test-content')).toEqual(prepared)
    const late = prepareObjectiveRace(career, career.objectives[0]!, { attempt: 0, strategy: 'end' }, {}, content, 'test-content')
    expect(late.strategy).toBe('end')
    expect(late.setup.runners[late.playerIndex]!.aptitude.strategy).toBe(UMA.aptitudes.strategy.end)
  })

  it('makes rivals as strong as the season the race falls in', () => {
    const at = (season: number) => {
      const field = prepareCareerRace(career, objectiveSpec({ raceId: 'sim-turf-mile-g2-1', season }, race('sim-turf-mile-g2-1')), { attempt: 0 }, {}, content, 'test-content')
      const rivals = field.setup.runners.filter((_, gate) => gate !== field.playerIndex)
      return rivals.reduce((sum, runner) => sum + mean(runner.stats), 0) / rivals.length
    }
    expect(at(0)).toBeLessThan(at(4))
    expect(at(4)).toBeLessThan(at(11))
  })

  it('settles a first place as a win and anything else as nothing', () => {
    expect(settleRace(career, 'sim-turf-mile-g2-1', 2, clock('08:00'))).toEqual({ career, won: false })
    const won = settleRace(career, 'sim-turf-mile-g2-1', 1, clock('08:00'))
    expect(won.won).toBe(true)
    expect(won.career.objectives[0]).toMatchObject({ status: 'won', wonAt: clock('08:00') })
    expect(settleRace(won.career, 'sim-turf-mile-g2-1', 1, clock('09:00'))).toEqual({ career: won.career, won: false })
    expect(() => settleRace(career, 'nope', 1, clock('08:00'))).toThrow(RangeError)
  })
})

describe('racingSkills', () => {
  it('races her unique first, a gold in place of its white, and only what the engine can run', () => {
    const skills = new Map<string, SkillTemplate>([
      ['unique', testSkill('unique', null, { kind: 'unique' })],
      ['white', testSkill('white', 100)],
      ['gold', testSkill('gold', 150, { kind: 'gold', normalSkillId: 'white' })],
      ['other', testSkill('other', 100)],
      ['inert', testSkill('inert', 100, { conditions: [{ precondition: null, condition: 'phase==1', baseTime: 0, cooldown: null, effects: [{ type: 999, value: 1 }] }] })],
    ])
    expect(racingSkills('unique', ['white', 'gold', 'other', 'inert'], skills).map((skill) => skill.id)).toEqual(['unique', 'gold', 'other'])
    expect(racingSkills(null, ['white'], skills).map((skill) => skill.id)).toEqual(['white'])
  })
})

describe('the URA Finals', () => {
  const races: RaceTemplate[] = [
    { ...race('sim-turf-mile-g2-1'), id: 'mile-g2' }, { ...race('sim-turf-mile-g1-5'), id: 'mile-g1-a' }, { ...race('sim-turf-mile-g1-3'), id: 'mile-g1-b' },
    { ...race('sim-turf-medium-g1-3'), id: 'medium-g1' }, { ...race('sim-dirt-sprint-g1-3'), id: 'dirt-sprint-g1' },
  ]

  it('runs at her best surface, then her best distance on it, among the pairs the catalogue races', () => {
    expect(finalePair(UMA, [], races)).toEqual({ surface: 'turf', distance: 'mile' })
    expect(finalePair(UMA, ['medium-g1'], races)).toEqual({ surface: 'turf', distance: 'medium' })
    const dirt = { aptitudes: { ...UMA.aptitudes, surface: { turf: 'B', dirt: 'A' } } } as const
    expect(finalePair(dirt, [], races)).toEqual({ surface: 'dirt', distance: 'sprint' })
    const longOnly = { aptitudes: { ...UMA.aptitudes, distance: { sprint: 'G', mile: 'B', medium: 'B', long: 'S' } } } as const
    expect(finalePair(longOnly, [], races)).toEqual({ surface: 'turf', distance: 'mile' })
  })

  it('takes the pair\'s highest grade, one of her objectives last, and builds stronger fields round by round', () => {
    const career = testCareer(UMA.id, { objectives: [objective('mile-g1-a', 8)] })
    expect(finaleRace(UMA, career, races).id).toBe('mile-g1-b')
    expect(finaleRace(UMA, testCareer(UMA.id), races).id).toBe('mile-g1-a')
    expect(FINALE_FIELDS.map((field) => field.grade)).toEqual(['g2', 'g1', 'g1'])
    expect([0, 1, 2].map((round) => finaleSpec(race('sim-turf-mile-g1-3'), round).seedKey)).toEqual([
      'sim-turf-mile-g1-3:ura-qualifier', 'sim-turf-mile-g1-3:ura-semifinal', 'sim-turf-mile-g1-3:ura-final'])
    expect(finaleSpec(race('sim-turf-mile-g1-3'), 2)).toMatchObject({ kind: 'finale', season: 12, handicap: FINALE_FIELDS[2]!.handicap })
    expect(() => finaleSpec(race('sim-turf-mile-g1-3'), 3)).toThrow(RangeError)
  })
})

describe('rewards and pay', () => {
  it('pays an objective SP by grade × (1 + the deck\'s Race Bonus), rounded, and a Card Ticket', () => {
    const deck = ['sim-speed-4', 'sim-wit-0']
    const bonus = deckRaceBonus(deck, content.cards)
    expect(bonus).toBeCloseTo((3 + 4 + 3 + 0) / 100, 10)
    expect(objectiveReward('main', deck, content.cards)).toEqual({ cardTickets: 1, sp: Math.round(OBJECTIVE_SP.g1! * (1 + bonus)), raceBonus: bonus })
    expect(objectiveReward('maiden', [], content.cards)).toEqual({ cardTickets: 1, sp: 40, raceBonus: 0 })
    expect(RACES.length).toBeGreaterThan(0)
  })

  it('scales a stage\'s pay at A by its grade\'s multiplier', () => {
    expect(stagePay('training-yard', 1)).toEqual(STAGE_PAY_AT_A['training-yard'])
    expect(stagePay('furlong-hand', 0.25)).toEqual({
      drills: 0, bond: Math.round(STAGE_PAY_AT_A['furlong-hand'].bond * 0.25), sp: Math.round(STAGE_PAY_AT_A['furlong-hand'].sp * 0.25),
    })
    expect(() => stagePay('training-yard', -1)).toThrow(RangeError)
  })
})
