// Cheap discovery only. Filenames are NOT a playability/capability proof (docs/technical/puzzle-content.md).
import type { ContentManifest } from '@racer/domain'
export function hasPuzzleContentFiles(manifest: ContentManifest): boolean {
  return manifest.files.some(f => /^data\/puzzles-catalog\.[a-f0-9]{8}\.json$/.test(f.path)) &&
    manifest.files.some(f => /^data\/puzzles-cast\.[a-f0-9]{8}\.json$/.test(f.path))
}
