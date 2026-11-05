// Where the app opens (docs/game/11-hub-and-places.md §2.4): `/` decides once, at launch: the last page viewed on this
// device, or Town Hall the first time.
import { isHubPage, type HubPage } from '@racer/domain/hub'
import { DEVICE_PREFIX } from './kit'

export const LAST_PAGE_KEY = `${DEVICE_PREFIX}lastPage`

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

export function startPath(last: HubPage | null = lastPage()): string {
  return `/${last ?? 'town'}`
}
