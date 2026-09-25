// Firestore cannot hold an array directly inside another array: it rejects the write with INVALID_ARGUMENT, "invalid
// nested entity". A compiled skill's condition is exactly that shape (alternatives, each a list of clauses), and race
// records carry every runner's skills. So a record whose data has a nested array is stored with its data as JSON text;
// every other record is stored as it always was, and documents written before this read unchanged (D151).

/** True if any array anywhere in `value` directly contains another array. */
export function hasNestedArray(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => Array.isArray(item) || hasNestedArray(item))
  if (value !== null && typeof value === 'object') return Object.values(value).some(hasNestedArray)
  return false
}

/** The document to write for a record: `data` as is, or as `dataJson` when Firestore could not store it. */
export function toStored<T extends { data: unknown }>(record: T): Record<string, unknown> {
  if (!hasNestedArray(record.data)) return { ...record }
  const { data, ...rest } = record
  return { ...rest, dataJson: JSON.stringify(data) }
}

/** The record a stored document holds, whichever way its data was written. */
export function fromStored<T extends { data: unknown }>(doc: Record<string, unknown>): T {
  if (typeof doc.dataJson !== 'string') return doc as T
  const { dataJson, ...rest } = doc
  return { ...rest, data: JSON.parse(dataJson) } as T
}
