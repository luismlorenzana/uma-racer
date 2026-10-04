// Home metadata only; campaign JSON/art stay lazy (docs/design/uma-rpg.md#phone-presentation).
import type { ContentManifest } from '@racer/domain'
export function hasRpgReleaseFiles(manifest: ContentManifest): boolean {
  return manifest.files.some(f => /^data\/rpg-catalog\.[a-f0-9]{8}\.json$/.test(f.path)) &&
    manifest.files.some(f => /^data\/rpg-chapters\.[a-f0-9]{8}\.json$/.test(f.path))
}
