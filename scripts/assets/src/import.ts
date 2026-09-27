// CLI orchestration for T002's private image and atlas pipeline.

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ContentAtlasKind } from '@racer/domain'
import { readFile } from 'node:fs/promises'
import { ART_FAMILIES, buildArtFamily, type ArtFamily, type BustCrop } from './art'
import { buildAtlas } from './atlas'
import { downloadImages, type ImageSource } from './download'
import { readAssetSources } from './read'
import { buildWikiFamily, readCostumes, selectWikiArt, stageWikiFiles, stagedWikiFiles, WIKI_FAMILIES } from './wiki'
import { writeArtFiles, writeAtlases } from './write'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const contentDir = resolve(repoRoot, 'content')
const cacheDir = resolve(repoRoot, 'scripts/assets/.cache')
const dataCacheDir = resolve(repoRoot, 'scripts/data/.cache')

async function build(kind: ContentAtlasKind, sources: readonly ImageSource[], refresh: boolean, optional = false) {
  const { images, failures } = await downloadImages(sources, { cacheDir, kind, refresh, concurrency: 8, optional })
  const hits = images.filter((image) => image.cacheHit).length
  console.log(`${kind}: ${images.length} sources (${hits} cache hits, ${images.length - hits} downloads)`)
  // An optional family skips what the source lacks; the app falls back to its own icon for those.
  if (failures.length > 0) console.warn(`  skipped ${failures.length}: ${failures.map((failure) => failure.id).join(', ')}`)
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

/**
 * T059's chibis, outfit stands and race faces, from the staged wiki files. `--source dir:<path>` stages the owner's
 * folder first; without it, whatever was staged before is used, and with nothing staged the families are left as they
 * are. `--dry-run` reports counts and gaps and writes nothing.
 */
async function buildWiki(umaCharas: { id: string; charaId: string }[], dryRun: boolean) {
  const flag = process.argv.indexOf('--source')
  const source = process.argv.find((arg) => arg.startsWith('--source='))?.slice('--source='.length) ??
    (flag === -1 ? undefined : process.argv[flag + 1])
  if (source !== undefined) {
    if (!source.startsWith('dir:')) throw new Error('--source takes dir:<path> (the wiki API needs the wiki\'s permission, T059)')
    const staged = await stageWikiFiles(resolve(source.slice(4).replace(/^~(?=\/)/, process.env.HOME ?? '~')), cacheDir)
    console.log(`wiki: staged ${staged.copied} new files, ${staged.kept} already cached`)
  }
  const files = await stagedWikiFiles(cacheDir)
  if (files.size === 0) {
    console.log('wiki: nothing staged; chibi, dress and face art left as they are (pass --source dir:<path>)')
    return null
  }
  const selection = selectWikiArt(files, umaCharas, await readCostumes(dataCacheDir))
  console.log(`wiki: ${selection.chibi.length} chibis, ${selection.dress.length} outfit stands, ${selection.face.length} race faces`)
  if (selection.missing.length > 0) console.warn(`  missing (the app falls back): ${selection.missing.join(', ')}`)
  if (dryRun) return null
  const families = []
  for (const family of ['chibi', 'dress', 'face'] as const) {
    const images = await buildWikiFamily(family, selection[family], cacheDir)
    console.log(`${family}: ${images.length} images, ${megabytes(images.reduce((sum, image) => sum + image.bytes.length, 0))}`)
    families.push({ dir: WIKI_FAMILIES[family].dir, images })
  }
  return families
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh')
  const skipArt = process.argv.includes('--icons-only')
  const dryRun = process.argv.includes('--dry-run')
  const sources = await readAssetSources(contentDir)
  // `--wiki-only` rebuilds T059's art alone, without fetching every icon and portrait again.
  if (process.argv.includes('--wiki-only') || dryRun) {
    const families = await buildWiki(sources.umaCharas, dryRun)
    if (families) console.log(`Manifest: ${(await writeArtFiles({ contentDir, families })).version}`)
    return
  }
  // D182's icon families: the original's card type icons (the app's stat icons) and its skill icons.
  const iconBuilds = () => [build('type-icons', sources.types, refresh), build('skill-icons', sources.skills, refresh, true)]
  // `--families=type-icons,skill-icons` rebuilds only those atlas families, leaving every other file as it is.
  const only = process.argv.find((value) => value.startsWith('--families='))?.split('=')[1]?.split(',')
  if (only) {
    const builds = iconBuilds().filter((_, index) => only.includes(['type-icons', 'skill-icons'][index]!))
    if (builds.length !== only.length) throw new Error('--families takes type-icons and/or skill-icons')
    const manifest = await writeAtlases({ contentDir, atlases: await Promise.all(builds) })
    console.log(`Manifest: ${manifest.version} (${manifest.files.length} files)`)
    return
  }
  const atlasBuilds = [
    build('uma-icons', sources.umas, refresh),
    build('card-icons', sources.cards, refresh),
    ...iconBuilds(),
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
    const wiki = await buildWiki(sources.umaCharas, false)
    if (wiki) manifest = await writeArtFiles({ contentDir, families: wiki })
  }

  console.log(`Manifest: ${manifest.version} (${manifest.files.length} files)`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
