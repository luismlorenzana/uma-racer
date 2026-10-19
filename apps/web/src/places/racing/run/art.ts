// Verified outfit busts for race playback (SB6; docs/game/racing.md). Pure playback art: no save or engine changes.
import type { ArtLoader } from '../../../content/view'

export function holdRaceBusts(art: ArtLoader, outfitIds: readonly string[]): { urls: Promise<(string | null)[]>; release: () => void } {
  const releases: (() => void)[] = []
  const requests = new Map<string, Promise<string | null>>()
  for (const id of new Set(outfitIds)) {
    if (!art.has('bust', id)) { requests.set(id, Promise.resolve(null)); continue }
    const release = art.hold?.('bust', id)
    if (release !== undefined) releases.push(release)
    requests.set(id, art.load('bust', id).catch(() => null))
  }
  let released = false
  return {
    urls: Promise.all(outfitIds.map((id) => requests.get(id)!)),
    release: () => { if (released) return; released = true; for (const release of releases) release() },
  }
}
