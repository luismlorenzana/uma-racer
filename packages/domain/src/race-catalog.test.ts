import { describe, expect, it } from 'vitest'
import type { RaceTemplate } from './content'
import { projectRaceCatalog, regularRaceCatalog } from './race-catalog'

const race = (id: string, name: string, venue = 'Synthetic Park'): RaceTemplate => ({
  id,
  familyId: `synthetic-family-${id}`,
  name,
  grade: 'g1',
  surface: 'turf',
  distance: 2_000,
  distanceCategory: 'medium',
  direction: 'left',
  venue,
  venueKey: `synthetic-venue-${id}`,
  venueTags: [],
  series: [],
  seriesLegs: [],
  courseId: `synthetic-course-${id}`,
  season: 1,
  fieldSize: 8,
})

describe('regular race catalog', () => {
  it('keeps one stable canonical row per display name', () => {
    const catalog = regularRaceCatalog([
      race('20', 'Synthetic Classic'),
      race('10', 'Synthetic Classic'),
      race('30', 'Synthetic Sprint'),
    ])
    expect(catalog.map(({ id, name }) => [id, name])).toEqual([
      ['10', 'Synthetic Classic'],
      ['30', 'Synthetic Sprint'],
    ])
  })

  it('supports a presentation-only exclusion policy while leaving the input intact', () => {
    const rows = [
      race('10', 'Synthetic Cup'),
      race('20', 'Synthetic Retired Cup'),
      race('30', 'Synthetic Overseas', 'Synthetic Abroad'),
    ]
    expect(projectRaceCatalog(rows, (item) => item.name.includes('Retired') || item.venue.endsWith('Abroad'))
      .map(({ id }) => id)).toEqual(['10'])
    expect(rows).toHaveLength(3)
  })
})
