// Real-content gate (docs/design/uma-rpg.md#phone-presentation); no manufactured campaign or save mutation.
import { assertProductionRpgPack, type RpgChapterPack } from '@racer/domain'
import { rpgContentLibrary, type RpgContentLibrary } from './rpg'
import { hasRpgReleaseFiles } from './rpg-manifest'
import type { LoadedContent } from './runtime'

export type RpgRelease = { status: 'ready'; pack: RpgChapterPack; chapterId: string } |
  { status: 'unavailable'; reason: string }
export async function verifyRpgRelease(content: LoadedContent, library: RpgContentLibrary = rpgContentLibrary(content)): Promise<RpgRelease> {
  if (!hasRpgReleaseFiles(content.manifest)) return { status: 'unavailable', reason: 'The private URA chapter has not been published in this content version.' }
  const pack = await library.load()
  if (!pack) return { status: 'unavailable', reason: 'The private campaign is unavailable. Your save is unchanged.' }
  assertProductionRpgPack(pack)
  const chapter = pack.chapters.find(c => c.scenarioId === 'ura-finale')
  if (!chapter) return { status: 'unavailable', reason: 'This campaign has no URA Finale opening chapter.' }
  const presentation = await library.presentation({ contentVersion: pack.version, contentHash: chapter.contentHash })
  const ids = new Set(chapter.nodes.flatMap(n => n.enemies))
  // Verify the actual portraits too, not just paths in a manifest. ArtLoader validates bytes/hashes.
  for (const id of ids) {
    const portrait = presentation.portraits[id]
    if (!portrait || !await content.art.load('priconne', portrait)) throw new Error('URA character portraits are unavailable. Retry when online; no substitute enemies will be used.')
  }
  return { status: 'ready', pack, chapterId: chapter.id }
}
