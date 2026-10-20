import { hasBannedWord } from '@racer/domain/check-in'
import { describe, expect, it } from 'vitest'
import { ContentError as ApiError, ContentFallbackError } from '@luismlorenzana/uma-kit/content'
import { diagnoseContentError, diagnoseLoadedContent, EMPTY_BUCKET_CONTENT, SIGNED_OUT_CONTENT } from './diagnostics'
import type { LoadedContent } from './view'

describe('content diagnostics', () => {
  it('distinguishes signed out, denied, empty, and a missing published object', () => {
    expect(SIGNED_OUT_CONTENT.code).toBe('signed-out')
    expect(EMPTY_BUCKET_CONTENT.code).toBe('empty-bucket')
    expect(diagnoseContentError(new ApiError('/api/content/manifest', 403, 'Forbidden')).code).toBe('not-allow-listed')
    expect(diagnoseContentError(new ApiError('/api/content/files/data%2Fmissing.json', 404, 'Missing')).code).toBe('missing-object')
  })

  it('distinguishes corrupt bytes from a network failure, including a failed cached fallback', () => {
    expect(diagnoseContentError(new Error('Content hash mismatch: data/synthetic.json')).code).toBe('corrupt-bytes')
    expect(diagnoseContentError(new TypeError('Failed to fetch')).code).toBe('network-failure')
    expect(diagnoseContentError(new ApiError('overlay.json', 503))).toMatchObject({ code: 'network-failure', title: 'Can’t reach the game' })
    expect(diagnoseContentError(new ContentFallbackError(new TypeError('offline'), new Error('Content byte length mismatch'))).code)
      .toBe('corrupt-bytes')
  })

  it('keeps a verified offline fallback as a success state', () => {
    const content = { origin: 'offline-cache' } as LoadedContent
    expect(diagnoseLoadedContent(content)).toMatchObject({ code: 'offline-fallback', success: true })
  })

  it('calls verified network content current', () => {
    const content = { origin: 'network' } as LoadedContent
    expect(diagnoseLoadedContent(content)).toMatchObject({ code: 'ready', success: true, action: null })
  })

  it('says every sentence the session panel can show in plain words (02 §9)', () => {
    const shown = [
      SIGNED_OUT_CONTENT,
      EMPTY_BUCKET_CONTENT,
      diagnoseContentError(new ApiError('/api/content/manifest', 401, 'Unauthorized')),
      diagnoseContentError(new ApiError('/api/content/manifest', 403, 'Forbidden')),
      diagnoseContentError(new ApiError('/api/content/files/data%2Fmissing.json', 404, 'Missing')),
      diagnoseContentError(new Error('Content hash mismatch: data/synthetic.json')),
      diagnoseContentError(new ApiError('/api/content/manifest', 503, 'Unavailable')),
      diagnoseContentError(new TypeError('Failed to fetch')),
      diagnoseContentError(new Error('Something else')),
      diagnoseLoadedContent({ origin: 'offline-cache' } as LoadedContent),
      diagnoseLoadedContent({ origin: 'network' } as LoadedContent),
    ]
    expect(new Set(shown.map((diagnostic) => diagnostic.code)).size).toBe(8)
    const sentences = shown.flatMap((diagnostic) => [diagnostic.title, diagnostic.message, ...(diagnostic.action ? [diagnostic.action.label] : [])])
    for (const text of sentences) {
      expect(hasBannedWord(text), text).toBe(false)
      // Not on 02 §9's list, but the same kind of word: the content's plumbing.
      expect(text, text).not.toMatch(/manifest|bucket|object|verif|allow-?list/i)
    }
  })
})
