import { parseRaceCondition, type CompiledRaceSkill, type Stats, type Strategy } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import {
  formatMargin,
  phaseAt,
  sampleTimeline,
  simulateRace,
  simulateRaceV1,
  simulateRaceV2,
  skillActivationChance,
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
  kind: 'recovery' | 'target-speed' | 'current-speed' | 'current-speed-natural' | 'acceleration',
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
    const skilled = runner(0, stats(600, { stamina: 220 }))
    skilled.skills = [
      compiledSkill('synthetic-speed', 'distance_rate>=40', 'target-speed', 0.35, 3),
      compiledSkill('synthetic-recovery', 'hp_per<=70', 'recovery', 0.35, 0),
    ]
    const input: RaceInput = {
      course: { distance: 3200, surface: 'turf' },
      seed: 91,
      runners: [skilled, runner(1, stats(600, { stamina: 220 }))],
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
  }, 10_000)
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
