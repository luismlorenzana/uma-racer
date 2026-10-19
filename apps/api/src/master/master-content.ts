// Release/overlay reads for server operations; the pure adapter is the same one the device runs (SE1).
import { createHash } from 'node:crypto'
import { createReleaseClient, type ReleaseManifest } from '@luismlorenzana/uma-data'
import type { FileSource } from '@luismlorenzana/uma-server/content'
import { adaptMaster, parseOverlayIndex, parseRacerOverlays, type OverlayIndex } from '@racer/domain/master'

export interface MasterSnapshot { readonly manifest: ReleaseManifest; readonly overlay: OverlayIndex }
const json = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
async function required(source: FileSource, path: string): Promise<Uint8Array> {
  const bytes = await source.read(path)
  if (bytes === null) throw new Error('Required master content is missing')
  return bytes
}

export class MasterContent {
  private readonly client
  constructor(private readonly sources: { master: FileSource; overlay: FileSource }) {
    this.client = createReleaseClient({ source: { read: (path) => required(sources.master, path) } })
  }
  async snapshot(): Promise<MasterSnapshot> {
    const [manifest, raw] = await Promise.all([this.client.manifest(), required(this.sources.overlay, 'overlay.json')])
    return { manifest, overlay: parseOverlayIndex(json(raw)) }
  }
  async load(snapshot: MasterSnapshot) {
    const [master, bytes] = await Promise.all([this.client.load(snapshot.manifest.version), required(this.sources.overlay, snapshot.overlay.file.path)])
    const file = snapshot.overlay.file
    if (bytes.byteLength !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('Racer overlay hash mismatch')
    return adaptMaster(master.data, parseRacerOverlays(json(bytes))).content
  }
}
