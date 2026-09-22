// Every way into Bond Recall names the card, the scenario and where to come back to (M016).

/** Only same-origin app paths are followed back, so a crafted link can never bounce the player off-site. */
export function safeReturnPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}

export function bondRecallHref(options: { cardId: string; tier: number; umaId?: string | null; returnTo: string }): string {
  const params = new URLSearchParams({ tier: String(options.tier) })
  if (options.umaId) params.set('uma', options.umaId)
  params.set('return', options.returnTo)
  return `/minigames/bond-recall/${encodeURIComponent(options.cardId)}?${params.toString()}`
}
