// CLI orchestration for T002's private image and atlas pipeline.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ContentAtlasKind } from '@racer/domain'
import { readFile } from 'node:fs/promises'
import { ART_FAMILIES, buildArtFamily, type ArtFamily, type BustCrop } from './art'
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

/** Optional private pins for busts the automatic crop misreads: `{ "<umaId>": { "cx": 0.5, "top": 0.02, "size": 0.6 } }`. */
async function readBustCrops(): Promise<Record<string, Partial<BustCrop>>> {
  let raw: string
  try {
    raw = await readFile(resolve(contentDir, 'overrides/bust-crops.json'), 'utf8')
  } catch {
    return {}
  }
  const parsed = JSON.parse(raw) as unknown
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('bust-crops.json must be an object')
  for (const [id, crop] of Object.entries(parsed as Record<string, unknown>)) {
    const values = crop as Record<string, unknown>
    if (typeof crop !== 'object' || crop === null || Object.keys(values).some((key) => !['cx', 'top', 'size'].includes(key)) ||
      Object.values(values).some((value) => typeof value !== 'number' || !(value >= 0 && value <= 1))) {
      throw new Error(`bust-crops.json has an invalid crop for ${id}`)
    }
  }
  return parsed as Record<string, Partial<BustCrop>>
}

async function buildArt(family: ArtFamily, icons: ImageSource[], refresh: boolean, bustCrops: Record<string, Partial<BustCrop>> = {}) {
  const built = await buildArtFamily(family, icons, {
    cacheDir,
    refresh,
    bustCrops,
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
  const atlasBuilds = [
    build('uma-icons', sources.umas, refresh),
    build('card-icons', sources.cards, refresh),
  ]
  // The crest atlas is skipped entirely when no override is authored, rather than written empty.
  if (sources.scenarios.length > 0) atlasBuilds.push(build('scenario-icons', sources.scenarios, refresh))
  const atlases = await Promise.all(atlasBuilds)
  let manifest = await writeAtlases({ contentDir, atlases })

  if (!skipArt) {
    // Art is large and per-entry, so it is written as individual files the app fetches on demand.
    const families = [
      await buildArt('uma-portrait', sources.umas, refresh),
      // Busts reuse the portrait sources just downloaded, so this pass is all cache hits.
      await buildArt('uma-bust', sources.umas, false, await readBustCrops()),
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
