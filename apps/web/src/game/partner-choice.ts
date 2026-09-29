// The partner cards last chosen for Friendship Training in each scenario, on this device (D199). Device-local and never
// synced: a run freezes its partners when it is reserved, so this only pre-fills the next start screen.

const STORAGE_KEY = 'uma-racer:ft-partners'

type Choices = Record<string, string[]>

function load(): Choices {
  try {
    const parsed: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, ids]) =>
      Array.isArray(ids) && ids.every((id) => typeof id === 'string'))) as Choices
  } catch {
    return {}
  }
}

/** The partners remembered for a scenario, unvalidated: the screen drops any no longer owned or eligible. */
export function rememberedPartners(tier: number): string[] {
  return load()[String(tier)] ?? []
}

export function rememberPartners(tier: number, partnerIds: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ ...load(), [String(tier)]: [...partnerIds] }))
  } catch {
    // A blocked store only means the next start screen offers the default partners again.
  }
}
