import { parseRaceCondition, type CompiledRaceSkill, type Stats, type Strategy } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import {
  formatMargin,
  phaseAt,
  sampleTimeline,
  simulateRace,
  simulateRaceV1,
  simulateRaceV2,
  simulateRaceV3,
  simulateRaceV4,
  skillActivationChance,
  staminaContestBonus,
  createRng,
  type RaceInput,
  type RaceRunnerInput,
} from './index'

const stats = (all: number, overrides: Partial<Stats> = {}): Stats => ({
  speed: all,
  stamina: all,
  power: all,
  guts: all,
  wit: all,
  ...overrides,
})

const runner = (gate: number, s: Stats, strategy: Strategy = 'pace'): RaceRunnerInput => ({
  id: `r${gate}`,
  label: `Runner ${gate + 1}`,
  stats: s,
  strategy,
  aptitude: { distance: 'A', surface: 'A', strategy: 'A' },
  gate,
})

const fullField = (seed: number, distance = 2400): RaceInput => ({
  course: { distance, surface: 'turf' },
  seed,
  runners: Array.from({ length: 18 }, (_, i) =>
    runner(i, stats(450 + (i % 5) * 20), (['front', 'pace', 'late', 'end'] as const)[i % 4]),
  ),
})

const compiledSkill = (
  id: string,
  condition: string,
  kind: CompiledRaceSkill['groups'][number]['effects'][number]['kind'],
  amount: number,
  duration = 2,
): CompiledRaceSkill => ({
  id,
  activation: 'guaranteed',
  inherited: false,
  groups: [{
    precondition: null,
    condition: parseRaceCondition(condition)!,
    duration,
    cooldown: 0,
    effects: [{ kind, amount }],
    unsupportedVariables: [],
    unsupportedEffects: [],
  }],
})

describe('simulateRace', () => {
  it('is deterministic for a seed', () => {
    const a = simulateRace(fullField(42, 1_200))
    const b = simulateRace(fullField(42, 1_200))
    expect(a.results).toEqual(b.results)
    expect(Array.from(a.distance)).toEqual(Array.from(b.distance))
  })

  it('finishes every runner in a plausible time', () => {
    const timeline = simulateRace(fullField(7))
    expect(timeline.results).toHaveLength(18)
    for (const result of timeline.results) {
      expect(result.finishTime).toBeGreaterThan(110)
      expect(result.finishTime).toBeLessThan(175)
    }
    expect(timeline.results.map((r) => r.placement)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
  })

  it('lets a much stronger runner win almost always', () => {
    let strongWins = 0
    for (let seed = 1; seed <= 40; seed++) {
      const t = simulateRace({
        course: { distance: 2000, surface: 'turf' },
        seed,
        runners: [runner(0, stats(300)), runner(1, stats(700))],
      })
      if (t.results[0]!.id === 'r1') strongWins++
    }
    expect(strongWins).toBeGreaterThanOrEqual(38)
  })

  it('punishes low stamina on a long course', () => {
    let staminaWins = 0
    for (let seed = 1; seed <= 30; seed++) {
      const t = simulateRace({
        course: { distance: 3200, surface: 'turf' },
        seed,
        runners: [runner(0, stats(600, { stamina: 150 })), runner(1, stats(600, { stamina: 800 }))],
      })
      if (t.results[0]!.id === 'r1') staminaWins++
    }
    expect(staminaWins).toBeGreaterThanOrEqual(18)
    const drained = simulateRace({
      course: { distance: 3200, surface: 'turf' },
      seed: 3,
      runners: [runner(0, stats(600, { stamina: 150 }))],
    })
    expect(drained.events.some((e) => e.type === 'hp-empty')).toBe(true)
  })

  it('decides a spurt for every runner and emits phase changes', () => {
    const timeline = simulateRace(fullField(11))
    expect(timeline.events.filter((e) => e.type === 'spurt')).toHaveLength(18)
    expect(timeline.events.filter((e) => e.type === 'phase').map((e) => e.value)).toEqual([1, 2, 3])
  })

  it('simulates a full field quickly', () => {
    const started = performance.now()
    const timeline = simulateRace(fullField(5, 3200))
    expect(timeline.results).toHaveLength(18)
    // CI runs all six workspace suites concurrently on a shared runner; measured wall time varied by nearly 2x for the
    // same commit, so the absolute precompute budget is a local-development gate rather than a flaky shared-CI signal.
    if (!process.env.CI) expect(performance.now() - started).toBeLessThan(250)
  })

  it('activates deterministic target-speed and recovery skills from engine context', () => {
    // Enough stamina and Wit that the question is whether skills help: v5 re-plans the spurt after a final-leg heal,
    // and Wit decides whether she takes the best plan, as in the original.
    const skilled = runner(0, stats(600, { stamina: 700, wit: 2200 }))
    skilled.skills = [
      compiledSkill('synthetic-speed', 'distance_rate>=40', 'target-speed', 0.35, 3),
      compiledSkill('synthetic-recovery', 'hp_per<=70', 'recovery', 0.35, 0),
    ]
    const input: RaceInput = {
      course: { distance: 3200, surface: 'turf' },
      seed: 91,
      runners: [skilled, runner(1, stats(600, { stamina: 700, wit: 2200 }))],
    }
    const first = simulateRace(input)
    const second = simulateRace(input)
    const activations = first.events.filter((event) => event.type === 'skill-activated')
    expect(activations.map((event) => event.skillId)).toEqual(['synthetic-speed', 'synthetic-recovery'])
    expect(second.events).toEqual(first.events)
    expect(second.results).toEqual(first.results)
    expect(first.results.find((result) => result.id === 'r0')!.finishTime)
      .toBeLessThan(first.results.find((result) => result.id === 'r1')!.finishTime)
    expect(simulateRaceV1(input).events.some((event) => event.type === 'skill-activated')).toBe(false)
  })

  it('applies current-speed immediately and acceleration for its finite duration', () => {
    const skilled = runner(0, stats(650))
    skilled.skills = [
      compiledSkill('synthetic-current-speed', 'phase>=1', 'current-speed', 0.25, 0),
      compiledSkill('synthetic-acceleration', 'phase>=1', 'acceleration', 0.3, 3),
    ]
    const timeline = simulateRace({
      course: { distance: 2_000, surface: 'turf' },
      seed: 8,
      runners: [skilled],
    })
    const baseline = simulateRace({
      course: { distance: 2_000, surface: 'turf' },
      seed: 8,
      runners: [runner(0, stats(650))],
    })
    const activations = timeline.events.filter((event) => event.type === 'skill-activated')
    expect(activations.map((event) => event.skillId)).toEqual(['synthetic-current-speed', 'synthetic-acceleration'])
    expect(activations[1]!.skillExpiresTick! - activations[1]!.tick).toBe(90)
    expect(timeline.results[0]!.finishTime).toBeLessThan(baseline.results[0]!.finishTime)
  })

  it('turns natural current-speed into carried momentum when the modifier expires', () => {
    const skilled = runner(0, stats(700))
    skilled.skills = [compiledSkill('synthetic-natural-speed', 'always==1', 'current-speed-natural', 0.5, 1)]
    const timeline = simulateRace({ course: { distance: 2_000, surface: 'turf' }, seed: 14, runners: [skilled] })
    const activation = timeline.events.find((event) => event.skillId === 'synthetic-natural-speed')!
    const before = timeline.speed[(activation.skillExpiresTick! - 1) * timeline.runnerCount]!
    const after = timeline.speed[activation.skillExpiresTick! * timeline.runnerCount]!
    expect(activation.skillExpiresTick! - activation.tick).toBe(30)
    expect(after).toBeGreaterThan(before - 0.1)
  })

  it('chooses a deterministic random point inside the requested phase half', () => {
    const skilled = runner(0, stats(700))
    skilled.skills = [compiledSkill('synthetic-random', 'phase_laterhalf_random==1', 'target-speed', 0.2)]
    const input: RaceInput = {
      course: { distance: 2_400, surface: 'turf' },
      seed: 510,
      runners: [skilled, runner(1, stats(700))],
    }
    const first = simulateRace(input)
    const second = simulateRace(input)
    const event = first.events.find((entry) => entry.type === 'skill-activated')!
    const distance = first.distance[(event.tick - 1) * first.runnerCount + event.runner]!
    expect(event).toMatchObject({ runner: 0, skillId: 'synthetic-random' })
    expect(distance / input.course.distance).toBeGreaterThanOrEqual(5 / 12)
    // Fixed ticks observe the first sample after crossing the seeded point.
    expect(distance / input.course.distance).toBeLessThan(2 / 3 + 0.002)
    expect(second.events).toEqual(first.events)
  })

  it('uses the first matching group once and applies the original Wit curve', () => {
    const skilled = runner(0, stats(700))
    skilled.skills = [{
      ...compiledSkill('synthetic-priority', 'phase>=1', 'target-speed', 0.4),
      groups: [
        compiledSkill('synthetic-priority', 'phase>=1', 'target-speed', 0.4).groups[0]!,
        compiledSkill('synthetic-priority', 'phase>=1', 'target-speed', 0.1).groups[0]!,
      ],
    }]
    const timeline = simulateRace({
      course: { distance: 2_000, surface: 'turf' },
      seed: 77,
      runners: [skilled, runner(1, stats(700))],
    })
    expect(timeline.events.filter((event) => event.skillId === 'synthetic-priority')).toHaveLength(1)
    expect(timeline.events.find((event) => event.skillId === 'synthetic-priority')).toMatchObject({ skillGroup: 0, value: 0.4 })
    expect(skillActivationChance(100)).toBe(0.2)
    expect(skillActivationChance(600)).toBeCloseTo(0.85)
  })

  it('makes seeded Wit checks reproducible without affecting guaranteed skills', () => {
    const witSkill = { ...compiledSkill('synthetic-wit', 'always==1', 'target-speed', 0.2), activation: 'wit' as const }
    const activations = Array.from({ length: 40 }, (_, index) => {
      const skilled = runner(0, stats(600, { wit: 100 }))
      skilled.skills = [witSkill]
      return simulateRace({ course: { distance: 1_200, surface: 'turf' }, seed: index + 1, runners: [skilled] })
        .events.some((event) => event.skillId === witSkill.id)
    })
    expect(activations.filter(Boolean).length).toBeGreaterThan(0)
    expect(activations.filter(Boolean).length).toBeLessThan(40)
    expect(activations).toEqual(Array.from({ length: 40 }, (_, index) => {
      const skilled = runner(0, stats(600, { wit: 100 }))
      skilled.skills = [witSkill]
      return simulateRace({ course: { distance: 1_200, surface: 'turf' }, seed: index + 1, runners: [skilled] })
        .events.some((event) => event.skillId === witSkill.id)
    }))
  })

  it('rejects malformed compiled skills at the simulation boundary', () => {
    const malformed = runner(0, stats(600))
    malformed.skills = [{ ...compiledSkill('synthetic-invalid', 'phase>=1', 'target-speed', 0.2), activation: 'never' } as unknown as CompiledRaceSkill]
    expect(() => simulateRace({ course: { distance: 1_600, surface: 'turf' }, seed: 1, runners: [malformed] }))
      .toThrow(/Invalid race skills/)
  })

  it('keeps engine-v2 skill timing and timelines free of R3 mutations', () => {
    const skilled = runner(0, stats(650))
    skilled.skills = [compiledSkill('synthetic-v2', 'phase>=1', 'target-speed', 0.25, 3)]
    const input = { course: { distance: 2_000, surface: 'turf' as const }, seed: 81, runners: [skilled, runner(1, stats(650))] }
    const timeline = simulateRaceV2(input)
    const event = timeline.events.find((entry) => entry.type === 'skill-activated')!
    expect(event.skillExpiresTick! - event.tick).toBe(45)
    expect(timeline.lane).toBeUndefined()
    expect(timeline.events.some((entry) => ['position-mode', 'blocked', 'overtake', 'lane-change'].includes(entry.type))).toBe(false)
  })

  it('drives course, gap, nearby, order-change, block, and overtake skill facts from the pack', () => {
    const lead = runner(0, stats(50), 'end')
    const closer = runner(1, stats(4_000), 'front')
    closer.skills = [
      compiledSkill('synthetic-near', 'near_count>=1', 'target-speed', 0.01),
      compiledSkill('synthetic-order-change', 'change_order_onetime<0', 'target-speed', 0.01),
      compiledSkill('synthetic-final-corner', 'is_finalcorner==1&corner!=0', 'target-speed', 0.01),
      compiledSkill('synthetic-final-half', 'is_finalcorner_laterhalf==1', 'target-speed', 0.01),
      compiledSkill('synthetic-gap', 'bashin_diff_infront<=1', 'target-speed', 0.01),
      compiledSkill('synthetic-overtake', 'is_overtake==1', 'target-speed', 0.01),
      compiledSkill('synthetic-clean-run', 'temptation_count==0', 'target-speed', 0.01),
    ]
    const timeline = simulateRace({
      course: {
        distance: 2_000,
        surface: 'turf',
        layout: {
          corners: [{ start: 1_250, end: 1_600, number: 2 }],
          straights: [{ start: 0, end: 1_250 }, { start: 1_600, end: 2_000 }],
        },
      },
      seed: 772,
      runners: [lead, closer],
    })
    const activated = new Set(timeline.events.filter((event) => event.type === 'skill-activated').map((event) => event.skillId))
    expect(activated).toEqual(new Set([
      'synthetic-near',
      'synthetic-order-change',
      'synthetic-final-corner',
      'synthetic-final-half',
      'synthetic-gap',
      'synthetic-overtake',
      'synthetic-clean-run',
    ]))
    expect(timeline.events.some((event) => event.type === 'position-mode')).toBe(true)
    expect(timeline.events.some((event) => event.type === 'overtake')).toBe(true)
  })

  it('exposes front and sustained side blocking to skill conditions', () => {
    const runners = Array.from({ length: 8 }, (_, gate) => {
      const item = runner(gate, stats(650 + (gate % 3) * 25), (['front', 'pace', 'late', 'end'] as const)[gate % 4])
      item.skills = [
        compiledSkill(`synthetic-front-block-${gate}`, 'blocked_front==1', 'target-speed', 0.01),
        compiledSkill(`synthetic-side-block-${gate}`, 'blocked_side_continuetime>=2', 'target-speed', 0.01),
      ]
      return item
    })
    const timeline = simulateRace({ course: { distance: 2_400, surface: 'turf' }, seed: 37, runners })
    const activations = timeline.events.filter((event) => event.type === 'skill-activated').map((event) => event.skillId!)
    expect(activations.some((id) => id.startsWith('synthetic-front-block-'))).toBe(true)
    expect(activations.some((id) => id.startsWith('synthetic-side-block-'))).toBe(true)
  })

  it('keeps lane samples finite, bounded, deterministic, and collision-resolved across field sizes and seeds', () => {
    for (const fieldSize of [8, 18]) {
      for (let seed = 1; seed <= 8; seed += 1) {
        const base = fullField(seed, seed % 2 ? 1_200 : 3_200)
        const input = { ...base, runners: base.runners.slice(0, fieldSize) }
        const first = simulateRace(input)
        const second = simulateRace(input)
        expect(Array.from(first.lane!)).toEqual(Array.from(second.lane!))
        expect(first.lane!.every((lane) => Number.isFinite(lane) && lane >= 0 && lane <= 11.25)).toBe(true)
        for (let tick = 1; tick < first.ticks; tick += 1) {
          for (let index = 0; index < fieldSize; index += 1) {
            expect(first.distance[tick * fieldSize + index]!).toBeGreaterThanOrEqual(first.distance[(tick - 1) * fieldSize + index]!)
          }
        }
        expect(new Set(first.results.map((result) => result.placement)).size).toBe(fieldSize)
      }
    }
  }, 20_000)
})

describe('playback', () => {
  it('interpolates between ticks', () => {
    const timeline = simulateRace(fullField(9))
    const frames = sampleTimeline(timeline, 30.5, [])
    expect(frames).toHaveLength(18)
    const tickA = Math.floor(30.5 * timeline.tickRate)
    const a = timeline.distance[tickA * 18]!
    const b = timeline.distance[(tickA + 1) * 18]!
    expect(frames[0]!.distance).toBeGreaterThanOrEqual(Math.min(a, b))
    expect(frames[0]!.distance).toBeLessThanOrEqual(Math.max(a, b))
  })
})

describe('helpers', () => {
  it('splits a race into phases', () => {
    expect(phaseAt(0, 2400)).toBe(0)
    expect(phaseAt(400, 2400)).toBe(1)
    expect(phaseAt(1600, 2400)).toBe(2)
    expect(phaseAt(2000, 2400)).toBe(3)
  })

  it('formats margins', () => {
    expect(formatMargin(0)).toBe('')
    expect(formatMargin(0.02)).toBe('Nose')
    expect(formatMargin(0.1)).toBe('Head')
    expect(formatMargin(0.3)).toBe('Neck')
    expect(formatMargin(0.5)).toBe('½ length')
    expect(formatMargin(1)).toBe('1 length')
    expect(formatMargin(2.75)).toBe('2 ¾ lengths')
    expect(formatMargin(12)).toBe('Big margin')
  })
})

describe('stamina contest (engine v4, D135)', () => {
  it('pays nothing at 1,200 stamina or under, or at 2,100 m or shorter', () => {
    expect(staminaContestBonus(1200, 3000, createRng(1))).toBe(0)
    expect(staminaContestBonus(1800, 2100, createRng(1))).toBe(0)
  })

  it('scales with √(stamina − 1200) and the distance factor, within the 0.98–1.02 random band', () => {
    // √(1600 − 1200) × 0.0085 = 0.17 m/s before the distance factor.
    for (const [distance, factor] of [[2200, 0.5], [2400, 1.0], [2500, 1.5], [3200, 1.8]] as const) {
      const bonus = staminaContestBonus(1600, distance, createRng(7))
      expect(bonus).toBeGreaterThanOrEqual(0.17 * factor * 0.98 - 1e-9)
      expect(bonus).toBeLessThanOrEqual(0.17 * factor * 1.02 + 1e-9)
    }
  })

  it('raises the max spurt of a high-stamina runner on a long course, and leaves v3 replays untouched', () => {
    const input: RaceInput = {
      course: { distance: 3000, surface: 'turf' },
      seed: 11,
      runners: [runner(0, stats(1000, { stamina: 1800, speed: 1300 }))],
    }
    const v4 = simulateRaceV4(input).results[0]!
    const v3 = simulateRaceV3(input).results[0]!
    expect(v4.spurtMaxed).toBe(true)
    expect(v3.spurtMaxed).toBe(true)
    expect(v4.spurtSpeed).toBeGreaterThan(v3.spurtSpeed)
    expect(v4.finishTime).toBeLessThan(v3.finishTime)
    // Under the threshold the rules agree exactly.
    const plain = { ...input, runners: [runner(0, stats(1000, { stamina: 1150, speed: 1300 }))] }
    expect(simulateRaceV4(plain).results[0]!.finishTime).toBe(simulateRaceV3(plain).results[0]!.finishTime)
  })
})

const straightCourse = (distance: number, slopes: { start: number; end: number; slope: number }[] = []): RaceInput['course'] => ({
  distance,
  surface: 'turf',
  layout: { corners: [], straights: [{ start: 0, end: distance }], slopes },
  trackId: 10006,
  rotation: 2,
})

describe('engine v5 (M018)', () => {
  it('plans a spurt a short-of-HP runner can finish, and marks it where it begins', () => {
    const input: RaceInput = { course: straightCourse(2400), seed: 5, runners: [runner(0, stats(900, { stamina: 250, wit: 2200 }))] }
    const v5 = simulateRace(input)
    const spurt = v5.events.find((event) => event.type === 'spurt')!
    // She holds her final-leg pace past the leg's start, then spurts at the speed her HP can carry to the line.
    expect(v5.distance[spurt.tick * v5.runnerCount]!).toBeGreaterThan(2400 * (2 / 3) + 10)
    expect(v5.results[0]!.spurtMaxed).toBe(false)
    // The plan leaves the last 60 m out, as the original does: HP may run dry there and nowhere earlier.
    const empty = v5.events.find((event) => event.type === 'hp-empty')
    if (empty) expect(v5.distance[empty.tick * v5.runnerCount]!).toBeGreaterThan(2400 - 90)
    // Taking the fastest plan every time, v5 beats v4's hold-one-speed-from-the-leg-start choice.
    expect(v5.results[0]!.finishTime).toBeLessThan(simulateRaceV4(input).results[0]!.finishTime)
  })

  it('applies green skills and gate skills at the gate', () => {
    const plain = runner(0, stats(600))
    const greens = { ...runner(0, stats(600)), skills: [
      compiledSkill('synthetic-green', 'rotation==2', 'passive-stamina', 60, 0),
      compiledSkill('synthetic-gate', 'always==1', 'start-delay', 0.4, 0),
    ] }
    const base = simulateRace({ course: straightCourse(2000), seed: 3, runners: [plain] })
    const boosted = simulateRace({ course: straightCourse(2000), seed: 3, runners: [greens] })
    const gate = boosted.events.filter((event) => event.type === 'skill-activated')
    expect(gate.map((event) => [event.skillId, event.tick])).toEqual([['synthetic-green', 0], ['synthetic-gate', 0]])
    expect(boosted.results[0]!.startDelay).toBeCloseTo(base.results[0]!.startDelay * 0.4, 10)
    // A green whose course condition fails does nothing.
    const wrongCourse = { ...greens, skills: [compiledSkill('synthetic-green', 'rotation==1', 'passive-stamina', 60, 0)] }
    expect(simulateRace({ course: straightCourse(2000), seed: 3, runners: [wrongCourse] }).events
      .some((event) => event.type === 'skill-activated')).toBe(false)
  })

  it('slows a climb by 200 / Power per percent, and times random-point skills on the course\'s own geometry', () => {
    const flat = simulateRace({ course: straightCourse(2000), seed: 4, runners: [runner(0, stats(700))] })
    const hill = simulateRace({ course: straightCourse(2000, [{ start: 400, end: 1000, slope: 20_000 }]), seed: 4, runners: [runner(0, stats(700))] })
    expect(hill.results[0]!.finishTime).toBeGreaterThan(flat.results[0]!.finishTime + 0.3)

    const climber = { ...runner(0, stats(700)), skills: [compiledSkill('synthetic-hill', 'up_slope_random==1', 'target-speed', 0.2, 2)] }
    const timeline = simulateRace({ course: straightCourse(2000, [{ start: 400, end: 1000, slope: 20_000 }]), seed: 4, runners: [climber] })
    const fired = timeline.events.find((event) => event.type === 'skill-activated')!
    const at = timeline.distance[fired.tick * timeline.runnerCount]!
    expect(at).toBeGreaterThanOrEqual(400)
    expect(at).toBeLessThan(1000 + 25)
    // No slope, no trigger.
    expect(simulateRace({ course: straightCourse(2000), seed: 4, runners: [climber] }).events
      .some((event) => event.type === 'skill-activated')).toBe(false)
  })

  it('starts a duel between evenly matched runners on the final straight', () => {
    const input: RaceInput = {
      course: straightCourse(1800),
      seed: 12,
      runners: [runner(0, stats(900)), runner(1, stats(900))],
    }
    const timeline = simulateRace(input)
    const duels = timeline.events.filter((event) => event.type === 'duel' && event.value === 1)
    expect(duels.length).toBeGreaterThan(0)
    expect(duels.every((event) => event.targetRunner !== undefined && event.targetRunner !== event.runner)).toBe(true)
    expect(simulateRaceV4(input).events.some((event) => event.type === 'duel')).toBe(false)
  })

  it('leaves engine-v4 replays exactly as they were', () => {
    const input = fullField(21)
    expect(simulateRaceV4(input)).toEqual(simulateRaceV4(input))
    expect(simulateRaceV4(input).results).not.toEqual(simulateRace(input).results)
  })
})
