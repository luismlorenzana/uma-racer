import { describe, expect, it } from 'vitest'
import { assertRaceCourseContent, compileRaceCourseLayout, type CourseTemplate, type RaceTemplate } from './index'

const course = (overrides: Partial<CourseTemplate> = {}): CourseTemplate => ({
  id: 'synthetic-course',
  trackId: 'synthetic-track',
  distance: 3,
  terrain: 1,
  turn: 1,
  corners: [{ start: 700, end: 1_100, number: 1 }, { start: 1_700, end: 2_100, number: 2 }],
  straights: [{ start: 0, end: 700, frontType: 1 }, { start: 1_100, end: 1_700, frontType: 2 }],
  slopes: [],
  ...overrides,
})

describe('race course layout', () => {
  it('clips ordered imported segments to the selected distance', () => {
    expect(compileRaceCourseLayout(course(), 2_000, 'left')).toEqual({
      corners: [{ start: 700, end: 1_100, number: 1 }, { start: 1_700, end: 2_000, number: 2 }],
      straights: [{ start: 0, end: 700 }, { start: 1_100, end: 1_700 }],
    })
  })

  it('uses the whole-course fallback only for an explicitly straight course', () => {
    expect(compileRaceCourseLayout(course({ corners: [], straights: [] }), 1_000, 'straight'))
      .toEqual({ corners: [], straights: [{ start: 0, end: 1_000 }] })
    expect(() => compileRaceCourseLayout(course({ corners: [], straights: [] }), 1_000, 'left')).toThrow(/no usable geometry/)
  })

  it('rejects overlapping or malformed source geometry', () => {
    expect(() => compileRaceCourseLayout(course({
      corners: [{ start: 500, end: 900, number: 1 }, { start: 800, end: 1_000, number: 2 }],
    }), 2_000, 'left')).toThrow(/malformed or unordered/)
  })

  it('validates race-to-course joins without consulting private content at runtime', () => {
    const race = {
      id: 'synthetic-race', familyId: '101', name: 'Synthetic Race', grade: 'g1', surface: 'turf', distance: 2_000,
      distanceCategory: 'medium', direction: 'left', venue: 'Synthetic', courseId: 'synthetic-course', season: 1, fieldSize: 8,
    } satisfies RaceTemplate
    expect(() => assertRaceCourseContent([race], [course()])).not.toThrow()
    expect(() => assertRaceCourseContent([{ ...race, courseId: 'missing' }], [course()])).toThrow(/missing course/)
  })
})
