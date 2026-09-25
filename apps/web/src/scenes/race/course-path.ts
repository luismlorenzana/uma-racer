// Course geometry for the race view (M018 part D): the race's own corners and straights laid out as a 2-D path.
// Presentation only — the simulation never reads it.

import type { RaceCourseLayout } from '@racer/domain'

/** Each numbered corner of a JRA oval turns a quarter circle; a corner the race starts part-way round turns less. */
const CORNER_TURN = Math.PI / 2

export interface CoursePath {
  distance: number
  /** Inner-rail point every meter, in y-up meters, and the heading there (radians, counter-clockwise from +x). */
  x: Float32Array
  y: Float32Array
  heading: Float32Array
  /** Unit vector from the inner rail towards the outer rail, every meter. */
  outX: Float32Array
  outY: Float32Array
}

/**
 * Walks the race meter by meter: straights hold the heading, corners turn it. `rotation` is the original's code — 1
 * turns right (clockwise), 2 left, 4 a straight course; anything else is drawn as a left-handed course.
 */
export function buildCoursePath(distance: number, layout: RaceCourseLayout | undefined, rotation: number | undefined): CoursePath {
  const length = Math.max(1, Math.ceil(distance))
  const x = new Float32Array(length + 1)
  const y = new Float32Array(length + 1)
  const heading = new Float32Array(length + 1)
  const outX = new Float32Array(length + 1)
  const outY = new Float32Array(length + 1)
  const corners = rotation === 4 ? [] : layout?.corners ?? []
  // Every corner turns a quarter circle over its own length, except one the start clips: only a corner beginning at
  // 0 m can be cut short, and it turns in proportion to the longest corner on the course.
  const longest = corners.reduce((max, corner) => Math.max(max, corner.end - corner.start), 0)
  const fullLength = (corner: { start: number; end: number }) => corner.start === 0 ? longest : corner.end - corner.start
  const sign = rotation === 1 ? -1 : 1
  let angle = 0
  let px = 0
  let py = 0
  for (let meter = 0; meter <= length; meter += 1) {
    x[meter] = px
    y[meter] = py
    heading[meter] = angle
    // Inside of the turns is on the runner's left on a left-handed course, so outward is her right.
    outX[meter] = sign * Math.sin(angle)
    outY[meter] = -sign * Math.cos(angle)
    const corner = corners.find((segment) => meter >= segment.start && meter < segment.end)
    const turn = corner ? (sign * CORNER_TURN) / Math.max(1, fullLength(corner)) : 0
    // Advance along the chord at the mid-step heading, which keeps a quarter turn round rather than faceted.
    const mid = angle + turn / 2
    px += Math.cos(mid)
    py += Math.sin(mid)
    angle += turn
  }
  return { distance, x, y, heading, outX, outY }
}

/** Linear sample at a fractional distance, clamped to the course. */
export function sampleCourse(path: CoursePath, distance: number): { x: number; y: number; heading: number; outX: number; outY: number } {
  const clamped = Math.min(path.x.length - 1, Math.max(0, distance))
  const index = Math.min(path.x.length - 2, Math.floor(clamped))
  const t = clamped - index
  const lerp = (values: Float32Array) => values[index]! + (values[index + 1]! - values[index]!) * t
  return { x: lerp(path.x), y: lerp(path.y), heading: lerp(path.heading), outX: lerp(path.outX), outY: lerp(path.outY) }
}

/** The path's bounding box, for fitting a minimap. */
export function courseBounds(path: CoursePath): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let index = 0; index < path.x.length; index += 1) {
    minX = Math.min(minX, path.x[index]!)
    maxX = Math.max(maxX, path.x[index]!)
    minY = Math.min(minY, path.y[index]!)
    maxY = Math.max(maxY, path.y[index]!)
  }
  return { minX, minY, maxX, maxY }
}
