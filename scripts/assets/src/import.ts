// CLI orchestration for T002's private image and atlas pipeline.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ContentAtlasKind } from '@racer/domain'
import { ART_FAMILIES, buildArtFamily, type ArtFamily } from './art'
import { buildAtlas } from './atlas'
import { downloadImages, type ImageSource } from './download'
import { readAssetSources } from './read'
import { writeArtFiles, writeAtlases } from './write'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const contentDir = resolve(repoRoot, 'content')
const cacheDir = resolve(repoRoot, 'scripts/assets/.cache')

async function build(kind: ContentAtlasKind, sources: ImageSource[], refresh: boolean) {
  const { images } = await downloadImages(sources, { cacheDir, kind, refresh, concurrency: 8 })
  const hits = images.filter((image) => image.cacheHit).length
  console.log(`${kind}: ${images.length} sources (${hits} cache hits, ${images.length - hits} downloads)`)
  const atlas = await buildAtlas(images)
  for (let index = 0; index < atlas.pages.length; index += 1) {
    const page = atlas.pages[index]!
    console.log(`  page ${index}: ${page.width}x${page.height}, ${page.bytes.length} bytes`)
  }
  return { kind, atlas }
}

const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`

async function buildArt(family: ArtFamily, icons: ImageSource[], refresh: boolean) {
  const built = await buildArtFamily(family, icons, {
    cacheDir,
    refresh,
    onProgress: (done, total) => {
      if (done === total || done % 50 === 0) process.stdout.write(`\r${family}: encoded ${done}/${total}`)
    },
  })
  process.stdout.write('\r')
  const downloads = built.images.length - built.cacheHits
  console.log(`${family}: ${built.images.length} images (${built.cacheHits} cache hits, ${downloads} downloads), ${megabytes(built.bytes)}`)
  if (built.skipped.length > 0) {
    console.warn(`  ${built.skipped.length} without source art (icon fallback): ${built.skipped.map((entry) => entry.id).join(', ')}`)
  }
  return { dir: built.config.dir, images: built.images }
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh')
  const skipArt = process.argv.includes('--icons-only')
  const sources = await readAssetSources(contentDir)
  const atlases = await Promise.all([
    build('uma-icons', sources.umas, refresh),
    build('card-icons', sources.cards, refresh),
  ])
  let manifest = await writeAtlases({ contentDir, atlases })

  if (!skipArt) {
    // Art is large and per-entry, so it is written as individual files the app fetches on demand.
    const families = [
      await buildArt('uma-portrait', sources.umas, refresh),
      await buildArt('card-art', sources.cards, refresh),
    ]
    manifest = await writeArtFiles({ contentDir, families })
  }

  console.log(`Manifest: ${manifest.version} (${manifest.files.length} files)`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
