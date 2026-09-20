// Structured content-load failures shared by the lazy runtime and startup diagnostics.

export class ContentFallbackError extends Error {
  constructor(
    readonly networkError: unknown,
    readonly fallbackError: unknown,
  ) {
    super(`Content unavailable: ${String(networkError)}; cached version failed: ${String(fallbackError)}`)
    this.name = 'ContentFallbackError'
  }
}
