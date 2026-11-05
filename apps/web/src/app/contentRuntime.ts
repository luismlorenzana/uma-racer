// SE4: configure the shared runtime. Generation 3 keeps its snapshot under the `uma-racer:g3:` prefix (the g2 key is
// wiped with the rest, D381) and keeps the content cache's name, so verified bytes already on the phone are reused.
import { contentSnapshotStore, createContentRuntime, type ContentClientOptions, type ContentSnapshotStore } from '@luismlorenzana/uma-kit/content'
import { parseOverlayIndex } from '@racer/domain/master'
import { decodeJson, prepareRacerContent } from '../content/adapt'
import { ownerToken } from './auth'
import { DEVICE_PREFIX } from './kit'

export const MASTER_SNAPSHOT = `${DEVICE_PREFIX}master-release`
export const MASTER_CACHE = 'uma-racer-master-v1'
export const masterCacheKey = (hash: string): string => `https://uma-racer.invalid/master/${hash}`
export function createRacerContentRuntime(options: Partial<ContentClientOptions> & { store?: ContentSnapshotStore } = {}) {
  return createContentRuntime({
    base: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api`, token: ownerToken,
    cacheName: MASTER_CACHE, cacheKey: masterCacheKey,
    store: contentSnapshotStore(MASTER_SNAPSHOT), metadataKey: 'overlay',
    ...options,
    readMetadata: async (client) => parseOverlayIndex(decodeJson(await client.pack('overlay.json'))),
    parseMetadata: parseOverlayIndex, prepare: prepareRacerContent,
  })
}
export const contentRuntime = createRacerContentRuntime()
