// User-facing content failure classification for release and offline recovery. Every title, message and button here
// can reach the session panel, so each is in plain words: none of 02 §9's banned words (`hasBannedWord`), and no
// plumbing such as the manifest or the bucket (docs/game/02-check-ins-and-notifications.md §9).

import { ApiError } from '../api/client'
import { ContentFallbackError } from './errors'
import type { LoadedContent } from './runtime'

export type ContentDiagnosticCode =
  | 'signed-out'
  | 'not-allow-listed'
  | 'empty-bucket'
  | 'missing-object'
  | 'corrupt-bytes'
  | 'network-failure'
  | 'offline-fallback'
  | 'ready'

export interface ContentDiagnostic {
  code: ContentDiagnosticCode
  success: boolean
  title: string
  message: string
  action: { kind: 'sign-in' | 'sign-out' | 'retry'; label: string } | null
}

const CORRUPT_PATTERN = /(?:byte length mismatch|hash mismatch|sha-256|manifest version|invalid json|unexpected content type|invalid webp|atlas .*mismatch|malformed)/i
const NETWORK_PATTERN = /(?:failed to fetch|network|offline|timed out|timeout|connection|unreachable|load failed)/i

function errors(value: unknown): unknown[] {
  if (value instanceof ContentFallbackError) return [value.fallbackError, value.networkError, value]
  return [value]
}

export function diagnoseContentError(error: unknown): ContentDiagnostic {
  const causes = errors(error)
  const api = causes.find((cause): cause is ApiError => cause instanceof ApiError)
  const message = causes.map(String).join(' ')
  if (api?.status === 401) {
    return {
      code: 'signed-out', success: false, title: 'Sign in again',
      message: 'You were signed out. Sign in again to keep playing; your progress on this phone is safe.',
      action: { kind: 'sign-out', label: 'Sign in again' },
    }
  }
  if (api?.status === 403) {
    return {
      code: 'not-allow-listed', success: false, title: 'This account can’t play',
      message: 'This Google account isn’t one that can play Uma Racer. Switch to the one that can.',
      action: { kind: 'sign-out', label: 'Switch account' },
    }
  }
  if (api?.status === 404 && api.path.includes('/api/content/files/')) {
    return {
      code: 'missing-object', success: false, title: 'The game’s content is incomplete',
      message: 'Part of the game’s content is missing online. Your progress on this phone is safe.',
      action: { kind: 'retry', label: 'Try again' },
    }
  }
  if (CORRUPT_PATTERN.test(message)) {
    return {
      code: 'corrupt-bytes', success: false, title: 'The download was damaged',
      message: 'Some of the game’s content didn’t arrive intact. Your progress on this phone is safe.',
      action: { kind: 'retry', label: 'Download again' },
    }
  }
  if (api?.status && api.status >= 500 || NETWORK_PATTERN.test(message) || error instanceof TypeError) {
    return {
      code: 'network-failure', success: false, title: 'Can’t reach the game',
      message: 'The game’s content couldn’t load, and this phone has no full copy yet. Check the connection and try again.',
      action: { kind: 'retry', label: 'Try again' },
    }
  }
  return {
    code: 'network-failure', success: false, title: 'The game couldn’t load',
    message: 'The game’s content couldn’t load. Your progress on this phone is safe.',
    action: { kind: 'retry', label: 'Try again' },
  }
}

export const SIGNED_OUT_CONTENT: ContentDiagnostic = {
  code: 'signed-out', success: false, title: 'Signed out',
  message: 'Sign in to play. Your progress on this phone stays.',
  action: { kind: 'sign-in', label: 'Sign in' },
}

export const EMPTY_BUCKET_CONTENT: ContentDiagnostic = {
  code: 'empty-bucket', success: false, title: 'Nothing to load yet',
  message: 'The game’s content isn’t online yet. Your progress on this phone is safe.',
  action: { kind: 'retry', label: 'Check again' },
}

export function diagnoseLoadedContent(content: LoadedContent): ContentDiagnostic {
  if (content.origin === 'offline-cache') {
    return {
      code: 'offline-fallback', success: true, title: 'Playing offline',
      message: 'Using the full copy of the game’s content kept on this phone.',
      action: { kind: 'retry', label: 'Check again' },
    }
  }
  return {
    code: 'ready', success: true, title: 'Content up to date',
    message: 'The game’s content is up to date and checked.',
    action: null,
  }
}
