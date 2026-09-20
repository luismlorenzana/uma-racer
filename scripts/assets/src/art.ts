// High-resolution private art: one WebP per entry, fetched on demand rather than atlased
// (docs/design/collection.md#detail-panel). Atlases stay for the dense icon grids.

import sharp from 'sharp'
import { downloadImages, type DownloadFailure, type DownloadedImage, type ImageSource } from './download'

export type ArtFamily = 'uma-portrait' | 'card-art'

export interface ArtFamilyConfig {
  family: ArtFamily
  /** Manifest directory, e.g. `art/uma`. */
  dir: string
  /** Longest edge after normalization. */
  maxSize: number
  quality: number
  /** Portraits keep their cut-out; card art is a full opaque illustration. */
  alpha: boolean
}

export const ART_FAMILIES: Record<ArtFamily, ArtFamilyConfig> = {
  'uma-portrait': { family: 'uma-portrait', dir: 'art/uma', maxSize: 512, quality: 82, alpha: true },
  'card-art': { family: 'card-art', dir: 'art/card', maxSize: 600, quality: 80, alpha: false },
}

/**
 * The packs already carry the icon URL for each entry, and the source hosts a larger image beside it:
 * the Uma icon lives under `/thumb/` with the 512 px portrait one directory up, and a card's square
 * icon has a `tex_`-prefixed full illustration. Deriving both keeps the data packs unchanged, and an
 * unexpected icon URL fails loudly here instead of silently importing nothing.
 */
export function deriveArtUrl(family: ArtFamily, iconUrl: string): string {
  if (family === 'uma-portrait') {
    if (!iconUrl.includes('/thumb/')) throw new Error(`Unexpected Uma icon URL: ${iconUrl}`)
    return iconUrl.replace('/thumb/', '/')
  }
  const match = /^(.*\/)support_card_s_(\d+\.png)$/.exec(iconUrl)
  if (!match) throw new Error(`Unexpected card icon URL: ${iconUrl}`)
  return `${match[1]}tex_support_card_${match[2]}`
}

export const artSources = (family: ArtFamily, icons: readonly ImageSource[]): ImageSource[] =>
  icons.map((icon) => ({ id: icon.id, url: deriveArtUrl(family, icon.url) }))

export interface ArtImage {
  id: string
  bytes: Buffer
  width: number
  height: number
}

/** Normalizes one source image to the family's size and encoding without cropping it. */
export async function encodeArt(config: ArtFamilyConfig, image: DownloadedImage): Promise<ArtImage> {
  const pipeline = sharp(image.bytes)
    .resize({
      width: config.maxSize,
      height: config.maxSize,
      fit: 'inside',
      withoutEnlargement: true,
    })
  const encoded = config.alpha
    ? pipeline.webp({ quality: config.quality, alphaQuality: 90, effort: 5 })
    : pipeline.flatten({ background: '#ffffff' }).webp({ quality: config.quality, effort: 5 })
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true })
  return { id: image.id, bytes: data, width: info.width, height: info.height }
}

export interface BuildArtOptions {
  cacheDir: string
  refresh?: boolean
  concurrency?: number
  fetcher?: typeof fetch
  onProgress?: (done: number, total: number) => void
}

export interface BuiltArtFamily {
  config: ArtFamilyConfig
  images: ArtImage[]
  cacheHits: number
  bytes: number
  /** Entries whose source art does not exist; the app falls back to their icon. */
  skipped: DownloadFailure[]
}

export async function buildArtFamily(
  family: ArtFamily,
  icons: readonly ImageSource[],
  options: BuildArtOptions,
): Promise<BuiltArtFamily> {
  const config = ART_FAMILIES[family]
  const downloaded = await downloadImages(artSources(family, icons), {
    cacheDir: options.cacheDir,
    kind: config.family,
    refresh: options.refresh,
    concurrency: options.concurrency ?? 6,
    fetcher: options.fetcher,
    optional: true,
  })
  const images: ArtImage[] = []
  for (const image of downloaded.images) {
    images.push(await encodeArt(config, image))
    options.onProgress?.(images.length, downloaded.images.length)
  }
  return {
    config,
    images,
    cacheHits: downloaded.images.filter((image) => image.cacheHit).length,
    bytes: images.reduce((sum, image) => sum + image.bytes.length, 0),
    skipped: downloaded.failures,
  }
}
