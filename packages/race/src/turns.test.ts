import { parseRaceCondition, type CompiledRaceSkill, type Stats, type Strategy } from '@racer/domain'
import { describe, expect, it } from 'vitest'
import { HORSE_LANE } from './constants'
import {
  PASS_GAP,
  phaseStartTurns,
  raceTurns,
  simulateRace,
  simulateRaceV6,
  turnPhase,
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
  it('is the current engine, deterministic, and records one frame a turn', () => {
    const a = simulateRace(field(42))
    const b = simulateRaceV6(field(42))
    expect(a.results).toEqual(b.results)
    expect(Array.from(a.distance)).toEqual(Array.from(b.distance))
    expect(a.tickRate).toBe(1)
    // A frame at the gate, then one per turn until the last runner is home.
    const last = Math.max(...a.results.map((result) => result.finishTime))
    expect(a.ticks).toBe(Math.ceil(last) + 1)
  })

  it('times a finish inside its turn and ranks by it', () => {
    const timeline = simulateRace(field(11))
    const finishes = timeline.events.filter((event) => event.type === 'finish')
    for (const event of finishes) {
      expect(event.value!).toBeGreaterThan(event.tick - 1)
      expect(event.value!).toBeLessThanOrEqual(event.tick)
    }
    const times = timeline.results.map((result) => result.finishTime)
    expect([...times].sort((left, right) => left - right)).toEqual(times)
  })

  it('records an overtake only when a runner ends a turn ahead of one she started it behind', () => {
    const timeline = simulateRace(field(3))
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
    const timeline = simulateRace({ ...field(5, 1600, 18), runners: Array.from({ length: 18 }, (_, i) => runner(i, stats(700), 'pace')) })
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
      const timeline = simulateRace(input)
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
    const events = simulateRace(input).events.filter((event) => event.type === 'skill-activated' && event.runner === 0)
    const middle = events.find((event) => event.skillId === 'middle')!
    // Three seconds on a 2,000 m course last 3 × 2,000 / 1,000 = 6 turns, from the middle leg's first turn.
    expect(middle.tick).toBe(18)
    expect(middle.skillExpiresTick).toBe(24)
    const late = events.find((event) => event.skillId === 'late-random')!
    expect(late.tick).toBeGreaterThanOrEqual(68)
    expect(late.tick).toBeLessThanOrEqual(84)
  })
})
