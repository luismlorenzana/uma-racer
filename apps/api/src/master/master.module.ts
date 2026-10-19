// SE1: use the already-published shared proxy, not another content controller (docs/game/architecture.md).
import { resolve } from 'node:path'
import { ReleaseProxyModule, PrivatePackModule, BucketFileSource, DirectoryFileSource, DirectoryReleaseSource } from '@luismlorenzana/uma-server/content'

export const OVERLAY_ALLOW = ['overlay.json', /^overlays\/racer\.[a-f0-9]{16}\.json$/] as const
export function masterOptions() {
  const cloud = process.env.CONTENT_SOURCE === 'gcs'
  return {
    master: cloud ? { bucket: process.env.MASTER_BUCKET ?? 'uma-platform-master-data' }
      : { dir: resolve(process.cwd(), process.env.MASTER_DIR ?? '../../../uma-platform/content/release') },
    overlay: cloud ? { bucket: process.env.CONTENT_BUCKET ?? 'uma-racer-content' }
      : { dir: resolve(process.cwd(), process.env.CONTENT_DIR ?? '../../content') },
  }
}
export function masterSources() {
  const { master, overlay } = masterOptions()
  return { master: master.bucket ? new BucketFileSource(master.bucket) : new DirectoryReleaseSource(master.dir!),
    overlay: overlay.bucket ? new BucketFileSource(overlay.bucket) : new DirectoryFileSource(overlay.dir!) }
}
// Called after ConfigModule.forRoot loads the local .env, not at module import time.
export function masterModules() {
  const { master, overlay } = masterOptions()
  return [ReleaseProxyModule.forRoot({ route: 'master', ...master }),
    PrivatePackModule.forRoot({ route: 'content', ...overlay, allow: OVERLAY_ALLOW })]
}
