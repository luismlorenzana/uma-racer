// Sharp-based image normalization and WebP atlas encoding for T002.

import type { ContentAtlasFrame } from '@racer/domain'
import sharp from 'sharp'
import type { DownloadedImage } from './download'
import { FRAME_SIZE, layoutFrames } from './layout'

sharp.cache(false)

export interface BuiltAtlasPage {
  bytes: Buffer
  width: number
  height: number
}

export interface BuiltAtlas {
  pages: BuiltAtlasPage[]
  frames: Record<string, ContentAtlasFrame>
}

async function normalizeFrame(bytes: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .resize(FRAME_SIZE, FRAME_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.width !== FRAME_SIZE || info.height !== FRAME_SIZE || info.channels !== 4) {
    throw new Error('Sharp returned an unexpected normalized frame')
  }
  return data
}

export async function buildAtlas(images: readonly DownloadedImage[]): Promise<BuiltAtlas> {
  const layout = layoutFrames(images.map((image) => image.id))
  const imageById = new Map(images.map((image) => [image.id, image]))
  const normalized = new Map<string, Buffer>()
  await Promise.all(
    [...imageById].map(async ([id, image]) => {
      try {
        normalized.set(id, await normalizeFrame(image.bytes))
      } catch (error) {
        throw new Error(`Failed to decode image ${id}: ${String(error)}`)
      }
    }),
  )

  const pages: BuiltAtlasPage[] = []
  for (let pageIndex = 0; pageIndex < layout.pages.length; pageIndex += 1) {
    const page = layout.pages[pageIndex]!
    const composites = page.ids.map((id) => {
      const frame = layout.frames[id]!
      return {
        input: normalized.get(id)!,
        raw: { width: FRAME_SIZE, height: FRAME_SIZE, channels: 4 as const },
        left: frame.x,
        top: frame.y,
      }
    })
    const bytes = await sharp({
      create: { width: page.width, height: page.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite(composites)
      .webp({ quality: 82, alphaQuality: 100, smartSubsample: true, effort: 4 })
      .toBuffer()
    pages.push({ bytes, width: page.width, height: page.height })
  }
  return { pages, frames: layout.frames }
}
