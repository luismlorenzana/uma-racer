import { describe, expect, it } from 'vitest'
import type { RaceTemplate } from '@racer/domain'
import { applyFlairOverride } from './flair'

const races: RaceTemplate[] = Array.from({ length: 10 }, (_, index) => ({
  id: `synthetic-race-${index + 1}`,
  familyId: `synthetic-family-${index + 1}`,
  name: `Synthetic Race ${index + 1}`,
  grade: 'g1',
  surface: 'turf',
  distance: 2_000,
  distanceCategory: 'medium',
  direction: 'left',
  venue: `Synthetic Venue ${index + 1}`,
  venueKey: `synthetic-venue-${index + 1}`,
  venueTags: [],
  series: [],
  courseId: `synthetic-course-${index + 1}`,
  season: 1,
  fieldSize: 8,
}))

const override = {
  version: 1,
  series: [
    { familyId: 'synthetic-family-1', tags: ['triple-tiara', 'triple-crown', 'spring-triple-crown', 'autumn-triple-crown'] },
    { familyId: 'synthetic-family-2', tags: ['triple-crown', 'triple-tiara', 'spring-triple-crown', 'autumn-triple-crown', 'grand-prix', 'sprint-crown', 'mile-crown', 'dirt-crown'] },
    { familyId: 'synthetic-family-3', tags: ['triple-crown', 'triple-tiara', 'spring-triple-crown', 'autumn-triple-crown'] },
    { familyId: 'synthetic-family-4', tags: ['grand-prix', 'sprint-crown', 'mile-crown', 'dirt-crown'] },
  ],
  mainVenueKeys: races.map((race) => race.venueKey).reverse(),
}

describe('private flair overlay', () => {
  it('applies validated family and venue tags with deterministic ordering and aggregate coverage', () => {
    const result = applyFlairOverride(races, override)
    expect(result.warnings).toEqual([])
    expect(result.coverage).toEqual({ taggedFamilies: 4, taggedSeries: 8, mainVenues: 10 })
    expect(result.items[0]).toMatchObject({
      venueTags: ['jra-main'],
      series: ['autumn-triple-crown', 'spring-triple-crown', 'triple-crown', 'triple-tiara'],
    })
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('warns without leaking references when the ignored override is absent', () => {
    const result = applyFlairOverride(races, null)
    expect(result.coverage).toEqual({ taggedFamilies: 0, taggedSeries: 0, mainVenues: 0 })
    expect(result.warnings).toEqual(['Flair override is missing; race-set titles and Grand Tour are disabled'])
    expect(result.items.every((race) => race.series.length === 0 && race.venueTags.length === 0)).toBe(true)
  })

  it('rejects duplicates, unknown references, and invalid cardinalities', () => {
    expect(() => applyFlairOverride(races, {
      ...override,
      series: [...override.series, override.series[0]],
    })).toThrow(/duplicate family/)
    expect(() => applyFlairOverride(races, {
      ...override,
      series: [{ familyId: 'synthetic-unknown', tags: ['triple-crown'] }, ...override.series],
    })).toThrow(/unknown retained family/)
    expect(() => applyFlairOverride(races, {
      ...override,
      mainVenueKeys: [...override.mainVenueKeys.slice(0, 9), 'synthetic-unknown'],
    })).toThrow(/unknown retained venue/)
    expect(() => applyFlairOverride(races, {
      ...override,
      series: override.series.map((entry) => ({ ...entry, tags: entry.tags.filter((tag) => tag !== 'dirt-crown') })),
    })).toThrow(/dirt-crown family coverage/)
  })
})
