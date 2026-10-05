// Campaign cast gate (D262): the private pack supplies names and portraits; chapters are generated in code.
// Never substitutes an invented cast for missing private content.
import { assertProductionRpgPack, type RpgCastMember } from '@racer/domain'
import { rpgContentLibrary, type RpgContentLibrary } from './rpg'
import { hasRpgReleaseFiles } from './rpg-manifest'
import type { LoadedContent } from './runtime'

export type RpgRelease = { status: 'ready'; cast: RpgCastMember[]; portraits: Record<string, string> } |
  { status: 'unavailable'; reason: string }

export async function verifyRpgRelease(content: LoadedContent, library: RpgContentLibrary = rpgContentLibrary(content)): Promise<RpgRelease> {
  if (!hasRpgReleaseFiles(content.manifest)) return { status: 'unavailable', reason: 'The private campaign cast has not been published in this content version.' }
  const pack = await library.load()
  if (!pack) return { status: 'unavailable', reason: 'The private campaign is unavailable. Your save is unchanged.' }
  // Only a pack with verified character sources may supply the cast.
  assertProductionRpgPack(pack)
  const presentation = await library.presentation({ contentVersion: pack.version, contentHash: pack.contentHash })
  const cast = new Map<string, RpgCastMember>()
  const portraits: Record<string, string> = {}
  for (const actor of pack.actors) {
    if (cast.has(actor.artKey)) continue
    cast.set(actor.artKey, { id: actor.artKey, name: actor.name })
    portraits[actor.artKey] = presentation.portraits[actor.id]!
  }
  // Verify the actual portraits, not just manifest paths. ArtLoader checks bytes and hashes.
  for (const art of Object.values(portraits)) {
    if (!art || !await content.art.load('priconne', art)) throw new Error('Campaign portraits are unavailable. Retry when online.')
  }
  return { status: 'ready', cast: [...cast.values()], portraits }
}
