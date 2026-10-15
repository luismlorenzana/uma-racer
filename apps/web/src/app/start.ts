// Where the app opens (docs/rework/11-hub-and-places.md §2.4): `/` decides once, at launch. A new account with no Umas
// opens the Stable's Locked tab; anything that needs a tap (02 §7) opens the Farm; otherwise the last page viewed on this
// device, or Town Hall the first time.
import { isHubPage, type HubPage } from '@racer/domain/hub'

export const LAST_PAGE_KEY = 'uma-racer:g2:lastPage'

export function lastPage(): HubPage | null {
  try {
    const value = globalThis.localStorage?.getItem(LAST_PAGE_KEY) ?? null
    return isHubPage(value) ? value : null
  } catch {
    return null
  }
}

/** Written on each page visit. */
export function rememberPage(page: HubPage): void {
  try {
    globalThis.localStorage?.setItem(LAST_PAGE_KEY, page)
  } catch {
    // The start rule then falls back to Town Hall.
  }
}

export function startPath(view: { readonly umas: number; readonly needsATap: number }, last: HubPage | null = lastPage()): string {
  if (view.umas === 0) return '/town/stable?tab=locked'
  if (view.needsATap > 0) return '/farm'
  return `/${last ?? 'town'}`
}
