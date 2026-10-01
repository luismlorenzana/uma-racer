import {
  fullSpurtStamina,
  parseRaceCondition,
  rivalPreset,
  rollRivalField,
  type CompiledRaceSkill,
  type RaceSkillEffectKind,
  type Stats,
  type Strategy,
} from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { HORSE_LANE } from './constants'
import {
  PASS_GAP,
  createRng,
  phaseStartTurns,
  raceTurns,
  simulateRace,
  simulateRaceV6,
  simulateRaceV7,
  simulateRaceV8,
  cornerRatio,
  baseSpeedFor,
  staminaKeepChance,
  swingLanes,
  turnPhase,
  turnSection,
  type RaceInput,
  type RaceRunnerInput,
} from './index'

const stats = (all: number): Stats => ({ speed: all, stamina: all, power: all, guts: all, wit: all })

const runner = (gate: number, s: Stats, strategy: Strategy = 'pace', skills?: CompiledRaceSkill[]): RaceRunnerInput => ({
  id: `r${gate}`,
  label: `Runner ${gate + 1}`,
  stats: s,
  strategy,
  aptitude: { distance: 'A', surface: 'A', strategy: 'A' },
  gate,
  ...(skills ? { skills } : {}),
})

const STYLES = ['front', 'pace', 'late', 'end'] as const
const field = (seed: number, distance = 2000, size = 12): RaceInput => ({
  course: { distance, surface: 'turf' },
  seed,
  runners: Array.from({ length: size }, (_, i) => runner(i, stats(650 + (i % 5) * 30), STYLES[i % 4])),
})

const skill = (id: string, condition: string, amount: number, duration: number): CompiledRaceSkill => ({
  id,
  activation: 'guaranteed',
  inherited: false,
  groups: [{
    precondition: null,
    condition: parseRaceCondition(condition)!,
    duration,
    cooldown: 0,
    effects: [{ kind: 'target-speed', amount }],
    unsupportedVariables: [],
    unsupportedEffects: [],
  }],
})

describe('the turn clock (M021)', () => {
  it('gives each course a fixed turn count from its distance', () => {
    expect([1200, 1600, 2000, 2400, 3200].map(raceTurns)).toEqual([58, 79, 100, 123, 171])
  })

  it('starts every phase on a fixed turn, the same for the whole field', () => {
    expect(phaseStartTurns(100)).toEqual([1, 18, 68, 85])
    expect([1, 17, 18, 67, 68, 84, 85, 100, 140].map((turn) => turnPhase(turn, 100))).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 3])
    const timeline = simulateRaceV6(field(7))
    const phases = timeline.events.filter((event) => event.type === 'phase').map((event) => [event.tick, event.value])
    expect(phases).toEqual([[18, 1], [68, 2], [85, 3]])
  })
})

describe('engine v6 (M021)', () => {
  it('is deterministic and records one frame a turn', () => {
    const a = simulateRaceV6(field(42))
    const b = simulateRaceV6(field(42))
    expect(a.results).toEqual(b.results)
    expect(Array.from(a.distance)).toEqual(Array.from(b.distance))
    expect(a.tickRate).toBe(1)
    // A frame at the gate, then one per turn until the last runner is home.
    const last = Math.max(...a.results.map((result) => result.finishTime))
    expect(a.ticks).toBe(Math.ceil(last) + 1)
  })

  it('times a finish inside its turn and ranks by it', () => {
    const timeline = simulateRaceV6(field(11))
    const finishes = timeline.events.filter((event) => event.type === 'finish')
    for (const event of finishes) {
      expect(event.value!).toBeGreaterThan(event.tick - 1)
      expect(event.value!).toBeLessThanOrEqual(event.tick)
    }
    const times = timeline.results.map((result) => result.finishTime)
    expect([...times].sort((left, right) => left - right)).toEqual(times)
  })

  it('records an overtake only when a runner ends a turn ahead of one she started it behind', () => {
    const timeline = simulateRaceV6(field(3))
    const n = timeline.runnerCount
    const at = (tick: number, runner: number) => timeline.distance[tick * n + runner]!
    const overtakes = timeline.events.filter((event) => event.type === 'overtake')
    expect(overtakes.length).toBeGreaterThan(0)
    const finish = (runner: number) => timeline.results.find((result) => result.runner === runner)!.finishTime
    for (const event of overtakes) {
      expect(at(event.tick - 1, event.runner)).toBeLessThan(at(event.tick - 1, event.targetRunner!))
      // Both home on the same turn: the pass is in the finish times, since both frames read the line.
      if (at(event.tick, event.runner) >= timeline.courseDistance && at(event.tick, event.targetRunner!) >= timeline.courseDistance) {
        expect(finish(event.runner)).toBeLessThan(finish(event.targetRunner!))
      } else {
        expect(at(event.tick, event.runner)).toBeGreaterThan(at(event.tick, event.targetRunner!))
      }
    }
  })

  it('holds a blocked runner a length behind the runner in her lane', () => {
    // Eighteen closely matched runners in one pack: someone is boxed in at some point.
    const timeline = simulateRaceV6({ ...field(5, 1600, 18), runners: Array.from({ length: 18 }, (_, i) => runner(i, stats(700), 'pace')) })
    const n = timeline.runnerCount
    const blocked = timeline.events.filter((event) => event.type === 'blocked' && event.value === 1)
    expect(blocked.length).toBeGreaterThan(0)
    for (const event of blocked) {
      const behind = timeline.distance[event.tick * n + event.runner]!
      const ahead = timeline.distance[event.tick * n + event.targetRunner!]!
      expect(ahead - behind).toBeGreaterThanOrEqual(PASS_GAP - 1e-3)
      expect(Math.abs(timeline.lane![event.tick * n + event.runner]! - timeline.lane![event.tick * n + event.targetRunner!]!)).toBeLessThan(HORSE_LANE)
    }
  })

  it('lets stats decide: a runner at twice the field wins clearly', () => {
    let wins = 0
    let margin = 0
    for (let seed = 1; seed <= 10; seed += 1) {
      const input: RaceInput = {
        course: { distance: 2000, surface: 'turf' },
        seed,
        runners: Array.from({ length: 12 }, (_, i) => runner(i, stats(i === seed % 12 ? 1400 : 700), STYLES[i % 4])),
      }
      const timeline = simulateRaceV6(input)
      const winner = timeline.results[0]!
      if (winner.runner === seed % 12) wins += 1
      margin += timeline.results[1]!.finishTime - winner.finishTime
    }
    expect(wins).toBe(10)
    expect(margin / 10).toBeGreaterThan(2)
  })

  it('counts skill durations in whole turns and fires phase skills on their phase turns', () => {
    const skills = [skill('middle', 'phase==1', 0.3, 3), skill('late-random', 'phase_random==2', 0.3, 2)]
    const input: RaceInput = { ...field(9), runners: [runner(0, stats(700), 'pace', skills), ...field(9).runners.slice(1)] }
    const events = simulateRaceV6(input).events.filter((event) => event.type === 'skill-activated' && event.runner === 0)
    const middle = events.find((event) => event.skillId === 'middle')!
    // Three seconds on a 2,000 m course last 3 × 2,000 / 1,000 = 6 turns, from the middle leg's first turn.
    expect(middle.tick).toBe(18)
    expect(middle.skillExpiresTick).toBe(24)
    const late = events.find((event) => event.skillId === 'late-random')!
    expect(late.tick).toBeGreaterThanOrEqual(68)
    expect(late.tick).toBeLessThanOrEqual(84)
  })
})

// A course with a final corner and a 330 m final straight, as the sims use.
const course = (distance: number): RaceInput['course'] => ({
  distance,
  surface: 'turf',
  layout: {
    corners: [{ start: distance - 630, end: distance - 330, number: 4 }],
    straights: [{ start: 0, end: distance - 630 }, { start: distance - 330, end: distance }],
    slopes: [],
  },
})
const guaranteed = (id: string, condition: string, kind: RaceSkillEffectKind, amount: number, duration: number): CompiledRaceSkill => ({
  ...skill(id, condition, amount, duration),
  groups: [{ ...skill(id, condition, amount, duration).groups[0]!, effects: [{ kind, amount }] }],
})
const even = (value: number) => stats(value)

describe('engine v7 (D158)', () => {
  it('is frozen, deterministic, and records one frame a turn', () => {
    const a = simulateRaceV7(field(42))
    const b = simulateRaceV7(field(42))
    expect(a.results).toEqual(b.results)
    expect(Array.from(a.distance)).toEqual(Array.from(b.distance))
    expect(a.tickRate).toBe(1)
    expect(a.ticks).toBe(Math.ceil(Math.max(...a.results.map((result) => result.finishTime))) + 1)
  })

  it('lets skills beat Speed: 1,000 Speed with procing skills beats 1,400 Speed without', () => {
    // A Lv5 unique, a gold speed, a gold acceleration and two whites, all firing, against 400 more Speed.
    const kit = [
      guaranteed('unique', 'phase_random==2', 'target-speed', 0.35 * 1.1, 5),
      guaranteed('gold-speed', 'is_finalcorner==1', 'target-speed', 0.35, 3),
      guaranteed('gold-acceleration', 'phase==2', 'acceleration', 0.4, 3),
      guaranteed('white-speed', 'phase==1', 'target-speed', 0.15, 3),
      guaranteed('white-acceleration', 'is_lastspurt==1', 'acceleration', 0.2, 3),
    ]
    let wins = 0
    let races = 0
    let gap = 0
    for (const style of STYLES) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const runners = Array.from({ length: 12 }, (_, gate) =>
          gate === 0 ? runner(0, { ...even(800), speed: 1400 }, style)
            : gate === 1 ? runner(1, { ...even(800), speed: 1000 }, style, kit)
              : runner(gate, even(800), STYLES[gate % 4]))
        const results = simulateRaceV7({ course: course(2000), seed, runners }).results
        const fast = results.find((result) => result.runner === 0)!
        const skilled = results.find((result) => result.runner === 1)!
        if (skilled.placement < fast.placement) wins += 1
        gap += fast.finishTime - skilled.finishTime
        races += 1
      }
    }
    expect(wins / races).toBeGreaterThanOrEqual(0.8)
    expect(gap / races).toBeGreaterThan(0.2)
    // On v6's amplified Speed term the same kit never came close.
  })

  it('makes every stat count: 300 more of any one finishes faster at 2,400 m', () => {
    const time = (stat?: keyof Stats) => {
      let total = 0
      for (let seed = 1; seed <= 40; seed += 1) {
        const runners = Array.from({ length: 12 }, (_, gate) =>
          runner(gate, gate === 0 && stat ? { ...even(800), [stat]: 1100 } : even(800), gate === 0 ? 'pace' : STYLES[gate % 4]))
        total += simulateRaceV7({ course: course(2400), seed, runners }).results.find((result) => result.runner === 0)!.finishTime
      }
      return total / 40
    }
    const baseline = time()
    for (const stat of ['speed', 'stamina', 'power', 'guts', 'wit'] as const) expect(time(stat)).toBeLessThan(baseline)
  })

  it('holds a full spurt on the Stamina the domain says the distance needs', () => {
    const held = (share: number) => {
      let maxed = 0
      for (let seed = 1; seed <= 20; seed += 1) {
        const others = rollRivalField({ tier: 1, grade: 'g1', distance: 'medium', meters: 2000, count: 11, rng: createRng(seed) })
        const build = rivalPreset(1, 'g1', 'medium', 'pace', 2000)
        const me = runner(11, { ...build, stamina: share * fullSpurtStamina(2000, 'pace', build.speed, build.guts) }, 'pace')
        const runners = [...others.map((slot, gate) => runner(gate, slot.stats, slot.strategy)), me]
        if (simulateRaceV7({ course: course(2000), seed, runners }).results.find((result) => result.runner === 11)!.spurtMaxed) maxed += 1
      }
      return maxed / 20
    }
    expect(held(1.1)).toBeGreaterThanOrEqual(0.8)
    expect(held(0.85)).toBeLessThanOrEqual(0.2)
  })

  it('runs a Spot Struggle among bunched front runners early, on Guts', () => {
    let struggles = 0
    for (let seed = 1; seed <= 10; seed += 1) {
      const runners = Array.from({ length: 12 }, (_, gate) => runner(gate, even(800), gate < 4 ? 'front' : STYLES[gate % 4]))
      const timeline = simulateRaceV7({ course: course(2000), seed, runners })
      const total = raceTurns(2000)
      const starts = timeline.events.filter((event) => event.type === 'spot-struggle' && event.value === 1)
      if (starts.length === 0) continue
      struggles += 1
      expect(starts.length).toBeGreaterThanOrEqual(2)
      // Once a race, together, from 150 m until section 6; over by section 9; front runners only.
      expect(new Set(starts.map((event) => event.tick)).size).toBe(1)
      expect(turnSection(starts[0]!.tick, total)).toBeLessThanOrEqual(5)
      for (const event of starts) expect(runners[event.runner]!.strategy).toBe('front')
      const ends = timeline.events.filter((event) => event.type === 'spot-struggle' && event.value === 0)
      expect(ends).toHaveLength(starts.length)
      for (const event of ends) expect(turnSection(event.tick, total)).toBeLessThanOrEqual(8)
    }
    expect(struggles).toBeGreaterThan(5)
  })

  it('competes before the spurt only in sections 11–15, and never secures a lead as an end closer', () => {
    const timeline = simulateRaceV7({ ...field(8), course: course(2000) })
    const total = raceTurns(2000)
    const pushes = timeline.events.filter((event) => event.type === 'compete')
    expect(pushes.length).toBeGreaterThan(0)
    for (const event of pushes) {
      expect(turnSection(event.tick, total)).toBeGreaterThanOrEqual(10)
      expect(turnSection(event.tick, total)).toBeLessThanOrEqual(14)
      if (event.value === 1) expect(field(8).runners[event.runner]!.strategy).not.toBe('end')
    }
  })

  it('lets Power carry a blocked runner further out, and Wit notice a short HP', () => {
    expect([300, 700, 1200].map((power) => swingLanes(power, 3))).toEqual([1, 2, 3])
    expect(staminaKeepChance(1000)).toBeGreaterThan(staminaKeepChance(300))
  })

  it('fires a skill on the first 10 m of the final straight in the turn she enters it', () => {
    const entry = [guaranteed('entry', 'is_last_straight_onetime==1', 'target-speed', 0.35, 3)]
    for (let seed = 1; seed <= 5; seed += 1) {
      const runners = [runner(0, even(800), 'pace', entry), ...field(seed).runners.slice(1)]
      const timeline = simulateRaceV7({ course: course(2000), seed, runners })
      const fired = timeline.events.filter((event) => event.type === 'skill-activated' && event.skillId === 'entry')
      expect(fired).toHaveLength(1)
      const n = timeline.runnerCount
      expect(timeline.distance[(fired[0]!.tick - 1) * n]!).toBeGreaterThanOrEqual(2000 - 330)
    }
  })
})

// An oval like the sims': a home straight after the final turn (corners 3 and 4), a back straight, and the first turn.
const oval = (distance: number): RaceInput['course'] => ({
  distance,
  surface: 'turf',
  layout: {
    corners: [
      { start: distance - 1750, end: distance - 1500, number: 1 }, { start: distance - 1500, end: distance - 1250, number: 2 },
      { start: distance - 850, end: distance - 600, number: 3 }, { start: distance - 600, end: distance - 350, number: 4 },
    ].filter((corner) => corner.start >= 0),
    straights: [
      ...(distance > 1750 ? [{ start: 0, end: distance - 1750, frontType: 1 as const }] : []),
      { start: Math.max(0, distance - 1250), end: distance - 850, frontType: 2 as const },
      { start: distance - 350, end: distance, frontType: 1 as const },
    ],
    slopes: [],
  },
  grade: 100,
})

describe('engine v8 (D231)', () => {
  it('is the current engine, deterministic, and records one frame a turn', () => {
    const a = simulateRace({ ...field(42), course: oval(2000) })
    const b = simulateRaceV8({ ...field(42), course: oval(2000) })
    expect(a.results).toEqual(b.results)
    expect(Array.from(a.distance)).toEqual(Array.from(b.distance))
    expect(a.tickRate).toBe(1)
  })

  it('ends the start dash at 85% of base speed, so Power and an early acceleration skill decide the opening', () => {
    const lone = (s: Stats, skills?: CompiledRaceSkill[]) => simulateRace({ course: oval(2000), seed: 3, runners: [runner(0, s, 'front', skills)] })
    const base = baseSpeedFor(2000)
    const plain = lone(even(600))
    // After the first second she is past the dash's 17 m/s but well short of her opening target of 20 m/s.
    expect(plain.speed[1]!).toBeGreaterThan(0.85 * base)
    expect(plain.speed[1]!).toBeLessThan(0.9 * base)
    const strong = lone({ ...even(600), power: 1200 })
    expect(strong.distance[6]!).toBeGreaterThan(plain.distance[6]! + 0.5)
    const early = lone(even(600), [guaranteed('early', 'phase==0', 'acceleration', 0.4, 1.2)])
    expect(early.distance[6]!).toBeGreaterThan(plain.distance[6]! + 0.5)
    // v7 carried every runner to her full target in the first second, so none of this counted.
    const v7 = (s: Stats) => simulateRaceV7({ course: oval(2000), seed: 3, runners: [runner(0, s, 'front')] }).distance[6]!
    expect(v7({ ...even(600), power: 1200 })).toBeCloseTo(v7(even(600)), 6)
  })

  it('holds her lane from the final corner instead of drifting back to the rail', () => {
    // She leads from the outside gate; the field is far behind, so nothing blocks her or makes her go round.
    const runners = Array.from({ length: 18 }, (_, gate) => gate === 17 ? runner(17, even(1000), 'front') : runner(gate, even(150), 'end'))
    const timeline = simulateRace({ course: oval(2000), seed: 5, runners })
    const n = timeline.runnerCount
    const finalCorner = 2000 - 600
    const lanes: number[] = []
    for (let tick = 1; tick < timeline.ticks; tick += 1) {
      if (timeline.distance[(tick - 1) * n + 17]! >= finalCorner && timeline.distance[(tick - 1) * n + 17]! < 2000) lanes.push(timeline.lane![tick * n + 17]!)
    }
    expect(lanes.length).toBeGreaterThan(10)
    expect(new Set(lanes).size).toBe(1)
    // Before it she still drifts toward the rail.
    expect(timeline.lane![n + 17]!).toBeGreaterThan(lanes[0]!)
  })

  it('charges a runner off the rail on a corner the extra ground she runs', () => {
    expect(cornerRatio(250, Math.PI / 2, 0)).toBe(1)
    expect(cornerRatio(250, 0, 5)).toBe(1)
    // Five meters out on a quarter-turn of 250 m: radius 159 m, so 159 / 164 of her running is progress.
    expect(cornerRatio(250, Math.PI / 2, 5)).toBeCloseTo(159.15 / 164.15, 3)
    // The same runner from the rail and from gate 18, in a field far behind her.
    const finish = (gate: number) => simulateRace({
      course: oval(1200), seed: 7,
      runners: Array.from({ length: 18 }, (_, index) => index === gate ? runner(index, even(800), 'front') : runner(index, even(150), 'end')),
    }).results.find((result) => result.runner === gate)!.finishTime
    expect(finish(17)).toBeGreaterThan(finish(0) + 0.1)
  })

  it('runs effects for their exact duration, part of a last turn included', () => {
    // Mid-race, where she runs at her target, a speed skill shows for exactly as long as it lasts.
    const finish = (duration: number) => simulateRace({
      course: oval(2000), seed: 11, runners: [runner(0, even(800), 'front', [guaranteed('burst', 'phase==1', 'target-speed', 0.4, duration)])],
    }).results[0]!.finishTime
    // 1.0, 1.2 and 1.5 s on 2,000 m run 2, 2.4 and 3 turns: v7 rounded 2.4 down to 2.
    expect(finish(1.2)).toBeLessThan(finish(1))
    expect(finish(1.5)).toBeLessThan(finish(1.2))
    const v7 = (duration: number) => simulateRaceV7({
      course: oval(2000), seed: 11, runners: [runner(0, even(800), 'front', [guaranteed('burst', 'phase==1', 'target-speed', 0.4, duration)])],
    }).results[0]!.finishTime
    expect(v7(1.2)).toBe(v7(1))
  })

  it('reads the conditions v7 could not: straight type, second stages, used skills and the race\'s grade', () => {
    const fired = (skills: CompiledRaceSkill[], course = oval(2000)) => simulateRace({ course, seed: 2, runners: [runner(0, even(800), 'pace', skills), ...field(2).runners.slice(1)] })
      .events.filter((event) => event.type === 'skill-activated' && event.runner === 0)
    // The back straight is the original's front type 2.
    const back = fired([guaranteed('back', 'straight_front_type==2&phase==1', 'target-speed', 0.2, 1)])
    expect(back).toHaveLength(1)
    const twoStage: CompiledRaceSkill = {
      ...guaranteed('two-stage', 'phase==1', 'target-speed', 0.2, 1),
      groups: [
        guaranteed('two-stage', 'phase==1', 'target-speed', 0.2, 1).groups[0]!,
        guaranteed('two-stage', 'is_activate_other_skill_detail==1&phase==2', 'target-speed', 0.3, 1).groups[0]!,
      ],
    }
    const stages = fired([twoStage]).filter((event) => event.skillId === 'two-stage')
    expect(stages.map((event) => event.skillGroup)).toEqual([0, 1])
    const chain = fired([
      guaranteed('100', 'phase==1', 'target-speed', 0.1, 1),
      guaranteed('200', 'is_used_skill_id==100&phase==2', 'target-speed', 0.1, 1),
      guaranteed('300', 'is_used_skill_id==999&phase==2', 'target-speed', 0.1, 1),
      guaranteed('400', 'grade==100&phase==2', 'target-speed', 0.1, 1),
    ]).map((event) => event.skillId)
    expect(chain).toEqual(expect.arrayContaining(['100', '200', '400']))
    expect(chain).not.toContain('300')
    // A lottery is drawn once a race: certain at 100, never at 0. A strong runner holds the top 80% once the start settles.
    const strong = simulateRace({ course: oval(2000), seed: 2, runners: [
      runner(0, even(1200), 'front', [
        guaranteed('lot-sure', 'random_lot==100&phase==1', 'target-speed', 0.1, 1),
        guaranteed('lot-never', 'random_lot==0&phase==1', 'target-speed', 0.1, 1),
        guaranteed('top-band', 'order_rate_in80_continue==1&phase==2', 'target-speed', 0.1, 1),
      ]),
      ...field(2).runners.slice(1).map((other) => ({ ...other, stats: even(400) })),
    ] }).events.filter((event) => event.type === 'skill-activated' && event.runner === 0).map((event) => event.skillId)
    expect(strong).toEqual(expect.arrayContaining(['lot-sure', 'top-band']))
    expect(strong).not.toContain('lot-never')
  })

  it('lets skills beat Speed: 1,000 Speed with procing skills beats 1,400 Speed without', () => {
    const kit = [
      guaranteed('unique', 'phase_random==2', 'target-speed', 0.35 * 1.1, 5),
      guaranteed('gold-speed', 'is_finalcorner==1', 'target-speed', 0.35, 3),
      guaranteed('gold-acceleration', 'phase==2', 'acceleration', 0.4, 3),
      guaranteed('white-speed', 'phase==1', 'target-speed', 0.15, 3),
      guaranteed('white-acceleration', 'is_lastspurt==1', 'acceleration', 0.2, 3),
    ]
    let wins = 0
    let races = 0
    for (const style of STYLES) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const runners = Array.from({ length: 12 }, (_, gate) =>
          gate === 0 ? runner(0, { ...even(800), speed: 1400 }, style)
            : gate === 1 ? runner(1, { ...even(800), speed: 1000 }, style, kit)
              : runner(gate, even(800), STYLES[gate % 4]))
        const results = simulateRace({ course: oval(2000), seed, runners }).results
        if (results.find((result) => result.runner === 1)!.placement < results.find((result) => result.runner === 0)!.placement) wins += 1
        races += 1
      }
    }
    expect(wins / races).toBeGreaterThanOrEqual(0.75)
  })

  it('makes every stat count: 300 more of any one finishes faster at 2,400 m', () => {
    const time = (stat?: keyof Stats) => {
      let total = 0
      for (let seed = 1; seed <= 40; seed += 1) {
        const runners = Array.from({ length: 12 }, (_, gate) =>
          runner(gate, gate === 0 && stat ? { ...even(800), [stat]: 1100 } : even(800), gate === 0 ? 'pace' : STYLES[gate % 4]))
        total += simulateRace({ course: oval(2400), seed, runners }).results.find((result) => result.runner === 0)!.finishTime
      }
      return total / 40
    }
    const baseline = time()
    for (const stat of ['speed', 'stamina', 'power', 'guts', 'wit'] as const) expect(time(stat)).toBeLessThan(baseline)
  })
})
