import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { diagnoseContentError, diagnoseLoadedContent, EMPTY_BUCKET_CONTENT, SIGNED_OUT_CONTENT } from './diagnostics'
import { ContentFallbackError } from './errors'
import type { LoadedContent } from './runtime'

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
})
