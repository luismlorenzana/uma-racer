import { describe, expect, it } from 'vitest'
import {
  FLAIR_SERIES_REQUIRED_LEGS,
  FLAIR_SERIES_TAGS,
  type FlairSeriesTag,
  type RaceTemplate,
} from '@racer/domain'
import { applyFlairOverride } from './flair'

const races: RaceTemplate[] = Array.from({ length: 11 }, (_, index) => ({
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
  seriesLegs: [],
  courseId: `synthetic-course-${index + 1}`,
  season: 1,
  fieldSize: 8,
}))

function seriesEntry(tag: FlairSeriesTag) {
  const legs = Array.from({ length: FLAIR_SERIES_REQUIRED_LEGS[tag] }, (_, index) => ({
    key: `leg-${index + 1}`,
    familyIds: index === 0 && tag === 'triple-crown'
      ? ['synthetic-family-1', 'synthetic-family-4']
      : [`synthetic-family-${index + 1}`],
  }))
  return { tag, legs }
}

const override = {
  version: 2,
  series: FLAIR_SERIES_TAGS.map(seriesEntry),
  mainVenueKeys: races.slice(0, 10).map((race) => race.venueKey).reverse(),
}

describe('private flair overlay', () => {
  it('stamps deterministic series legs, alias families, and aggregate coverage', () => {
    const result = applyFlairOverride(races, override)
    expect(result.warnings).toEqual([])
    expect(result.coverage).toEqual({ taggedFamilies: 4, taggedSeries: 8, mainVenues: 10 })
    expect(result.items[0]).toMatchObject({
      venueTags: ['jra-main'],
      series: [...FLAIR_SERIES_TAGS].sort(),
      seriesLegs: FLAIR_SERIES_TAGS.map((tag) => `${tag}:leg-1`).sort(),
    })
    expect(result.items[3]).toMatchObject({
      series: ['triple-crown'],
      seriesLegs: ['triple-crown:leg-1'],
    })
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it('allows a partial override while reporting only covered series', () => {
    const result = applyFlairOverride(races, { ...override, series: [seriesEntry('triple-crown')] })
    expect(result.coverage).toEqual({ taggedFamilies: 4, taggedSeries: 1, mainVenues: 10 })
    expect(result.items[0]?.series).toEqual(['triple-crown'])
  })

  it('warns without leaking references when the ignored override is absent', () => {
    const result = applyFlairOverride(races, null)
    expect(result.coverage).toEqual({ taggedFamilies: 0, taggedSeries: 0, mainVenues: 0 })
    expect(result.warnings).toEqual(['Flair override is missing; race-set titles and Grand Tour are disabled'])
    expect(result.items.every((race) => race.series.length === 0 && race.seriesLegs.length === 0 && race.venueTags.length === 0)).toBe(true)
  })

  it('rejects invalid tags, duplicate tags and leg keys, and wrong leg counts', () => {
    expect(() => applyFlairOverride(races, { ...override, series: [...override.series, override.series[0]] })).toThrow(/duplicate series tags/)
    expect(() => applyFlairOverride(races, {
      ...override,
      series: [{ ...override.series[0], tag: 'unknown-series' }, ...override.series.slice(1)],
    })).toThrow(/invalid series mapping/)
    expect(() => applyFlairOverride(races, {
      ...override,
      series: override.series.map((entry, index) => index === 0
        ? { ...entry, legs: [...entry.legs.slice(0, 2), { ...entry.legs[1] }] }
        : entry),
    })).toThrow(/duplicate triple-crown leg keys/)
    expect(() => applyFlairOverride(races, {
      ...override,
      series: override.series.map((entry) => entry.tag === 'dirt-crown' ? { ...entry, legs: entry.legs.slice(0, 1) } : entry),
    })).toThrow(/dirt-crown leg coverage/)
  })

  it('rejects duplicate/unknown families and unknown or wrongly sized venue sets', () => {
    expect(() => applyFlairOverride(races, {
      ...override,
      series: override.series.map((entry, index) => index === 0 ? {
        ...entry,
        legs: entry.legs.map((leg, legIndex) => legIndex === 1
          ? { ...leg, familyIds: [entry.legs[0]!.familyIds[0]!] }
          : leg),
      } : entry),
    })).toThrow(/repeats a family inside triple-crown/)
    expect(() => applyFlairOverride(races, {
      ...override,
      series: override.series.map((entry, index) => index === 0 ? {
        ...entry,
        legs: entry.legs.map((leg, legIndex) => legIndex === 0 ? { ...leg, familyIds: ['synthetic-unknown'] } : leg),
      } : entry),
    })).toThrow(/unknown retained family/)
    expect(() => applyFlairOverride(races, {
      ...override,
      mainVenueKeys: [...override.mainVenueKeys.slice(0, 9), 'synthetic-unknown'],
    })).toThrow(/unknown retained venue/)
    expect(() => applyFlairOverride(races, { ...override, mainVenueKeys: override.mainVenueKeys.slice(0, 9) })).toThrow(/exactly 10/)
    expect(() => applyFlairOverride(races, {
      ...override,
      mainVenueKeys: [...override.mainVenueKeys, races[10]!.venueKey],
    })).toThrow(/exactly 10/)
  })
})
