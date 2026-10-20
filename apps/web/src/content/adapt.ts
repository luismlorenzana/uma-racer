// Game projection only (SE4): uma-kit owns transport, verified bytes, offline snapshots and URL lifetime.
import { MASTER_DATA_KEYS, SET_NAMES, type AtlasFamily, type MasterData, type ReleaseManifest } from '@luismlorenzana/uma-data'
import { imagePath, type ContentClient } from '@luismlorenzana/uma-kit/content'
import { adaptMaster, parseRacerOverlays, type OverlayIndex } from '@racer/domain/master'
import type { ContentAtlas, ContentAtlasKind } from '@racer/domain'
import type { ArtKind, LoadedAtlas, LoadedContent } from './view'

const ATLASES: Record<ContentAtlasKind, AtlasFamily> = { 'uma-icons': 'outfit-icons', 'card-icons': 'support-card-icons', 'scenario-icons': 'scenario-icons', 'skill-icons': 'skill-icons' }
const ART = { face: 'outfit-faces', bust: 'outfit-busts', chibi: 'outfit-chibis', uma: 'outfit-portraits', card: 'support-card-art', dress: 'character-dresses' } as const
const registry = <T extends { id: string }>(items: T[]) => ({ items: Object.freeze([...items]), byId: new Map(items.map((item) => [item.id, item])) })
export const decodeJson = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown

export async function prepareRacerContent(client: ContentClient, manifest: ReleaseManifest, overlay: OverlayIndex): Promise<LoadedContent> {
  const release = await client.release()
  const [sets, art, raw] = await Promise.all([
    Promise.all(SET_NAMES.map(async (name) => [MASTER_DATA_KEYS[name], await release.set(manifest, name)] as const)),
    release.art(manifest), client.pack(overlay.file.path, overlay.file),
  ])
  // uma-data's exhaustive registry and validators establish this shape; no private row parsing lives here.
  const master = Object.fromEntries(sets) as unknown as MasterData
  const adapted = adaptMaster(master, parseRacerOverlays(decodeJson(raw)))
  const atlas = async (kind: ContentAtlasKind): Promise<LoadedAtlas> => {
    const source = art?.atlases[ATLASES[kind]] ?? { frameWidth: 128, frameHeight: 128, frames: {}, pages: [] }
    const pageUrls = await Promise.all(source.pages.map((page) => {
      client.hold(page.path) // Boot atlases live for this content session, not an individual tile.
      return client.artUrl(page.path)
    }))
    const frames = Object.fromEntries(Object.entries(source.frames).map(([id, frame]) => {
      if (frame.width !== 128 || frame.height !== 128) throw new Error('Malformed master atlas frame')
      return [kind === 'scenario-icons' ? adapted.scenarioIds.get(id) ?? id : id, { ...frame, width: 128 as const, height: 128 as const }]
    }))
    const descriptor: ContentAtlas = { ...source, schemaVersion: 1, kind, frameWidth: 128, frameHeight: 128, frames }
    return { descriptor, pageUrls }
  }
  const [umas, cards, scenarios, skills] = await Promise.all([atlas('uma-icons'), atlas('card-icons'), atlas('scenario-icons'), atlas('skill-icons')])
  const path = (kind: ArtKind, id: string) => imagePath(art, ART[kind], id)
  return { manifest, origin: 'network',
    umas: registry(adapted.content.umas), cards: registry(adapted.content.cards), skills: registry(adapted.content.skills),
    races: registry(adapted.content.races), courses: registry(adapted.content.courses),
    atlases: { 'uma-icons': umas, 'card-icons': cards, 'scenario-icons': scenarios, 'skill-icons': skills },
    art: {
      has: (kind, id) => path(kind, id) !== null,
      load: (kind, id) => { const file = path(kind, id); return file === null ? Promise.resolve(null) : client.artUrl(file) },
      hold: (kind, id) => { const file = path(kind, id); return file === null ? () => {} : client.hold(file) },
    },
    shared: { client, index: art },
  }
}
