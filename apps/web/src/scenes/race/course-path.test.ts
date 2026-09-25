import { describe, expect, it } from 'vitest'
import { buildCoursePath, sampleCourse } from './course-path'

// A 2,000 m left-handed oval: four 300 m corners, two 400 m straights, finishing where it started.
const oval = {
  corners: [
    { start: 400, end: 700, number: 1 },
    { start: 700, end: 1_000, number: 2 },
    { start: 1_400, end: 1_700, number: 3 },
    { start: 1_700, end: 2_000, number: 4 },
  ],
  straights: [{ start: 0, end: 400 }, { start: 1_000, end: 1_400 }],
}

describe('course path', () => {
  it('turns a quarter circle per corner, so a full oval closes on itself', () => {
    const path = buildCoursePath(2_000, oval, 2)
    const end = sampleCourse(path, 2_000)
    expect(end.heading).toBeCloseTo(2 * Math.PI, 5)
    expect(Math.hypot(end.x, end.y)).toBeLessThan(1)
    // Halfway round a left-handed course she has turned left: the back straight lies above the start.
    expect(sampleCourse(path, 1_200).y).toBeGreaterThan(100)
  })

  it('mirrors a right-handed course and puts the inside of the turns on her right', () => {
    const left = buildCoursePath(2_000, oval, 2)
    const right = buildCoursePath(2_000, oval, 1)
    expect(sampleCourse(right, 1_200).y).toBeCloseTo(-sampleCourse(left, 1_200).y, 3)
    // Outward points away from the infield: to her right on a left-handed course (−y at the start), left on a right-handed one.
    expect(sampleCourse(left, 0).outY).toBeCloseTo(-1, 5)
    expect(sampleCourse(right, 0).outY).toBeCloseTo(1, 5)
  })

  it('turns only part of a corner the race starts inside, and draws a straight course straight', () => {
    const clipped = buildCoursePath(1_700, { corners: [{ start: 0, end: 150, number: 2 }, { start: 1_100, end: 1_400, number: 3 }], straights: [] }, 2)
    // The start cuts corner 2 to 150 m; against the course's longest corner (300 m) that is an eighth of a turn.
    expect(sampleCourse(clipped, 150).heading).toBeCloseTo(Math.PI / 4, 5)
    expect(sampleCourse(clipped, 1_400).heading).toBeCloseTo(Math.PI * 3 / 4, 5)
    expect(sampleCourse(buildCoursePath(1_000, oval, 4), 900).heading).toBe(0)
  })
})
