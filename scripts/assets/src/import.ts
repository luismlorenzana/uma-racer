// CLI orchestration for T002's private image and atlas pipeline.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ContentAtlasKind } from '@racer/domain'
import { buildAtlas } from './atlas'
import { downloadImages, type ImageSource } from './download'
import { readAssetSources } from './read'
import { writeAtlases } from './write'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const contentDir = resolve(repoRoot, 'content')
const cacheDir = resolve(repoRoot, 'scripts/assets/.cache')

async function build(kind: ContentAtlasKind, sources: ImageSource[], refresh: boolean) {
  const downloaded = await downloadImages(sources, { cacheDir, kind, refresh, concurrency: 8 })
  const hits = downloaded.filter((image) => image.cacheHit).length
  console.log(`${kind}: ${downloaded.length} sources (${hits} cache hits, ${downloaded.length - hits} downloads)`)
  const atlas = await buildAtlas(downloaded)
  for (let index = 0; index < atlas.pages.length; index += 1) {
    const page = atlas.pages[index]!
    console.log(`  page ${index}: ${page.width}x${page.height}, ${page.bytes.length} bytes`)
  }
  return { kind, atlas }
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh')
  const sources = await readAssetSources(contentDir)
  const atlases = await Promise.all([
    build('uma-icons', sources.umas, refresh),
    build('card-icons', sources.cards, refresh),
  ])
  const manifest = await writeAtlases({ contentDir, atlases })
  console.log(`Manifest: ${manifest.version} (${manifest.files.length} files)`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
