// Race series (the private flair overlay's series and legs), kept from the retired badges module by T152 (D381):
// the career generator draws its Main G1 sets from them, and `RaceTemplate.series` carries them.

export const FLAIR_SERIES_TAGS = [
  'triple-crown',
  'triple-tiara',
  'spring-triple-crown',
  'autumn-triple-crown',
  'grand-prix',
  'sprint-crown',
  'mile-crown',
  'dirt-crown',
] as const
export type FlairSeriesTag = (typeof FLAIR_SERIES_TAGS)[number]

export const FLAIR_SERIES_REQUIRED_LEGS: Readonly<Record<FlairSeriesTag, number>> = {
  'triple-crown': 3,
  'triple-tiara': 3,
  'spring-triple-crown': 3,
  'autumn-triple-crown': 3,
  'grand-prix': 2,
  'sprint-crown': 2,
  'mile-crown': 2,
  'dirt-crown': 2,
}

export const FLAIR_SERIES_LEG_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function flairSeriesLegId(tag: FlairSeriesTag, key: string): string {
  if (!FLAIR_SERIES_TAGS.includes(tag) || key.length < 1 || key.length > 40 || !FLAIR_SERIES_LEG_KEY_PATTERN.test(key)) {
    throw new Error('Invalid flair series leg')
  }
  return `${tag}:${key}`
}

export function parseFlairSeriesLegId(value: string): { tag: FlairSeriesTag; key: string } | null {
  const separator = value.indexOf(':')
  if (separator <= 0 || separator !== value.lastIndexOf(':')) return null
  const tag = value.slice(0, separator)
  const key = value.slice(separator + 1)
  if (!FLAIR_SERIES_TAGS.includes(tag as FlairSeriesTag) || key.length < 1 || key.length > 40 ||
    !FLAIR_SERIES_LEG_KEY_PATTERN.test(key)) return null
  return { tag: tag as FlairSeriesTag, key }
}
