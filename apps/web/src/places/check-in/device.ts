// What this device remembers about the check-in sheet (docs/rework/02-check-ins-and-notifications.md §10; T142), in
// `uma-racer:g2:` keys, each read and written in try/catch so a blocked storage only forgets: when it last showed the
// summary (`since`, written when the sheet closes), and which sections are collapsed. Never synced.
import { SUMMARY_SECTIONS, type SummarySectionKind } from '@racer/domain/check-in'

export const SHOWN_AT_KEY = 'uma-racer:g2:check-in:shown-at'
export const COLLAPSED_KEY = 'uma-racer:g2:check-in:collapsed'

/** The summary's sections plus the sheet's own Repeated block, which a device can collapse. */
export type SheetSection = SummarySectionKind | 'repeated'
const SECTIONS: readonly SheetSection[] = [...SUMMARY_SECTIONS, 'repeated']

/** When this device last showed the summary, or null the first time. */
export function readShownAt(): number | null {
  try {
    const value = globalThis.localStorage?.getItem(SHOWN_AT_KEY) ?? null
    const at = value === null ? NaN : Number(value)
    return Number.isSafeInteger(at) && at >= 0 ? at : null
  } catch {
    return null
  }
}

export function writeShownAt(at: number): void {
  try {
    globalThis.localStorage?.setItem(SHOWN_AT_KEY, String(Math.round(at)))
  } catch {
    // The next sheet then reads "since" from the last time it could.
  }
}

export function readCollapsed(): ReadonlySet<SheetSection> {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(COLLAPSED_KEY) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((kind): kind is SheetSection => SECTIONS.includes(kind as SheetSection)) : [])
  } catch {
    return new Set()
  }
}

export function writeCollapsed(collapsed: ReadonlySet<SheetSection>): void {
  try {
    globalThis.localStorage?.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]))
  } catch {
    // Collapsed sections then open again next time.
  }
}
