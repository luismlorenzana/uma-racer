// Furlong Hand's setup (D385): the legs from the real layout, her build and skills as the rules read them, the rival
// field of real Umas, and a career's config (its race: the season's objective, else the next one, else the URA
// Finals), practice, and the field's scripts and form.
import { describe, expect, it } from 'vitest'
import { careerSave, CONTENT_ENV } from '../../__fixtures__/career'
import { COURSES, furlongConfig, RACES, SKILLS, UMA_MAP, UMAS } from '../../__fixtures__/furlong'
import { clock, opId } from '../../__fixtures__/g3'
import { finaleRace } from '../../career/finale'
import type { SkillTemplate } from '../../content'
import { commitOperation } from '../../save/commit'
import { careerId, FINALE_SEASON, type CareerRecord } from '../../save/records'
import { isRefusal } from '../../save/registry'
import { careerStageConfig, furlongRaceFor, practiceStageConfig } from '../config'
import { fieldForms, FIELD, initFurlong, MOVE, railClosed, rivalGain, rivalScripts, SCRIPT_ODDS } from './rules'
import {
  FURLONG_RIVALS, furlongField, furlongHer, furlongSkills, LEGS_BY_DISTANCE, raceLegs, skillColour, skillTrigger, terrainOf, typicalStat,
} from './setup'

const race = (id: string) => RACES.find((entry) => entry.id === id)!

describe('the legs', () => {
  it('reads a stretch as a climb when a quarter runs uphill, else a corner where corners outrun straights', () => {
    const layout = { corners: [{ start: 100, end: 300 }], straights: [{ start: 0, end: 100 }, { start: 300, end: 400 }], slopes: [{ start: 300, end: 350, slope: 10_000 }] }
    expect(terrainOf(0, 100, layout)).toBe('straight')
    expect(terrainOf(50, 300, layout)).toBe('corner')
    expect(terrainOf(300, 400, layout)).toBe('climb')
    expect(terrainOf(300, 400, { ...layout, slopes: [{ start: 300, end: 350, slope: -10_000 }] })).toBe('straight')
  })

  it('cuts the real course into Sprint 3, Mile 4, Medium 5 and Long 6 legs and the spurt', () => {
    const medium = race('sim-turf-medium-g1-3')
    expect(raceLegs(medium, COURSES.get(medium.courseId)!)).toEqual({ legs: ['straight', 'corner', 'corner', 'climb', 'corner'], spurt: 'straight' })
    for (const distance of ['sprint', 'mile', 'medium', 'long'] as const) {
      const each = RACES.find((entry) => entry.distanceCategory === distance)!
      expect(raceLegs(each, COURSES.get(each.courseId)!).legs).toHaveLength(LEGS_BY_DISTANCE[distance])
    }
  })
})

describe('her', () => {
  it('reads each stat as a whole percentage of the season\'s typical trained Uma, with her distance and style aptitudes', () => {
    const typical = typicalStat(1, 6)
    const her = furlongHer({ speed: typical * 1.2, stamina: typical, power: typical * 0.8, guts: typical, wit: typical / 2 }, UMAS[0]!.aptitudes, 'medium', 'pace', typical)
    expect(her).toEqual({ strategy: 'pace', stats: [120, 100, 80, 100, 50], distance: UMAS[0]!.aptitudes.distance.medium, style: UMAS[0]!.aptitudes.strategy.pace })
  })

  it('colours a skill by its first effect and fires it on its condition\'s ground', () => {
    const skill = (type: number, condition: string): Pick<SkillTemplate, 'conditions'> =>
      ({ conditions: [{ precondition: null, condition, baseTime: 1, cooldown: null, effects: [{ type, value: 1 }] }] })
    expect([27, 9, 31, 4, 10].map((type) => skillColour(skill(type, '')))).toEqual([0, 1, 2, 3, 4])
    expect(['corner_random==1', 'straight_random==1', 'slope==1', 'phase>=2', 'is_finalcorner==1', 'distance_type==2', 'phase==1']
      .map((condition) => skillTrigger(skill(27, condition)))).toEqual(['corner', 'straight', 'climb', 'spurt', 'spurt', 'any', 'any'])
  })

  it('deals her unique first, then golds, then whites; a gold stands for its white', () => {
    const skills = furlongSkills('sim-unique-0', ['sim-skill-speed-3', 'sim-skill-speed-1', 'sim-event-speed', 'sim-skill-wit-2'], SKILLS)
    expect(skills.map((skill) => skill.id)).toEqual(['sim-unique-0', 'sim-event-speed', 'sim-skill-speed-3', 'sim-skill-wit-2'])
    expect(skills.map((skill) => skill.gold)).toEqual([true, true, false, false])
    expect(furlongSkills(null, [], SKILLS)).toEqual([])
  })
})

describe('the field', () => {
  const field = (seed: number, grade: 'g1' | 'g3' = 'g1', season = 6) => furlongField({
    seed, T: 1, season, grade, race: race('sim-turf-medium-g1-3'), uma: UMAS[0]!, umas: UMA_MAP,
  })

  it('is eight real Umas, one a character and never her, two of each style, their strength a share of the typical', () => {
    const rivals = field(1)
    expect(rivals).toHaveLength(FURLONG_RIVALS)
    expect(rivals.every((rival) => UMA_MAP.has(rival.umaId) && rival.umaId !== UMAS[0]!.id)).toBe(true)
    expect(new Set(rivals.map((rival) => UMA_MAP.get(rival.umaId)!.charaId)).size).toBe(FURLONG_RIVALS)
    for (const style of ['front', 'pace', 'late', 'end']) expect(rivals.filter((rival) => rival.strategy === style)).toHaveLength(2)
    // A G1 field races at 83% of the trained stat, each stat rolled 80–100%.
    for (const rival of rivals) expect(rival.strength).toBeGreaterThanOrEqual(60)
    for (const rival of rivals) expect(rival.strength).toBeLessThanOrEqual(84)
  })

  it('is the seed\'s, and a G3 field is softer than a G1 field', () => {
    expect(field(1)).toEqual(field(1))
    expect(field(1)).not.toEqual(field(2))
    const mean = (rivals: ReturnType<typeof field>) => rivals.reduce((sum, rival) => sum + rival.strength, 0) / rivals.length
    expect(mean(field(1, 'g3'))).toBeLessThan(mean(field(1, 'g1')))
  })

  it('races at a ladder of forms, +24% to −24%, dealt by the seed: every field is as strong', () => {
    expect(fieldForms(8)).toEqual([24, 17, 10, 3, -3, -10, -17, -24])
    expect(fieldForms(1)).toEqual([0])
    for (const seed of [1, 2, 3]) {
      expect([...rivalScripts(furlongConfig().furlong!, seed).map((rival) => rival.form)].sort((a, b) => b - a)).toEqual(fieldForms(8))
    }
  })

  it('scripts each rival a move a spread by its style: front runners surge early, closers in the spurt', () => {
    expect(Object.values(SCRIPT_ODDS).every((phases) => phases.every((odds) => odds.reduce((a, b) => a + b, 0) === 100))).toBe(true)
    const setup = furlongConfig().furlong!
    const share = (style: string, spread: number) => {
      let surges = 0
      let all = 0
      for (let seed = 0; seed < 300; seed += 1) {
        for (const rival of rivalScripts(setup, seed)) {
          if (rival.strategy !== style) continue
          all += 1
          if (rival.script[spread] === MOVE.surge) surges += 1
        }
      }
      return surges / all
    }
    expect(share('front', 0)).toBeGreaterThan(share('front', setup.legs.length))
    expect(share('end', setup.legs.length)).toBeGreaterThan(share('end', 0))
    expect(rivalScripts(setup, 5)[0]!.script).toHaveLength(setup.legs.length + 1)
  })

  it('gains its pace for its strength and form a leg, plus its move, and its spurt grows with the legs', () => {
    const state = initFurlong(furlongConfig())
    const rivals = state.rivals.map((rival) => ({ ...rival, strength: FIELD.reference, form: 0, script: rival.script.map(() => MOVE.hold) }))
    const flat = { ...state, rivals }
    expect(rivalGain(flat, 0, 0, 0)).toBe(FIELD.pace)
    expect(rivalGain({ ...flat, rivals: [{ ...rivals[0]!, script: rivals[0]!.script.map(() => MOVE.surge) }] }, 0, 0, 0)).toBe(FIELD.pace + FIELD.surge)
    expect(rivalGain({ ...flat, rivals: [{ ...rivals[0]!, form: 10 }] }, 0, 0, 0)).toBe(Math.floor(FIELD.pace * 1.1))
    expect(rivalGain(flat, 0, state.legs.length, 0)).toBe(FIELD.spurt)
    expect(rivalGain({ ...flat, legs: ['straight', 'corner', 'corner'] }, 0, 3, 0)).toBeLessThan(FIELD.spurt)
    expect(railClosed(flat, 0)).toBe(false)
    expect(railClosed({ ...flat, rivals: [{ ...rivals[0]!, script: [MOVE.rail] }] }, 0)).toBe(true)
  })
})

describe('a career\'s config', () => {
  const UMA = UMAS[0]!
  const ID = careerId(UMA.id, 1)
  const started = (): CareerRecord => {
    const commit = commitOperation(careerSave(UMA.id), { id: opId(1), name: 'start-career', input: { umaId: UMA.id, T: 1 }, at: clock('08:00') }, CONTENT_ENV)
    if (commit.status !== 'applied') throw new Error(commit.status)
    return commit.state.careers[ID]!
  }

  it('runs the season\'s first objective, against its grade\'s field as strong as her season', () => {
    const career = started()
    const first = career.objectives[0]!
    const at = furlongRaceFor({ ...career, season: first.season }, UMA, RACES)!
    expect([at.race.id, at.season, at.grade]).toEqual([first.raceId, first.season, race(first.raceId).grade])
    const config = careerStageConfig({ ...career, season: first.season }, {}, CONTENT_ENV.content, 'furlong-hand', 9, false)
    if (isRefusal(config)) throw new Error(config.reason)
    expect(config).toMatchObject({ kind: 'furlong-hand', course: first.raceId, seed: 9 })
    expect(config.furlong!.race.id).toBe(first.raceId)
    expect(config.furlong!.rivals).toHaveLength(FURLONG_RIVALS)
    expect(config).not.toHaveProperty('seasonFocus')
  })

  it('runs her next objective in a season without one, and the URA Finals\' course at the Finale', () => {
    const career = started()
    const empty = [...Array(12).keys()].find((season) => !career.objectives.some((objective) => objective.season === season) &&
      career.objectives.some((objective) => objective.season > season))!
    const next = [...career.objectives].filter((objective) => objective.season > empty).sort((a, b) => a.season - b.season)[0]!
    expect(furlongRaceFor({ ...career, season: empty }, UMA, RACES)!.race.id).toBe(next.raceId)
    const finale = furlongRaceFor({ ...career, season: FINALE_SEASON }, UMA, RACES)!
    expect([finale.race.id, finale.season, finale.grade]).toEqual([finaleRace(UMA, career, RACES).id, FINALE_SEASON, 'g1'])
  })

  it('carries her racing stats and bought skills, and each card\'s unique for its ability', () => {
    const cards = [...CONTENT_ENV.content.cards.values()]
    const career = { ...started(), deck: [cards[2]!.id], skills: ['sim-skill-speed-1'], season: started().objectives[0]!.season }
    const config = careerStageConfig(career, {}, CONTENT_ENV.content, 'furlong-hand', 3, false)
    if (isRefusal(config)) throw new Error(config.reason)
    expect(config.furlong!.skills.map((skill) => skill.id)).toEqual([UMA.uniqueSkillId, 'sim-skill-speed-1'])
    expect(config.deck[0]!.unique?.effects[0]?.type).toBe(101)
  })

  it('refuses without races to run, and practice runs her best pair\'s URA Finals course on her base stats', () => {
    const missing = careerStageConfig(started(), {}, { umas: CONTENT_ENV.content.umas, cards: CONTENT_ENV.content.cards }, 'furlong-hand', 1, false)
    expect(isRefusal(missing) && missing.code).toBe('no-race')
    const practice = practiceStageConfig(UMA, 'furlong-hand', 5, CONTENT_ENV.content)
    if (isRefusal(practice)) throw new Error(practice.reason)
    expect(practice).toMatchObject({ kind: 'furlong-hand', deck: [], practice: true, course: finaleRace(UMA, { objectives: [] }, RACES).id })
    expect(isRefusal(practiceStageConfig(UMA, 'furlong-hand', 5))).toBe(true)
  })
})
