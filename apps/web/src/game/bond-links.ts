// Every way into the card minigame names the card, the scenario and where to come back to (M016, M020).

/** Only same-origin app paths are followed back, so a crafted link can never bounce the player off-site. */
export function safeReturnPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}

/**
 * Bond: a Friendship Training run for this card in this scenario (D177). An Uma, when named, only pre-fills the run's
 * partners with her card set there (D199); the run never depends on her.
 */
export function friendshipTrainingHref(options: { cardId: string; tier: number; umaId?: string | null; returnTo: string }): string {
  const params = new URLSearchParams({ tier: String(options.tier) })
  if (options.umaId) params.set('uma', options.umaId)
  params.set('return', options.returnTo)
  return `/minigames/friendship-training/${encodeURIComponent(options.cardId)}?${params.toString()}`
}
