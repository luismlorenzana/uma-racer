// How the shell moves (docs/game/11-hub-and-places.md §1, §2): every place is a link, so Back and the iPhone's edge
// swipe work everywhere. A Peek is `/:page?peek=:place` and a global sheet `?sheet=…` on the route it opens over, so
// Back closes either. An entry pushed from inside the app carries `back`, and leaving it pops history; a deep link
// replaces itself with where it would have come from.
import type { Place } from '@racer/domain/hub'
import { useCallback } from 'react'
import { useLocation, useNavigate, type Location } from 'react-router'

export interface G2NavState {
  /** Pushed from inside the app: leaving pops back to where it came from. */
  readonly back?: boolean
  /** Collect all's intent for the check-in sheet (T142); a reload never collects again. */
  readonly collect?: boolean
  /** The check-in sheet's Collect all, once it ran: its receipt is the summary's, on a reload too (T142). */
  readonly collectId?: string
  /** The check-in sheet's latest Repeat all, the same way (T142). */
  readonly repeatId?: string
}

export const GLOBAL_SHEETS = Object.freeze(['menu', 'featured', 'check-in'] as const)
export type GlobalSheet = (typeof GLOBAL_SHEETS)[number]

export const isGlobalSheet = (value: string | null): value is GlobalSheet => (GLOBAL_SHEETS as readonly string[]).includes(value ?? '')

export const peekPath = (place: Pick<Place, 'page' | 'id'>): string => `/${place.page}?peek=${encodeURIComponent(place.id)}`

/** The location with one search param set (or removed with null), path kept. */
export function withParam(location: Pick<Location, 'pathname' | 'search'>, key: string, value: string | null): string {
  const params = new URLSearchParams(location.search)
  if (value === null) params.delete(key)
  else params.set(key, value)
  const search = params.toString()
  return `${location.pathname}${search ? `?${search}` : ''}`
}

export const navState = (location: Pick<Location, 'state'>): G2NavState => (location.state as G2NavState | null) ?? {}

/** Leaves the current entry: back where it came from when the app pushed it, else to `fallback` in its place. */
export function useLeave(): (fallback: string) => void {
  const navigate = useNavigate()
  const location = useLocation()
  const pushed = navState(location).back === true
  return useCallback((fallback: string) => {
    if (pushed) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, pushed])
}
