// Aggregate-only source freshness guard for the scenario ladder (docs/game/scenarios.md "Keeping the list current").

function releaseDateFromSeconds(value: unknown): string | null {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) return null
  const date = new Date((value as number) * 1_000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

/**
 * Returns an aggregate warning without retaining or printing source names, ids, or rows.
 * Future source scenarios do not count until their JP start date.
 */
export function scenarioCoverageWarning(
  source: unknown,
  modeledReleaseDates: readonly string[],
  today = new Date(),
): string | null {
  if (!Array.isArray(source)) throw new Error('GameTora scenarios dataset is not an array')
  if (Number.isNaN(today.getTime())) throw new Error('Scenario coverage date is invalid')
  const todayIso = today.toISOString().slice(0, 10)
  const sourceDates = source.map((row) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return null
    return releaseDateFromSeconds((row as Record<string, unknown>).start_ja)
  })
  if (sourceDates.some((date) => date === null)) throw new Error('GameTora scenarios dataset contains an invalid JP start date')

  const releasedSourceDates = (sourceDates as string[]).filter((date) => date <= todayIso).sort()
  const releasedModeledDates = modeledReleaseDates.filter((date) => date <= todayIso).sort()
  if (releasedSourceDates.length <= releasedModeledDates.length) return null
  const sourceThrough = releasedSourceDates.at(-1) ?? 'none'
  const modeledThrough = releasedModeledDates.at(-1) ?? 'none'
  return `Scenario ladder is behind: source has ${releasedSourceDates.length} JP releases through ${sourceThrough}; modeled ${releasedModeledDates.length} through ${modeledThrough}`
}
