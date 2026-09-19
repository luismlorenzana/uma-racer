// Bounded private-course geometry for race engine R3 (docs/design/racing.md#pack-racing-r3).

import type { CourseTemplate, RaceDirection, RaceTemplate } from './content'

export interface RaceCourseCorner {
  /** Meters from the start, inclusive. */
  start: number
  /** Meters from the start, exclusive. */
  end: number
  /** Imported 1-based corner number. */
  number: number
}

export interface RaceCourseStraight {
  /** Meters from the start, inclusive. */
  start: number
  /** Meters from the start, exclusive. */
  end: number
}

export interface RaceCourseLayout {
  corners: RaceCourseCorner[]
  straights: RaceCourseStraight[]
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function sortedNonOverlapping<T extends { start: number; end: number }>(segments: readonly T[]): boolean {
  return segments.every((segment, index) =>
    finite(segment.start) && finite(segment.end) && segment.start >= 0 && segment.end > segment.start &&
    (index === 0 || segment.start >= segments[index - 1]!.end),
  )
}

/**
 * Clips imported geometry to the selected race distance. A truly straight course may use the documented whole-course
 * fallback; malformed geometry and non-straight courses without usable segments fail closed.
 */
export function compileRaceCourseLayout(
  course: CourseTemplate,
  raceDistance: number,
  direction: RaceDirection,
): RaceCourseLayout {
  if (!Number.isSafeInteger(raceDistance) || raceDistance <= 0) throw new Error('Invalid race distance for course layout')
  if (!Array.isArray(course.corners) || !Array.isArray(course.straights)) throw new Error(`Course ${course.id} has no typed layout`)
  if (!sortedNonOverlapping(course.corners) || !sortedNonOverlapping(course.straights)) {
    throw new Error(`Course ${course.id} has malformed or unordered geometry`)
  }
  const corners = course.corners.flatMap((segment) => {
    const end = Math.min(raceDistance, segment.end)
    if (segment.start >= raceDistance || end <= segment.start) return []
    if (!Number.isSafeInteger(segment.number) || segment.number < 1 || segment.number > 32) {
      throw new Error(`Course ${course.id} has an invalid corner number`)
    }
    return [{ start: segment.start, end, number: segment.number }]
  })
  const straights = course.straights.flatMap((segment) => {
    const end = Math.min(raceDistance, segment.end)
    return segment.start >= raceDistance || end <= segment.start ? [] : [{ start: segment.start, end }]
  })
  if (corners.length === 0 && straights.length === 0) {
    if (direction !== 'straight') throw new Error(`Course ${course.id} has no usable geometry`)
    return { corners: [], straights: [{ start: 0, end: raceDistance }] }
  }
  if (straights.length === 0) {
    if (direction !== 'straight') throw new Error(`Course ${course.id} has no usable straight geometry`)
    return { corners, straights: [{ start: 0, end: raceDistance }] }
  }
  return { corners, straights }
}

/** Validate every course/race relationship consumed by engine v3 before gameplay or pack publication. */
export function assertRaceCourseContent(races: readonly RaceTemplate[], courses: readonly CourseTemplate[]): void {
  const byId = new Map<string, CourseTemplate>()
  for (const course of courses) {
    if (typeof course.id !== 'string' || course.id.length === 0 || byId.has(course.id) ||
      typeof course.trackId !== 'string' || course.trackId.length === 0 ||
      !Number.isSafeInteger(course.distance) || course.distance < 1 || course.distance > 4 ||
      !Number.isSafeInteger(course.terrain) || !Number.isSafeInteger(course.turn)) {
      throw new Error(`Course ${String(course.id)} has invalid R3 metadata`)
    }
    byId.set(course.id, course)
  }
  for (const race of races) {
    const course = byId.get(race.courseId)
    if (!course) throw new Error(`Race ${race.id} references missing course ${race.courseId}`)
    compileRaceCourseLayout(course, race.distance, race.direction)
  }
}
