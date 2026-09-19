// Private badge/title classification overlay (docs/design/badges.md#durable-facts-and-honest-history).

import {
  FLAIR_SERIES_LEG_KEY_PATTERN,
  FLAIR_SERIES_REQUIRED_LEGS,
  FLAIR_SERIES_TAGS,
  SAVE_ID_PATTERN,
  flairSeriesLegId,
  type FlairSeriesTag,
  type RaceTemplate,
} from '@racer/domain'

interface FlairOverrideLeg {
  key: string
  familyIds: string[]
}

interface FlairOverrideSeries {
  tag: FlairSeriesTag
  legs: FlairOverrideLeg[]
}

interface FlairOverride {
  version: 2
  series: FlairOverrideSeries[]
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

function parseLeg(value: unknown): FlairOverrideLeg {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'familyIds,key' ||
    typeof value.key !== 'string' || value.key.length < 1 || value.key.length > 40 ||
    !FLAIR_SERIES_LEG_KEY_PATTERN.test(value.key) || !Array.isArray(value.familyIds) || value.familyIds.length === 0 ||
    value.familyIds.some((familyId) => typeof familyId !== 'string' || !SAVE_ID_PATTERN.test(familyId)) ||
    new Set(value.familyIds).size !== value.familyIds.length) {
    throw new Error('Flair override has an invalid series leg')
  }
  return { key: value.key, familyIds: [...value.familyIds].sort() }
}

function parseSeries(value: unknown): FlairOverrideSeries {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'legs,tag' ||
    !FLAIR_SERIES_TAGS.includes(value.tag as FlairSeriesTag) || !Array.isArray(value.legs)) {
    throw new Error('Flair override has an invalid series mapping')
  }
  const tag = value.tag as FlairSeriesTag
  const legs = value.legs.map(parseLeg)
  if (legs.length !== FLAIR_SERIES_REQUIRED_LEGS[tag]) throw new Error(`Flair override has invalid ${tag} leg coverage`)
  if (new Set(legs.map((leg) => leg.key)).size !== legs.length) throw new Error(`Flair override has duplicate ${tag} leg keys`)
  const familyIds = legs.flatMap((leg) => leg.familyIds)
  if (new Set(familyIds).size !== familyIds.length) throw new Error(`Flair override repeats a family inside ${tag}`)
  return { tag, legs: [...legs].sort((left, right) => left.key.localeCompare(right.key)) }
}

function parseOverride(value: unknown): FlairOverride {
  if (!record(value) || value.version !== 2 || !Array.isArray(value.series) || !Array.isArray(value.mainVenueKeys) ||
    Object.keys(value).sort().join(',') !== 'mainVenueKeys,series,version') throw new Error('Flair override has an invalid shape')
  const series = value.series.map(parseSeries)
  if (new Set(series.map((entry) => entry.tag)).size !== series.length) throw new Error('Flair override has duplicate series tags')
  if (value.mainVenueKeys.some((key) => typeof key !== 'string' || !SAVE_ID_PATTERN.test(key)) ||
    new Set(value.mainVenueKeys).size !== value.mainVenueKeys.length) throw new Error('Flair override has invalid main venue keys')
  return {
    version: 2,
    series: [...series].sort((left, right) => left.tag.localeCompare(right.tag)),
    mainVenueKeys: [...value.mainVenueKeys].sort(),
  }
}

export function applyFlairOverride(races: readonly RaceTemplate[], raw: unknown | null): FlairOverlayResult {
  if (raw === null) {
    return {
      items: races.map((race) => ({ ...race, venueTags: [], series: [], seriesLegs: [] })),
      warnings: ['Flair override is missing; race-set titles and Grand Tour are disabled'],
      coverage: { taggedFamilies: 0, taggedSeries: 0, mainVenues: 0 },
    }
  }
  const override = parseOverride(raw)
  const families = new Set(races.map((race) => race.familyId))
  const venues = new Set(races.map((race) => race.venueKey))
  const unknownFamily = override.series.flatMap((entry) => entry.legs)
    .flatMap((leg) => leg.familyIds).find((familyId) => !families.has(familyId))
  if (unknownFamily) throw new Error('Flair override references an unknown retained family')
  const unknownVenue = override.mainVenueKeys.find((key) => !venues.has(key))
  if (unknownVenue) throw new Error('Flair override references an unknown retained venue')
  if (override.mainVenueKeys.length !== 10) throw new Error('Flair override must identify exactly 10 main venues')

  const legIdsByFamily = new Map<string, Set<string>>()
  for (const entry of override.series) {
    for (const leg of entry.legs) {
      const legId = flairSeriesLegId(entry.tag, leg.key)
      for (const familyId of leg.familyIds) {
        const legIds = legIdsByFamily.get(familyId) ?? new Set<string>()
        legIds.add(legId)
        legIdsByFamily.set(familyId, legIds)
      }
    }
  }
  const mainVenues = new Set(override.mainVenueKeys)
  return {
    items: races.map((race) => {
      const seriesLegs = [...(legIdsByFamily.get(race.familyId) ?? [])].sort()
      const series = [...new Set(seriesLegs.map((legId) => legId.slice(0, legId.indexOf(':')) as FlairSeriesTag))].sort()
      return {
        ...race,
        venueTags: mainVenues.has(race.venueKey) ? ['jra-main'] : [],
        series,
        seriesLegs,
      }
    }),
    warnings: [],
    coverage: {
      taggedFamilies: legIdsByFamily.size,
      taggedSeries: override.series.length,
      mainVenues: mainVenues.size,
    },
  }
}
