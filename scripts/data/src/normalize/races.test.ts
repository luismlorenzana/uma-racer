import { describe, expect, it } from 'vitest'
import { syntheticRaces, syntheticRacetracks } from '../__fixtures__/synthetic'
import { normalizeCourses } from './courses'
import { normalizeRaces } from './races'

describe('normalizeRaces', () => {
  it('deduplicates and maps grade, surface, distance, direction, venue, and field size', () => {
    const result = normalizeRaces(syntheticRaces)
    expect(result.items).toHaveLength(5)
    expect(result.items[0]).toEqual({
      id: '8101',
      familyId: '8801',
      name: 'Synthetic Sprint Cup',
      grade: 'g1',
      surface: 'turf',
      distance: 1400,
      distanceCategory: 'sprint',
      direction: 'right',
      venue: 'Tokyo',
      venueKey: '10006',
      venueTags: [],
      series: [],
      courseId: '8201',
      season: 1,
      fieldSize: 18,
    })
    expect(result.items[1]).toMatchObject({ grade: 'g2', surface: 'dirt', direction: 'left', venue: 'Ohi' })
    expect(result.items[2]).toMatchObject({ grade: 'g3', distanceCategory: 'medium', direction: 'straight' })
    expect(result.items[3]).toMatchObject({ grade: 'op', distanceCategory: 'long' })
    expect(result.items[4]).toMatchObject({ grade: 'pre-op' })
    expect(result.warnings).toHaveLength(2)
  })
})

describe('normalizeCourses', () => {
  it('keeps layouts only for supported venues', () => {
    const result = normalizeCourses(syntheticRacetracks)
    expect(result.warnings).toEqual([])
    expect(result.items).toEqual([
      {
        id: '8201',
        trackId: '10006',
        distance: 1,
        terrain: 1,
        turn: 1,
        corners: [{ start: 400, end: 600, number: 1 }],
        straights: [{ start: 0, end: 400, frontType: 1 }],
        slopes: [{ start: 900, slope: 1 }],
      },
    ])
  })
})
