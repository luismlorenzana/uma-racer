// Private badge/title classification overlay (docs/design/badges.md#durable-facts-and-honest-history).

import {
  FLAIR_SERIES_REQUIRED_FAMILIES,
  FLAIR_SERIES_TAGS,
  SAVE_ID_PATTERN,
  type FlairSeriesTag,
  type RaceTemplate,
} from '@racer/domain'

interface FlairOverride {
  version: 1
  series: { familyId: string; tags: FlairSeriesTag[] }[]
  mainVenueKeys: string[]
}

export interface FlairOverlayResult {
  items: RaceTemplate[]
  warnings: string[]
  coverage: { taggedFamilies: number; taggedSeries: number; mainVenues: number }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseOverride(value: unknown): FlairOverride {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.series) || !Array.isArray(value.mainVenueKeys) ||
    Object.keys(value).sort().join(',') !== 'mainVenueKeys,series,version') throw new Error('Flair override has an invalid shape')
  const series = value.series.map((entry) => {
    if (!record(entry) || Object.keys(entry).sort().join(',') !== 'familyId,tags' || typeof entry.familyId !== 'string' ||
      !SAVE_ID_PATTERN.test(entry.familyId) || !Array.isArray(entry.tags) ||
      entry.tags.length === 0 || entry.tags.some((tag) => !FLAIR_SERIES_TAGS.includes(tag as FlairSeriesTag)) ||
      new Set(entry.tags).size !== entry.tags.length) {
      throw new Error('Flair override has an invalid family mapping')
    }
    return { familyId: entry.familyId, tags: [...entry.tags].sort() as FlairSeriesTag[] }
  })
  const familyIds = series.map((entry) => entry.familyId)
  if (new Set(familyIds).size !== familyIds.length) throw new Error('Flair override has duplicate family mappings')
  if (value.mainVenueKeys.some((key) => typeof key !== 'string' || !SAVE_ID_PATTERN.test(key)) ||
    new Set(value.mainVenueKeys).size !== value.mainVenueKeys.length) throw new Error('Flair override has invalid main venue keys')
  return { version: 1, series, mainVenueKeys: [...value.mainVenueKeys].sort() }
}

export function applyFlairOverride(races: readonly RaceTemplate[], raw: unknown | null): FlairOverlayResult {
  if (raw === null) {
    return {
      items: races.map((race) => ({ ...race, venueTags: [], series: [] })),
      warnings: ['Flair override is missing; race-set titles and Grand Tour are disabled'],
      coverage: { taggedFamilies: 0, taggedSeries: 0, mainVenues: 0 },
    }
  }
  const override = parseOverride(raw)
  const families = new Set(races.map((race) => race.familyId))
  const venues = new Set(races.map((race) => race.venueKey))
  const unknownFamily = override.series.find((entry) => !families.has(entry.familyId))
  if (unknownFamily) throw new Error('Flair override references an unknown retained family')
  const unknownVenue = override.mainVenueKeys.find((key) => !venues.has(key))
  if (unknownVenue) throw new Error('Flair override references an unknown retained venue')
  if (override.mainVenueKeys.length !== 10) throw new Error('Flair override must identify exactly 10 main venues')
  for (const tag of FLAIR_SERIES_TAGS) {
    const count = override.series.filter((entry) => entry.tags.includes(tag)).length
    if (count !== FLAIR_SERIES_REQUIRED_FAMILIES[tag]) {
      throw new Error(`Flair override has invalid ${tag} family coverage`)
    }
  }
  const tagsByFamily = new Map(override.series.map((entry) => [entry.familyId, entry.tags]))
  const mainVenues = new Set(override.mainVenueKeys)
  return {
    items: races.map((race) => ({
      ...race,
      venueTags: mainVenues.has(race.venueKey) ? ['jra-main'] : [],
      series: [...(tagsByFamily.get(race.familyId) ?? [])],
    })),
    warnings: [],
    coverage: {
      taggedFamilies: tagsByFamily.size,
      taggedSeries: FLAIR_SERIES_TAGS.length,
      mainVenues: mainVenues.size,
    },
  }
}
