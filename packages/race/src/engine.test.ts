import type { Stats, Strategy } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { formatMargin, phaseAt, sampleTimeline, simulateRace, type RaceInput, type RaceRunnerInput } from './index'

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

describe('simulateRace', () => {
  it('is deterministic for a seed', () => {
    const a = simulateRace(fullField(42))
    const b = simulateRace(fullField(42))
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
    expect(staminaWins).toBeGreaterThanOrEqual(27)
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
    simulateRace(fullField(5, 3200))
    expect(performance.now() - started).toBeLessThan(250)
  })
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
