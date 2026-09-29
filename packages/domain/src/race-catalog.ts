// Regular Race Select catalog projection (docs/design/racing.md).

import type { RaceTemplate } from './content'

const HIDDEN_REGULAR_RACE_NAMES = new Set(['copa republica argentina'])
const HIDDEN_REGULAR_RACE_VENUES = new Set(['longchamp'])

const raceNameKey = (name: string): string => name.trim().toLowerCase()

export function projectRaceCatalog(
  races: readonly RaceTemplate[],
  hidden: (race: RaceTemplate) => boolean,
): RaceTemplate[] {
  const byName = new Map<string, RaceTemplate>()
  for (const race of races) {
    if (hidden(race)) continue
    const key = raceNameKey(race.name)
    const current = byName.get(key)
    if (!current || race.id.localeCompare(current.id) < 0) byName.set(key, race)
  }
  return [...byName.values()].sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * Keeps private source rows available to frozen goals, history, and future modes while presenting one canonical row per
 * ordinary race in Race Select. Historical/course variants use the smallest stable content id.
 */
export function regularRaceCatalog(races: readonly RaceTemplate[]): RaceTemplate[] {
  return projectRaceCatalog(races, (race) => {
    const key = raceNameKey(race.name)
    return HIDDEN_REGULAR_RACE_NAMES.has(key) || HIDDEN_REGULAR_RACE_VENUES.has(race.venue.trim().toLowerCase()) ||
      /\(story race use\)/i.test(race.name)
  })
}
