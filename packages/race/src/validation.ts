// Runtime boundary for deterministic race inputs (docs/tasks/T006-basic-race-skills.md).

import { GRADES, STATS, STRATEGIES, SURFACES, parseCompiledRaceSkill } from '@racer/domain'
import type { RaceInput } from './types'

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,120}$/
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}
const finiteNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export function assertRaceInput(value: unknown): asserts value is RaceInput {
  if (!isRecord(value) || !exactKeys(value, ['course', 'runners', 'seed'])) throw new Error('Invalid race input')
  if (!Number.isSafeInteger(value.seed) || (value.seed as number) < 0 || (value.seed as number) > 0xffff_ffff) {
    throw new Error('Invalid race seed')
  }
  if (!isRecord(value.course)) throw new Error('Invalid race course')
  const courseKeys = [
    'distance',
    'surface',
    ...(Object.hasOwn(value.course, 'season') ? ['season'] : []),
    ...(Object.hasOwn(value.course, 'layout') ? ['layout'] : []),
  ]
  if (
    !exactKeys(value.course, courseKeys) || !finiteNonNegative(value.course.distance) || value.course.distance <= 0 ||
    !SURFACES.includes(value.course.surface as (typeof SURFACES)[number]) ||
    (Object.hasOwn(value.course, 'season') && (!Number.isSafeInteger(value.course.season) || (value.course.season as number) < 0))
  ) throw new Error('Invalid race course')
  if (Object.hasOwn(value.course, 'layout')) {
    const layout = value.course.layout
    if (!isRecord(layout) || !exactKeys(layout, ['corners', 'straights']) ||
      !Array.isArray(layout.corners) || !Array.isArray(layout.straights)) throw new Error('Invalid race course layout')
    const distance = value.course.distance as number
    const validSegments = (segments: unknown[], corner: boolean) => segments.every((segment, index) => {
      if (!isRecord(segment) || !exactKeys(segment, corner ? ['start', 'end', 'number'] : ['start', 'end'])) return false
      if (!finiteNonNegative(segment.start) || !finiteNonNegative(segment.end) || segment.end <= segment.start || segment.end > distance) return false
      if (index > 0) {
        const previous = segments[index - 1]
        if (!isRecord(previous) || (previous.end as number) > segment.start) return false
      }
      return !corner || (Number.isSafeInteger(segment.number) && (segment.number as number) >= 1 && (segment.number as number) <= 32)
    })
    if (!validSegments(layout.corners, true) || !validSegments(layout.straights, false) ||
      (layout.corners.length === 0 && layout.straights.length === 0)) throw new Error('Invalid race course layout')
  }
  if (!Array.isArray(value.runners) || value.runners.length < 1 || value.runners.length > 18) {
    throw new Error('Invalid race field size')
  }
  const runners = value.runners
  const gates = new Set<number>()
  const ids = new Set<string>()
  runners.forEach((runner, index) => {
    if (!isRecord(runner)) throw new Error(`Invalid race runner ${index}`)
    const runnerKeys = Object.hasOwn(runner, 'skills')
      ? ['id', 'label', 'stats', 'strategy', 'aptitude', 'gate', 'skills']
      : ['id', 'label', 'stats', 'strategy', 'aptitude', 'gate']
    if (
      !exactKeys(runner, runnerKeys) || typeof runner.id !== 'string' || !ID_PATTERN.test(runner.id) || ids.has(runner.id) ||
      typeof runner.label !== 'string' || runner.label.length < 1 || runner.label.length > 120 ||
      !STRATEGIES.includes(runner.strategy as (typeof STRATEGIES)[number]) ||
      !Number.isSafeInteger(runner.gate) || (runner.gate as number) < 0 || (runner.gate as number) >= runners.length ||
      gates.has(runner.gate as number)
    ) throw new Error(`Invalid race runner ${index}`)
    const stats = runner.stats
    if (!isRecord(stats) || !exactKeys(stats, STATS) || STATS.some((stat) => !finiteNonNegative(stats[stat]))) {
      throw new Error(`Invalid race stats for runner ${index}`)
    }
    const aptitude = runner.aptitude
    if (
      !isRecord(aptitude) || !exactKeys(aptitude, ['distance', 'surface', 'strategy']) ||
      !['distance', 'surface', 'strategy'].every((key) => GRADES.includes(aptitude[key] as (typeof GRADES)[number]))
    ) throw new Error(`Invalid race aptitude for runner ${index}`)
    if (Object.hasOwn(runner, 'skills')) {
      if (!Array.isArray(runner.skills) || runner.skills.length > 64) throw new Error(`Invalid race skills for runner ${index}`)
      const skills = runner.skills.map(parseCompiledRaceSkill)
      if (skills.some((skill) => skill === null) || new Set(skills.map((skill) => skill!.id)).size !== skills.length) {
        throw new Error(`Invalid race skills for runner ${index}`)
      }
    }
    ids.add(runner.id)
    gates.add(runner.gate as number)
  })
}
