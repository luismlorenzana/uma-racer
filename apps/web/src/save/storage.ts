// Optional browser storage; a blocked store must never prevent the save opening.
export function browserStorage(): Storage | null {
  try { return globalThis.localStorage ?? null } catch { return null }
}
