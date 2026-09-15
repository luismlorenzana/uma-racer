// Pure course-layout normalization for later race-engine milestones R3/R4.

import type { CourseTemplate } from '@racer/domain'
import { id, number as numberValue, records, type NormalizeResult } from './shared'
import { VENUES_BY_TRACK_ID } from './races'

export function normalizeCourses(value: unknown): NormalizeResult<CourseTemplate> {
  const warnings: string[] = []
  const items: CourseTemplate[] = []
  const seen = new Set<string>()

  for (const track of records(value)) {
    const trackId = id(track.id)
    if (!trackId || !VENUES_BY_TRACK_ID[trackId]) continue
    for (const course of records(track.courses)) {
      const courseId = id(course.id)
      const distance = numberValue(course.distance)
      const terrain = numberValue(course.terrain)
      const turn = numberValue(course.turn)
      if (!courseId || distance === null || terrain === null || turn === null) {
        warnings.push(`Course ${courseId ?? '<missing id>'} on track ${trackId} has invalid required fields and was skipped`)
        continue
      }
      if (seen.has(courseId)) continue
      seen.add(courseId)
      items.push({
        id: courseId,
        trackId,
        distance,
        terrain,
        turn,
        corners: course.corners ?? [],
        straights: course.straights ?? [],
        slopes: course.slopes ?? [],
      })
    }
  }

  return { items, warnings }
}
