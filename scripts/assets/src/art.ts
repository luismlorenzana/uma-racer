// High-resolution private art: one WebP per entry, fetched on demand rather than atlased
// (docs/design/ux.md#albums). Atlases stay for the dense icon grids.

import sharp from 'sharp'
import { downloadImages, type DownloadFailure, type DownloadedImage, type ImageSource } from './download'

export type ArtFamily = 'uma-portrait' | 'card-art' | 'uma-bust'

export interface ArtFamilyConfig {
  family: ArtFamily
  /** Manifest directory, e.g. `art/uma`. */
  dir: string
  /** Longest edge after normalization. */
  maxSize: number
  quality: number
  /** Portraits keep their cut-out; card art is a full opaque illustration. */
  alpha: boolean
  /** The downloaded family it is made from; busts are cut from the portrait sources, never fetched twice. */
  source: 'uma-portrait' | 'card-art'
}

export const ART_FAMILIES: Record<ArtFamily, ArtFamilyConfig> = {
  'uma-portrait': { family: 'uma-portrait', dir: 'art/uma', maxSize: 512, quality: 82, alpha: true, source: 'uma-portrait' },
  'card-art': { family: 'card-art', dir: 'art/card', maxSize: 600, quality: 80, alpha: false, source: 'card-art' },
  // Head-and-shoulders tiles for Uma lists, like the original's Trainee Select (docs/design/ux.md#art-tiers).
  'uma-bust': { family: 'uma-bust', dir: 'art/bust', maxSize: 256, quality: 82, alpha: true, source: 'uma-portrait' },
}

/**
 * The packs already carry the icon URL for each entry, and the source hosts a larger image beside it:
 * the Uma icon lives under `/thumb/` with the 512 px portrait one directory up, and a card's square
 * icon has a `tex_`-prefixed full illustration. Deriving both keeps the data packs unchanged, and an
 * unexpected icon URL fails loudly here instead of silently importing nothing.
 */
export function deriveArtUrl(family: ArtFamily, iconUrl: string): string {
  if (ART_FAMILIES[family].source === 'uma-portrait') {
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

/** Where a bust sits in its portrait, as shares of the portrait's width (`cx`, `size`) and height (`top`). */
export interface BustCrop {
  cx: number
  top: number
  size: number
}

/** Busts start near the top so ears stay in, and take 60% of the frame: head and shoulders, as the original's tiles. */
export const BUST_DEFAULTS = { top: 0.02, size: 0.6 } as const
/** Rows where a stand portrait's face sits; arms and props mostly fall below it. */
const HEAD_BAND = [0.15, 0.4] as const

/**
 * The square to cut a bust from: centred on the horizontal centroid of opaque pixels in the head band, clamped inside
 * the portrait. `override` pins any part of it for the few portraits the centroid misreads.
 */
export function bustCrop(
  rgba: Uint8Array,
  width: number,
  height: number,
  override: Partial<BustCrop> = {},
): { left: number; top: number; size: number } {
  let sum = 0
  let count = 0
  for (let y = Math.round(height * HEAD_BAND[0]); y < Math.round(height * HEAD_BAND[1]); y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3]! > 128) {
        sum += x
        count += 1
      }
    }
  }
  const cx = override.cx !== undefined ? override.cx * width : count > 0 ? sum / count : width / 2
  const size = Math.round(Math.min(width, height) * (override.size ?? BUST_DEFAULTS.size))
  const left = Math.max(0, Math.min(width - size, Math.round(cx - size / 2)))
  const top = Math.max(0, Math.min(height - size, Math.round(height * (override.top ?? BUST_DEFAULTS.top))))
  return { left, top, size }
}

/** Cuts and encodes one bust from a portrait source. */
export async function encodeBust(config: ArtFamilyConfig, image: DownloadedImage, override?: Partial<BustCrop>): Promise<ArtImage> {
  const { data, info } = await sharp(image.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const box = bustCrop(data, info.width, info.height, override)
  const { data: bytes, info: encoded } = await sharp(image.bytes)
    .extract({ left: box.left, top: box.top, width: box.size, height: box.size })
    .resize({ width: config.maxSize, height: config.maxSize, withoutEnlargement: true })
    .webp({ quality: config.quality, alphaQuality: 90, effort: 5 })
    .toBuffer({ resolveWithObject: true })
  return { id: image.id, bytes, width: encoded.width, height: encoded.height }
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
  /** Bust crop pins by entry id (`content/overrides/bust-crops.json`). */
  bustCrops?: Readonly<Record<string, Partial<BustCrop>>>
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
    kind: config.source,
    refresh: options.refresh,
    concurrency: options.concurrency ?? 6,
    fetcher: options.fetcher,
    optional: true,
  })
  const images: ArtImage[] = []
  for (const image of downloaded.images) {
    images.push(config.family === 'uma-bust'
      ? await encodeBust(config, image, options.bustCrops?.[image.id])
      : await encodeArt(config, image))
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
