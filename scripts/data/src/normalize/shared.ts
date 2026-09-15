export interface NormalizeResult<T> {
  items: T[]
  warnings: string[]
}

export type RawRecord = Record<string, unknown>

export function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** GameTora uses both arrays and id-keyed objects across its datasets. */
export function records(value: unknown): RawRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (isRecord(value)) return Object.values(value).filter(isRecord)
  return []
}

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function id(value: unknown): string | null {
  if (typeof value === 'string' && value) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

export function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(id).filter((value): value is string => value !== null)
}
