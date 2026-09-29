// Regular Race Select catalog projection (docs/design/racing.md).

import type { RaceTemplate } from './content'

const HIDDEN_REGULAR_RACE_NAMES = new Set(['copa republica argentina'])
const HIDDEN_REGULAR_RACE_VENUES = new Set(['longchamp'])

const raceNameKey = (name: string): string => name.trim().toLowerCase()

export function projectRaceCatalog(
  races: readonly RaceTemplate[],
  hidden: (race: RaceTemplate) => boolean,
  preferredRaceIds: ReadonlySet<string> = new Set(),
): RaceTemplate[] {
  const byName = new Map<string, RaceTemplate>()
  for (const race of races) {
    if (hidden(race)) continue
    const key = raceNameKey(race.name)
    const current = byName.get(key)
    const preferred = preferredRaceIds.has(race.id)
    const currentPreferred = current ? preferredRaceIds.has(current.id) : false
    if (!current || (preferred && !currentPreferred) ||
      (preferred === currentPreferred && race.id.localeCompare(current.id) < 0)) {
      byName.set(key, race)
    }
  }
  return [...byName.values()].sort((left, right) => left.id.localeCompare(right.id))
}

const hiddenFromRegularPlay = (race: RaceTemplate): boolean => {
  const key = raceNameKey(race.name)
  return HIDDEN_REGULAR_RACE_NAMES.has(key) || HIDDEN_REGULAR_RACE_VENUES.has(race.venue.trim().toLowerCase()) ||
    /\(story race use\)/i.test(race.name)
}

/** Goal generation keeps source variants and their family ids, but never chooses a row retired from regular play. */
export function careerRaceCatalog(races: readonly RaceTemplate[]): RaceTemplate[] {
  return races.filter((race) => !hiddenFromRegularPlay(race)).sort((left, right) => left.id.localeCompare(right.id))
}

/**
 * Presents one canonical row per ordinary race in Race Select. A frozen goal wins its name group; other
 * historical/course variants use the smallest stable content id.
 */
export function regularRaceCatalog(
  races: readonly RaceTemplate[],
  preferredRaceIds: readonly string[] = [],
): RaceTemplate[] {
  return projectRaceCatalog(careerRaceCatalog(races), () => false, new Set(preferredRaceIds))
}
