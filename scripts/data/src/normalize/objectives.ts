// Private career-objective normalization for deterministic scenario goals (docs/design/scenario-goals.md).

import type { RaceTemplate } from '@racer/domain'
import { id, isRecord, number as numberValue, records, type RawRecord } from './shared'

export interface ObjectiveNormalization {
  byCharacterId: ReadonlyMap<string, readonly string[]>
  counts: {
    rows: number
    malformedRows: number
    characters: number
    resolvedReferences: number
    unresolvedReferences: number
  }
  warnings: string[]
}

function orderedObjectives(row: RawRecord): RawRecord[] | null {
  if (!Array.isArray(row.objectives)) return null
  const parsed = row.objectives.filter(isRecord)
  if (parsed.length !== row.objectives.length || parsed.some((objective) =>
    numberValue(objective.order) === null ||
    (objective.races !== null && objective.races !== undefined &&
      (!Array.isArray(objective.races) || objective.races.some((race) => !isRecord(race)))))) {
    return null
  }
  return parsed
    .map((objective, index) => ({ objective, index, order: numberValue(objective.order)! }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map(({ objective }) => objective)
}

/** Keep only safe race-family references that still have a retained gameplay race. */
export function normalizeObjectiveFamilies(
  objectives: unknown,
  rawRaces: unknown,
  normalizedRaces: readonly RaceTemplate[],
): ObjectiveNormalization {
  const retainedFamilies = new Set(normalizedRaces.map((race) => race.familyId))
  const rawRaceFamilies = new Map<string, string>()
  for (const race of records(rawRaces)) {
    const nestedId = id(race.race_id)
    if (nestedId && /^\d+$/.test(nestedId)) rawRaceFamilies.set(nestedId, nestedId)
  }

  const byCharacterId = new Map<string, readonly string[]>()
  let malformedRows = 0
  let resolvedReferences = 0
  let unresolvedReferences = 0
  const rows = records(objectives)
  for (const row of rows) {
    const charaId = id(row.char_id)
    const ordered = orderedObjectives(row)
    if (!charaId || !/^\d+$/.test(charaId) || !ordered) {
      malformedRows += 1
      continue
    }
    const families: string[] = []
    const seen = new Set<string>()
    for (const objective of ordered) {
      for (const nested of records(objective.races)) {
        const nestedRaceId = id(nested.id)
        const familyId = nestedRaceId ? rawRaceFamilies.get(nestedRaceId) : undefined
        if (!familyId || !retainedFamilies.has(familyId)) {
          unresolvedReferences += 1
          continue
        }
        resolvedReferences += 1
        if (!seen.has(familyId)) {
          seen.add(familyId)
          families.push(familyId)
        }
      }
    }
    byCharacterId.set(charaId, families)
  }

  const warnings: string[] = []
  if (malformedRows > 0) warnings.push(`Objective metadata skipped ${malformedRows} malformed row(s)`)
  if (unresolvedReferences > 0) warnings.push(`Objective metadata left ${unresolvedReferences} race reference(s) unresolved`)
  return {
    byCharacterId,
    counts: { rows: rows.length, malformedRows, characters: byCharacterId.size, resolvedReferences, unresolvedReferences },
    warnings,
  }
}
