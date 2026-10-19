// Local-only tooling over the published release (SE1). No GameTora downloads; nothing here reads an owner save.
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { createReleaseClient } from '@luismlorenzana/uma-data'
import { adaptMaster, parseRacerOverlays, type RacerOverlays } from '@racer/domain/master'

export const ROOT = resolve(import.meta.dirname, '../../..')
export const CONTENT = resolve(ROOT, 'content')
export const MASTER = resolve(process.env.MASTER_DIR ?? resolve(ROOT, '../uma-platform/content/release'))
export function localRelease(dir = MASTER) {
  return createReleaseClient({ source: { read: async (path) => {
    if (path.startsWith('channels/') || path.startsWith('manifests/')) {
      const manifest = JSON.parse(await readFile(resolve(dir, 'manifest.json'), 'utf8')) as { version: string; schemaMajor: number; createdAt: string }
      const value = path.startsWith('channels/') ? { schemaMajor: manifest.schemaMajor, channel: 'latest', version: manifest.version,
        manifest: `manifests/v1/${manifest.version}.json`, updatedAt: manifest.createdAt } : manifest
      return new TextEncoder().encode(JSON.stringify(value))
    }
    const full = resolve(dir, path.startsWith('files/') ? path.slice(6) : path)
    if (!full.startsWith(resolve(dir) + sep)) throw new Error('Invalid release path')
    return new Uint8Array(await readFile(full))
  } } })
}
export async function authoringOverlay(dir = CONTENT): Promise<RacerOverlays> {
  const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(resolve(dir, 'overrides', path), 'utf8')) as unknown
  const [flair, cardFocus] = await Promise.all([json('flair.json'), json('card-focus.json')])
  return parseRacerOverlays({ schema: 1, flair, cardFocus })
}
export async function localContent(masterDir = MASTER, contentDir = CONTENT) {
  const master = await localRelease(masterDir).load()
  return { master, ...adaptMaster(master.data, await authoringOverlay(contentDir)) }
}
