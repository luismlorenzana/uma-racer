// Where the app opens (docs/game/11-hub-and-places.md §2.4): `/` decides once, at launch: the career page last viewed
// on this device while that career still runs (D387), else the last page viewed, or Town Hall the first time.
import { isHubPage, type HubPage } from '@racer/domain/hub'
import { careerPath } from '../hub/nav'
import { DEVICE_PREFIX } from './kit'

export const LAST_PAGE_KEY = `${DEVICE_PREFIX}lastPage`
/** The career whose page (or play, or race) was viewed last; cleared on any other screen. */
export const LAST_CAREER_KEY = `${DEVICE_PREFIX}lastCareer`

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

export function lastCareer(): string | null {
  try {
    return globalThis.localStorage?.getItem(LAST_CAREER_KEY) ?? null
  } catch {
    return null
  }
}

/** Written on each visit: the career on screen, or null anywhere else. */
export function rememberCareer(careerId: string | null): void {
  try {
    if (careerId === null) globalThis.localStorage?.removeItem(LAST_CAREER_KEY)
    else globalThis.localStorage?.setItem(LAST_CAREER_KEY, careerId)
  } catch {
    // The start rule then opens the last page.
  }
}

/**
 * The path `/` opens: the last career viewed when `running` says it still runs, else the last page, else Town Hall. A
 * stage left mid-play resumes from the career page's Play, through the stage host's journal.
 */
export function startPath(last: HubPage | null = lastPage(), career: string | null = lastCareer(), running: (careerId: string) => boolean = () => false): string {
  if (career !== null && running(career)) return careerPath(career)
  return `/${last ?? 'town'}`
}
