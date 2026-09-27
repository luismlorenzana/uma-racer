// User-facing content failure classification for release and offline recovery.

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
  | 'spark-rivals-fallback'
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
      message: 'Your private-content session expired. Sign in again; the local save stays untouched.',
      action: { kind: 'sign-out', label: 'Sign in again' },
    }
  }
  if (api?.status === 403) {
    return {
      code: 'not-allow-listed', success: false, title: 'Account not allow-listed',
      message: 'This Google account is signed in but is not on Uma Racer’s private allowlist.',
      action: { kind: 'sign-out', label: 'Switch account' },
    }
  }
  if (api?.status === 404 && api.path.includes('/api/content/files/')) {
    return {
      code: 'missing-object', success: false, title: 'Published content is incomplete',
      message: 'The manifest points to a private content object that is missing. The local save was not changed.',
      action: { kind: 'retry', label: 'Retry content' },
    }
  }
  if (CORRUPT_PATTERN.test(message)) {
    return {
      code: 'corrupt-bytes', success: false, title: 'Content integrity check failed',
      message: 'Downloaded content did not match its signed manifest. The local save was not changed.',
      action: { kind: 'retry', label: 'Download again' },
    }
  }
  if (api?.status && api.status >= 500 || NETWORK_PATTERN.test(message) || error instanceof TypeError) {
    return {
      code: 'network-failure', success: false, title: 'Content network unavailable',
      message: 'No complete verified content version could be loaded from the network or this device.',
      action: { kind: 'retry', label: 'Try again' },
    }
  }
  return {
    code: 'network-failure', success: false, title: 'Content unavailable',
    message: 'Private content could not be loaded. The local save was preserved.',
    action: { kind: 'retry', label: 'Try again' },
  }
}

export const SIGNED_OUT_CONTENT: ContentDiagnostic = {
  code: 'signed-out', success: false, title: 'Signed out',
  message: 'Sign in to load Uma Racer’s private content. Your local save is not cleared.',
  action: { kind: 'sign-in', label: 'Sign in' },
}

export const EMPTY_BUCKET_CONTENT: ContentDiagnostic = {
  code: 'empty-bucket', success: false, title: 'Private content is not published',
  message: 'The private bucket is reachable, but it does not contain an active content manifest.',
  action: { kind: 'retry', label: 'Check again' },
}

export function diagnoseLoadedContent(content: LoadedContent): ContentDiagnostic {
  if (content.origin === 'offline-cache') {
    return {
      code: 'offline-fallback', success: true, title: 'Verified offline content',
      message: 'Using the last complete verified content version stored on this device.',
      action: { kind: 'retry', label: 'Check for content' },
    }
  }
  if (content.sparkRivals === null) {
    return {
      code: 'spark-rivals-fallback', success: true, title: 'Spark rivals using catalogue fallback',
      message: 'The active private content predates the rival roster pack. Spark Match remains playable with a deterministic local lineup.',
      action: { kind: 'retry', label: 'Check for content' },
    }
  }
  return {
    code: 'ready', success: true, title: 'Content current',
    message: 'The active private content manifest and every loaded object passed verification.',
    action: null,
  }
}
